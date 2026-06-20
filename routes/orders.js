const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const XLSX = require('xlsx');

router.get('/', async (req, res) => {
  try {
    const orders = await Order.findAll(req.query);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await Order.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/grouped', async (req, res) => {
  try {
    const grouped = await Order.getGroupedByProcess();
    res.json(grouped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const orders = await Order.findAll();
    const worksheet = XLSX.utils.json_to_sheet(orders.map(order => ({
      '订单编号': order.order_no,
      '款号': order.style_no,
      '客户': order.customer,
      '加工工艺': order.process_type,
      '类别': order.category,
      '优先级': order.priority,
      '备注': order.remark,
      '用料': order.material,
      '片材尺寸': order.sheet_size,
      '片材数量': order.sheet_qty,
      '切片尺寸': order.slice_size,
      '切片数量': order.slice_qty,
      '冲型尺寸': order.punch_size,
      '冲型数量': order.punch_qty,
      '冲型工艺': order.punch_process,
      '状态': order.status,
      '下单日期': order.order_date
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '生产排单表');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=production-schedule.xlsx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const order = await Order.create(req.body);
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const order = await Order.update(req.params.id, req.body);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Order.delete(req.params.id);
    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
