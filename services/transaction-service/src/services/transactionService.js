/**
 * transactionService.js — Business Logic Layer
 *
 * Implements FR-03 (Warehouse Transactions) and ASR-01/ASR-03:
 *  - UC_CheckStock: verifies available stock before export
 *  - Calls product-service (via HTTP) to update stock level
 *  - Writes immutable audit trail via transactionRepository
 *
 * Communication pattern (Lab 4/6):
 *  Synchronous HTTP to product-service → confirm stock before committing.
 */

const axios                  = require('axios');
const transactionRepository  = require('../repositories/transactionRepository');

const PRODUCT_SVC = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';

const transactionService = {

  async getAll(filter = 'all') {
    return transactionRepository.getFiltered(filter);
  },

  async getRecent(n = 8) {
    return transactionRepository.getRecent(n);
  },

  async getAuditLog(limit = 50) {
    return transactionRepository.getAuditLog(limit);
  },

  /**
   * FR-03 / ASR-01: Process an import or export transaction.
   *
   * Steps:
   *  1. Validate inputs
   *  2. Fetch current product from product-service (synchronous HTTP)
   *  3. UC_CheckStock: reject export if qty > current stock
   *  4. Apply stock delta via product-service PATCH /stock
   *  5. Persist transaction record
   *  6. Write audit log entry (ASR-03)
   */
  async save({ productId, type, qty, note, user, ip }) {
    // 1. Validate
    if (!qty || qty < 1) throw new Error('Vui lòng nhập số lượng hợp lệ (≥ 1)');
    if (!['import', 'export'].includes(type)) throw new Error('Loại giao dịch không hợp lệ');

    // 2. Fetch product info from product-service
    let product;
    try {
      const { data } = await axios.get(`${PRODUCT_SVC}/api/products/${productId}`);
      product = data.product;
    } catch (e) {
      throw new Error('Không thể lấy thông tin sản phẩm từ product-service');
    }

    // 3. UC_CheckStock
    if (type === 'export' && qty > product.stock) {
      throw new Error(
        `Số lượng xuất (${qty}) vượt quá tồn kho hiện tại (${product.stock})`
      );
    }

    // 4. Apply stock delta via product-service
    const delta = type === 'import' ? qty : -qty;
    try {
      const { data } = await axios.patch(
        `${PRODUCT_SVC}/api/products/${productId}/stock`,
        { delta }
      );
      product = data.product;
    } catch (e) {
      throw new Error('Không thể cập nhật tồn kho tại product-service');
    }

    // 5. Persist transaction
    const tx = await transactionRepository.create({ productId, type, qty, note, user });

    // 6. Audit trail (ASR-03)
    await transactionRepository.addAudit({
      user,
      action: type === 'import' ? 'IMPORT' : 'EXPORT',
      target: product.name,
      detail: `${type === 'import' ? 'Nhập' : 'Xuất'} ${qty} đơn vị`,
      ip,
    });

    return { tx, product };
  },

  async countByType() {
    return transactionRepository.countByType();
  },

  /** For report-service internal use — returns breakdown with product info */
  async getCategoryBreakdown() {
    // Fetch all products to map productId → category
    let products = [];
    try {
      const { data } = await axios.get(`${PRODUCT_SVC}/api/products`);
      products = data.products;
    } catch (e) { /* fallback: empty breakdown */ }
    return transactionRepository.getCategoryBreakdown(products);
  },
};

module.exports = transactionService;