import { Router } from 'express';
import { ConfigModule } from '../modules/ConfigModule';
import { JellyfinModule } from '../modules/JellyfinModule';
import { SSHUploadModule } from '../modules/SSHUploadModule';

const jellyfinRouter = Router();
const configModule = new ConfigModule();

// Jellyfin routes
jellyfinRouter.get('/libraries', async (req, res) => {
  try {
    const jellyfin = new JellyfinModule(configModule);
    const libraries = await jellyfin.getLibraries();
    res.json({ success: true, data: libraries });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

jellyfinRouter.get('/items', async (req, res) => {
  try {
    const jellyfin = new JellyfinModule(configModule);
    const items = await jellyfin.getLibraryItems();
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

jellyfinRouter.post('/scan', async (req, res) => {
  try {
    const jellyfin = new JellyfinModule(configModule);
    await jellyfin.scanLibrary();
    res.json({ success: true, message: 'Library scan triggered' });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

jellyfinRouter.get('/test', async (req, res) => {
  try {
    const jellyfin = new JellyfinModule(configModule);
    const connected = await jellyfin.testConnection();
    res.json({ success: true, connected });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default jellyfinRouter;