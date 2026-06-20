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

// 获取所有机器
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        m.*,
        w.name as worker_name
      FROM machines m
      LEFT JOIN workers w ON m.worker_id = w.id
      ORDER BY m.name
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取单个机器
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        m.*,
        w.name as worker_name
      FROM machines m
      LEFT JOIN workers w ON m.worker_id = w.id
      WHERE m.id = ?
    `, [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '机器不存在' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 新增机器
router.post('/', async (req, res) => {
  try {
    const { name, worker_id, status, description } = req.body;
    const [result] = await pool.query(
      'INSERT INTO machines (name, worker_id, status, description) VALUES (?, ?, ?, ?)',
      [name, worker_id, status || '正常', description]
    );
    res.json({ id: result.insertId, message: '添加成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新机器
router.put('/:id', async (req, res) => {
  try {
    const { name, worker_id, status, description } = req.body;
    await pool.query(
      'UPDATE machines SET name = ?, worker_id = ?, status = ?, description = ? WHERE id = ?',
      [name, worker_id, status, description, req.params.id]
    );
    res.json({ message: '更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除机器
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM machines WHERE id = ?', [req.params.id]);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
