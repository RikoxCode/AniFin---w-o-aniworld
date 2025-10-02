import { DownloadManager } from './lib/modules/DownloadManager';
import { AniworldDownloader } from './lib/modules/AniworldDownloader';
import { VoeProvider } from './lib/providers/VoeProvider';
import { ConfigModule } from './lib/modules/ConfigModule';

export { DownloadManager };
export * from './lib/types/types';

const manager = new DownloadManager();
const configModule = new ConfigModule('../.env');

// Create VOE provider wrapper
const voeProvider = {
  name: 'voe',
  extractDirectLink: (url: string) => VoeProvider.getDirectLink(url),
  extractPreviewImage: (url: string) => VoeProvider.getPreviewImage(url)
};

// Register downloaders
const aniworldInstance = new AniworldDownloader(configModule, [voeProvider], 'voe')
manager.registerDownloader('aniworld', aniworldInstance);

export function getManager(){
  return manager
};