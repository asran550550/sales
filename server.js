/**
 * RoseCosmetics - Cloud / Local Full-Stack Node.js Server
 * Connects directly to Turso LibSQL Edge Database or local SQLite.
 * Compatible with Vercel, Render, Railway, and local network.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const apiHandler = require('./api/index.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Forward all /api requests to Turso LibSQL handler
app.all(['/api', '/api/*'], async (req, res) => {
  try {
    await apiHandler(req, res);
  } catch (err) {
    console.error('Server error handling API request:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// Serve frontend static assets
app.use(express.static(__dirname));

// SPA fallback for HTML5 routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`================================================================`);
  console.log(`🌸 RoseCosmetics Server is LIVE on port ${PORT}!`);
  console.log(`🗄️ Database: Turso LibSQL (${process.env.TURSO_DATABASE_URL ? 'Connected to Turso Cloud' : 'Local SQLite mode'})`);
  console.log(`👉 Local:   http://localhost:${PORT}`);
  console.log(`👉 Network: http://0.0.0.0:${PORT}`);
  console.log(`================================================================`);
});
