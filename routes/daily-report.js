const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

// 获取日报数据
router.get('/', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];

    // 获取当日订单统计
    const [orders] = await pool.query(`
      SELECT
        status,
        COUNT(*) as count
      FROM orders
      WHERE DATE(created_at) = ? OR DATE(updated_at) = ?
      GROUP BY status
    `, [date, date]);

    // 获取当日完成的订单
    const [completedOrders] = await pool.query(`
      SELECT o.*, c.name as customer_name
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE DATE(o.completed_at) = ?
    `, [date]);

    // 获取当日反馈
    const [feedbacks] = await pool.query(`
      SELECT f.*, w.name as from_worker_name, o.order_no
      FROM feedbacks f
      LEFT JOIN workers w ON f.from_worker_id = w.id
      LEFT JOIN orders o ON f.order_id = o.id
      WHERE DATE(f.created_at) = ?
    `, [date]);

    // 获取师傅进度
    const [workerProgress] = await pool.query(`
      SELECT
        w.name as worker_name,
        COUNT(CASE WHEN op.status = '已完成' THEN 1 END) as completed,
        COUNT(CASE WHEN op.status = '进行中' THEN 1 END) as in_progress,
        COUNT(CASE WHEN op.status = '待开始' THEN 1 END) as pending
      FROM workers w
      LEFT JOIN order_progress op ON w.id = op.worker_id
      WHERE w.name IS NOT NULL
      GROUP BY w.id, w.name
    `);

    // 获取库存变动
    const [inventoryChanges] = await pool.query(`
      SELECT
        i.manufacturer,
        i.material,
        SUM(CASE WHEN it.type = 'inbound' THEN it.quantity ELSE 0 END) as inbound,
        SUM(CASE WHEN it.type = 'outbound' THEN it.quantity ELSE 0 END) as outbound
      FROM inventory_transactions it
      JOIN inventory i ON it.inventory_id = i.id
      WHERE DATE(it.transaction_date) = ?
      GROUP BY i.manufacturer, i.material
    `, [date]);

    res.json({
      date,
      orders: orders.reduce((acc, row) => { acc[row.status] = row.count; return acc; }, {}),
      completedOrders,
      feedbacks,
      workerProgress,
      inventoryChanges
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
