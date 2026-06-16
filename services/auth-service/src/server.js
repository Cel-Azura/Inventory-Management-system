/**
 * auth-service/src/server.js
 * Entry point — Express HTTP server for the Auth Microservice.
 *
 * Routes:
 *   POST /api/auth/login          → issue JWT
 *   POST /api/auth/verify         → validate JWT (called by API Gateway)
 *   GET  /api/auth/users          → list users       [admin]
 *   POST /api/auth/users          → create user      [admin]
 *   PATCH /api/auth/users/:id/toggle → toggle status [admin]
 *   DELETE /api/auth/users/:id    → delete user      [admin]
 *   GET  /health                  → liveness probe
 */

require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const authService = require('./services/authService');

const app  = express();
const PORT = parseInt(process.env.PORT || '3001');

// ── Middleware ────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// ── Helpers ───────────────────────────────────────────────────
function ok(res, data, status = 200)  { return res.status(status).json({ success: true,  ...data }); }
function err(res, msg, status = 400)  { return res.status(status).json({ success: false, message: msg }); }

/**
 * requireRole middleware — verifies the x-user-role header injected
 * by the API Gateway after token validation.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.headers['x-user-role'];
    if (!roles.includes(role)) {
      return err(res, 'Bạn không có quyền thực hiện thao tác này', 403);
    }
    next();
  };
}

// ── Health ────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'auth-service' }));

// ── POST /api/auth/login ──────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password);
    return ok(res, result);
  } catch (e) {
    return err(res, e.message, 401);
  }
});

// ── POST /api/auth/verify ─────────────────────────────────────
// Called internally by the API Gateway to validate incoming JWTs
app.post('/api/auth/verify', (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return err(res, 'Token không được để trống', 400);
    const decoded = authService.verifyToken(token);
    return ok(res, { user: decoded });
  } catch (e) {
    return err(res, 'Token không hợp lệ hoặc đã hết hạn', 401);
  }
});

// ── GET /api/auth/users ───────────────────────────────────────
app.get('/api/auth/users', requireRole('admin'), async (_req, res) => {
  try {
    const users = await authService.getAllUsers();
    return ok(res, { users });
  } catch (e) {
    return err(res, e.message);
  }
});

// ── POST /api/auth/users ──────────────────────────────────────
app.post('/api/auth/users', requireRole('admin'), async (req, res) => {
  try {
    const actor = req.headers['x-user-username'];
    const user  = await authService.createUser(req.body, actor);
    return ok(res, { user }, 201);
  } catch (e) {
    return err(res, e.message);
  }
});

// ── PATCH /api/auth/users/:id/toggle ─────────────────────────
app.patch('/api/auth/users/:id/toggle', requireRole('admin'), async (req, res) => {
  try {
    const actor = req.headers['x-user-username'];
    const user  = await authService.toggleUserStatus(parseInt(req.params.id), actor);
    return ok(res, { user });
  } catch (e) {
    return err(res, e.message);
  }
});

// ── DELETE /api/auth/users/:id ────────────────────────────────
app.delete('/api/auth/users/:id', requireRole('admin'), async (req, res) => {
  try {
    const actor  = req.headers['x-user-username'];
    const result = await authService.deleteUser(parseInt(req.params.id), actor);
    return ok(res, result);
  } catch (e) {
    return err(res, e.message);
  }
});

// ── GET /api/auth/users/count-active ────────────────────────
app.get('/api/auth/users/count-active', async (_req, res) => {
  try {
    const count = await authService.countActiveUsers();
    return ok(res, { count });
  } catch (e) {
    return err(res, e.message);
  }
});

// ── Global error handler ──────────────────────────────────────
app.use((error, _req, res, _next) => {
  console.error('[auth-service] Unhandled error:', error);
  return err(res, 'Lỗi máy chủ nội bộ', 500);
});

app.listen(PORT, () => {
  console.log(`[auth-service] Running on port ${PORT}`);
});

module.exports = app;