// ── Ticket Service ─────────────────────────────────────
// All database CRUD operations for SupportTickets, TicketUpdates, and Settings.

const { v4: uuidv4 } = require('uuid');

// Characters for short ticket IDs (no ambiguous 0/O, 1/I/L)
const ID_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

class TicketService {
  constructor(db) {
    this.db = db;
    this._prepareStatements();
  }

  /**
   * Pre-compile frequently used SQL statements for performance.
   */
  _prepareStatements() {
    this.stmts = {
      insertTicket: this.db.prepare(`
        INSERT INTO SupportTickets
          (ticket_id, customer_name, customer_email, customer_company,
           device_number, order_number, purchase_date,
           issue_subject, issue_description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),

      getTicketById: this.db.prepare(`
        SELECT * FROM SupportTickets WHERE ticket_id = ?
      `),

      updateTicketTimestamp: this.db.prepare(`
        UPDATE SupportTickets
        SET last_updated_at = datetime('now')
        WHERE ticket_id = ?
      `),

      insertUpdate: this.db.prepare(`
        INSERT INTO TicketUpdates (update_id, ticket_id, internal_user, update_text)
        VALUES (?, ?, ?, ?)
      `),

      getUpdatesByTicket: this.db.prepare(`
        SELECT * FROM TicketUpdates
        WHERE ticket_id = ?
        ORDER BY created_at ASC
      `),

      // SLA: find stale tickets
      getStaleTickets: this.db.prepare(`
        SELECT * FROM SupportTickets
        WHERE status NOT IN ('Resolved', 'Closed')
          AND last_updated_at < datetime('now', '-' || ? || ' hours')
      `),

      // SLA: insert alert (will fail silently on duplicate due to unique index)
      insertSlaAlert: this.db.prepare(`
        INSERT OR IGNORE INTO SlaAlerts (alert_id, ticket_id, window_key)
        VALUES (?, ?, ?)
      `),
    };
  }

  /**
   * Generate a short, human-friendly ticket ID.
   * Format: TKT-XXXXXX (6 random alphanumeric characters).
   * Retries on collision (32^6 ≈ 1 billion possibilities).
   */
  _generateTicketId() {
    for (let attempt = 0; attempt < 10; attempt++) {
      let id = 'TKT-';
      for (let i = 0; i < 6; i++) {
        id += ID_CHARS.charAt(Math.floor(Math.random() * ID_CHARS.length));
      }
      // Check uniqueness
      const existing = this.stmts.getTicketById.get(id);
      if (!existing) return id;
    }
    // Extremely unlikely fallback
    return 'TKT-' + uuidv4().split('-')[0].toUpperCase();
  }

  /**
   * Create a new support ticket from public submission.
   */
  createTicket(data) {
    const ticketId = this._generateTicketId();
    this.stmts.insertTicket.run(
      ticketId,
      data.customer_name,
      data.customer_email,
      data.customer_company,
      data.device_number,
      data.order_number,
      data.purchase_date,
      data.issue_subject,
      data.issue_description
    );
    return this.stmts.getTicketById.get(ticketId);
  }

  /**
   * Get a single ticket by ID.
   */
  getTicketById(ticketId) {
    return this.stmts.getTicketById.get(ticketId);
  }

  /**
   * List tickets with filtering, sorting, and pagination.
   */
  listTickets({ status, customer_company, sort_by, sort_order, page, limit }) {
    const conditions = [];
    const params = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (customer_company) {
      conditions.push('customer_company LIKE ?');
      params.push(`%${customer_company}%`);
    }

    const whereClause = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    // Priority-weighted sort: Critical=4, High=3, Medium=2, Low=1
    const priorityOrder = `
      CASE priority
        WHEN 'Critical' THEN 4
        WHEN 'High'     THEN 3
        WHEN 'Medium'   THEN 2
        WHEN 'Low'      THEN 1
        ELSE 0
      END
    `;

    // Determine sort column
    const allowedSorts = {
      priority: priorityOrder,
      created_at: 'created_at',
      last_updated_at: 'last_updated_at',
      customer_name: 'customer_name',
      customer_company: 'customer_company',
      status: 'status',
    };

    const sortCol = allowedSorts[sort_by] || priorityOrder;
    const order = sort_order === 'ASC' ? 'ASC' : 'DESC';

    // Default sort: priority DESC, then created_at DESC
    let orderByClause;
    if (sort_by && sort_by !== 'priority') {
      orderByClause = `ORDER BY ${sortCol} ${order}`;
    } else {
      orderByClause = `ORDER BY ${priorityOrder} DESC, created_at DESC`;
    }

    // Count total
    const countSql = `SELECT COUNT(*) as total FROM SupportTickets ${whereClause}`;
    const { total } = this.db.prepare(countSql).get(...params);

    // Paginate
    const offset = (page - 1) * limit;
    const dataSql = `
      SELECT * FROM SupportTickets
      ${whereClause}
      ${orderByClause}
      LIMIT ? OFFSET ?
    `;

    const tickets = this.db.prepare(dataSql).all(...params, limit, offset);

    return {
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update ticket priority and/or status.
   * When status or priority changes, a change_note and change_by are required.
   * The system will auto-log the change in the TicketUpdates timeline.
   *
   * @param {string} ticketId
   * @param {Object} updates           - { priority, status }
   * @param {Object} [changeContext]    - { change_note, change_by } — required if values change
   * @returns {Object|null} updated ticket, or null if not found
   * @throws {Error} CHANGE_NOTE_REQUIRED if values changed without a note
   * @throws {Error} NO_CHANGES if nothing actually changed
   */
  updateTicket(ticketId, updates, changeContext) {
    const ticket = this.stmts.getTicketById.get(ticketId);
    if (!ticket) return null;

    // Detect what actually changed
    const changes = [];
    if (updates.priority && updates.priority !== ticket.priority) {
      changes.push({ field: 'Priority', from: ticket.priority, to: updates.priority });
    }
    if (updates.status && updates.status !== ticket.status) {
      changes.push({ field: 'Status', from: ticket.status, to: updates.status });
    }

    if (changes.length === 0) {
      throw new Error('NO_CHANGES');
    }

    // Enforce: must provide a note for STATUS changes
    const hasStatusChange = changes.some(c => c.field === 'Status');
    if (hasStatusChange && (!changeContext || !changeContext.change_note)) {
      throw new Error('CHANGE_NOTE_REQUIRED');
    }
    if (!changeContext || !changeContext.change_by) {
      // Name is always required
      throw new Error('CHANGE_NOTE_REQUIRED');
    }

    // Build the timeline entry text
    const changeLines = changes.map(c => `⚙️ ${c.field}: ${c.from} → ${c.to}`);
    const updateText = changeLines.join('\n') + (changeContext.change_note ? '\n\n' + changeContext.change_note : '');

    const updateId = uuidv4();

    // Atomic: create timeline entry + update ticket fields
    const doUpdate = this.db.transaction(() => {
      // 1. Insert the timeline entry
      this.stmts.insertUpdate.run(updateId, ticketId, changeContext.change_by, updateText);

      // 2. Update the ticket fields
      const setClauses = [];
      const params = [];
      changes.forEach(c => {
        if (c.field === 'Priority') { setClauses.push('priority = ?'); params.push(c.to); }
        if (c.field === 'Status')   { setClauses.push('status = ?');   params.push(c.to); }
      });
      setClauses.push("last_updated_at = datetime('now')");
      params.push(ticketId);

      const sql = `UPDATE SupportTickets SET ${setClauses.join(', ')} WHERE ticket_id = ?`;
      this.db.prepare(sql).run(...params);
    });

    doUpdate();
    return this.stmts.getTicketById.get(ticketId);
  }

  /**
   * Add an update/note to a ticket.
   */
  addTicketUpdate(ticketId, data) {
    const ticket = this.stmts.getTicketById.get(ticketId);
    if (!ticket) return null;

    const updateId = uuidv4();

    // Use a transaction to ensure both operations succeed atomically
    const addUpdate = this.db.transaction(() => {
      this.stmts.insertUpdate.run(
        updateId,
        ticketId,
        data.internal_user,
        data.update_text
      );
      this.stmts.updateTicketTimestamp.run(ticketId);
    });

    addUpdate();

    return {
      update_id: updateId,
      ticket_id: ticketId,
      internal_user: data.internal_user,
      update_text: data.update_text,
    };
  }

  /**
   * Get all updates for a ticket.
   */
  getTicketUpdates(ticketId) {
    return this.stmts.getUpdatesByTicket.all(ticketId);
  }

  /**
   * Get all tickets matching filters (for export — no pagination).
   */
  listAllTickets({ status, customer_company }) {
    const conditions = [];
    const params = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (customer_company) {
      conditions.push('customer_company LIKE ?');
      params.push(`%${customer_company}%`);
    }

    const whereClause = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    const priorityOrder = `
      CASE priority
        WHEN 'Critical' THEN 4
        WHEN 'High'     THEN 3
        WHEN 'Medium'   THEN 2
        WHEN 'Low'      THEN 1
        ELSE 0
      END
    `;

    const sql = `
      SELECT * FROM SupportTickets
      ${whereClause}
      ORDER BY ${priorityOrder} DESC, created_at DESC
    `;

    return this.db.prepare(sql).all(...params);
  }

  /**
   * Find tickets that have breached SLA threshold.
   */
  getStaleTickets(thresholdHours) {
    return this.stmts.getStaleTickets.all(thresholdHours.toString());
  }

  /**
   * Record an SLA alert (returns true if new, false if duplicate).
   */
  recordSlaAlert(ticketId, windowKey) {
    const alertId = uuidv4();
    const result = this.stmts.insertSlaAlert.run(alertId, ticketId, windowKey);
    return result.changes > 0;
  }

  // ── Settings Methods ────────────────────────────────

  /**
   * Get all settings as a flat key-value object.
   */
  getSettings() {
    const rows = this.db.prepare('SELECT setting_key, setting_value FROM Settings').all();
    const settings = {};
    rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });
    return settings;
  }

  /**
   * Update multiple settings at once (upsert).
   */
  updateSettings(settingsObj) {
    const upsert = this.db.prepare(
      `INSERT INTO Settings (setting_key, setting_value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(setting_key) DO UPDATE SET
         setting_value = excluded.setting_value,
         updated_at = excluded.updated_at`
    );

    const updateAll = this.db.transaction(() => {
      for (const [key, value] of Object.entries(settingsObj)) {
        upsert.run(key, String(value));
      }
    });

    updateAll();
  }
}

module.exports = { TicketService };
