/**
 * productService.js — Business Logic Layer (V2)
 * V2: Adds variant/grouped product support (parent_sku).
 */

const productRepository = require('../repositories/productRepository');

const productService = {

  async getAll() {
    return productRepository.getAll();
  },

  async getGrouped() {
    return productRepository.getGrouped();
  },

  async getParents() {
    return productRepository.getParents();
  },

  async getVariants(parentSku) {
    if (!parentSku) throw new Error('parentSku không được để trống');
    return productRepository.getVariants(parentSku);
  },

  async getById(id) {
    const product = await productRepository.getById(id);
    if (!product) throw new Error('Sản phẩm không tồn tại');
    return product;
  },

  async getBySku(sku) {
    const product = await productRepository.getBySku(sku);
    if (!product) throw new Error('SKU không tồn tại');
    return product;
  },

  async search(query) {
    if (!query || !query.trim()) return productRepository.getAll();
    return productRepository.search(query.trim());
  },

  /** Create — validates fields; parent groups may have price=0 */
  async create(data) {
    const { sku, name, price, parentSku } = data;
    if (!sku || !sku.trim())   throw new Error('SKU không được để trống');
    if (!name || !name.trim()) throw new Error('Tên sản phẩm không được để trống');
    // Parent group nodes have price=0; real products must have price > 0
    if (!parentSku && price <= 0 && data.threshold > 0) {
      throw new Error('Giá sản phẩm phải lớn hơn 0');
    }
    if (parentSku) {
      const parent = await productRepository.getBySku(parentSku);
      if (!parent) throw new Error(`SKU cha "${parentSku}" không tồn tại`);
    }
    return productRepository.create(data);
  },

  /** Update — product must exist */
  async update(id, data) {
    const { name, price, parentSku } = data;
    if (!name || !name.trim()) throw new Error('Tên sản phẩm không được để trống');
    if (parentSku) {
      const parent = await productRepository.getBySku(parentSku);
      if (!parent) throw new Error(`SKU cha "${parentSku}" không tồn tại`);
    }
    const product = await productRepository.update(id, data);
    if (!product) throw new Error('Sản phẩm không tồn tại');
    return product;
  },

  /** Delete */
  async delete(id) {
    const product = await productRepository.getById(id);
    if (!product) throw new Error('Sản phẩm không tồn tại');
    await productRepository.delete(id);
    return product;
  },

  /** Apply stock delta after a transaction (called by transaction-service). */
  async applyStockDelta(id, delta) {
    const product = await productRepository.updateStock(id, delta);
    if (!product) {
      throw new Error('Số lượng xuất vượt quá tồn kho hoặc sản phẩm không tồn tại');
    }
    return product;
  },

  async getLowStock() {
    return productRepository.getLowStock();
  },

  async getTopByStock(n = 5) {
    return productRepository.getTopByStock(n);
  },

  async getTotalValue() {
    return productRepository.getTotalValue();
  },
};

module.exports = productService;
