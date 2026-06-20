const express = require('express');
const router = express.Router();
const dataStore = require('../models/data-store');

// 工艺流程映射（源自 data-store.js 单一数据源）
const WORKFLOW_MAP = dataStore.WORKFLOW_MAP;

// 估算零工需求（使用工序的 base_workers）
function estimateCasualWorkers(step, quantity) {
  let workers = step.base_workers || 1;

  // 根据订单数量调整
  if (quantity > 100) workers += 1;
  if (quantity > 200) workers += 1;
  if (quantity > 500) workers += 1;

  return workers;
}

// 估算预估时间（分钟）
function estimateTime(stepName, quantity) {
  const baseTime = {
    '横竖分切': 30,
    '破片': 20,
    '直切': 15,
    '冲型': 25,
    '背胶': 20,
    '贴布': 30,
    '打包': 10,
    '排废': 10,
    '直接出库': 5
  };

  let time = baseTime[stepName] || 15;

  // 根据数量调整
  time = Math.ceil(time * (quantity / 50));

  return time;
}

// 智能分配订单
router.post('/assign', (req, res) => {
  try {
    const { orderId, orderNo, customer, processType, material, sheetSpec, sheetQty, priority } = req.body;

    // 获取工艺流程
    const workflow = WORKFLOW_MAP[processType];
    if (!workflow) {
      return res.status(400).json({ error: '未知的加工工艺: ' + processType });
    }

    // 解析数量
    const quantity = parseInt(sheetQty) || 0;

    // 生成分配结果
    const assignments = workflow.map(step => ({
      order_id: orderId,
      order_no: orderNo,
      customer: customer,
      step_name: step.step_name,
      step_order: step.step_order,
      worker: step.worker,
      machine: step.machine,
      casual_workers: estimateCasualWorkers(step, quantity),
      estimated_time: estimateTime(step.step_name, quantity),
      material: material,
      sheet_spec: sheetSpec,
      sheet_qty: sheetQty,
      priority: priority
    }));

    res.json({
      success: true,
      order_id: orderId,
      process_type: processType,
      total_steps: assignments.length,
      total_casual_workers: Math.max(...assignments.map(a => a.casual_workers)),
      total_estimated_time: assignments.reduce((sum, a) => sum + a.estimated_time, 0),
      assignments: assignments
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 批量分配订单
router.post('/batch-assign', (req, res) => {
  try {
    const { orders } = req.body;

    const results = orders.map(order => {
      const workflow = WORKFLOW_MAP[order.process_type] || [];
      const quantity = parseInt(order.sheet_qty) || 0;

      return {
        order_id: order.id,
        order_no: order.order_no,
        customer: order.customer,
        process_type: order.process_type,
        assignments: workflow.map(step => ({
          step_name: step.step_name,
          step_order: step.step_order,
          worker: step.worker,
          machine: step.machine,
          casual_workers: estimateCasualWorkers(step, quantity),
          estimated_time: estimateTime(step.step_name, quantity)
        }))
      };
    });

    res.json({
      success: true,
      total_orders: results.length,
      results: results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取工艺流程
router.get('/workflow/:processType', (req, res) => {
  const workflow = WORKFLOW_MAP[req.params.processType];
  if (!workflow) {
    return res.status(404).json({ error: '未知的加工工艺' });
  }
  res.json(workflow);
});

// 获取所有工艺流程
router.get('/workflows', (req, res) => {
  res.json(WORKFLOW_MAP);
});

// 获取师傅工作量
router.get('/workload', (req, res) => {
  // 模拟数据
  const workload = [
    { worker: '郑思远', current_orders: 3, estimated_hours: 4.5 },
    { worker: '伍乾进', current_orders: 5, estimated_hours: 3.0 },
    { worker: '莫齐国', current_orders: 4, estimated_hours: 2.5 },
    { worker: '李乐', current_orders: 6, estimated_hours: 5.0 },
    { worker: '简翠花', current_orders: 2, estimated_hours: 1.5 },
    { worker: '杨合进', current_orders: 8, estimated_hours: 2.0 }
  ];
  res.json(workload);
});

// 生成打印数据
router.get('/print/:workerName', (req, res) => {
  const workerName = req.params.workerName;

  // 模拟打印数据
  const printData = {
    worker: workerName,
    date: new Date().toISOString().split('T')[0],
    tasks: [
      {
        order_no: 'YC0001',
        customer: '安源',
        process_type: '片材切片',
        material: '白色38°B料EVA（岳东）',
        sheet_spec: '1.44m*3.06m*25mm',
        sheet_qty: '60张',
        slice_spec: '100*234*25mm',
        slice_qty: '500片'
      },
      {
        order_no: 'YC0002',
        customer: '兴达',
        process_type: '片材冲型',
        material: '黑色高发泡1800（易升）',
        sheet_spec: '1.5m*2.4m*10mm',
        sheet_qty: '2张',
        punch_spec: '50*80*10mm',
        punch_qty: '200件'
      }
    ]
  };

  res.json(printData);
});

module.exports = router;
