/**
 * report-service/src/server.js
 * Express HTTP server for the Report & Statistics Microservice.
 *
 * Routes:
 *   GET /api/reports/summary           → KPI cards (admin only)
 *   GET /api/reports/top-stock         → top N products by stock
 *   GET /api/reports/low-stock         → products near/below threshold
 *   GET /api/reports/category          → tx volume by category
 *   GET /api/reports/full              → all of the above in one call
 *   GET /health
 */

require('dotenv').config();

const express       = require('express');
const cors          = require('cors');
const helmet        = require('helmet');
const morgan        = require('morgan');
const reportService = require('./services/reportService');

const app  = express();
const PORT = parseInt(process.env.PORT || '3004');

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
  res.json({ status: 'ok', service: 'report-service' })
);

// ── GET /api/reports/summary ──────────────────────────────────
app.get('/api/reports/summary', requireRole('admin'), async (_req, res) => {
  try {
    const summary = await reportService.getSummary();
    return ok(res, { summary });
  } catch (e) { return err(res, e.message); }
});

// ── GET /api/reports/top-stock ────────────────────────────────
app.get('/api/reports/top-stock', requireRole('admin'), async (req, res) => {
  try {
    const n    = parseInt(req.query.n || '5');
    const data = await reportService.getTopStock(n);
    return ok(res, { products: data });
  } catch (e) { return err(res, e.message); }
});

// ── GET /api/reports/low-stock ────────────────────────────────
app.get('/api/reports/low-stock', async (_req, res) => {
  try {
    const products = await reportService.getLowStock();
    return ok(res, { products });
  } catch (e) { return err(res, e.message); }
});

// ── GET /api/reports/category ─────────────────────────────────
app.get('/api/reports/category', requireRole('admin'), async (_req, res) => {
  try {
    const breakdown = await reportService.getCategoryBreakdown();
    return ok(res, { breakdown });
  } catch (e) { return err(res, e.message); }
});

// ── GET /api/reports/full ─────────────────────────────────────
app.get('/api/reports/full', requireRole('admin'), async (_req, res) => {
  try {
    const report = await reportService.getFullReport();
    return ok(res, report);
  } catch (e) { return err(res, e.message); }
});

// ── Global error handler ──────────────────────────────────────
app.use((error, _req, res, _next) => {
  console.error('[report-service] Unhandled error:', error);
  return err(res, 'Lỗi máy chủ nội bộ', 500);
});

app.listen(PORT, () => {
  console.log(`[report-service] Running on port ${PORT}`);
});

module.exports = app;