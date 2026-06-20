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

// 加工工艺分类定义（用于展示和筛选）
const PROCESS_CATEGORIES = {
  // 基础工序
  '片材': { name: '片材', color: '#667eea', icon: '📦' },
  '切片': { name: '切片', color: '#11998e', icon: '✂️' },
  '冲型': { name: '冲型', color: '#eb3349', icon: '🔧' },
  '背胶': { name: '背胶', color: '#f093fb', icon: '🏷️' },

  // 组合工序
  '片材切片': { name: '片材→切片', color: '#4facfe', icon: '📦✂️' },
  '片材冲型': { name: '片材→冲型', color: '#f5576c', icon: '📦🔧' },
  '片材背胶': { name: '片材→背胶', color: '#a855f7', icon: '📦🏷️' },
  '切片冲型': { name: '切片→冲型', color: '#f97316', icon: '✂️🔧' },

  // 复杂工序
  '片材切片冲型': { name: '片材→切片→冲型', color: '#8b5cf6', icon: '📦✂️🔧' },
  '片材背胶切片': { name: '片材→背胶→切片', color: '#06b6d4', icon: '📦🏷️✂️' },
  '片材背胶冲型': { name: '片材→背胶→冲型', color: '#ec4899', icon: '📦🏷️🔧' },
  '片材贴布切片冲型': { name: '片材→贴布→切片→冲型', color: '#14b8a6', icon: '📦🏷️✂️🔧' },
  '片材背胶切片冲型': { name: '片材→背胶→切片→冲型', color: '#f43f5e', icon: '📦🏷️✂️🔧' },

  // 库存工序
  '库存冲型': { name: '库存→冲型', color: '#64748b', icon: '🗄️🔧' },
  '库存切片': { name: '库存→切片', color: '#64748b', icon: '🗄️✂️' },
  '库存切片冲型': { name: '库存→切片→冲型', color: '#64748b', icon: '🗄️✂️🔧' }
};

// 获取所有排单数据（从数据库）
router.get('/', async (req, res) => {
  try {
    let query = `
      SELECT
        o.*,
        c.name as customer,
        m.name as material_name
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN materials m ON o.sheet_material_id = m.id
      WHERE 1=1
    `;
    const params = [];

    // 按加工工艺筛选
    if (req.query.process_type) {
      query += ' AND o.process_type = ?';
      params.push(req.query.process_type);
    }

    // 按客户筛选
    if (req.query.customer) {
      query += ' AND c.name LIKE ?';
      params.push(`%${req.query.customer}%`);
    }

    // 按优先级筛选
    if (req.query.priority) {
      query += ' AND o.priority = ?';
      params.push(req.query.priority);
    }

    // 搜索
    if (req.query.search) {
      query += ' AND (c.name LIKE ? OR o.material_info LIKE ? OR o.process_type LIKE ? OR o.style_no LIKE ?)';
      const search = `%${req.query.search}%`;
      params.push(search, search, search, search);
    }

    query += ' ORDER BY o.created_at DESC';

    const [rows] = await pool.query(query, params);

    // 格式化数据
    const result = rows.map(row => ({
      ...row,
      customer: row.customer || '-',
      material: row.material_name || row.material_info || '-'
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取统计信息
router.get('/stats', async (req, res) => {
  try {
    const [totalResult] = await pool.query('SELECT COUNT(*) as total FROM orders');
    const [urgentResult] = await pool.query(
      "SELECT COUNT(*) as urgent FROM orders WHERE priority IN ('特急', '注意')"
    );
    const [customersResult] = await pool.query(
      'SELECT COUNT(DISTINCT customer_id) as customers FROM orders WHERE customer_id IS NOT NULL'
    );
    const [processResult] = await pool.query(
      'SELECT COUNT(DISTINCT process_type) as processTypes FROM orders WHERE process_type IS NOT NULL'
    );

    // 按状态统计
    const [statusStats] = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM orders
      GROUP BY status
    `);

    res.json({
      total: totalResult[0].total,
      urgent: urgentResult[0].urgent,
      customers: customersResult[0].customers,
      processTypes: processResult[0].processTypes,
      byStatus: statusStats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 按加工工艺分组统计（用于气泡图）
router.get('/grouped', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        process_type,
        COUNT(*) as count,
        SUM(CASE WHEN status = '已完成' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = '生产中' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = '待排产' THEN 1 ELSE 0 END) as pending
      FROM orders
      WHERE process_type IS NOT NULL AND process_type != ''
      GROUP BY process_type
      ORDER BY count DESC
    `);

    // 添加样式信息
    const result = rows.map(row => ({
      ...row,
      ...(PROCESS_CATEGORIES[row.process_type] || {
        name: row.process_type,
        color: '#6b7280',
        icon: '📋'
      })
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取工艺分类定义（用于前端展示）
router.get('/categories', (req, res) => {
  res.json(PROCESS_CATEGORIES);
});

// 获取单个订单
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        o.*,
        c.name as customer,
        m.name as material_name
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN materials m ON o.sheet_material_id = m.id
      WHERE o.id = ?
    `, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 新增订单
router.post('/', async (req, res) => {
  try {
    const {
      orderNo, styleNo, customerId, processType, category, priority, remark,
      materialInfo, sheetSpec, sheetQty, sliceSpec, sliceQty,
      punchProcess, punchSpec, punchQty
    } = req.body;

    const [result] = await pool.query(`
      INSERT INTO orders (
        order_no, style_no, customer_id, process_type, category, priority, remark,
        material_info, sheet_spec, sheet_qty,
        slice_spec, slice_qty,
        punch_process, punch_spec, punch_qty,
        status, order_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '待排产', CURDATE())
    `, [
      orderNo, styleNo, customerId, processType, category, priority, remark,
      materialInfo, sheetSpec, sheetQty || 0,
      sliceSpec, sliceQty || 0,
      punchProcess, punchSpec, punchQty || 0
    ]);

    res.json({ id: result.insertId, message: '订单创建成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新订单
router.put('/:id', async (req, res) => {
  try {
    const {
      orderNo, styleNo, customerId, processType, category, priority, remark,
      materialInfo, sheetSpec, sheetQty, sheetCompleted,
      sliceSpec, sliceQty, sliceCompleted,
      punchProcess, punchSpec, punchQty, punchCompleted,
      status
    } = req.body;

    // 计算订单状态
    let newStatus = status;
    if (status !== '已完成' && status !== '已取消') {
      if (sheetCompleted > 0 || sliceCompleted > 0 || punchCompleted > 0) {
        newStatus = '生产中';
      } else {
        newStatus = '待排产';
      }
    }

    await pool.query(`
      UPDATE orders SET
        order_no = ?,
        style_no = ?,
        customer_id = ?,
        process_type = ?,
        category = ?,
        priority = ?,
        remark = ?,
        material_info = ?,
        sheet_spec = ?,
        sheet_qty = ?,
        sheet_completed = ?,
        slice_spec = ?,
        slice_qty = ?,
        slice_completed = ?,
        punch_process = ?,
        punch_spec = ?,
        punch_qty = ?,
        punch_completed = ?,
        status = ?,
        completed_at = CASE WHEN ? = '已完成' THEN NOW() ELSE completed_at END
      WHERE id = ?
    `, [
      orderNo, styleNo, customerId, processType, category, priority, remark,
      materialInfo, sheetSpec, sheetQty || 0, sheetCompleted || 0,
      sliceSpec, sliceQty || 0, sliceCompleted || 0,
      punchProcess, punchSpec, punchQty || 0, punchCompleted || 0,
      newStatus, newStatus,
      req.params.id
    ]);

    res.json({ message: '订单更新成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除订单
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM orders WHERE id = ?', [req.params.id]);
    res.json({ message: '订单删除成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
