import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

interface JellyfinConfig {
  serverUrl: string;
  apiKey: string;
  userId?: string;
  libraryId?: string;
}

interface SSHConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  remotePath: string;
}

interface AppConfig {
  downloadPath: string;
  autoUpload: boolean;
  defaultLanguage: string;
  fallbackLanguage: string;
}

export class ConfigModule {
  private config: {
    jellyfin: JellyfinConfig;
    ssh: SSHConfig;
    app: AppConfig;
  };

  constructor(envPath?: string) {
    dotenv.config({ path: envPath || path.join(process.cwd(), '.env') });

    this.config = {
      jellyfin: {
        serverUrl: process.env.JELLYFIN_SERVER_URL || '',
        apiKey: process.env.JELLYFIN_API_KEY || '',
        userId: process.env.JELLYFIN_USER_ID,
        libraryId: process.env.JELLYFIN_LIBRARY_ID
      },
      ssh: {
        enabled: process.env.SSH_ENABLED === 'true',
        host: process.env.SSH_HOST || '',
        port: parseInt(process.env.SSH_PORT || '22'),
        username: process.env.SSH_USERNAME || '',
        remotePath: process.env.SSH_REMOTE_PATH || '/mnt/media'
      },
      app: {
        downloadPath: process.env.DOWNLOAD_PATH || './downloads',
        autoUpload: process.env.AUTO_UPLOAD === 'true',
        defaultLanguage: process.env.DEFAULT_LANGUAGE || 'German Dub',
        fallbackLanguage: process.env.FALLBACK_LANGUAGE || 'German Sub'
      }
    };
  }

  // Getters
  getJellyfinConfig(): JellyfinConfig {
    return { ...this.config.jellyfin };
  }

  getSSHConfig(): SSHConfig {
    return { ...this.config.ssh };
  }

  getAppConfig(): AppConfig {
    return { ...this.config.app };
  }

  // Setters (Runtime only - not persisted)
  setJellyfinConfig(jellyfinConfig: Partial<JellyfinConfig>): JellyfinConfig {
    this.config.jellyfin = { ...this.config.jellyfin, ...jellyfinConfig };
    return { ...this.config.jellyfin };
  }

  setSSHConfig(sshConfig: Partial<SSHConfig>): SSHConfig {
    this.config.ssh = { ...this.config.ssh, ...sshConfig };
    return { ...this.config.ssh };
  }

  setAppConfig(appConfig: Partial<AppConfig>): AppConfig {
    this.config.app = { ...this.config.app, ...appConfig };
    return { ...this.config.app };
  }

  // Validation
  isJellyfinConfigured(): boolean {
    return !!(this.config.jellyfin.serverUrl && this.config.jellyfin.apiKey);
  }

  isSSHConfigured(): boolean {
    return this.config.ssh.enabled && !!(this.config.ssh.host && this.config.ssh.username);
  }

  // Reset to .env defaults
  resetToDefaults(): void {
    const envPath = path.join(process.cwd(), '.env');
    dotenv.config({ path: envPath, override: true });

    this.config = {
      jellyfin: {
        serverUrl: process.env.JELLYFIN_SERVER_URL || '',
        apiKey: process.env.JELLYFIN_API_KEY || '',
        userId: process.env.JELLYFIN_USER_ID,
        libraryId: process.env.JELLYFIN_LIBRARY_ID
      },
      ssh: {
        enabled: process.env.SSH_ENABLED === 'true',
        host: process.env.SSH_HOST || '',
        port: parseInt(process.env.SSH_PORT || '22'),
        username: process.env.SSH_USERNAME || '',
        remotePath: process.env.SSH_REMOTE_PATH || '/mnt/media'
      },
      app: {
        downloadPath: process.env.DOWNLOAD_PATH || './downloads',
        autoUpload: process.env.AUTO_UPLOAD === 'true',
        defaultLanguage: process.env.DEFAULT_LANGUAGE || 'German Dub',
        fallbackLanguage: process.env.FALLBACK_LANGUAGE || 'German Sub'
      }
    };
  }
}