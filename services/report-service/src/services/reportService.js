/**
 * reportService.js — Business Logic Layer for Reports
 *
 * Aggregates statistics by calling product-service and transaction-service
 * via HTTP (Service Contract pattern from Lab 4/5).
 * Does NOT access any DB directly — pure aggregation logic.
 */

const axios = require('axios');

const PRODUCT_SVC     = process.env.PRODUCT_SERVICE_URL     || 'http://localhost:3002';
const TRANSACTION_SVC = process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3003';

const reportService = {

  /**
   * FR-04: Summary statistics for the dashboard report cards.
   * Calls product-service and transaction-service concurrently.
   */
  async getSummary() {
    const [productsRes, countsRes, valueRes] = await Promise.all([
      axios.get(`${PRODUCT_SVC}/api/products`),
      axios.get(`${TRANSACTION_SVC}/api/transactions/count`),
      axios.get(`${PRODUCT_SVC}/api/products/total-value`),
    ]);

    const products = productsRes.data.products || [];
    const counts   = countsRes.data;

    return {
      totalProducts:  products.length,
      totalValue:     valueRes.data.total   || 0,
      totalTx:        counts.total          || 0,
      importCount:    counts.import         || 0,
      exportCount:    counts.export         || 0,
    };
  },

  /**
   * Top N products by current stock level.
   */
  async getTopStock(n = 5) {
    const { data } = await axios.get(
      `${PRODUCT_SVC}/api/products/top-stock?n=${n}`
    );
    return data.products || [];
  },

  /**
   * Products with stock ≤ threshold (low-stock alerts).
   */
  async getLowStock() {
    const { data } = await axios.get(`${PRODUCT_SVC}/api/products/low-stock`);
    return data.products || [];
  },

  /**
   * Transaction volume breakdown by product category.
   */
  async getCategoryBreakdown() {
    const { data } = await axios.get(
      `${TRANSACTION_SVC}/api/transactions/category-breakdown`
    );
    return data.breakdown || [];
  },

  /**
   * Combined report payload — fetched in parallel for performance.
   */
  async getFullReport() {
    const [summary, topStock, lowStock, categoryBreakdown] = await Promise.all([
      this.getSummary(),
      this.getTopStock(5),
      this.getLowStock(),
      this.getCategoryBreakdown(),
    ]);
    return { summary, topStock, lowStock, categoryBreakdown };
  },
};

module.exports = reportService;