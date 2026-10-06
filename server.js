/**
 * RoseCosmetics - Cloud / Local Full-Stack Node.js Server
 * Connects directly to Turso LibSQL Edge Database.
 * Compatible with Express 5, Vercel Serverless, and local Node.js.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const apiHandler = require('./api/index.js');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Forward all /api requests to Turso LibSQL handler (Express 5 compatible)
app.use('/api', async (req, res) => {
  try {
    await apiHandler(req, res);
  } catch (err) {
    console.error('Server error handling API request:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// Serve static frontend assets from public/ and root
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// SPA fallback for HTML5 routing - never return index.html for static file extensions
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (/\.[a-zA-Z0-9]+$/.test(req.path)) {
    return res.status(404).send('Not found: ' + req.path);
  }
  const publicIndex = path.join(__dirname, 'public', 'index.html');
  const rootIndex = path.join(__dirname, 'index.html');
  const fs = require('fs');
  if (fs.existsSync(publicIndex)) {
    return res.sendFile(publicIndex);
  }
  res.sendFile(rootIndex);
});

// Export app for Vercel Serverless Function compatibility
module.exports = app;

// Listen only when run directly (local / non-Vercel environment)
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`================================================================`);
    console.log(`🌸 RoseCosmetics Server is LIVE on port ${PORT}!`);
    console.log(`🗄️ Database: Turso LibSQL (${process.env.TURSO_DATABASE_URL ? 'Connected to Turso Cloud' : 'Local SQLite mode'})`);
    console.log(`👉 Local:   http://localhost:${PORT}`);
    console.log(`👉 Network: http://0.0.0.0:${PORT}`);
    console.log(`================================================================`);
  });
}
