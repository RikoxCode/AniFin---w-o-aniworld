import * as path from 'path';
import * as fs from 'fs';
import { IDownloader, IDownloadOptions, IVideoInfo, LogEntry } from '../types/types';
import { EventEmitter } from 'events';
import { ConfigModule } from './ConfigModule';
import { SSHUploadModule } from './SSHUploadModule';



export abstract class BaseDownloader implements IDownloader {
  protected outputDir: string;
  protected configModule: ConfigModule;
  private logs: LogEntry[] = [];
  private eventEmitter: EventEmitter = new EventEmitter();
  private maxLogs: number = 1000;
  private uploadModule?: SSHUploadModule; // Optional, wird lazy initialisiert

  constructor(configModule?: ConfigModule) {
    this.configModule = configModule || new ConfigModule();

    // Use config from ConfigModule
    const appConfig = this.configModule.getAppConfig();
    this.outputDir = appConfig.downloadPath;

    this.ensureDirectoryExists();
  }

  protected ensureDirectoryExists(outputDir: string = ''): void {
    let dir = outputDir != '' ? outputDir : this.outputDir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  protected getOutputPath(filename: string): string {
    return path.join(this.outputDir, filename);
  }

  protected setOutputDir(newPath: string): void {
    if (newPath) {
      this.outputDir = newPath;
      this.ensureDirectoryExists(newPath);
    }
  }

  /**
   * Get config module instance
   */
  protected getConfig(): ConfigModule {
    return this.configModule;
  }

  /**
   * Check if auto-upload is enabled
   */
  protected isAutoUploadEnabled(): boolean {
    return this.configModule.getAppConfig().autoUpload;
  }

  /**
   * Upload file to remote server
   * @param localPath - Path to local file
   * @param remotePath - Optional remote path
   * @returns true on success, false on failure
   */
  protected async upload(localPath: string, remotePath?: string): Promise<boolean> {
    this.log(`Start uploading to jellyfin...`, 'info');
    if (!this.configModule.getAppConfig().autoUpload){
      this.log(`AutoUpload disabled! Please turne it on to upload automaticly after download`, 'warning')
      return false;
    }

    if (!this.uploadModule) {
      this.uploadModule = new SSHUploadModule(this.configModule);
    }

    try {
      await this.uploadModule.uploadDirectory(localPath, remotePath);
      this.log(`Successfully uploaded: ${localPath}`, 'success');
      return true;
    } catch (error) {
      this.log(`Upload failed: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Log a message and emit event
   */
  public log(message: string, level: 'info' | 'success' | 'error' | 'warning' = 'info'): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message
    };

    this.logs.push(entry);

    // Limit array size
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Emit event for real-time updates
    this.eventEmitter.emit('log', entry);

    if (level !== 'info') {
      // Also console log for non-info messages
      console.log(`[${level.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Get all logs
   */
  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get event emitter for real-time updates
   */
  public getEmitter(): EventEmitter {
    return this.eventEmitter;
  }

  /**
   * Clear all logs
   */
  public clearLogs(): void {
    this.logs = [];
  }

  /**
   * Subscribe to log events
   */
  public onLog(callback: (entry: LogEntry) => void): void {
    this.eventEmitter.on('log', callback);
  }

  abstract download(url: string, options?: IDownloadOptions): Promise<string>;
  abstract getVideoInfo(url: string): Promise<IVideoInfo>;
}