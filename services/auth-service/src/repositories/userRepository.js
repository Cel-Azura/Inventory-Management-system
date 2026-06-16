/**
 * userRepository.js
 * Persistence layer — all DB access for the users table.
 * Uses `pg` (node-postgres) for direct SQL queries.
 *
 * FIX: Tích hợp bcryptjs để hash mật khẩu khi tạo user
 *      và dùng bcrypt.compare() khi đăng nhập (thay vì plain text).
 */

const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');
const User     = require('../models/User');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  user:     process.env.DB_USER     || 'ims_admin',
  password: process.env.DB_PASS     || 'ims_secret_2024',
  database: process.env.DB_NAME     || 'ims_db',
  max: 10,
  idleTimeoutMillis: 30000,
});

const SALT_ROUNDS = 10;

const userRepository = {
  /** Return all users */
  async getAll() {
    const { rows } = await pool.query(
      'SELECT * FROM users ORDER BY id ASC'
    );
    return rows.map(r => new User(r));
  },

  /** Find by primary key */
  async getById(id) {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE id = $1', [id]
    );
    return rows[0] ? new User(rows[0]) : null;
  },

  /**
   * FIX: Authenticate — fetch user by username & active status,
   * then compare password with bcrypt (hỗ trợ cả hash lẫn plain text legacy).
   */
  async findByCredentials(username, password) {
    const { rows } = await pool.query(
      `SELECT * FROM users WHERE username = $1 AND status = 'active'`,
      [username]
    );
    if (!rows[0]) return null;

    const user = new User(rows[0]);

    // Hỗ trợ cả bcrypt hash (mới) lẫn plain text (legacy seed cũ)
    let isMatch = false;
    if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
      // Mật khẩu đã được hash bằng bcrypt
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      // Mật khẩu plain text (legacy — chỉ dùng cho seed ban đầu)
      isMatch = (password === user.password);
    }

    return isMatch ? user : null;
  },

  /** Check username uniqueness */
  async existsByUsername(username) {
    const { rows } = await pool.query(
      'SELECT 1 FROM users WHERE username = $1', [username]
    );
    return rows.length > 0;
  },

  /** FIX: Create a new user — hash password trước khi lưu */
  async create({ username, password, fullname, role }) {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await pool.query(
      `INSERT INTO users (username, password, fullname, role, status, created_at)
       VALUES ($1, $2, $3, $4, 'active', CURRENT_DATE)
       RETURNING *`,
      [username, hashedPassword, fullname, role || 'staff']
    );
    return new User(rows[0]);
  },

  /** Toggle active ↔ inactive */
  async toggleStatus(id) {
    const { rows } = await pool.query(
      `UPDATE users
       SET status = CASE WHEN status = 'active' THEN 'inactive' ELSE 'active' END
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return rows[0] ? new User(rows[0]) : null;
  },

  /** Hard-delete a user */
  async delete(id) {
    const { rowCount } = await pool.query(
      'DELETE FROM users WHERE id = $1', [id]
    );
    return rowCount > 0;
  },

  /** Count active users */
  async countActive() {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM users WHERE status = 'active'`
    );
    return parseInt(rows[0].cnt, 10);
  },

  /** FIX: Change password — hash mật khẩu mới trước khi lưu */
  async changePassword(id, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const { rows } = await pool.query(
      `UPDATE users SET password = $1 WHERE id = $2 RETURNING *`,
      [hashedPassword, id]
    );
    return rows[0] ? new User(rows[0]) : null;
  },
};

module.exports = userRepository;
