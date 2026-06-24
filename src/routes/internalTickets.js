// ── Internal Ticket Routes ────────────────────────────
// All internal-only endpoints, guarded by API key authentication.

const express = require('express');
const router = express.Router();
const { requireInternalAuth } = require('../middleware/auth');
const {
  validateTicketUpdate,
  validateTicketNote,
  handleValidationErrors,
} = require('../middleware/validator');
const { TicketService } = require('../services/ticketService');
const { generateExcelExport } = require('../services/exportService');
const { reloadEmailService, testEmailConnection } = require('../services/emailService');

// Apply auth middleware to all internal routes
router.use(requireInternalAuth);

/**
 * GET /api/tickets
 * Fetch tickets with filtering, sorting, and pagination.
 */
router.get('/tickets', (req, res) => {
  try {
    const ticketService = new TicketService(req.app.locals.db);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));

    const result = ticketService.listTickets({
      status: req.query.status || null,
      customer_company: req.query.customer_company || null,
      sort_by: req.query.sort_by || 'priority',
      sort_order: req.query.sort_order || 'DESC',
      page,
      limit,
    });

    res.json(result);
  } catch (err) {
    console.error('Error fetching tickets:', err);
    res.status(500).json({ error: 'Failed to fetch tickets.' });
  }
});

/**
 * GET /api/tickets/export
 * Export tickets to Excel (.xlsx) with current filters.
 * Must be defined BEFORE the :ticket_id param route.
 */
router.get('/tickets/export', async (req, res) => {
  try {
    const ticketService = new TicketService(req.app.locals.db);

    const tickets = ticketService.listAllTickets({
      status: req.query.status || null,
      customer_company: req.query.customer_company || null,
    });

    const buffer = await generateExcelExport(tickets);

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `support-tickets-${timestamp}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buffer);
  } catch (err) {
    console.error('Error exporting tickets:', err);
    res.status(500).json({ error: 'Failed to export tickets.' });
  }
});

/**
 * GET /api/tickets/:ticket_id
 * Get a single ticket with its update history.
 */
router.get('/tickets/:ticket_id', (req, res) => {
  try {
    const ticketService = new TicketService(req.app.locals.db);
    const ticket = ticketService.getTicketById(req.params.ticket_id);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const updates = ticketService.getTicketUpdates(req.params.ticket_id);

    res.json({ ticket, updates });
  } catch (err) {
    console.error('Error fetching ticket:', err);
    res.status(500).json({ error: 'Failed to fetch ticket.' });
  }
});

/**
 * PATCH /api/tickets/:ticket_id
 * Update ticket priority and/or status.
 * Requires a change_note and change_by when values actually change.
 */
router.patch(
  '/tickets/:ticket_id',
  validateTicketUpdate,
  handleValidationErrors,
  (req, res) => {
    try {
      const ticketService = new TicketService(req.app.locals.db);

      const updated = ticketService.updateTicket(
        req.params.ticket_id,
        { priority: req.body.priority, status: req.body.status },
        { change_note: req.body.change_note, change_by: req.body.change_by }
      );

      if (!updated) {
        return res.status(404).json({ error: 'Ticket not found.' });
      }

      res.json({ message: 'Ticket updated successfully.', ticket: updated });
    } catch (err) {
      if (err.message === 'CHANGE_NOTE_REQUIRED') {
        return res.status(400).json({
          error: 'Please add an activity note before changing status or priority.',
        });
      }
      if (err.message === 'NO_CHANGES') {
        return res.status(400).json({
          error: 'No changes detected. Priority and status are unchanged.',
        });
      }
      console.error('Error updating ticket:', err);
      res.status(500).json({ error: 'Failed to update ticket.' });
    }
  }
);

/**
 * POST /api/tickets/:ticket_id/updates
 * Add an update note to a ticket.
 */
router.post(
  '/tickets/:ticket_id/updates',
  validateTicketNote,
  handleValidationErrors,
  (req, res) => {
    try {
      const ticketService = new TicketService(req.app.locals.db);

      const update = ticketService.addTicketUpdate(req.params.ticket_id, {
        internal_user: req.body.internal_user,
        update_text: req.body.update_text,
      });

      if (!update) {
        return res.status(404).json({ error: 'Ticket not found.' });
      }

      res.status(201).json({ message: 'Update added successfully.', update });
    } catch (err) {
      console.error('Error adding update:', err);
      res.status(500).json({ error: 'Failed to add update.' });
    }
  }
);

// ── Settings Routes ─────────────────────────────────

/**
 * GET /api/settings
 * Retrieve all application settings.
 */
router.get('/settings', (req, res) => {
  try {
    const ticketService = new TicketService(req.app.locals.db);
    const settings = ticketService.getSettings();

    // Mask the SMTP password for security
    if (settings.smtp_pass) {
      settings.smtp_pass_masked = '•'.repeat(Math.min(settings.smtp_pass.length, 12));
    }

    res.json({ settings });
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Failed to fetch settings.' });
  }
});

/**
 * PUT /api/settings
 * Update application settings and reload email service.
 */
router.put('/settings', (req, res) => {
  try {
    const ticketService = new TicketService(req.app.locals.db);

    // Only allow known setting keys
    const allowedKeys = [
      'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass',
      'smtp_from', 'admin_email', 'sla_threshold_hours', 'theme', 'language',
    ];

    const updates = {};
    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid settings provided.' });
    }

    ticketService.updateSettings(updates);

    // Reload email service with new settings
    const allSettings = ticketService.getSettings();
    reloadEmailService(allSettings);

    res.json({ message: 'Settings saved successfully.', settings: allSettings });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});

/**
 * POST /api/settings/test-email
 * Test the current SMTP configuration.
 */
router.post('/settings/test-email', async (req, res) => {
  try {
    const result = await testEmailConnection();
    res.json(result);
  } catch (err) {
    console.error('Error testing email:', err);
    res.status(500).json({ success: false, message: 'Failed to test email connection.' });
  }
});

/**
 * POST /api/settings/change-password
 * Change the admin portal login password.
 */
router.post('/settings/change-password', (req, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;

    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({ error: 'All password fields are required.' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({ error: 'New passwords do not match.' });
    }

    // Verify current password
    const config = require('../config');
    const ticketService = new TicketService(req.app.locals.db);
    const settings = ticketService.getSettings();
    const currentKey = settings.admin_password || config.internalApiKey;

    const crypto = require('crypto');
    if (current_password.length !== currentKey.length ||
        !crypto.timingSafeEqual(Buffer.from(current_password), Buffer.from(currentKey))) {
      return res.status(403).json({ error: 'Current password is incorrect.' });
    }

    // Save new password
    ticketService.updateSettings({ admin_password: new_password });

    res.json({ message: 'Password changed successfully. Please re-login with the new password.' });
  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

module.exports = router;

