/**
 * api-gateway/src/server.js
 * =============================================================
 * IMS API Gateway — Single Entry Point (Lab 6 implementation)
 *
 * Responsibilities (ASR-02 / Lab 6):
 *  1. JWT Authentication   — validates every request (except /api/auth/login)
 *  2. Role-Based Authorization — injects x-user-role header for downstream
 *  3. Reverse Proxy Routing — forwards to correct microservice
 *  4. Rate Limiting         — prevents abuse
 *  5. Error handling        — 503 when a downstream service is unavailable
 *
 * Route Table:
 *  POST /api/auth/login            → auth-service    (public)
 *  *    /api/auth/*                → auth-service    [admin]
 *  *    /api/products/*            → product-service [all authenticated]
 *  *    /api/transactions/*        → transaction-svc [all authenticated]
 *  *    /api/reports/*             → report-service  [admin]
 * =============================================================
 */

require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const jwt       = require('jsonwebtoken');
const axios     = require('axios');
const rateLimit = require('express-rate-limit');

const app  = express();
const PORT = parseInt(process.env.PORT || '3000');

// ── Service URLs ──────────────────────────────────────────────
const SERVICES = {
  auth:        process.env.AUTH_SERVICE_URL        || 'http://localhost:3001',
  product:     process.env.PRODUCT_SERVICE_URL     || 'http://localhost:3002',
  transaction: process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3003',
  report:      process.env.REPORT_SERVICE_URL      || 'http://localhost:3004',
};

const JWT_SECRET = process.env.JWT_SECRET || 'ims_jwt_super_secret_key_2024';

// ── Middleware ────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'] }));
app.use(express.json());
app.use(morgan('combined'));

// Rate limiter — max 200 req/min per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { success: false, message: 'Quá nhiều yêu cầu, vui lòng thử lại sau' },
});
app.use(limiter);

// Strict limiter for login — max 10 attempts/min
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, message: 'Quá nhiều lần đăng nhập thất bại, thử lại sau 1 phút' },
});

// ── Helpers ───────────────────────────────────────────────────
function sendError(res, msg, status) {
  return res.status(status).json({ success: false, message: msg });
}

/**
 * JWT authentication middleware.
 * Decodes token, attaches user to req, injects headers for downstream services.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return sendError(res, 'Yêu cầu xác thực. Vui lòng đăng nhập', 401);
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    // Inject user context headers for downstream services
    req.headers['x-user-id']       = String(decoded.id);
    req.headers['x-user-username'] = decoded.username;
    req.headers['x-user-role']     = decoded.role;
    req.headers['x-user-fullname'] = decoded.fullname;

    next();
  } catch (e) {
    return sendError(res, 'Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại', 401);
  }
}

/**
 * Role authorization factory.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendError(res, 'Bạn không có quyền thực hiện thao tác này', 403);
    }
    next();
  };
}

/**
 * Generic proxy function — forwards request to target service.
 * Preserves method, headers, body. Returns 503 if service is down.
 */
async function proxy(req, res, targetBase) {
  // FIX: dung req.originalUrl de giu nguyen full path /api/...
  // app.use('/api/products') strip prefix khoi req.path => req.path = '/' thay vi '/api/products'
  // req.originalUrl luon giu path goc day du nhu '/api/products?q=...'
  const targetUrl = `${targetBase}${req.originalUrl}`;

  try {
    const response = await axios({
      method:  req.method,
      url:     targetUrl,
      headers: {
        ...req.headers,
        host: undefined,          // don't forward Host header
      },
      data:    req.body,
      timeout: 10000,
      validateStatus: () => true, // forward all status codes
    });

    return res.status(response.status).json(response.data);
  } catch (e) {
    if (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND' || e.code === 'ETIMEDOUT') {
      return sendError(res, 'Dịch vụ tạm thời không khả dụng (503)', 503);
    }
    console.error(`[gateway] Proxy error to ${targetUrl}:`, e.message);
    return sendError(res, 'Lỗi máy chủ nội bộ', 500);
  }
}

// ══════════════════════════════════════════════════════════════
//  ROUTE DEFINITIONS
// ══════════════════════════════════════════════════════════════

// ── Health ─────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'api-gateway', services: Object.keys(SERVICES) })
);

// ── [PUBLIC] POST /api/auth/login ──────────────────────────────
app.post('/api/auth/login', loginLimiter, (req, res) =>
  proxy(req, res, SERVICES.auth)
);

// ── [ADMIN] /api/auth/* (user management) ─────────────────────
app.use('/api/auth', authenticate, requireRole('admin'), (req, res) =>
  proxy(req, res, SERVICES.auth)
);

// ── [ALL] /api/products/* ─────────────────────────────────────
// GET requests: all authenticated users
// POST/PUT/DELETE: admin only (enforced at product-service via x-user-role header)
app.use('/api/products', authenticate, (req, res) =>
  proxy(req, res, SERVICES.product)
);

// ── [ALL] /api/transactions/* ─────────────────────────────────
// POST: any authenticated user (staff can create transactions)
// GET /audit: admin only (enforced at transaction-service)
app.use('/api/transactions', authenticate, (req, res) =>
  proxy(req, res, SERVICES.transaction)
);

// ── [ADMIN] /api/reports/* ────────────────────────────────────
app.use('/api/reports', authenticate, requireRole('admin'), (req, res) =>
  proxy(req, res, SERVICES.report)
);

// ── 404 catch-all ─────────────────────────────────────────────
app.use((_req, res) =>
  sendError(res, 'Endpoint không tồn tại', 404)
);

// ── Global error handler ──────────────────────────────────────
app.use((error, _req, res, _next) => {
  console.error('[api-gateway] Unhandled error:', error);
  return sendError(res, 'Lỗi máy chủ nội bộ', 500);
});

app.listen(PORT, () => {
  console.log(`[api-gateway] Running on port ${PORT}`);
  console.log('[api-gateway] Service map:', SERVICES);
});

module.exports = app;