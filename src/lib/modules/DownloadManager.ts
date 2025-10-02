import { EventEmitter } from 'events';
import { IDownloader, IDownloadOptions, LogEntry } from '../types/types';

export class DownloadManager {
  private downloaders: Map<string, IDownloader>;
  private downloadQueue: Array<{ url: string; options?: IDownloadOptions }>;
  private isProcessing: boolean;
  private currentDownloader: string | null;
  private eventEmitter: EventEmitter;

  constructor() {
    this.downloaders = new Map();
    this.downloadQueue = [];
    this.isProcessing = false;
    this.currentDownloader = null;
    this.eventEmitter = new EventEmitter();
  }

  registerDownloader(name: string, downloader: IDownloader): void {
    this.downloaders.set(name, downloader);
    
    // Subscribe to downloader's logs and re-emit with downloader name
    if (typeof (downloader as any).onLog === 'function') {
      (downloader as any).onLog((entry: LogEntry) => {
        this.eventEmitter.emit('log', {
          ...entry,
          downloader: name,
          queueLength: this.downloadQueue.length
        });
      });
    }
  }

  getDownloader(name: string): IDownloader | undefined {
    return this.downloaders.get(name);
  }

  addToQueue(url: string, options?: IDownloadOptions): void {
    this.downloadQueue.push({ url, options });
    
    this.eventEmitter.emit('queueUpdate', {
      action: 'added',
      url,
      queueLength: this.downloadQueue.length
    });
    
    if (!this.isProcessing && this.currentDownloader) {
      this.processQueue(this.currentDownloader);
    }
  }

  async processQueue(downloaderName: string): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    const downloader = this.getDownloader(downloaderName);
    if (!downloader) {
      throw new Error(`Downloader '${downloaderName}' not found`);
    }

    this.isProcessing = true;
    this.currentDownloader = downloaderName;

    this.eventEmitter.emit('queueStart', {
      downloader: downloaderName,
      queueLength: this.downloadQueue.length
    });

    while (this.downloadQueue.length > 0) {
      const item = this.downloadQueue.shift();
      if (item) {
        try {
          this.eventEmitter.emit('downloadStart', {
            url: item.url,
            remaining: this.downloadQueue.length
          });

          await downloader.download(item.url, item.options);

          this.eventEmitter.emit('downloadComplete', {
            url: item.url,
            remaining: this.downloadQueue.length
          });
        } catch (error) {
          this.eventEmitter.emit('downloadError', {
            url: item.url,
            error: String(error),
            remaining: this.downloadQueue.length
          });
        }
      }
    }

    this.isProcessing = false;
    this.currentDownloader = null;
    
    this.eventEmitter.emit('queueComplete', {
      downloader: downloaderName
    });
  }

  /**
   * Get event emitter for live updates
   */
  getEmitter(): EventEmitter {
    return this.eventEmitter;
  }

  /**
   * Subscribe to events
   */
  onEvent(event: string, callback: (data: any) => void): void {
    this.eventEmitter.on(event, callback);
  }

  /**
   * Get all logs from all downloaders
   */
  getAllLogs(): Array<LogEntry & { downloader: string }> {
    const allLogs: Array<LogEntry & { downloader: string }> = [];
    
    for (const [name, downloader] of this.downloaders) {
      if (typeof (downloader as any).getLogs === 'function') {
        const logs = (downloader as any).getLogs() as LogEntry[];
        logs.forEach(log => {
          allLogs.push({ ...log, downloader: name });
        });
      }
    }
    
    return allLogs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  getQueueLength(): number {
    return this.downloadQueue.length;
  }

  getQueue(): Array<{ url: string; options?: IDownloadOptions }> {
    return [...this.downloadQueue];
  }

  clearQueue(): void {
    this.downloadQueue = [];
    this.eventEmitter.emit('queueCleared');
  }

  isRunning(): boolean {
    return this.isProcessing;
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isProcessing: this.isProcessing,
      currentDownloader: this.currentDownloader,
      queueLength: this.downloadQueue.length,
      queue: this.getQueue()
    };
  }
}