// ── Support Portal — Main Entry Point ──────────────────
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
// cors removed — both frontends served from the same origin, no cross-origin needed
const path = require('path');

const { initDatabase } = require('./db/init');
const config = require('./src/config');
const publicRoutes = require('./src/routes/publicTickets');
const internalRoutes = require('./src/routes/internalTickets');
const { initEmailService } = require('./src/services/emailService');
const { TicketService } = require('./src/services/ticketService');
const { startSlaChecker } = require('./src/workers/slaChecker');

/**
 * Boot the application.
 * Wrapped in async IIFE because sql.js initialization is async.
 */
(async function boot() {
  const app = express();

  // ── Security Hardening ──────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
      },
    },
  }));
  // cors disabled — single-origin deployment (public + internal on same domain)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ── Initialize Database (async for sql.js WASM) ─────
  const db = await initDatabase();
  app.locals.db = db;

  // ── Initialize Email Service ────────────────────────
  // Read DB settings so SMTP config persists across restarts
  const settingsService = new TicketService(db);
  const dbSettings = settingsService.getSettings();
  initEmailService(dbSettings);

  // ── Serve Static Frontends ──────────────────────────
  // Public customer form at root
  app.use('/', express.static(path.join(__dirname, 'public')));

  // Internal dashboard at /internal
  app.use('/internal', express.static(path.join(__dirname, 'internal')));

  // ── API Routes ──────────────────────────────────────
  // Public routes (no auth required)
  app.use('/api', publicRoutes);

  // Internal routes (auth required — middleware applied inside the router)
  app.use('/api', internalRoutes);

  // ── Health Check ────────────────────────────────────
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // ── Global Error Handler ────────────────────────────
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  // ── Start Server ────────────────────────────────────
  const PORT = config.port;
  app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║       Customer Support Portal — Running             ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║  📋  Public Form:   http://localhost:${PORT}/            ║`);
    console.log(`║  🔒  Dashboard:     http://localhost:${PORT}/internal/   ║`);
    console.log(`║  🔑  API Key:       ${config.internalApiKey.substring(0, 20)}...  ║`);
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');
  });

  // ── Start Background Workers ────────────────────────
  startSlaChecker(db);

  // ── Graceful Shutdown ───────────────────────────────
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    db.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down...');
    db.close();
    process.exit(0);
  });

})().catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
