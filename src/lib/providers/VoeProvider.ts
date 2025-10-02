import axios from 'axios';

interface VoeDecoded {
  source?: string;
  [key: string]: any;
}

export class VoeProvider {
  private static readonly JUNK_PARTS = ['@$', '^^', '~@', '%?', '*~', '!!', '#&'];
  private static readonly REDIRECT_PATTERN = /https?:\/\/[^'"<>]+/;
  private static readonly B64_PATTERN = /var a168c='([^']+)'/;
  private static readonly HLS_PATTERN = /'hls': '(?<hls>[^']+)'/;

  /**
   * Apply ROT13 cipher to alphabetic characters
   */
  private static shiftLetters(input: string): string {
    let result = '';
    for (const char of input) {
      const code = char.charCodeAt(0);
      let newCode = code;

      if (code >= 65 && code <= 90) {
        // Uppercase A-Z
        newCode = ((code - 65 + 13) % 26) + 65;
      } else if (code >= 97 && code <= 122) {
        // Lowercase a-z
        newCode = ((code - 97 + 13) % 26) + 97;
      }

      result += String.fromCharCode(newCode);
    }
    return result;
  }

  /**
   * Replace junk patterns with underscores
   */
  private static replaceJunk(input: string): string {
    let result = input;
    for (const part of this.JUNK_PARTS) {
      // Escape special regex characters and replace globally
      const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escaped, 'g'), '_');
    }
    return result;
  }

  /**
   * Shift characters back by n positions
   */
  private static shiftBack(s: string, n: number): string {
    return s.split('').map(c => String.fromCharCode(c.charCodeAt(0) - n)).join('');
  }

  /**
   * Decode VOE encoded string through multiple transformation steps
   * Implements the exact Python algorithm
   */
  private static decodeVoeString(encoded: string): VoeDecoded {
    try {
      // Step 1: ROT13
      const step1 = this.shiftLetters(encoded);

      // Step 2: Replace junk and remove underscores
      const step2 = this.replaceJunk(step1).replace(/_/g, '');

      // Step 3: Base64 decode
      const step3 = Buffer.from(step2, 'base64').toString('utf-8');

      // Step 4: Shift back by 3
      const step4 = this.shiftBack(step3, 3);

      // Step 5: Reverse and base64 decode
      const reversed = step4.split('').reverse().join('');
      const step5 = Buffer.from(reversed, 'base64').toString('utf-8');

      return JSON.parse(step5);
    } catch (error) {
      throw new Error(`Failed to decode VOE string: ${error}`);
    }
  }

  /**
   * Extract VOE source from script tag in HTML
   */
  private static extractVoeFromScript(html: string): string | null {
    try {
      // Find script with type="application/json"
      const scriptMatch = html.match(/<script type="application\/json">([^<]+)<\/script>/);
      if (scriptMatch && scriptMatch[1]) {
        const text = scriptMatch[1];
        // Remove first 2 and last 2 characters like Python does [2:-2]
        const encoded = text.slice(2, -2);
        const decoded = this.decodeVoeString(encoded);
        return decoded.source || null;
      }
    } catch (error) {
      console.log('Script extraction failed:', error);
    }
    return null;
  }

  /**
   * Extract direct video link from VOE embed page
   */
  static async getDirectLink(embededVoeLink: string): Promise<string> {
    try {
      console.log('Fetching VOE page...');

      // Initial request to get redirect URL
      const response = await axios.get(embededVoeLink, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000
      });

      // Find redirect URL
      const redirectMatch = response.data.match(this.REDIRECT_PATTERN);
      if (!redirectMatch) {
        console.log('No redirect found, trying direct extraction...');
        return await this.extractFromHtml(response.data);
      }

      const redirectUrl = redirectMatch[0];
      console.log(`Following redirect to: ${redirectUrl}`);

      // Follow redirect and get final HTML
      const redirectResponse = await axios.get(redirectUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': embededVoeLink
        },
        timeout: 30000
      });

      return await this.extractFromHtml(redirectResponse.data);
    } catch (error) {
      throw new Error(`Failed to extract VOE link: ${error}`);
    }
  }

  /**
   * Extract video source from HTML using multiple methods
   */
  private static async extractFromHtml(html: string): Promise<string> {
    // Method 1: Extract from script tag with full decoding
    console.log('Method 1: Script tag with VOE decoding...');
    const extracted = this.extractVoeFromScript(html);
    if (extracted) {
      console.log('✓ Found via script tag decoding');
      return extracted;
    }

    // Method 2: Extract from base64 encoded variable (Python method 2)
    console.log('Method 2: Base64 variable (a168c)...');
    const b64Match = html.match(this.B64_PATTERN);
    if (b64Match) {
      try {
        const reversed = Buffer.from(b64Match[1], 'base64').toString('utf-8').split('').reverse().join('');
        const parsed = JSON.parse(reversed);
        if (parsed.source) {
          console.log('✓ Found via base64 variable');
          return parsed.source;
        }
      } catch (error) {
        console.log('✗ Base64 variable method failed:', error);
      }
    }

    // Method 3: Extract HLS source (Python method 3)
    console.log('Method 3: HLS pattern...');
    const hlsMatch = html.match(this.HLS_PATTERN);
    if (hlsMatch && hlsMatch.groups?.hls) {
      try {
        const decoded = Buffer.from(hlsMatch.groups.hls, 'base64').toString('utf-8');
        console.log('✓ Found via HLS pattern');
        return decoded;
      } catch (error) {
        console.log('✗ HLS method failed:', error);
      }
    }

    // Method 4: Look for any .m3u8 or .mp4 URLs
    console.log('Method 4: Direct video URLs...');
    const videoUrlMatch = html.match(/https?:\/\/[^"']*\.(m3u8|mp4)[^"']*/i);
    if (videoUrlMatch) {
      console.log('✓ Found direct video URL');
      return videoUrlMatch[0];
    }

    throw new Error('No video source found using any extraction method');
  }

  /**
   * Extract preview image from VOE embed page
   */
  static async getPreviewImage(embededVoeLink: string): Promise<string> {
    try {
      const response = await axios.get(embededVoeLink, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000
      });

      const redirectMatch = response.data.match(this.REDIRECT_PATTERN);
      if (!redirectMatch) {
        throw new Error('No redirect URL found in VOE response');
      }

      const redirectUrl = redirectMatch[0];
      const imageUrl = redirectUrl.replace('/e/', '/cache/') + '_storyboard_L2.jpg';

      // Check if image exists
      await axios.head(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      return imageUrl;
    } catch (error) {
      throw new Error(`Failed to extract preview image: ${error}`);
    }
  }
}