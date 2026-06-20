const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
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

// 获取所有库存记录
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        i.*,
        m.name as manufacturer_name
      FROM inventory i
      LEFT JOIN manufacturers m ON i.manufacturer = m.name
      ORDER BY i.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取库存统计
router.get('/stats', async (req, res) => {
  try {
    const [totalStock] = await pool.query(
      'SELECT SUM(remaining_stock) as total FROM inventory'
    );

    const [byManufacturer] = await pool.query(`
      SELECT
        manufacturer,
        SUM(remaining_stock) as total
      FROM inventory
      GROUP BY manufacturer
      ORDER BY total DESC
    `);

    const [byMaterial] = await pool.query(`
      SELECT
        material,
        SUM(remaining_stock) as total
      FROM inventory
      GROUP BY material
      ORDER BY total DESC
      LIMIT 10
    `);

    res.json({
      totalStock: totalStock[0].total || 0,
      byManufacturer,
      byMaterial
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取单条库存记录
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM inventory WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 新增库存记录
router.post('/', async (req, res) => {
  try {
    const {
      manufacturer, material, specification,
      originalStock, weekInbound, weekOutbound,
      remainingStock, remark, weekStart, weekEnd
    } = req.body;

    const [result] = await pool.query(`
      INSERT INTO inventory
        (manufacturer, material, specification,
         original_stock, week_inbound, week_outbound,
         remaining_stock, remark, week_start, week_end)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      manufacturer, material, specification,
      originalStock || 0, weekInbound || 0, weekOutbound || 0,
      remainingStock || 0, remark || '', weekStart, weekEnd
    ]);

    res.json({ id: result.insertId, message: '添加成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新库存记录
router.put('/:id', async (req, res) => {
  try {
    const {
      manufacturer, material, specification,
      originalStock, weekInbound, weekOutbound,
      remainingStock, remark
    } = req.body;

    await pool.query(`
      UPDATE inventory SET
        manufacturer = ?,
        material = ?,
        specification = ?,
        original_stock = ?,
        week_inbound = ?,
        week_outbound = ?,
        remaining_stock = ?,
        remark = ?
      WHERE id = ?
    `, [
      manufacturer, material, specification,
      originalStock, weekInbound, weekOutbound,
      remainingStock, remark, req.params.id
    ]);

    res.json({ message: '更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除库存记录
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM inventory WHERE id = ?', [req.params.id]);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 导出库存为Excel
router.get('/export/excel', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM inventory ORDER BY created_at DESC');

    const data = rows.map(row => ({
      '厂家': row.manufacturer,
      '材质': row.material,
      '规格': row.specification,
      '原有库存': row.original_stock,
      '一周累计入库': row.week_inbound,
      '一周累计出库': row.week_outbound,
      '剩余库存': row.remaining_stock,
      '备注': row.remark,
      '周开始日期': row.week_start,
      '周结束日期': row.week_end
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '库存数据');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=inventory.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
