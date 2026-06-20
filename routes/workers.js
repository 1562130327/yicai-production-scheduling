const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// 创建数据库连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

// 获取所有师傅
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM workers ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取单个师傅
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM workers WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '师傅不存在' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取师傅的任务列表
router.get('/:id/tasks', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        op.*,
        o.order_no,
        o.customer_id,
        o.process_type,
        o.material_info,
        o.sheet_spec,
        o.sheet_qty,
        o.slice_spec,
        o.slice_qty,
        o.punch_spec,
        o.punch_qty,
        o.priority,
        c.name as customer_name
      FROM order_progress op
      LEFT JOIN orders o ON op.order_id = o.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE op.worker_id = ? AND op.status != '已完成'
      ORDER BY o.priority DESC, op.step_order
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 新增师傅
router.post('/', async (req, res) => {
  try {
    const { name, phone, specialty } = req.body;
    const [result] = await pool.query(
      'INSERT INTO workers (name, phone, specialty) VALUES (?, ?, ?)',
      [name, phone, specialty]
    );
    res.json({ id: result.insertId, message: '添加成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新师傅
router.put('/:id', async (req, res) => {
  try {
    const { name, phone, specialty } = req.body;
    await pool.query(
      'UPDATE workers SET name = ?, phone = ?, specialty = ? WHERE id = ?',
      [name, phone, specialty, req.params.id]
    );
    res.json({ message: '更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除师傅
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM workers WHERE id = ?', [req.params.id]);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
