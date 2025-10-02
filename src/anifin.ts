import express from 'express';
import path from 'path';
import authRouter from './lib/routers/AuthRouter';
import downloadRouter from './lib/routers/DownloadRouter';
import jellyfinRouter from './lib/routers/JellyfinRouter';
import configRouter from './lib/routers/ConfigRouter';
import { getManager } from './initialize_manager';

const app = express();
export const manager = getManager();

// Middleware
app.use(express.json());

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/download', downloadRouter);
app.use('/api/jellyfin', jellyfinRouter);
app.use('/api/config', configRouter);

// Sanity check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Page Routes
app.get('/', (req, res) => {
  res.render('index', {
    app_name: 'AniFin',
    title: 'Dashboard'
  });
});

app.get('/downloads', (req, res) => {
  res.render('downloads', {
    app_name: 'AniFin',
    title: 'Downloads'
  });
});

app.get('/settings', (req, res) => {
  res.render('settings', {
    app_name: 'AniFin',
    title: 'Settings'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AniFin running on http://localhost:${PORT}`);
});