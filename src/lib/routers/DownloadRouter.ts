import { Router } from "express";
import { authMiddleware } from '../middleware/AuthMiddleware';
import { manager } from "../../anifin";

const downloadRouter = Router();

/**
 * Add download to queue
 */
downloadRouter.post('/', authMiddleware, async (req, res) => {
  try {
    const { url, provider, language } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    // Add to manager queue
    manager.addToQueue(url, { provider, language });

    // Start processing if not already running
    if (!manager.isRunning()) {
      manager.processQueue('aniworld').catch((error: Error) => {
        console.error('Queue processing error:', error);
      });
    }

    res.json({
      success: true,
      message: 'Added to queue',
      status: manager.getStatus()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * Get queue status
 */
downloadRouter.get('/queue', authMiddleware, (req, res) => {
  try {
    const status = manager.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * Clear queue
 */
downloadRouter.delete('/queue', authMiddleware, (req, res) => {
  try {
    manager.clearQueue();
    res.json({ success: true, message: 'Queue cleared' });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * Get all logs from all downloaders
 */
downloadRouter.get('/logs', authMiddleware, (req, res) => {
  try {
    const logs = manager.getAllLogs();
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * SSE endpoint for live log stream
 */
downloadRouter.get('/stream', authMiddleware, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial status
  res.write(`data: ${JSON.stringify({
    type: 'status',
    data: manager.getStatus()
  })}\n\n`);

  // Subscribe to all manager events
  const logHandler = (data: any) => {
    res.write(`data: ${JSON.stringify({ type: 'log', data })}\n\n`);
  };

  const queueHandler = (data: any) => {
    res.write(`data: ${JSON.stringify({ type: 'queue', data })}\n\n`);
  };

  const downloadStartHandler = (data: any) => {
    res.write(`data: ${JSON.stringify({ type: 'downloadStart', data })}\n\n`);
  };

  const downloadCompleteHandler = (data: any) => {
    res.write(`data: ${JSON.stringify({ type: 'downloadComplete', data })}\n\n`);
  };

  const downloadErrorHandler = (data: any) => {
    res.write(`data: ${JSON.stringify({ type: 'downloadError', data })}\n\n`);
  };

  manager.onEvent('log', logHandler);
  manager.onEvent('queueUpdate', queueHandler);
  manager.onEvent('downloadStart', downloadStartHandler);
  manager.onEvent('downloadComplete', downloadCompleteHandler);
  manager.onEvent('downloadError', downloadErrorHandler);

  // Cleanup on disconnect
  req.on('close', () => {
    const emitter = manager.getEmitter();
    emitter.off('log', logHandler);
    emitter.off('queueUpdate', queueHandler);
    emitter.off('downloadStart', downloadStartHandler);
    emitter.off('downloadComplete', downloadCompleteHandler);
    emitter.off('downloadError', downloadErrorHandler);
    res.end();
  });
});

export default downloadRouter;