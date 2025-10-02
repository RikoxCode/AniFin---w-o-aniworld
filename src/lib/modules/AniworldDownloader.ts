import axios from 'axios';
import { BaseDownloader } from './BaseDownloader';
import { IDownloadOptions, IVideoInfo, AniworldEpisodeInfo, VideoProvider } from '../types/types';
import path from 'path';
import fs from 'fs';
import { VoeProvider } from '../providers/VoeProvider';
import { ConfigModule } from './ConfigModule';

export class AniworldDownloader extends BaseDownloader {
    private ytDlpBinary: string;
    private providers: Map<string, VideoProvider>;
    private defaultProvider: string;

    constructor(configModule: ConfigModule, providers: VideoProvider[] = [], defaultProvider?: string) {
        super(configModule);
        this.ytDlpBinary = 'yt-dlp';
        this.providers = new Map();

        // Register all providers
        for (const provider of providers) {
            this.providers.set(provider.name.toLowerCase(), provider);
        }

        // Set default provider
        this.defaultProvider = defaultProvider?.toLowerCase() || providers[0]?.name.toLowerCase() || '';

        if (!this.defaultProvider && providers.length === 0) {
            throw new Error('At least one provider must be registered');
        }
    }

    /**
     * Register a new provider
     */
    public registerProvider(provider: VideoProvider): void {
        this.providers.set(provider.name.toLowerCase(), provider);
        if (!this.defaultProvider) {
            this.defaultProvider = provider.name.toLowerCase();
        }
    }

    /**
     * Set default provider
     */
    public setDefaultProvider(providerName: string): void {
        const name = providerName.toLowerCase();
        if (!this.providers.has(name)) {
            throw new Error(`Provider '${providerName}' not found`);
        }
        this.defaultProvider = name;
    }

    /**
     * Execute yt-dlp command
     */
    private async executeYtDlp(args: string[]): Promise<void> {
        const { spawn } = require('child_process');

        args.push('--concurrent-fragments', '8');
        args.push('--newline');

        return new Promise((resolve, reject) => {
            const process = spawn(this.ytDlpBinary, args);

            process.stdout.on('data', (data: Buffer) => {
                const output = data.toString().trim();
                if (output) {
                    if (output.includes('[download]')) {
                        this.log(output, 'info');
                    } else if (output.includes('Merger')) {
                        this.log('Merging fragments...', 'info');
                    }
                }
            });

            process.stderr.on('data', (data: Buffer) => {
                const error = data.toString().trim();
                if (error) {
                    this.log(error, 'warning');
                }
            });

            process.on('close', (code: number) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`yt-dlp exited with code ${code}`));
                }
            });

            process.on('error', (error: Error) => {
                reject(new Error(`Failed to start yt-dlp: ${error.message}`));
            });
        });
    }

    /**
     * Extract anime name from URL
     */
    private extractAnimeName(url: string): string {
        const match = url.match(/\/anime\/stream\/([^/]+)/);
        if (!match) {
            throw new Error('Invalid anime URL');
        }
        return match[1].replace(/-/g, ' ');
    }

    /**
     * Parse episode URL to get info
     */
    private parseEpisodeUrl(url: string): AniworldEpisodeInfo {
        const match = url.match(/\/anime\/stream\/([^/]+)\/staffel-(\d+)\/episode-(\d+)/);
        if (!match) {
            throw new Error('Invalid episode URL');
        }

        return {
            title: match[1].replace(/-/g, ' '),
            season: parseInt(match[2]),
            episode: parseInt(match[3])
        };
    }

    /**
     * Create anime directory
     */
    private createAnimeDirectory(animeName: string): string {
        const animeDir = path.join(this.outputDir, animeName);
        if (!fs.existsSync(animeDir)) {
            fs.mkdirSync(animeDir, { recursive: true });
        }
        return animeDir;
    }

    /**
     * Extract provider embed URL from episode page
     */
    /**
 * Extract provider embed URL from episode page
 */
    private async extractProviderUrl(
        episodeUrl: string,
        providerName?: string,
        language?: string
    ): Promise<{ url: string, provider: VideoProvider }> {
        const response = await axios.get(episodeUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 30000
        });

        const html = response.data;
        const baseUrl = episodeUrl.match(/https?:\/\/[^/]+/)?.[0] || 'https://aniworld.to';

        const targetProvider = providerName?.toLowerCase() || this.defaultProvider;
        const provider = this.providers.get(targetProvider);

        if (!provider) {
            throw new Error(`Provider '${targetProvider}' not found`);
        }

        // Determine language to search for
        const targetLanguage = language || this.configModule.getAppConfig().defaultLanguage;
        const fallbackLanguage = this.configModule.getAppConfig().fallbackLanguage;

        this.log(`Looking for ${provider.name} with language: ${targetLanguage}`, 'info');

        // Language mapping for Aniworld
        const languageMap: Record<string, number> = {
            'German Dub': 1,
            'German Sub': 2,
            'English Sub': 3
        };

        const langCode = languageMap[targetLanguage];
        if (!langCode) {
            throw new Error(`Unknown language: ${targetLanguage}`);
        }

        // Try to find language-specific link
        // Aniworld uses data-lang-key attributes for language selection
        const langPattern = new RegExp(
            `data-lang-key="${langCode}"[^>]*href="([^"]*\\/redirect\\/[^"]*)"`,
            'i'
        );

        let redirectMatch = html.match(langPattern);

        // If not found, try fallback language
        if (!redirectMatch && fallbackLanguage) {
            const fallbackCode = languageMap[fallbackLanguage];
            this.log(`Language ${targetLanguage} not found, trying fallback: ${fallbackLanguage}`, 'warning');

            const fallbackPattern = new RegExp(
                `data-lang-key="${fallbackCode}"[^>]*href="([^"]*\\/redirect\\/[^"]*)"`,
                'i'
            );
            redirectMatch = html.match(fallbackPattern);
        }

        // Generic redirect fallback
        if (!redirectMatch) {
            redirectMatch = html.match(/href="([^"]*\/redirect\/[^"]*)"/i);
        }

        if (redirectMatch) {
            let redirectUrl = redirectMatch[1];
            if (redirectUrl.startsWith('/')) {
                redirectUrl = baseUrl + redirectUrl;
            }

            this.log(`Following redirect: ${redirectUrl}`, 'info');

            const redirectResponse = await axios.get(redirectUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': episodeUrl
                },
                timeout: 30000,
                maxRedirects: 5
            });

            const finalUrl = redirectResponse.request?.res?.responseUrl;
            if (finalUrl && finalUrl.toLowerCase().includes(provider.name.toLowerCase())) {
                this.log(`Found ${provider.name} URL: ${finalUrl}`, 'success');
                return { url: finalUrl, provider };
            }
        }

        throw new Error(`${provider.name} URL not found for language: ${targetLanguage}`);
    }

    /**
     * Get all seasons for anime
     */
    private async getSeasons(animeUrl: string): Promise<number[]> {
        const response = await axios.get(animeUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 30000
        });

        const seasons = new Set<number>();
        const matches = response.data.matchAll(/staffel-(\d+)/g);

        for (const match of matches) {
            seasons.add(parseInt(match[1]));
        }

        return Array.from(seasons).sort((a, b) => a - b);
    }

    /**
     * Get all episodes for a season
     */
    private async getEpisodes(animeUrl: string, season: number): Promise<number[]> {
        const seasonUrl = `${animeUrl}/staffel-${season}`;
        const response = await axios.get(seasonUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 30000
        });

        const episodes = new Set<number>();
        const matches = response.data.matchAll(/episode-(\d+)/g);

        for (const match of matches) {
            episodes.add(parseInt(match[1]));
        }

        return Array.from(episodes).sort((a, b) => a - b);
    }

    private async downloadSingleEpisode(
        episodeUrl: string,
        providerName?: string,
        language?: string,
        autoUploadAfterwards: boolean = true
    ): Promise<string> {
        this.log(`Processing: ${episodeUrl}`, 'info');

        const episodeInfo = this.parseEpisodeUrl(episodeUrl);
        const lang = language || this.configModule.getAppConfig().defaultLanguage;
        this.log(`Downloading: ${episodeInfo.title} S${episodeInfo.season}E${episodeInfo.episode} [${lang}]`, 'info');

        const animeDir = this.createAnimeDirectory(episodeInfo.title);
        const { url: embedUrl, provider } = await this.extractProviderUrl(episodeUrl, providerName, lang);
        const directLink = await provider.extractDirectLink(embedUrl);

        const filename = `${episodeInfo.title} - S${String(episodeInfo.season).padStart(2, '0')}E${String(episodeInfo.episode).padStart(2, '0')} - (${language}).mp4`;
        const outputPath = path.join(animeDir, filename);

        await this.executeYtDlp([
            directLink,
            '-o', outputPath,
            '--no-playlist'
        ]);

        this.log(`Completed: ${filename}`, 'success');

        if (autoUploadAfterwards) {
            await this.upload(animeDir);
        }

        return outputPath;
    }

    async download(url: string, options: IDownloadOptions = {}): Promise<string> {
        url = url.replace(/\/$/, '');
        const providerName = options.provider || 'voe';
        const language = options.language || this.configModule.getAppConfig().defaultLanguage;

        // Single episode
        if (url.match(/\/staffel-\d+\/episode-\d+$/)) {
            return await this.downloadSingleEpisode(url, providerName, language);
        }

        // Whole season
        const seasonMatch = url.match(/\/staffel-(\d+)$/);
        if (seasonMatch) {
            const season = parseInt(seasonMatch[1]);
            const baseUrl = url.replace(/\/staffel-\d+$/, '');
            const animeName = this.extractAnimeName(baseUrl);
            const animeDir = this.createAnimeDirectory(animeName);

            this.log(`Downloading season ${season} [${language}]...`, 'info');
            const episodes = await this.getEpisodes(baseUrl, season);
            this.log(`Found ${episodes.length} episodes`, 'info');

            for (const episode of episodes) {
                try {
                    await this.downloadSingleEpisode(
                        `${baseUrl}/staffel-${season}/episode-${episode}`,
                        providerName,
                        language,
                        false
                    );
                } catch (error) {
                    this.log(`Failed episode ${episode}: ${error}`, 'error');
                }
            }

            this.log(`Season ${season} completed!`, 'success');
            await this.upload(animeDir);
            return animeDir;
        }

        // Whole anime
        const animeName = this.extractAnimeName(url);
        const animeDir = this.createAnimeDirectory(animeName);

        this.log(`Downloading entire anime: ${animeName} [${language}]`, 'info');
        const seasons = await this.getSeasons(url);
        this.log(`Found ${seasons.length} seasons`, 'info');

        for (const season of seasons) {
            this.log(`Season ${season}`, 'info');
            const episodes = await this.getEpisodes(url, season);
            this.log(`Found ${episodes.length} episodes`, 'info');

            for (const episode of episodes) {
                try {
                    await this.downloadSingleEpisode(
                        `${url}/staffel-${season}/episode-${episode}`,
                        providerName,
                        language,
                        false
                    );
                } catch (error) {
                    this.log(`Failed S${season}E${episode}: ${error}`, 'error');
                }
            }
        }

        this.log('Download completed!', 'success');
        await this.upload(animeDir);
        return animeDir;
    }

    async getVideoInfo(url: string, providerName?: string): Promise<IVideoInfo> {
        const episodeInfo = this.parseEpisodeUrl(url);
        const { url: embedUrl, provider } = await this.extractProviderUrl(url, providerName);

        let thumbnail: string | undefined;
        if (provider.extractPreviewImage) {
            thumbnail = await provider.extractPreviewImage(embedUrl).catch(() => undefined);
        }

        return {
            title: `${episodeInfo.title} S${episodeInfo.season}E${episodeInfo.episode}`,
            url: url,
            thumbnail
        };
    }
}