// ── Rate Limiter Middleware ─────────────────────────────
// Applied to public-facing endpoints to prevent abuse.

const rateLimit = require('express-rate-limit');

// Public ticket submission: 5 requests per minute per IP
const publicSubmitLimiter = rateLimit({
  windowMs: 60 * 1000,          // 1 minute window
  max: 5,                       // 5 requests per window
  standardHeaders: true,        // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,         // Disable X-RateLimit-* headers
  message: {
    error: 'Too many requests',
    message: 'You have exceeded the rate limit. Please wait a moment before submitting again.',
  },
});

module.exports = { publicSubmitLimiter };
