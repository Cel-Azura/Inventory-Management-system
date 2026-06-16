/**
 * transactionRepository.js — Persistence Layer
 * Handles `transactions` and `audit_log` tables.
 * This service owns both tables (Data Ownership principle from Lab 4/5).
 */

const { Pool }      = require('pg');
const Transaction   = require('../models/Transaction');

const pool = new Pool({
  host:     process.env.DB_HOST || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  user:     process.env.DB_USER || 'ims_admin',
  password: process.env.DB_PASS || 'ims_secret_2024',
  database: process.env.DB_NAME || 'ims_db',
  max: 10,
  idleTimeoutMillis: 30000,
});

const transactionRepository = {

  // ─── Transactions ──────────────────────────────────────────

  async getAll() {
    const { rows } = await pool.query(
      'SELECT * FROM transactions ORDER BY created_at DESC'
    );
    return rows.map(r => new Transaction(r));
  },

  async getFiltered(type) {
    if (type === 'all') return this.getAll();
    const { rows } = await pool.query(
      'SELECT * FROM transactions WHERE type = $1 ORDER BY created_at DESC',
      [type]
    );
    return rows.map(r => new Transaction(r));
  },

  // FIX: JOIN voi products de lay ten san pham (productName) thay vi chi co productId
  async getRecent(n = 8) {
    const { rows } = await pool.query(
      `SELECT t.*, p.name AS product_name
       FROM transactions t
       LEFT JOIN products p ON p.id = t.product_id
       ORDER BY t.created_at DESC
       LIMIT $1`, [n]
    );
    return rows.map(r => {
      const tx = new Transaction(r);
      tx.productName = r.product_name || null;
      return tx;
    });
  },

  async getByProductId(productId) {
    const { rows } = await pool.query(
      'SELECT * FROM transactions WHERE product_id = $1 ORDER BY created_at DESC',
      [productId]
    );
    return rows.map(r => new Transaction(r));
  },

  async create({ productId, type, qty, note, user }) {
    const { rows } = await pool.query(
      `INSERT INTO transactions (product_id, type, qty, note, username)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [productId, type, qty, note || '', user]
    );
    return new Transaction(rows[0]);
  },

  async countByType() {
    const { rows } = await pool.query(
      `SELECT type, COUNT(*) AS cnt FROM transactions GROUP BY type`
    );
    const result = { import: 0, export: 0, total: 0 };
    rows.forEach(r => {
      result[r.type] = parseInt(r.cnt, 10);
      result.total  += parseInt(r.cnt, 10);
    });
    return result;
  },

  /** Returns [ [category, sumQty], ... ] sorted desc */
  async getCategoryBreakdown(products) {
    const all = await this.getAll();
    const cats = {};
    all.forEach(tx => {
      const p = products.find(p => p.id === tx.productId);
      if (!p) return;
      cats[p.category] = (cats[p.category] || 0) + tx.qty;
    });
    return Object.entries(cats).sort((a, b) => b[1] - a[1]);
  },

  // ─── Audit Log ─────────────────────────────────────────────

  async getAuditLog(limit = 50) {
    const { rows } = await pool.query(
      'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1', [limit]
    );
    return rows.map(r => ({
      time:   r.created_at,
      user:   r.username,
      action: r.action,
      target: r.target,
      detail: r.detail,
      ip:     r.ip,
    }));
  },

  async addAudit({ user, action, target, detail, ip }) {
    await pool.query(
      `INSERT INTO audit_log (username, action, target, detail, ip)
       VALUES ($1, $2, $3, $4, $5)`,
      [user, action, target, detail || '', ip || '127.0.0.1']
    );
  },
};

module.exports = transactionRepository;