// ── Public Ticket Routes ──────────────────────────────
// POST /api/tickets — accepts submissions from the public form.

const express = require('express');
const router = express.Router();
const { publicSubmitLimiter } = require('../middleware/rateLimiter');
const { validateTicketCreation, handleValidationErrors } = require('../middleware/validator');
const { TicketService } = require('../services/ticketService');
const { sendAcknowledgmentEmail, sendAdminNotificationEmail } = require('../services/emailService');

/**
 * POST /api/tickets
 * Public endpoint for customer ticket submission.
 */
router.post(
  '/tickets',
  publicSubmitLimiter,
  validateTicketCreation,
  handleValidationErrors,
  (req, res) => {
    try {
      const ticketService = new TicketService(req.app.locals.db);

      const ticket = ticketService.createTicket({
        customer_name: req.body.customer_name,
        customer_email: req.body.customer_email,
        customer_company: req.body.customer_company,
        device_number: req.body.device_number,
        order_number: req.body.order_number,
        purchase_date: req.body.purchase_date,
        issue_subject: req.body.issue_subject,
        issue_description: req.body.issue_description,
      });

      // Fire-and-forget customer acknowledgment email
      sendAcknowledgmentEmail(ticket).catch(err => {
        console.error('Email dispatch error:', err.message);
      });

      // Fire-and-forget admin notification email (if admin email is configured)
      const settings = ticketService.getSettings();
      if (settings.admin_email) {
        sendAdminNotificationEmail(ticket, settings.admin_email).catch(err => {
          console.error('Admin notification error:', err.message);
        });
      }

      res.status(201).json({
        message: 'Support ticket created successfully.',
        ticket_id: ticket.ticket_id,
        created_at: ticket.created_at,
      });
    } catch (err) {
      console.error('Error creating ticket:', err);
      res.status(500).json({ error: 'Failed to create support ticket.' });
    }
  }
);

module.exports = router;
