/**
 * transaction-service/src/server.js
 * Express HTTP server for the Transaction Microservice.
 *
 * Routes:
 *   GET    /api/transactions           → list (filter: ?type=import|export|all)
 *   GET    /api/transactions/recent    → latest N transactions
 *   POST   /api/transactions           → create import/export transaction
 *   GET    /api/transactions/audit     → audit log   [admin]
 *   GET    /api/transactions/count     → counts by type
 *   GET    /api/transactions/category-breakdown → for reports
 *   GET    /health
 */

require('dotenv').config();

const express            = require('express');
const cors               = require('cors');
const helmet             = require('helmet');
const morgan             = require('morgan');
const transactionService = require('./services/transactionService');

const app  = express();
const PORT = parseInt(process.env.PORT || '3003');

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
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'transaction-service' })
);

// ── GET /api/transactions/recent ──────────────────────────────
app.get('/api/transactions/recent', async (req, res) => {
  try {
    const n  = parseInt(req.query.n || '8');
    const txs = await transactionService.getRecent(n);
    return ok(res, { transactions: txs });
  } catch (e) { return err(res, e.message); }
});

// ── GET /api/transactions/count ───────────────────────────────
app.get('/api/transactions/count', async (_req, res) => {
  try {
    const counts = await transactionService.countByType();
    return ok(res, counts);
  } catch (e) { return err(res, e.message); }
});

// ── GET /api/transactions/audit ───────────────────────────────
app.get('/api/transactions/audit', requireRole('admin'), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50');
    const log   = await transactionService.getAuditLog(limit);
    return ok(res, { log });
  } catch (e) { return err(res, e.message); }
});

// ── GET /api/transactions/category-breakdown ──────────────────
app.get('/api/transactions/category-breakdown', async (_req, res) => {
  try {
    const breakdown = await transactionService.getCategoryBreakdown();
    return ok(res, { breakdown });
  } catch (e) { return err(res, e.message); }
});

// ── GET /api/transactions ─────────────────────────────────────
app.get('/api/transactions', async (req, res) => {
  try {
    const type = req.query.type || 'all';
    const txs  = await transactionService.getAll(type);
    return ok(res, { transactions: txs });
  } catch (e) { return err(res, e.message); }
});

// ── POST /api/transactions ────────────────────────────────────
// FR-03: Execute import or export — any authenticated user (admin or staff)
app.post('/api/transactions', async (req, res) => {
  try {
    const user = req.headers['x-user-username'] || 'unknown';
    const ip   = req.headers['x-forwarded-for'] || req.ip || '127.0.0.1';
    const { productId, type, qty, note } = req.body;

    const result = await transactionService.save({
      productId: parseInt(productId),
      type,
      qty: parseInt(qty),
      note,
      user,
      ip,
    });
    return ok(res, result, 201);
  } catch (e) { return err(res, e.message); }
});

// ── Global error handler ──────────────────────────────────────
app.use((error, _req, res, _next) => {
  console.error('[transaction-service] Unhandled error:', error);
  return err(res, 'Lỗi máy chủ nội bộ', 500);
});

app.listen(PORT, () => {
  console.log(`[transaction-service] Running on port ${PORT}`);
});

module.exports = app;