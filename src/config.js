// ── Centralized Configuration ──────────────────────────
// Reads from process.env (loaded via dotenv) with sensible defaults.

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,

  // Internal API key for dashboard authentication
  internalApiKey: process.env.INTERNAL_API_KEY || 'change-me-to-a-secure-random-key-abc123',

  // SMTP settings
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.example.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'Support Team <support@example.com>',
  },

  // SLA configuration
  sla: {
    thresholdHours: parseInt(process.env.SLA_THRESHOLD_HOURS, 10) || 24,
    alertEmail: process.env.SLA_ALERT_EMAIL || 'management@example.com',
    cronSchedule: process.env.SLA_CRON_SCHEDULE || '0 * * * *',
  },
};
