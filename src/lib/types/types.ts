/**
 * Video information returned by providers
 */
export interface IVideoInfo {
  /** Title of the video/episode */
  title: string;
  
  /** Original URL of the video */
  url: string;
  
  /** Duration in seconds (optional) */
  duration?: number;
  
  /** URL to thumbnail/preview image (optional) */
  thumbnail?: string;
  
  /** Video quality information (e.g., "1080p", "720p") (optional) */
  quality?: string;
}

/**
 * Options for downloading videos
 */
export interface IDownloadOptions {
  /**
   * Video language
   */
  language?: string;

  /** 
   * Video quality to download (e.g., "best", "1080p", "720p")
   * If not specified, downloads best available quality
   */
  quality?: string;
  
  /** 
   * Output format for the downloaded file
   * @default 'mp4'
   */
  format?: 'mp4' | 'mkv' | 'mp3';
  
  /** 
   * Custom output directory path
   * Overrides the default output directory
   */
  outputPath?: string;
  
  /** 
   * Custom filename for the downloaded file
   * Can include yt-dlp template variables like %(title)s
   * If not specified, uses default naming convention
   */
  filename?: string;
  
  /**
   * Provider name to use for downloading
   * Particularly for AniworldDownloader: Specifies which video host to use (e.g., 'voe', 'vidoza')
   * If not specified, uses the default provider
   */
  provider?: string;
}

/**
 * Base interface that all downloader classes must implement
 */
export interface IDownloader {
  /**
   * Download a video from the given URL
   * @param url - The URL to download from
   * @param options - Optional download configuration
   * @returns Promise resolving to the path of the downloaded file
   */
  download(url: string, options?: IDownloadOptions): Promise<string>;
  
  /**
   * Get video information without downloading
   * @param url - The URL to get information from
   * @returns Promise resolving to video information
   */
  getVideoInfo(url: string): Promise<IVideoInfo>;
}

/**
 * Information about an anime episode parsed from URL
 */
export interface AniworldEpisodeInfo {
  /** Anime title (e.g., "horimiya") */
  title: string;
  
  /** Season number */
  season: number;
  
  /** Episode number */
  episode: number;
}

/**
 * Video provider interface for extracting direct video links
 * Used by AniworldDownloader to support multiple video hosts
 * 
 * @example
 * ```typescript
 * const voeProvider: VideoProvider = {
 *   name: 'voe',
 *   extractDirectLink: async (embedUrl) => {
 *     // Extract direct video link from VOE embed page
 *     return 'https://direct-video-url.mp4';
 *   },
 *   extractPreviewImage: async (embedUrl) => {
 *     // Optional: Extract preview/thumbnail image
 *     return 'https://thumbnail-url.jpg';
 *   }
 * };
 * ```
 */
export interface VideoProvider {
  /** 
   * Provider name (e.g., 'voe', 'vidoza', 'streamtape')
   * Used to identify and select the provider
   */
  name: string;
  
  /**
   * Extract direct video download link from embed page
   * @param embedUrl - The embed page URL (e.g., https://voe.sx/e/abc123)
   * @returns Promise resolving to direct video URL
   */
  extractDirectLink(embedUrl: string): Promise<string>;
  
  /**
   * Extract preview/thumbnail image from embed page (optional)
   * @param embedUrl - The embed page URL
   * @returns Promise resolving to image URL
   */
  extractPreviewImage?(embedUrl: string): Promise<string>;
}

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'success' | 'error' | 'warning';
  message: string;
}