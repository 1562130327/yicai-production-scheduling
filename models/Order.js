const db = require('../config/database');

class Order {
  static async findAll(filters = {}) {
    let query = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (filters.process_type) {
      query += ' AND process_type = ?';
      params.push(filters.process_type);
    }

    if (filters.priority) {
      query += ' AND priority = ?';
      params.push(filters.priority);
    }

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.search) {
      query += ' AND (customer LIKE ? OR order_no LIKE ? OR material LIKE ?)';
      const search = '%' + filters.search + '%';
      params.push(search, search, search);
    }

    query += ' ORDER BY created_at DESC';
    const [rows] = await db.execute(query, params);
    return rows;
  }

  static async findById(id) {
    const [rows] = await db.execute('SELECT * FROM orders WHERE id = ?', [id]);
    return rows[0];
  }

  static async create(orderData) {
    const fields = Object.keys(orderData);
    const values = Object.values(orderData);
    const placeholders = fields.map(() => '?').join(', ');
    const query = 'INSERT INTO orders (' + fields.join(', ') + ') VALUES (' + placeholders + ')';
    const [result] = await db.execute(query, values);
    return { id: result.insertId, ...orderData };
  }

  static async update(id, orderData) {
    const fields = Object.keys(orderData);
    const values = Object.values(orderData);
    const setClause = fields.map(field => field + ' = ?').join(', ');
    const query = 'UPDATE orders SET ' + setClause + ' WHERE id = ?';
    await db.execute(query, [...values, id]);
    return { id, ...orderData };
  }

  static async delete(id) {
    await db.execute('DELETE FROM orders WHERE id = ?', [id]);
    return true;
  }

  static async getStats() {
    const [total] = await db.execute('SELECT COUNT(*) as count FROM orders');
    const [urgent] = await db.execute("SELECT COUNT(*) as count FROM orders WHERE priority IN ('注意', '特急')");
    const [completed] = await db.execute("SELECT COUNT(*) as count FROM orders WHERE status = '已完成'");
    const [inProgress] = await db.execute("SELECT COUNT(*) as count FROM orders WHERE status = '进行中'");

    return {
      total: total[0].count,
      urgent: urgent[0].count,
      completed: completed[0].count,
      inProgress: inProgress[0].count
    };
  }

  static async getGroupedByProcess() {
    const [rows] = await db.execute('SELECT process_type, COUNT(*) as count FROM orders GROUP BY process_type ORDER BY count DESC');
    return rows;
  }
}

module.exports = Order;
