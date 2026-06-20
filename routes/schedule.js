const express = require('express');
const router = express.Router();
const scheduleData = require('../schedule-data');

// 获取所有排单数据
router.get('/', (req, res) => {
  try {
    let result = scheduleData;

    // 按加工工艺筛选
    if (req.query.process_type) {
      result = result.filter(o => o.process_type === req.query.process_type);
    }

    // 按客户筛选
    if (req.query.customer) {
      result = result.filter(o => o.customer.includes(req.query.customer));
    }

    // 按优先级筛选
    if (req.query.priority) {
      result = result.filter(o => o.priority === req.query.priority);
    }

    // 搜索
    if (req.query.search) {
      const search = req.query.search.toLowerCase();
      result = result.filter(o =>
        (o.customer && o.customer.toLowerCase().includes(search)) ||
        (o.material && o.material.toLowerCase().includes(search)) ||
        (o.process_type && o.process_type.toLowerCase().includes(search)) ||
        (o.style_no && o.style_no.toLowerCase().includes(search))
      );
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取统计信息
router.get('/stats', (req, res) => {
  try {
    const total = scheduleData.length;
    const urgent = scheduleData.filter(o => o.priority === '特急' || o.priority === '注意').length;
    const customers = [...new Set(scheduleData.map(o => o.customer).filter(Boolean))].length;
    const processTypes = [...new Set(scheduleData.map(o => o.process_type).filter(Boolean))].length;

    res.json({
      total,
      urgent,
      customers,
      processTypes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 按加工工艺分组统计
router.get('/grouped', (req, res) => {
  try {
    const grouped = {};
    scheduleData.forEach(o => {
      if (o.process_type) {
        grouped[o.process_type] = (grouped[o.process_type] || 0) + 1;
      }
    });
    const result = Object.entries(grouped).map(([process_type, count]) => ({
      process_type,
      count
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
