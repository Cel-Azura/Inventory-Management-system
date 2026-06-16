/**
 * product-service/src/server.js (V2)
 *
 * Routes:
 *   GET    /api/products               → list all products
 *   GET    /api/products/grouped       → tree: parent groups + variants
 *   GET    /api/products/parents       → only parent group nodes
 *   GET    /api/products/variants/:sku → variants of a given parent SKU
 *   GET    /api/products/low-stock     → products near threshold
 *   GET    /api/products/top-stock     → top N by quantity
 *   GET    /api/products/total-value   → inventory value
 *   GET    /api/products/:id           → single product
 *   POST   /api/products               → create product [admin]
 *   PUT    /api/products/:id           → update product [admin]
 *   DELETE /api/products/:id           → delete product [admin]
 *   PATCH  /api/products/:id/stock     → apply stock delta [internal]
 *   GET    /health
 */

require('dotenv').config();

const express        = require('express');
const cors           = require('cors');
const helmet         = require('helmet');
const morgan         = require('morgan');
const productService = require('./services/productService');

const app  = express();
const PORT = parseInt(process.env.PORT || '3002');

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

const ok  = (res, data, status = 200) => res.status(status).json({ success: true,  ...data });
const err = (res, msg, status = 400)  => res.status(status).json({ success: false, message: msg });

function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.headers['x-user-role'];
    if (!roles.includes(role)) return err(res, 'Không có quyền truy cập', 403);
    next();
  };
}

// ── Health ────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'product-service' }));

// ── Aggregates (must come before /:id routes) ─────────────────
app.get('/api/products/grouped', async (_req, res) => {
  try {
    const data = await productService.getGrouped();
    return ok(res, data);
  } catch (e) { return err(res, e.message); }
});

app.get('/api/products/parents', async (_req, res) => {
  try {
    const products = await productService.getParents();
    return ok(res, { products });
  } catch (e) { return err(res, e.message); }
});

app.get('/api/products/variants/:sku', async (req, res) => {
  try {
    const products = await productService.getVariants(req.params.sku);
    return ok(res, { products });
  } catch (e) { return err(res, e.message); }
});

app.get('/api/products/low-stock', async (_req, res) => {
  try {
    const products = await productService.getLowStock();
    return ok(res, { products });
  } catch (e) { return err(res, e.message); }
});

app.get('/api/products/top-stock', async (req, res) => {
  try {
    const n        = parseInt(req.query.n || '5');
    const products = await productService.getTopByStock(n);
    return ok(res, { products });
  } catch (e) { return err(res, e.message); }
});

app.get('/api/products/total-value', async (_req, res) => {
  try {
    const total = await productService.getTotalValue();
    return ok(res, { total });
  } catch (e) { return err(res, e.message); }
});

// ── GET /api/products ─────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  try {
    const { q } = req.query;
    const products = q
      ? await productService.search(q)
      : await productService.getAll();
    return ok(res, { products });
  } catch (e) { return err(res, e.message); }
});

// ── GET /api/products/:id ─────────────────────────────────────
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await productService.getById(parseInt(req.params.id));
    return ok(res, { product });
  } catch (e) { return err(res, e.message, 404); }
});

// ── POST /api/products ────────────────────────────────────────
app.post('/api/products', requireRole('admin'), async (req, res) => {
  try {
    const product = await productService.create(req.body);
    return ok(res, { product }, 201);
  } catch (e) { return err(res, e.message); }
});

// ── PUT /api/products/:id ─────────────────────────────────────
app.put('/api/products/:id', requireRole('admin'), async (req, res) => {
  try {
    const product = await productService.update(parseInt(req.params.id), req.body);
    return ok(res, { product });
  } catch (e) { return err(res, e.message); }
});

// ── DELETE /api/products/:id ──────────────────────────────────
app.delete('/api/products/:id', requireRole('admin'), async (req, res) => {
  try {
    const product = await productService.delete(parseInt(req.params.id));
    return ok(res, { deleted: true, product });
  } catch (e) { return err(res, e.message); }
});

// ── PATCH /api/products/:id/stock ────────────────────────────
app.patch('/api/products/:id/stock', async (req, res) => {
  try {
    const { delta } = req.body;
    if (typeof delta !== 'number') return err(res, 'delta phải là số');
    const product = await productService.applyStockDelta(parseInt(req.params.id), delta);
    return ok(res, { product });
  } catch (e) { return err(res, e.message); }
});

app.use((error, _req, res, _next) => {
  console.error('[product-service] Unhandled error:', error);
  return err(res, 'Lỗi máy chủ nội bộ', 500);
});

app.listen(PORT, () => {
  console.log(`[product-service] Running on port ${PORT}`);
});

module.exports = app;
