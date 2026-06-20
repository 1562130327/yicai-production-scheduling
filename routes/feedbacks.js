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

// 获取所有反馈
router.get('/', async (req, res) => {
  try {
    let query = `
      SELECT
        f.*,
        o.order_no,
        o.process_type,
        fw.name as from_worker_name,
        tw.name as to_worker_name,
        c.name as customer_name
      FROM feedbacks f
      LEFT JOIN orders o ON f.order_id = o.id
      LEFT JOIN workers fw ON f.from_worker_id = fw.id
      LEFT JOIN workers tw ON f.to_worker_id = tw.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (req.query.status) {
      query += ' AND f.status = ?';
      params.push(req.query.status);
    }

    if (req.query.type) {
      query += ' AND f.type = ?';
      params.push(req.query.type);
    }

    if (req.query.to_worker_id) {
      query += ' AND f.to_worker_id = ?';
      params.push(req.query.to_worker_id);
    }

    query += ' ORDER BY f.created_at DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取单个反馈
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        f.*,
        o.order_no,
        o.process_type,
        fw.name as from_worker_name,
        tw.name as to_worker_name,
        c.name as customer_name
      FROM feedbacks f
      LEFT JOIN orders o ON f.order_id = o.id
      LEFT JOIN workers fw ON f.from_worker_id = fw.id
      LEFT JOIN workers tw ON f.to_worker_id = tw.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE f.id = ?
    `, [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '反馈不存在' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 新增反馈
router.post('/', async (req, res) => {
  try {
    const { order_id, from_worker_id, to_worker_id, type, content } = req.body;

    // 如果没有指定接收人，根据类型自动分配
    let finalToWorkerId = to_worker_id;
    if (!finalToWorkerId) {
      // 获取管理员ID
      const [admins] = await pool.query("SELECT id FROM users WHERE role = '管理员' LIMIT 1");
      finalToWorkerId = admins.length > 0 ? admins[0].id : 1;
    }

    const [result] = await pool.query(
      `INSERT INTO feedbacks (order_id, from_worker_id, to_worker_id, type, content)
       VALUES (?, ?, ?, ?, ?)`,
      [order_id, from_worker_id, finalToWorkerId, type, content]
    );
    res.json({ id: result.insertId, message: '反馈提交成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新反馈状态
router.put('/:id', async (req, res) => {
  try {
    const { status, reply } = req.body;
    await pool.query(
      'UPDATE feedbacks SET status = ?, reply = ? WHERE id = ?',
      [status, reply, req.params.id]
    );
    res.json({ message: '更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除反馈
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM feedbacks WHERE id = ?', [req.params.id]);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
