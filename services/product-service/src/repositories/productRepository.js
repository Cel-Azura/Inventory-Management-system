/**
 * productRepository.js — Persistence Layer (V2)
 * All DB access for the products table.
 * V2: Supports parent_sku for SKU variant/sub-product grouping.
 */

const { Pool } = require('pg');
const Product  = require('../models/Product');

const pool = new Pool({
  host:     process.env.DB_HOST || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  user:     process.env.DB_USER || 'ims_admin',
  password: process.env.DB_PASS || 'ims_secret_2024',
  database: process.env.DB_NAME || 'ims_db',
  max: 10,
  idleTimeoutMillis: 30000,
});

const productRepository = {

  /** Return all products ordered by id */
  async getAll() {
    const { rows } = await pool.query(
      'SELECT * FROM products ORDER BY id ASC'
    );
    return rows.map(r => new Product(r));
  },

  /** Find by primary key */
  async getById(id) {
    const { rows } = await pool.query(
      'SELECT * FROM products WHERE id = $1', [id]
    );
    return rows[0] ? new Product(rows[0]) : null;
  },

  /** Find by SKU */
  async getBySku(sku) {
    const { rows } = await pool.query(
      'SELECT * FROM products WHERE sku = $1', [sku]
    );
    return rows[0] ? new Product(rows[0]) : null;
  },

  /** Get all variants (children) of a parent SKU */
  async getVariants(parentSku) {
    const { rows } = await pool.query(
      'SELECT * FROM products WHERE parent_sku = $1 ORDER BY id ASC', [parentSku]
    );
    return rows.map(r => new Product(r));
  },

  /** Get all parent SKUs (groups) — products where parent_sku IS NULL and price = 0 */
  async getParents() {
    const { rows } = await pool.query(
      `SELECT * FROM products WHERE parent_sku IS NULL AND price = 0 ORDER BY category, id ASC`
    );
    return rows.map(r => new Product(r));
  },

  /**
   * Returns full grouped tree: each parent with its variants array.
   * Standalone products (parent_sku IS NULL, price > 0) are returned as-is.
   */
  async getGrouped() {
    const { rows } = await pool.query(
      'SELECT * FROM products ORDER BY id ASC'
    );
    const all      = rows.map(r => new Product(r));
    const parents  = all.filter(p => p.parentSku === null && p.price === 0);
    const variants = all.filter(p => p.parentSku !== null);
    const standalone = all.filter(p => p.parentSku === null && p.price > 0);

    const grouped = parents.map(parent => ({
      ...parent.toJSON(),
      isGroup:  true,
      variants: variants.filter(v => v.parentSku === parent.sku).map(v => v.toJSON()),
    }));

    return { groups: grouped, standalone: standalone.map(p => p.toJSON()) };
  },

  /** Full-text search on name, sku, category, description */
  async search(query) {
    const like = `%${query}%`;
    const { rows } = await pool.query(
      `SELECT * FROM products
       WHERE name        ILIKE $1
          OR sku         ILIKE $1
          OR category    ILIKE $1
          OR description ILIKE $1
       ORDER BY id ASC`,
      [like]
    );
    return rows.map(r => new Product(r));
  },

  /** Create a new product */
  async create({ sku, parentSku, name, category, desc, price, stock, threshold }) {
    const { rows } = await pool.query(
      `INSERT INTO products (sku, parent_sku, name, category, description, price, stock, threshold)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [sku, parentSku || null, name, category || '', desc || '', price, stock || 0, threshold || 10]
    );
    return new Product(rows[0]);
  },

  /** Update an existing product */
  async update(id, { name, category, desc, price, stock, threshold, parentSku }) {
    const { rows } = await pool.query(
      `UPDATE products
       SET name        = $1,
           category    = $2,
           description = $3,
           price       = $4,
           stock       = $5,
           threshold   = $6,
           parent_sku  = $7
       WHERE id = $8
       RETURNING *`,
      [name, category || '', desc || '', price, stock ?? 0, threshold ?? 10, parentSku || null, id]
    );
    return rows[0] ? new Product(rows[0]) : null;
  },

  /** Hard-delete a product */
  async delete(id) {
    const { rowCount } = await pool.query(
      'DELETE FROM products WHERE id = $1', [id]
    );
    return rowCount > 0;
  },

  /** Apply stock delta (positive = import, negative = export). */
  async updateStock(id, delta) {
    const { rows } = await pool.query(
      `UPDATE products
       SET stock = stock + $1
       WHERE id = $2 AND (stock + $1) >= 0
       RETURNING *`,
      [delta, id]
    );
    return rows[0] ? new Product(rows[0]) : null;
  },

  /** Products at or below their threshold (low stock alert) — exclude parent groups */
  async getLowStock() {
    const { rows } = await pool.query(
      `SELECT * FROM products
       WHERE stock <= threshold AND threshold > 0
       ORDER BY (stock::float / NULLIF(threshold, 0)) ASC`
    );
    return rows.map(r => new Product(r));
  },

  /** Top N products by stock quantity — exclude parent groups */
  async getTopByStock(n = 5) {
    const { rows } = await pool.query(
      `SELECT * FROM products WHERE threshold > 0 ORDER BY stock DESC LIMIT $1`, [n]
    );
    return rows.map(r => new Product(r));
  },

  /** Total inventory value: SUM(price * stock) — excludes parent groups (price=0) */
  async getTotalValue() {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(price * stock), 0) AS total FROM products`
    );
    return parseFloat(rows[0].total);
  },
};

module.exports = productRepository;
