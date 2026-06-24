// ── Email Service ──────────────────────────────────────
// Handles all outbound email: customer acknowledgment, admin notification,
// and SLA alerts. Gracefully degrades if SMTP is not configured.

const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;
let emailEnabled = false;
let currentFrom = '';

/**
 * Initialize the SMTP transporter from environment variables.
 * Called once at startup, optionally with DB settings override.
 */
function initEmailService(dbSettings) {
  const settings = dbSettings || {};
  const host = settings.smtp_host || config.smtp.host;

  if (!host || host === 'smtp.example.com') {
    console.warn('⚠️  SMTP not configured — emails will be logged to console only.');
    emailEnabled = false;
    return;
  }

  _setupTransporter({
    host: host,
    port: parseInt(settings.smtp_port || config.smtp.port, 10) || 587,
    secure: (settings.smtp_secure || String(config.smtp.secure)) === 'true',
    user: settings.smtp_user || config.smtp.user,
    pass: settings.smtp_pass || config.smtp.pass,
    from: settings.smtp_from || config.smtp.from,
  });
}

/**
 * Reload SMTP settings (called when settings are saved from dashboard).
 */
function reloadEmailService(dbSettings) {
  if (!dbSettings.smtp_host) {
    console.log('📧 SMTP not configured in settings — emails disabled.');
    emailEnabled = false;
    transporter = null;
    return;
  }

  _setupTransporter({
    host: dbSettings.smtp_host,
    port: parseInt(dbSettings.smtp_port, 10) || 587,
    secure: dbSettings.smtp_secure === 'true',
    user: dbSettings.smtp_user || '',
    pass: dbSettings.smtp_pass || '',
    from: dbSettings.smtp_from || '',
  });

  console.log('📧 Email service reloaded with new settings.');
}

/**
 * Internal: create the nodemailer transporter.
 */
function _setupTransporter(opts) {
  try {
    transporter = nodemailer.createTransport({
      host: opts.host,
      port: opts.port,
      secure: opts.secure,
      auth: {
        user: opts.user,
        pass: opts.pass,
      },
    });
    currentFrom = opts.from;
    emailEnabled = true;
    console.log('✅ Email service initialized');
  } catch (err) {
    console.error('❌ Failed to initialize email service:', err.message);
    emailEnabled = false;
  }
}

/**
 * Send customer acknowledgment email.
 * Non-blocking — failures are logged but do not throw.
 */
async function sendAcknowledgmentEmail(ticket) {
  const subject = `Support Request Received — ${ticket.ticket_id}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px 40px; }
        .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 600; }
        .header p { color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px; }
        .body { padding: 32px 40px; color: #374151; line-height: 1.7; }
        .ticket-id { display: inline-block; background: #f0f0ff; color: #6366f1; padding: 6px 16px; border-radius: 8px; font-family: monospace; font-size: 16px; font-weight: 600; letter-spacing: 1px; }
        .details { background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb; }
        .details p { margin: 6px 0; font-size: 14px; }
        .details strong { color: #111827; }
        .footer { padding: 24px 40px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>We've Received Your Support Request</h1>
          <p>Our team will review your issue shortly.</p>
        </div>
        <div class="body">
          <p>Hello <strong>${escapeHtml(ticket.customer_name)}</strong>,</p>
          <p>Thank you for reaching out. Your support ticket has been successfully created and assigned the following reference number:</p>
          <p style="text-align: center; margin: 24px 0;">
            <span class="ticket-id">${ticket.ticket_id}</span>
          </p>
          <div class="details">
            <p><strong>Subject:</strong> ${escapeHtml(ticket.issue_subject)}</p>
            <p><strong>Company:</strong> ${escapeHtml(ticket.customer_company)}</p>
            <p><strong>Device:</strong> ${escapeHtml(ticket.device_number)}</p>
            <p><strong>Submitted:</strong> ${new Date(ticket.created_at).toLocaleString()}</p>
          </div>
          <p>Our support team will review your request and get back to you as soon as possible. Please keep your ticket ID for future reference.</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply directly to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  if (!emailEnabled) {
    console.log(`📧 [SIMULATED] Acknowledgment → ${ticket.customer_email} | ${ticket.ticket_id}`);
    return;
  }

  try {
    await transporter.sendMail({
      from: currentFrom,
      to: ticket.customer_email,
      subject,
      html,
    });
    console.log(`📧 Acknowledgment email sent for ticket ${ticket.ticket_id}`);
  } catch (err) {
    console.error(`❌ Failed to send acknowledgment email for ${ticket.ticket_id}:`, err.message);
  }
}

/**
 * Send admin notification for a new ticket.
 * Only fires if adminEmail is provided and non-empty.
 */
async function sendAdminNotificationEmail(ticket, adminEmail) {
  if (!adminEmail) return;

  const subject = `🎫 New Support Ticket: ${ticket.ticket_id} — ${ticket.issue_subject}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f9; margin: 0; }
        .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #3b82f6, #6366f1); padding: 28px 40px; }
        .header h1 { color: #fff; margin: 0; font-size: 20px; font-weight: 600; }
        .header p { color: rgba(255,255,255,0.8); margin: 6px 0 0; font-size: 13px; }
        .body { padding: 28px 40px; color: #374151; line-height: 1.7; }
        .badge { display: inline-block; background: #dbeafe; color: #2563eb; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; font-family: monospace; letter-spacing: 0.5px; }
        .info-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        .info-table td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-size: 14px; vertical-align: top; }
        .info-table td:first-child { font-weight: 600; color: #374151; width: 120px; }
        .info-table td:last-child { color: #6b7280; }
        .desc { background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb; font-size: 14px; color: #4b5563; white-space: pre-wrap; margin: 12px 0; }
        .footer { padding: 20px 40px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Support Ticket Submitted</h1>
          <p>A customer has submitted a new support request.</p>
        </div>
        <div class="body">
          <p style="margin-bottom:16px;"><span class="badge">${ticket.ticket_id}</span></p>
          <table class="info-table">
            <tr><td>Customer</td><td>${escapeHtml(ticket.customer_name)}</td></tr>
            <tr><td>Email</td><td>${escapeHtml(ticket.customer_email)}</td></tr>
            <tr><td>Company</td><td>${escapeHtml(ticket.customer_company)}</td></tr>
            <tr><td>Device #</td><td>${escapeHtml(ticket.device_number)}</td></tr>
            <tr><td>Order #</td><td>${escapeHtml(ticket.order_number)}</td></tr>
            <tr><td>Subject</td><td><strong>${escapeHtml(ticket.issue_subject)}</strong></td></tr>
          </table>
          <p style="font-weight:600; margin-top:16px; font-size:13px; color:#374151;">Issue Description:</p>
          <div class="desc">${escapeHtml(ticket.issue_description)}</div>
        </div>
        <div class="footer">
          <p>Open the internal dashboard to triage this ticket.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  if (!emailEnabled) {
    console.log(`📧 [SIMULATED] Admin notification → ${adminEmail} | New ticket ${ticket.ticket_id}`);
    return;
  }

  try {
    await transporter.sendMail({
      from: currentFrom,
      to: adminEmail,
      subject,
      html,
    });
    console.log(`📧 Admin notification sent for ticket ${ticket.ticket_id}`);
  } catch (err) {
    console.error(`❌ Failed to send admin notification for ${ticket.ticket_id}:`, err.message);
  }
}

/**
 * Send SLA breach alert to management.
 */
async function sendSlaAlertEmail(staleTickets) {
  if (staleTickets.length === 0) return;

  const subject = `⚠️ SLA Alert: ${staleTickets.length} ticket(s) require attention`;

  const ticketRows = staleTickets.map(t => `
    <tr>
      <td style="padding:10px 12px; border-bottom:1px solid #e5e7eb; font-family:monospace; font-size:12px; color:#6366f1;">${t.ticket_id}</td>
      <td style="padding:10px 12px; border-bottom:1px solid #e5e7eb;">${escapeHtml(t.customer_company)}</td>
      <td style="padding:10px 12px; border-bottom:1px solid #e5e7eb;">${escapeHtml(t.issue_subject)}</td>
      <td style="padding:10px 12px; border-bottom:1px solid #e5e7eb;">
        <span style="display:inline-block; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:600;
          background:${t.priority === 'Critical' ? '#fef2f2' : t.priority === 'High' ? '#fff7ed' : '#f0f9ff'};
          color:${t.priority === 'Critical' ? '#dc2626' : t.priority === 'High' ? '#ea580c' : '#2563eb'};">
          ${t.priority}
        </span>
      </td>
      <td style="padding:10px 12px; border-bottom:1px solid #e5e7eb; color:#6b7280; font-size:13px;">${t.last_updated_at}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f9; margin: 0; }
        .container { max-width: 700px; margin: 30px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #ef4444, #f97316); padding: 28px 40px; }
        .header h1 { color: #fff; margin: 0; font-size: 20px; }
        .body { padding: 28px 40px; color: #374151; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
        th { text-align: left; padding: 10px 12px; background: #f9fafb; border-bottom: 2px solid #e5e7eb; font-weight: 600; color: #374151; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ SLA Inactivity Alert</h1>
        </div>
        <div class="body">
          <p>The following <strong>${staleTickets.length}</strong> ticket(s) have had no updates within the SLA threshold and require immediate attention:</p>
          <table>
            <thead>
              <tr><th>Ticket ID</th><th>Company</th><th>Subject</th><th>Priority</th><th>Last Updated</th></tr>
            </thead>
            <tbody>${ticketRows}</tbody>
          </table>
          <p style="color:#6b7280; font-size:13px; margin-top:20px;">This is an automated SLA monitoring alert.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  if (!emailEnabled) {
    console.log(`📧 [SIMULATED] SLA alert for ${staleTickets.length} stale ticket(s)`);
    return;
  }

  try {
    await transporter.sendMail({
      from: currentFrom,
      to: config.sla.alertEmail,
      subject,
      html,
    });
    console.log(`📧 SLA alert sent for ${staleTickets.length} ticket(s)`);
  } catch (err) {
    console.error('❌ Failed to send SLA alert email:', err.message);
  }
}

/**
 * Test the current SMTP connection. Returns { success, message }.
 */
async function testEmailConnection() {
  if (!transporter || !emailEnabled) {
    return { success: false, message: 'SMTP is not configured. Please save SMTP settings first.' };
  }
  try {
    await transporter.verify();
    return { success: true, message: 'SMTP connection verified successfully!' };
  } catch (err) {
    return { success: false, message: `Connection failed: ${err.message}` };
  }
}

/**
 * Simple HTML escape to prevent XSS in email templates.
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  initEmailService,
  reloadEmailService,
  sendAcknowledgmentEmail,
  sendAdminNotificationEmail,
  sendSlaAlertEmail,
  testEmailConnection,
};
