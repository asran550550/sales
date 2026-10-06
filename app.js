/**
 * RoseCosmetics - Vercel Serverless Entrypoint
 * Bridges Express 5 app and Turso database to Vercel's edge network.
 */
const app = require('./server.js');

module.exports = app;
