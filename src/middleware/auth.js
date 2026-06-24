// ── Internal Access Guard Middleware ────────────────────
// Validates the X-Internal-Key header against the configured API key.
// Checks the database-stored key first, then falls back to config.

const config = require('../config');

function requireInternalAuth(req, res, next) {
  const providedKey = req.headers['x-internal-key'];

  if (!providedKey) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Missing X-Internal-Key header.',
    });
  }

  // Get the current key: check DB-stored key first, fallback to config
  let expected = config.internalApiKey;
  try {
    const db = req.app.locals.db;
    if (db) {
      const row = db.prepare("SELECT setting_value FROM Settings WHERE setting_key = 'admin_password'").get();
      if (row && row.setting_value) {
        expected = row.setting_value;
      }
    }
  } catch (e) {
    // If DB lookup fails, use config value
  }

  // Constant-time comparison to prevent timing attacks
  if (providedKey.length !== expected.length ||
      !require('crypto').timingSafeEqual(
        Buffer.from(providedKey),
        Buffer.from(expected)
      )) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Invalid API key.',
    });
  }

  next();
}

module.exports = { requireInternalAuth };
