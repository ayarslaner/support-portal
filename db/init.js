// ── SQLite Database Initialization (sql.js) ────────────
// Uses sql.js (pure JS/WASM SQLite) with a compatibility wrapper
// that provides the same API as better-sqlite3.
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'support.db');

/**
 * Compatibility wrapper around sql.js that exposes a better-sqlite3-like API.
 * This allows the rest of the application to use familiar methods
 * (prepare/run/get/all/exec/transaction) without knowing the underlying engine.
 */
class DatabaseWrapper {
  constructor(sqlDb, dbPath) {
    this._db = sqlDb;
    this._dbPath = dbPath;
    this._inTransaction = false;
  }

  /**
   * Persist the in-memory database to disk.
   * Skipped during transactions (saved once at commit).
   */
  _save() {
    if (!this._inTransaction) {
      const data = this._db.export();
      fs.writeFileSync(this._dbPath, Buffer.from(data));
    }
  }

  /**
   * Execute raw SQL (supports multiple statements). Used for DDL.
   */
  exec(sql) {
    this._db.exec(sql);
    this._save();
  }

  /**
   * Execute a PRAGMA statement.
   */
  pragma(str) {
    this._db.exec(`PRAGMA ${str};`);
  }

  /**
   * Returns a reusable prepared-statement-like object with run/get/all methods.
   * Each invocation creates a fresh sql.js statement internally,
   * uses it, and immediately frees it — safe for concurrent use.
   */
  prepare(sql) {
    const wrapper = this;
    const db = this._db;

    return {
      /**
       * Execute a write statement (INSERT/UPDATE/DELETE).
       * Returns { changes: number }.
       */
      run(...params) {
        db.run(sql, params);
        const changes = db.getRowsModified();
        wrapper._save();
        return { changes };
      },

      /**
       * Execute a read statement and return the first row as an object, or undefined.
       */
      get(...params) {
        const stmt = db.prepare(sql);
        if (params.length > 0) stmt.bind(params);
        let row = undefined;
        if (stmt.step()) {
          row = stmt.getAsObject();
        }
        stmt.free();
        return row;
      },

      /**
       * Execute a read statement and return all matching rows as an array of objects.
       */
      all(...params) {
        const stmt = db.prepare(sql);
        if (params.length > 0) stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
      },
    };
  }

  /**
   * Wraps a function in a BEGIN/COMMIT transaction.
   * Returns a new function that, when called, runs the original inside a transaction.
   * Saves to disk once at commit. Rolls back on error.
   */
  transaction(fn) {
    const wrapper = this;
    return function (...args) {
      wrapper._db.run('BEGIN');
      wrapper._inTransaction = true;
      try {
        const result = fn(...args);
        wrapper._db.run('COMMIT');
        wrapper._inTransaction = false;
        wrapper._save();
        return result;
      } catch (e) {
        wrapper._db.run('ROLLBACK');
        wrapper._inTransaction = false;
        throw e;
      }
    };
  }

  /**
   * Close the database and persist final state.
   */
  close() {
    this._save();
    this._db.close();
  }
}

/**
 * Initializes the SQLite database with all required tables and indexes.
 * Returns a DatabaseWrapper instance.
 *
 * NOTE: This function is async because sql.js WASM initialization is async.
 */
async function initDatabase() {
  const SQL = await initSqlJs();

  let sqlDb;
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(buffer);
  } else {
    sqlDb = new SQL.Database();
  }

  const db = new DatabaseWrapper(sqlDb, DB_PATH);

  // Enable foreign key enforcement
  db.pragma('foreign_keys = ON');

  // ── SupportTickets ─────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS SupportTickets (
      ticket_id         TEXT PRIMARY KEY,
      customer_name     TEXT NOT NULL,
      customer_email    TEXT NOT NULL,
      customer_company  TEXT NOT NULL,
      device_number     TEXT NOT NULL,
      order_number      TEXT NOT NULL,
      purchase_date     TEXT NOT NULL,
      issue_subject     TEXT NOT NULL,
      issue_description TEXT NOT NULL,
      priority          TEXT NOT NULL DEFAULT 'Medium'
                        CHECK(priority IN ('Low','Medium','High','Critical')),
      status            TEXT NOT NULL DEFAULT 'Open'
                        CHECK(status IN ('Open','In Progress','Resolved','Closed')),
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      last_updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── TicketUpdates ──────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS TicketUpdates (
      update_id     TEXT PRIMARY KEY,
      ticket_id     TEXT NOT NULL REFERENCES SupportTickets(ticket_id) ON DELETE CASCADE,
      internal_user TEXT NOT NULL,
      update_text   TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── SlaAlerts (deduplication table) ────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS SlaAlerts (
      alert_id   TEXT PRIMARY KEY,
      ticket_id  TEXT NOT NULL REFERENCES SupportTickets(ticket_id) ON DELETE CASCADE,
      alerted_at TEXT NOT NULL DEFAULT (datetime('now')),
      window_key TEXT NOT NULL
    );
  `);

  // ── Indexes ────────────────────────────────────────
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sla_dedup
      ON SlaAlerts(ticket_id, window_key);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tickets_status
      ON SupportTickets(status);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tickets_priority
      ON SupportTickets(priority);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tickets_company
      ON SupportTickets(customer_company);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_updates_ticket
      ON TicketUpdates(ticket_id);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tickets_updated
      ON SupportTickets(last_updated_at);
  `);

  // ── Settings (key-value store) ─────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS Settings (
      setting_key   TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL DEFAULT '',
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed default settings (INSERT OR IGNORE = only on first run)
  const defaultSettings = {
    smtp_host: '',
    smtp_port: '587',
    smtp_secure: 'false',
    smtp_user: '',
    smtp_pass: '',
    smtp_from: '',
    admin_email: '',
    sla_threshold_hours: '24',
    theme: 'dark',
    language: 'en',
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    db.exec(`INSERT OR IGNORE INTO Settings (setting_key, setting_value) VALUES ('${key}', '${value}');`);
  }

  console.log('✅ Database initialized at', DB_PATH);
  return db;
}

module.exports = { initDatabase };
