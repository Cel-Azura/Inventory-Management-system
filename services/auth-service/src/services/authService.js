/**
 * authService.js  — Business Logic Layer
 * Handles login validation, JWT issuance, and user management rules.
 * Calls userRepository for all persistence operations.
 */

const jwt            = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');

const JWT_SECRET  = process.env.JWT_SECRET     || 'ims_jwt_super_secret_key_2024';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '8h';

const authService = {

  /**
   * Validate credentials and issue a JWT.
   * @returns {{ token, user }} on success
   * @throws  Error on invalid credentials
   */
  async login(username, password) {
    if (!username || !password) {
      throw new Error('Tên đăng nhập và mật khẩu không được để trống');
    }

    const user = await userRepository.findByCredentials(username, password);
    if (!user) {
      throw new Error('Tài khoản hoặc mật khẩu không đúng');
    }

    const payload = {
      id:       user.id,
      username: user.username,
      fullname: user.fullname,
      role:     user.role,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    return { token, user: user.toPublic() };
  },

  /**
   * Verify a JWT token and return the decoded payload.
   * @throws Error if token is invalid or expired
   */
  verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
  },

  // ── User Management (Admin only) ──────────────────────────

  async getAllUsers() {
    const users = await userRepository.getAll();
    return users.map(u => u.toPublic());
  },

  async createUser({ username, password, fullname, role }, actorUsername) {
    if (!username || !password || !fullname) {
      throw new Error('Vui lòng điền đầy đủ thông tin bắt buộc (*)');
    }
    const exists = await userRepository.existsByUsername(username);
    if (exists) {
      throw new Error(`Tên đăng nhập "${username}" đã tồn tại`);
    }
    const user = await userRepository.create({ username, password, fullname, role });
    return user.toPublic();
  },

  async toggleUserStatus(id, actorUsername) {
    const user = await userRepository.toggleStatus(id);
    if (!user) throw new Error('Người dùng không tồn tại');
    return user.toPublic();
  },

  async deleteUser(id, actorUsername) {
    const target = await userRepository.getById(id);
    if (!target) throw new Error('Người dùng không tồn tại');
    if (target.username === actorUsername) {
      throw new Error('Không thể xóa tài khoản đang đăng nhập');
    }
    await userRepository.delete(id);
    return { deleted: true };
  },

  async countActiveUsers() {
    return userRepository.countActive();
  },
};

module.exports = authService;