/**
 * Product domain model
 * Maps to the `products` table in PostgreSQL.
 * V2: Supports parent_sku for SKU variant grouping.
 */
class Product {
  constructor({ id, sku, parent_sku, name, category, description, price, stock, threshold, created_at, updated_at }) {
    this.id          = id;
    this.sku         = sku;
    this.parentSku   = parent_sku || null;
    this.name        = name;
    this.category    = category;
    this.desc        = description || '';
    this.price       = Number(price);
    this.stock       = Number(stock)     || 0;
    this.threshold   = Number(threshold) || 10;
    this.createdAt   = created_at;
    this.updatedAt   = updated_at;
  }

  isParent()  { return this.parentSku === null && this.price === 0; }
  isVariant() { return this.parentSku !== null; }

  toJSON() {
    return {
      id:        this.id,
      sku:       this.sku,
      parentSku: this.parentSku,
      name:      this.name,
      category:  this.category,
      desc:      this.desc,
      price:     this.price,
      stock:     this.stock,
      threshold: this.threshold,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

module.exports = Product;
