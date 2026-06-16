/**
 * Transaction domain model
 * Maps to the `transactions` table in PostgreSQL.
 * Also represents audit_log entries when used for the audit trail.
 */
class Transaction {
  constructor({ id, product_id, type, qty, note, username, created_at }) {
    this.id        = id;
    this.productId = product_id;
    this.type      = type;       // 'import' | 'export'
    this.qty       = Number(qty);
    this.note      = note || '';
    this.user      = username;
    this.time      = created_at || new Date().toISOString();
  }

  toJSON() {
    const obj = {
      id:          this.id,
      productId:   this.productId,
      productName: this.productName || null,  // FIX: ten san pham tu JOIN
      type:        this.type,
      qty:         this.qty,
      note:        this.note,
      user:        this.user,
      time:        this.time,
    };
    return obj;
  }
}

module.exports = Transaction;