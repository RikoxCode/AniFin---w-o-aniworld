import axios, { AxiosInstance } from 'axios';
import { ConfigModule } from './ConfigModule';

interface JellyfinItem {
  Id: string;
  Name: string;
  Type: string;
  Path?: string;
  DateCreated?: string;
  DateLastMediaAdded?: string;
}

interface JellyfinLibrary {
  Id: string;
  Name: string;
  CollectionType: string;
}

export class JellyfinModule {
  private client: AxiosInstance;
  private config: ReturnType<ConfigModule['getJellyfinConfig']>;

  constructor(configModule: ConfigModule) {
    this.config = configModule.getJellyfinConfig();

    if (!configModule.isJellyfinConfigured()) {
      throw new Error('Jellyfin not configured. Check .env file.');
    }

    this.client = axios.create({
      baseURL: this.config.serverUrl,
      headers: {
        'Authorization': `MediaBrowser Token="${this.config.apiKey}"`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Get all libraries
   */
  async getLibraries(): Promise<JellyfinLibrary[]> {
    const response = await this.client.get('/Library/VirtualFolders');
    return response.data;
  }

  /**
   * Get items in library with full details
   */
  async getLibraryItems(libraryId?: string, userId?: string): Promise<JellyfinItem[]> {
    const targetLibraryId = libraryId || this.config.libraryId;
    const targetUserId = userId || this.config.userId;

    if (!targetLibraryId) {
      throw new Error('No library ID provided');
    }

    const params: any = {
      ParentId: targetLibraryId,
      Recursive: true,
      IncludeItemTypes: 'Series,Movie',
      Fields: 'DateCreated,DateLastMediaAdded'
    };

    if (targetUserId) {
      params.UserId = targetUserId;
    }

    const response = await this.client.get('/Items', { params });
    return response.data.Items;
  }

  /**
   * Trigger library scan
   */
  async scanLibrary(libraryId?: string): Promise<void> {
    const targetLibraryId = libraryId || this.config.libraryId;
    if (!targetLibraryId) {
      throw new Error('No library ID provided');
    }

    await this.client.post(`/Library/Refresh`, null, {
      params: { libraryId: targetLibraryId }
    });
  }

  /**
   * Get series by name
   */
  async findSeriesByName(name: string): Promise<JellyfinItem | null> {
    const response = await this.client.get('/Items', {
      params: {
        SearchTerm: name,
        IncludeItemTypes: 'Series',
        Limit: 1
      }
    });

    return response.data.Items?.[0] || null;
  }

  /**
   * Check connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/System/Info');
      return true;
    } catch {
      return false;
    }
  }
}