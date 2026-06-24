// ── SLA Inactivity Checker ─────────────────────────────
// Background cron job that monitors ticket staleness and dispatches alerts.

const cron = require('node-cron');
const config = require('../config');
const { TicketService } = require('../services/ticketService');
const { sendSlaAlertEmail } = require('../services/emailService');

/**
 * Start the SLA checker cron job.
 * Runs at the interval defined by SLA_CRON_SCHEDULE (default: every hour).
 */
function startSlaChecker(db) {
  const schedule = config.sla.cronSchedule;

  console.log(`🕐 SLA Checker scheduled: "${schedule}" (threshold: ${config.sla.thresholdHours}h)`);

  cron.schedule(schedule, async () => {
    console.log(`🔍 [SLA Check] Running at ${new Date().toISOString()}...`);

    try {
      const ticketService = new TicketService(db);

      // Find tickets that have exceeded the SLA threshold
      const staleTickets = ticketService.getStaleTickets(config.sla.thresholdHours);

      if (staleTickets.length === 0) {
        console.log('   ✅ No stale tickets found.');
        return;
      }

      console.log(`   ⚠️  Found ${staleTickets.length} stale ticket(s).`);

      // Generate a window key to prevent duplicate alerts
      // Window key is based on the current date + hour bucket
      const now = new Date();
      const windowKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}-H${String(now.getUTCHours()).padStart(2, '0')}`;

      // Filter to only tickets that haven't been alerted in this window
      const newAlerts = [];
      for (const ticket of staleTickets) {
        const isNew = ticketService.recordSlaAlert(ticket.ticket_id, windowKey);
        if (isNew) {
          newAlerts.push(ticket);
        }
      }

      if (newAlerts.length === 0) {
        console.log('   ℹ️  All stale tickets already alerted in this window.');
        return;
      }

      console.log(`   📧 Dispatching alert for ${newAlerts.length} new stale ticket(s)...`);

      // Send the alert email
      await sendSlaAlertEmail(newAlerts);

    } catch (err) {
      console.error('❌ SLA Checker error:', err);
    }
  });
}

module.exports = { startSlaChecker };
