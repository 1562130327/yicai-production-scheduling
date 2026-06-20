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

// 获取订单的流程进度
router.get('/order/:orderId', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        op.*,
        w.name as worker_name,
        m.name as machine_name
      FROM order_progress op
      LEFT JOIN workers w ON op.worker_id = w.id
      LEFT JOIN machines m ON op.machine_id = m.id
      WHERE op.order_id = ?
      ORDER BY op.step_order
    `, [req.params.orderId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取师傅的待办任务
router.get('/worker/:workerId', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        op.*,
        o.order_no,
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
    `, [req.params.workerId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 新增流程步骤
router.post('/', async (req, res) => {
  try {
    const { order_id, step_name, step_order, worker_id, machine_id, casual_worker_count } = req.body;
    const [result] = await pool.query(
      `INSERT INTO order_progress
       (order_id, step_name, step_order, worker_id, machine_id, casual_worker_count)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [order_id, step_name, step_order, worker_id, machine_id, casual_worker_count || 0]
    );
    res.json({ id: result.insertId, message: '添加成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新流程步骤状态
router.put('/:id', async (req, res) => {
  try {
    const { status, quantity } = req.body;
    let updateFields = 'status = ?';
    let params = [status];

    if (status === '进行中') {
      updateFields += ', started_at = NOW()';
    } else if (status === '已完成') {
      updateFields += ', completed_at = NOW()';
    }

    if (quantity !== undefined) {
      updateFields += ', quantity = ?';
      params.push(quantity);
    }

    params.push(req.params.id);

    await pool.query(
      `UPDATE order_progress SET ${updateFields} WHERE id = ?`,
      params
    );

    // 检查订单是否全部完成
    if (status === '已完成') {
      const [progress] = await pool.query(
        'SELECT * FROM order_progress WHERE order_id = (SELECT order_id FROM order_progress WHERE id = ?)',
        [req.params.id]
      );

      const allCompleted = progress.every(p => p.status === '已完成');
      if (allCompleted) {
        await pool.query(
          "UPDATE orders SET status = '已完成', completed_at = NOW() WHERE id = (SELECT order_id FROM order_progress WHERE id = ?)",
          [req.params.id]
        );
      } else {
        // 更新订单状态为生产中
        await pool.query(
          "UPDATE orders SET status = '生产中' WHERE id = (SELECT order_id FROM order_progress WHERE id = ?)",
          [req.params.id]
        );
      }
    }

    res.json({ message: '更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除流程步骤
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM order_progress WHERE id = ?', [req.params.id]);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
