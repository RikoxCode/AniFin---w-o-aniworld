import { Router } from 'express';
import { authMiddleware } from '../middleware/AuthMiddleware';
import { ConfigModule } from '../modules/ConfigModule';

const configRouter = Router();
const configModule = new ConfigModule();

// Get Jellyfin config
configRouter.get('/jellyfin', authMiddleware, (req, res) => {
  try {
    const config = configModule.getJellyfinConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Update Jellyfin config
configRouter.put('/jellyfin', authMiddleware, (req, res) => {
  try {
    const updated = configModule.setJellyfinConfig(req.body);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Get SSH config
configRouter.get('/ssh', authMiddleware, (req, res) => {
  try {
    const config = configModule.getSSHConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Update SSH config
configRouter.put('/ssh', authMiddleware, (req, res) => {
  try {
    const updated = configModule.setSSHConfig(req.body);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Get App config
configRouter.get('/app', authMiddleware, (req, res) => {
  try {
    const config = configModule.getAppConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Update App config
configRouter.put('/app', authMiddleware, (req, res) => {
  try {
    const updated = configModule.setAppConfig(req.body);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Reset to .env defaults
configRouter.post('/reset', authMiddleware, (req, res) => {
  try {
    configModule.resetToDefaults();
    res.json({ success: true, message: 'Config reset to .env defaults' });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default configRouter;