require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const scheduleData = require('./schedule-data');
const dataStore = require('./models/data-store');
const { bus, EVENTS } = require('./models/event-bus');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// 权限系统 (P0-3)
// ============================================
const sessions = new Map();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: '未登录' });
  }
  req.currentUser = sessions.get(token);
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.currentUser) {
      return res.status(401).json({ error: '未登录' });
    }
    if (!roles.includes(req.currentUser.role)) {
      return res.status(403).json({ error: '没有权限' });
    }
    next();
  };
}

// 登录 API
app.post('/api/login', (req, res) => {
  const { name, role } = req.body;
  if (!name || !role) {
    return res.status(400).json({ error: '缺少姓名或角色' });
  }
  const token = generateToken();
  sessions.set(token, { name, role, loginTime: new Date().toISOString() });
  res.json({ success: true, token, user: { name, role } });
});

// 登出 API
app.post('/api/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) sessions.delete(token);
  res.json({ success: true });
});

// 获取当前用户
app.get('/api/me', requireAuth, (req, res) => {
  res.json(req.currentUser);
});

// 初始化库存数据
dataStore.inventory = require('./schedule-data').inventory || [];

// 加载持久化数据（覆盖默认数据）
dataStore.loadFromFile();

// 如果持久化数据为空，用 schedule-data 的初始数据；否则同步到 scheduleData
if (dataStore.orders.length === 0) {
  scheduleData.forEach(o => dataStore.orders.push(o));
} else {
  // 用持久化数据覆盖 scheduleData
  scheduleData.length = 0;
  dataStore.orders.forEach(o => scheduleData.push(o));
}

// 注入 scheduleData 引用，让 data-store 能访问订单数据
dataStore.setScheduleDataRef(scheduleData);

// 检查数据库配置
const hasDbConfig = process.env.DB_HOST &&
                   process.env.DB_HOST !== 'your_cloud_db_host' &&
                   process.env.DB_USER &&
                   process.env.DB_PASSWORD;

console.log('📊 数据库配置状态:', hasDbConfig ? '已配置' : '使用本地数据');

if (hasDbConfig) {
  // 使用数据库路由
  const ordersRouter = require('./routes/orders');
  const scheduleRouter = require('./routes/schedule-v2');
  const inventoryRouter = require('./routes/inventory');
  const workersRouter = require('./routes/workers');
  const machinesRouter = require('./routes/machines');
  const orderProgressRouter = require('./routes/order-progress');
  const feedbacksRouter = require('./routes/feedbacks');
  const calculatorRouter = require('./routes/calculator');
  const dailyReportRouter = require('./routes/daily-report');
  const agentRouter = require('./routes/agent');
  app.use('/api/orders', ordersRouter);
  app.use('/api/schedule', scheduleRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/workers', workersRouter);
  app.use('/api/machines', machinesRouter);
  app.use('/api/order-progress', orderProgressRouter);
  app.use('/api/feedbacks', feedbacksRouter);
  app.use('/api/calculator', calculatorRouter);
  app.use('/api/daily-report', dailyReportRouter);
  app.use('/api/agent', agentRouter);
} else {
  // 使用本地 Mock 数据
  console.log('📦 使用本地 Mock 数据模式');

  // 解析 Excel 数据
  const XLSX = require('xlsx');

  // 读取库存表 (P2-10: 从 .env 读取路径)
  function getInventoryData() {
    try {
      const excelPath = process.env.INVENTORY_EXCEL_PATH || 'C:/Users/Administrator/Desktop/最新版EVA库存表.xlsx';
      const workbook = XLSX.readFile(excelPath);
      const targetSheet = '6.15-6.21';
      if (!workbook.SheetNames.includes(targetSheet)) return [];
      const raw = XLSX.utils.sheet_to_json(workbook.Sheets[targetSheet], { header: 1 });
      const records = [];
      let currentSupplier = '';
      for (let i = 2; i < raw.length; i++) {
        const row = raw[i];
        if (!row) continue;
        if (row[0]) currentSupplier = row[0];
        if (!row[1] || !row[2]) continue;
        let weekIn = 0, weekOut = 0;
        for (let j = 4; j <= 17; j += 2) {
          weekIn += parseFloat(row[j]) || 0;
          weekOut += parseFloat(row[j + 1]) || 0;
        }
        records.push({
          id: records.length + 1,
          manufacturer: currentSupplier,
          material: row[1],
          specification: row[2],
          original_stock: parseFloat(row[3]) || 0,
          week_inbound: weekIn,
          week_outbound: weekOut,
          remaining_stock: (parseFloat(row[3]) || 0) + weekIn - weekOut,
          remark: row[18] || ''
        });
      }
      return records;
    } catch (err) {
      console.error('读取库存表失败:', err.message);
      return [];
    }
  }

  // 如果库存仍为空，尝试从Excel导入（一次性初始化）
  if (dataStore.inventory.length === 0) {
    try {
      const excelData = getInventoryData();
      if (excelData.length > 0) {
        dataStore.inventory.length = 0;
        dataStore.inventory.push(...excelData);
        console.log('📊 已从Excel导入库存数据:', excelData.length, '条');
        dataStore.autoSave();
      }
    } catch (err) {
      console.error('从Excel导入库存失败:', err.message);
    }
  }

  // 排单 API
  app.get('/api/schedule', requireAuth, (req, res) => {
    let result = scheduleData;
    if (req.query.process_type) {
      result = result.filter(o => o.process_type === req.query.process_type);
    }
    if (req.query.customer) {
      result = result.filter(o => o.customer && o.customer.includes(req.query.customer));
    }
    if (req.query.priority) {
      result = result.filter(o => o.priority === req.query.priority);
    }
    if (req.query.search) {
      const search = req.query.search.toLowerCase();
      result = result.filter(o =>
        (o.customer && o.customer.toLowerCase().includes(search)) ||
        (o.material && o.material.toLowerCase().includes(search)) ||
        (o.process_type && o.process_type.toLowerCase().includes(search))
      );
    }
    res.json(result);
  });

  app.get('/api/schedule/stats', requireAuth, (req, res) => {
    const total = scheduleData.length;
    const urgent = scheduleData.filter(o => o.priority === '特急' || o.priority === '注意').length;
    const customers = [...new Set(scheduleData.map(o => o.customer).filter(Boolean))].length;
    const processTypes = [...new Set(scheduleData.map(o => o.process_type).filter(Boolean))].length;
    res.json({ total, urgent, customers, processTypes });
  });

  app.get('/api/schedule/grouped', requireAuth, (req, res) => {
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
  });

  app.get('/api/schedule/categories', requireAuth, (req, res) => {
    res.json({
      '片材': { name: '片材', color: '#667eea', icon: '📦' },
      '切片': { name: '切片', color: '#11998e', icon: '✂️' },
      '冲型': { name: '冲型', color: '#eb3349', icon: '🔧' },
      '片材切片': { name: '片材→切片', color: '#4facfe', icon: '📦✂️' },
      '片材冲型': { name: '片材→冲型', color: '#f5576c', icon: '📦🔧' },
      '片材背胶切片冲型': { name: '片材→背胶→切片→冲型', color: '#f43f5e', icon: '📦🏷️✂️🔧' }
    });
  });

  // 新建订单 API (P0-2)
  app.post('/api/schedule', requireAuth, requireRole('跟单员', '管理员'), (req, res) => {
    const d = req.body;
    const newId = scheduleData.length > 0 ? Math.max(...scheduleData.map(o => o.id)) + 1 : 1;
    const productSizes = d.productSizes || [];
    const sliceSize = productSizes.length > 0 ? productSizes.map(s => s.sliceSize || s.slice_size || '').filter(Boolean).join(', ') : d.sliceSize || '';
    const sliceQty = productSizes.length > 0 ? productSizes.reduce((sum, s) => sum + (parseInt(s.sliceQty || s.slice_qty || 0)), 0) : d.sliceQty || '';
    const punchSize = productSizes.length > 0 ? productSizes.map(s => s.punchSize || s.punch_size || '').filter(Boolean).join(', ') : d.punchSize || '';
    const punchQty = productSizes.length > 0 ? productSizes.reduce((sum, s) => sum + (parseInt(s.punchQty || s.punch_qty || 0)), 0) : d.punchQty || '';
    const punchProcess = productSizes.length > 0 ? productSizes.map(s => s.punchProcess || s.punch_process || '').filter(Boolean).join(', ') : d.punchProcess || '';

    const newOrder = {
      id: newId,
      order_no: d.orderNo || ('YC' + String(newId).padStart(4, '0')),
      style_no: d.styleNo || '',
      customer: d.customer || '',
      process_type: d.processType || '',
      category: d.category || '',
      priority: d.priority || '普通',
      remark: d.remark || '',
      material: d.material || '',
      sheet_size: d.sheetSpec || '',
      sheet_qty: d.sheetQty || '',
      slice_size: sliceSize,
      slice_qty: sliceQty,
      punch_process: punchProcess,
      punch_size: punchSize,
      punch_qty: punchQty,
      raw_width: d.rawWidth || '',
      raw_length: d.rawLength || '',
      raw_thickness: d.rawThickness || '',
      edge_remark: d.edgeRemark || '',
      product_sizes: JSON.stringify(productSizes),
      is_tiebu: d.isTiebu !== undefined ? d.isTiebu : false,
      is_tiebu_outsource: d.isTiebuOutsource !== undefined ? d.isTiebuOutsource : false,
      is_beijiao: d.isBeijiao !== undefined ? d.isBeijiao : false,
      is_beijiao_outsource: d.isBeijiaoOutsource !== undefined ? d.isBeijiaoOutsource : false,
      is_dianjiao: d.isDianjiao !== undefined ? d.isDianjiao : false,
      sheet_done: '',
      slice_done: '',
      punch_done: '',
      completed: '',
      order_date: new Date().toISOString().split('T')[0],
      due_date: d.dueDate || '',
      status: '待分配',
      created_at: new Date().toISOString()
    };

    scheduleData.push(newOrder);
    dataStore.orders.push(newOrder);
    dataStore.logOperation(null, '新建订单', 'order', newId, { order_no: newOrder.order_no, customer: newOrder.customer });
    dataStore.autoSave();

    bus.emit(EVENTS.ORDER_CREATED, { order: newOrder, user: req.currentUser });

    res.json({ success: true, message: '订单创建成功', order: newOrder });
  });

  // 库存 API
  app.get('/api/inventory', requireAuth, (req, res) => {
    res.json(dataStore.inventory);
  });

  app.get('/api/inventory/stats', requireAuth, (req, res) => {
    const data = dataStore.inventory;
    const totalStock = data.reduce((sum, item) => sum + (item.remaining_stock || 0), 0);
    const materials = new Set(data.map(item => item.material));
    const manufacturers = new Set(data.map(item => item.manufacturer));
    res.json({
      totalStock,
      materialCount: materials.size,
      supplierCount: manufacturers.size
    });
  });

  // 师傅 Mock 数据
  // 使用统一数据模型中的师傅和机器数据
  const workersData = dataStore.workers;

  // 使用统一数据模型中的机器数据
  const machinesData = dataStore.machines;

  // 反馈 Mock 数据
  let feedbacksData = dataStore.feedbacks;

  // 师傅 API
  app.get('/api/workers', requireAuth, (req, res) => {
    res.json(workersData);
  });

  app.get('/api/workers/:id', requireAuth, (req, res) => {
    const worker = workersData.find(w => w.id == req.params.id);
    if (!worker) return res.status(404).json({ error: '师傅不存在' });
    res.json(worker);
  });

  app.post('/api/workers', requireAuth, (req, res) => {
    const newWorker = { id: workersData.length + 1, ...req.body };
    workersData.push(newWorker);
    res.json({ id: newWorker.id, message: '添加成功' });
    dataStore.autoSave();
  });

  // 机器 API
  app.get('/api/machines', requireAuth, (req, res) => {
    res.json(machinesData);
  });

  app.get('/api/machines/:id', requireAuth, (req, res) => {
    const machine = machinesData.find(m => m.id == req.params.id);
    if (!machine) return res.status(404).json({ error: '机器不存在' });
    res.json(machine);
  });

  // 反馈 API
  app.get('/api/feedbacks', requireAuth, (req, res) => {
    let result = feedbacksData;
    if (req.query.status) {
      result = result.filter(f => f.status === req.query.status);
    }
    if (req.query.to_worker) {
      result = result.filter(f => f.to_worker === req.query.to_worker);
    }
    res.json(result);
  });

  app.post('/api/feedbacks', requireAuth, (req, res) => {
    const { order_id, from_worker_id, type, content, step_name } = req.body;

    // 确定反馈接收人
    let toWorker = '管理员';

    // 根据反馈类型确定接收人
    if (type === '材料问题' || type === '人员不足') {
      toWorker = '跟单员+管理员';
    } else if (type === '机器故障') {
      toWorker = '管理员';
    } else if (step_name && order_id) {
      // 找到上一步的负责人
      const orderAssignments = dataStore.assignments
        .filter(a => a.order_id == order_id)
        .sort((a, b) => a.step_order - b.step_order);
      const currentStepIndex = orderAssignments.findIndex(a => a.step_name === step_name);
      if (currentStepIndex > 0) {
        toWorker = orderAssignments[currentStepIndex - 1].worker + '+跟单员+管理员';
      }
    }

    const newFeedback = {
      id: feedbacksData.length + 1,
      order_id,
      from_worker_id,
      to_worker: toWorker,
      type,
      content,
      step_name,
      status: '待处理',
      created_at: new Date().toISOString()
    };

    feedbacksData.push(newFeedback);

    bus.emit(EVENTS.FEEDBACK_SUBMITTED, { feedback: newFeedback });

    // P0-4: 反馈联动 - 暂停相关工序，通知相关人员
    if (order_id) {
      const orderAssignments = dataStore.assignments
        .filter(a => a.order_id == order_id)
        .sort((a, b) => a.step_order - b.step_order);

      // 找到当前进行中的工序并暂停
      const currentAssignment = orderAssignments.find(a => a.status === '进行中');
      if (currentAssignment) {
        currentAssignment.status = '暂停';
        currentAssignment.pause_reason = `反馈: ${type} - ${content}`;
        currentAssignment.paused_at = new Date().toISOString();
        dataStore.logOperation(from_worker_id, '反馈暂停工序', 'assignment', currentAssignment.id, {
          order_id, feedback_id: newFeedback.id, reason: type
        });
      }

      // 通知上一步师傅 + 跟单员 + 管理员
      if (step_name) {
        const currentStepIndex = orderAssignments.findIndex(a => a.step_name === step_name);
        if (currentStepIndex > 0) {
          const prevAssignment = orderAssignments[currentStepIndex - 1];
          dataStore.logOperation(from_worker_id, '反馈通知', 'order', order_id, {
            notify_to: prevAssignment.worker,
            message: `订单 ${order_id} 收到反馈: ${type}，请关注`
          });
        }
      }

      dataStore.autoSave();
    }

    res.json({ id: newFeedback.id, message: '反馈提交成功', to_worker: toWorker });
  });

  app.put('/api/feedbacks/:id', requireAuth, (req, res) => {
    const feedback = feedbacksData.find(f => f.id == req.params.id);
    if (!feedback) return res.status(404).json({ error: '反馈不存在' });
    Object.assign(feedback, req.body);
    res.json({ message: '更新成功' });
    dataStore.autoSave();
  });

  // 算料 API
  app.post('/api/calculator/calculate', (req, res) => {
    const {
      productThickness, productWidth, productLength, productQty,
      rawMaterialThickness, rawMaterialWidth, rawMaterialLength,
      edgeWidth, edgeLength  // 打边尺寸（可选）
    } = req.body;

    const THICKNESS_RULES = { 58: 60, 54: 55 };
    const SIZE_RULES = { 1: 1.05, 1.2: 1.27, 1.4: 1.46, 1.5: 1.55, 3: 3.07 };

    let actualThickness = THICKNESS_RULES[productThickness] || productThickness;
    const sheetsPerBed = Math.floor(rawMaterialThickness / actualThickness);

    const actualRawWidth = SIZE_RULES[rawMaterialWidth] || rawMaterialWidth;
    const actualRawLength = SIZE_RULES[rawMaterialLength] || rawMaterialLength;

    // 计算打边后的可用尺寸
    const usableWidth = edgeWidth ? (actualRawWidth * 1000 - edgeWidth * 2) : (actualRawWidth * 1000);
    const usableLength = edgeLength ? (actualRawLength * 1000 - edgeLength * 2) : (actualRawLength * 1000);

    // 直接切算法
    const piecesPerSheetByWidth = Math.floor(usableWidth / productWidth);
    const piecesPerSheetByLength = Math.floor(usableLength / productLength);
    const piecesPerSheet = piecesPerSheetByWidth * piecesPerSheetByLength;

    // 套料切算法（尝试旋转90度）
    const piecesPerSheetByWidthAlt = Math.floor(usableWidth / productLength);
    const piecesPerSheetByLengthAlt = Math.floor(usableLength / productWidth);
    const piecesPerSheetAlt = piecesPerSheetByWidthAlt * piecesPerSheetByLengthAlt;

    // 选择最优切法
    const bestPieces = Math.max(piecesPerSheet, piecesPerSheetAlt);
    const useAltMethod = piecesPerSheetAlt > piecesPerSheet;

    const totalPiecesNeeded = Math.ceil(productQty / sheetsPerBed);
    const sheetsNeeded = Math.ceil(totalPiecesNeeded / bestPieces);
    const bedsNeeded = Math.ceil(productQty / (sheetsPerBed * bestPieces));

    // 库存检查
    const inventoryAlerts = [];
    dataStore.inventory.forEach(item => {
      if (item.material && item.material.includes(productThickness + 'mm')) {
        if (item.remaining_stock < sheetsNeeded) {
          inventoryAlerts.push({
            material: item.material,
            current: item.remaining_stock,
            needed: sheetsNeeded,
            shortage: sheetsNeeded - item.remaining_stock
          });
        }
      }
    });

    res.json({
      input: {
        productThickness, productWidth, productLength, productQty,
        rawMaterialThickness, rawMaterialWidth, rawMaterialLength,
        edgeWidth: edgeWidth || 0, edgeLength: edgeLength || 0
      },
      result: {
        actualThickness,
        sheetsPerBed,
        piecesPerSheet: bestPieces,
        piecesPerSheetByWidth: useAltMethod ? piecesPerSheetByWidthAlt : piecesPerSheetByWidth,
        piecesPerSheetByLength: useAltMethod ? piecesPerSheetByLengthAlt : piecesPerSheetByLength,
        sheetsNeeded,
        bedsNeeded,
        waste: (sheetsNeeded * bestPieces * sheetsPerBed) - productQty,
        cutMethod: useAltMethod ? '套料切（旋转90度）' : '直接切',
        usableWidth: usableWidth.toFixed(0) + 'mm',
        usableLength: usableLength.toFixed(0) + 'mm'
      },
      notes: {
        thicknessRule: THICKNESS_RULES[productThickness] ? `${productThickness}mm → ${actualThickness}mm` : '无需换算',
        sizeRule: `${rawMaterialWidth}m → ${actualRawWidth}m, ${rawMaterialLength}m → ${actualRawLength}m`,
        edgeNote: edgeWidth || edgeLength ? `打边: 宽度-${edgeWidth*2 || 0}mm, 长度-${edgeLength*2 || 0}mm` : '无打边'
      },
      inventoryAlerts
    });
  });

  // 多订单配套算料
  app.post('/api/calculator/batch-calculate', (req, res) => {
    const { orders } = req.body;

    // 按原材料规格分组
    const groups = {};
    orders.forEach(order => {
      const key = `${order.rawWidth || 1.4}_${order.rawLength || 3}_${order.rawThickness || 60}`;
      if (!groups[key]) {
        groups[key] = {
          rawWidth: order.rawWidth || 1.4,
          rawLength: order.rawLength || 3,
          rawThickness: order.rawThickness || 60,
          orders: []
        };
      }
      groups[key].orders.push(order);
    });

    // 计算每个组的最佳方案
    const results = Object.entries(groups).map(([key, group]) => {
      const { rawWidth, rawLength, rawThickness, orders } = group;

      // 计算总需求厚度
      const totalThicknessNeeded = orders.reduce((sum, o) => {
        return sum + (o.thickness * o.qty);
      }, 0);

      // 计算一床可开多少张
      const sheetsPerBed = Math.floor(rawThickness / Math.min(...orders.map(o => o.thickness)));

      // 计算需要多少床
      const bedsNeeded = Math.ceil(totalThicknessNeeded / (rawThickness * sheetsPerBed));

      // 生成方案
      const plan = [];
      let remainingThickness = totalThicknessNeeded;

      orders.forEach(order => {
        const bedsForOrder = Math.ceil((order.thickness * order.qty) / rawThickness);
        plan.push({
          orderId: order.id,
          thickness: order.thickness,
          qty: order.qty,
          beds: bedsForOrder,
          sheetsPerBed: Math.floor(rawThickness / order.thickness)
        });
        remainingThickness -= (order.thickness * order.qty);
      });

      return {
        rawSpec: `${rawWidth}m × ${rawLength}m × ${rawThickness}mm`,
        totalOrders: orders.length,
        bedsNeeded,
        plan,
        waste: Math.max(0, remainingThickness)
      };
    });

    res.json({ success: true, results });
  });

  // 切割优化
  app.post('/api/calculator/cut-optimization', (req, res) => {
    const { width, length, cuts } = req.body;

    // 计算最优切割方案
    const solutions = [];

    // 方案1：直接切
    const solution1 = {
      name: '直接切',
      cuts: cuts.map(cut => ({
        width: cut.width,
        length: cut.length,
        quantity: Math.floor((width * length) / (cut.width * cut.length))
      }))
    };
    solutions.push(solution1);

    // 方案2：旋转90度切
    const solution2 = {
      name: '旋转90度切',
      cuts: cuts.map(cut => ({
        width: cut.length,
        length: cut.width,
        quantity: Math.floor((width * length) / (cut.width * cut.length))
      }))
    };
    solutions.push(solution2);

    // 选择最优方案
    const bestSolution = solutions.reduce((best, current) => {
      const currentTotal = current.cuts.reduce((sum, c) => sum + c.quantity, 0);
      const bestTotal = best.cuts.reduce((sum, c) => sum + c.quantity, 0);
      return currentTotal > bestTotal ? current : best;
    });

    res.json({
      success: true,
      input: { width, length, cuts },
      solutions,
      bestSolution
    });
  });

  // 日报 API (P1-7: 使用真实数据)
  app.get('/api/daily-report', requireAuth, (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];

    // 统计订单
    const orderStats = {};
    scheduleData.forEach(o => {
      orderStats[o.status] = (orderStats[o.status] || 0) + 1;
    });

    // 从真实分配数据统计师傅进度
    const workerProgress = workersData.filter(w => w.role === '师傅').map(w => {
      const workerAssignments = dataStore.assignments.filter(a => a.worker === w.name);
      return {
        worker_name: w.name,
        completed: workerAssignments.filter(a => a.status === '已完成').length,
        in_progress: workerAssignments.filter(a => a.status === '进行中').length,
        pending: workerAssignments.filter(a => a.status === '待开始').length
      };
    });

    res.json({
      date,
      orders: orderStats,
      completedOrders: scheduleData.filter(o => o.status === '已完成').slice(0, 5),
      feedbacks: feedbacksData.filter(f => {
        const fDate = new Date(f.created_at).toISOString().split('T')[0];
        return fDate === date;
      }),
      workerProgress,
      inventoryChanges: []
    });
  });

  // 首页
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // Agent API (Mock 模式)
  const WORKFLOW_MAP = dataStore.WORKFLOW_MAP;

  function estimateCasualWorkers(step, quantity) {
    let workers = step.base_workers || 1;
    if (quantity > 100) workers += 1;
    if (quantity > 200) workers += 1;
    return workers;
  }

  function estimateTime(stepName, quantity) {
    const baseTime = { '横竖分切': 30, '破片': 20, '直切': 15, '冲型': 25, '背胶': 20, '贴布': 30, '打包': 10, '排废': 10, '直接出库': 5 };
    let time = baseTime[stepName] || 15;
    time = Math.ceil(time * (quantity / 50));
    return time;
  }

  app.post('/api/agent/assign', requireAuth, requireRole('管理员'), (req, res) => {
    const { orderId, orderNo, customer, processType, material, sheetSpec, sheetQty, priority } = req.body;
    const workflow = WORKFLOW_MAP[processType];
    if (!workflow) return res.status(400).json({ error: '未知的加工工艺: ' + processType });

    const quantity = parseInt(sheetQty) || 0;

    // 生成分配记录
    const newAssignments = workflow.map(step => ({
      id: dataStore.generateId(),
      order_id: orderId, order_no: orderNo, customer,
      step_name: step.step_name, step_order: step.step_order,
      worker: step.worker, machine: step.machine,
      casual_workers: estimateCasualWorkers(step, quantity),
      estimated_time: estimateTime(step.step_name, quantity),
      material, sheet_spec: sheetSpec, sheet_qty: sheetQty, priority,
      status: '待开始',
      created_at: new Date().toISOString()
    }));

    // 保存到统一数据模型（不清空数组引用，避免断开data-store内部引用）
    const filtered = dataStore.assignments.filter(a => a.order_id !== orderId);
    dataStore.assignments.length = 0;
    dataStore.assignments.push(...filtered, ...newAssignments);

    // 更新订单状态：待分配 → 已分配
    const targetOrder = scheduleData.find(o => o.id === orderId);
    if (targetOrder && targetOrder.status === '待分配') {
      targetOrder.status = '已分配';
      dataStore.orderStatusHistory.push({
        id: dataStore.generateId(),
        order_id: orderId,
        from_status: '待分配',
        to_status: '已分配',
        changed_by: null,
        changed_at: new Date().toISOString()
      });
    }

    // 记录操作日志
    dataStore.logOperation(null, '分配订单', 'order', orderId, {
      process_type: processType,
      steps: newAssignments.length
    });

    bus.emit(EVENTS.ORDER_ASSIGNED, { orderId, processType, steps: newAssignments.length });

    res.json({
      success: true, order_id: orderId, process_type: processType,
      total_steps: newAssignments.length,
      total_casual_workers: Math.max(...newAssignments.map(a => a.casual_workers)),
      total_estimated_time: newAssignments.reduce((sum, a) => sum + a.estimated_time, 0),
      assignments: newAssignments
    });
    dataStore.autoSave();
  });

  // 存储分配结果
  // 使用统一数据模型中的分配数据
  let assignedOrders = dataStore.assignments;

  app.post('/api/agent/batch-assign', requireAuth, requireRole('管理员'), (req, res) => {
    const { orders } = req.body;
    const results = orders.map(order => {
      const workflow = WORKFLOW_MAP[order.process_type] || [];
      const quantity = parseInt(order.sheet_qty) || 0;
      const newAssignments = workflow.map(step => ({
        id: dataStore.generateId(),
        order_id: order.id, order_no: order.order_no, customer: order.customer,
        step_name: step.step_name, step_order: step.step_order, worker: step.worker, machine: step.machine,
        casual_workers: estimateCasualWorkers(step, quantity), estimated_time: estimateTime(step.step_name, quantity),
        material: order.material, sheet_spec: order.sheet_spec, sheet_qty: order.sheet_qty,
        slice_spec: order.slice_spec, punch_spec: order.punch_spec, priority: order.priority,
        status: '待开始',
        created_at: new Date().toISOString()
      }));

      // 保存到统一数据模型（不清空数组引用，避免断开data-store内部引用）
      const filtered = dataStore.assignments.filter(a => a.order_id !== order.id);
      dataStore.assignments.length = 0;
      dataStore.assignments.push(...filtered, ...newAssignments);

      // 更新订单状态：待分配 → 已分配
      const targetOrder = scheduleData.find(o => o.id === order.id);
      if (targetOrder && targetOrder.status === '待分配') {
        targetOrder.status = '已分配';
        dataStore.orderStatusHistory.push({
          id: dataStore.generateId(),
          order_id: order.id,
          from_status: '待分配',
          to_status: '已分配',
          changed_by: null,
          changed_at: new Date().toISOString()
        });
      }

      // 记录操作日志
      dataStore.logOperation(null, '批量分配订单', 'order', order.id, {
        process_type: order.process_type,
        steps: newAssignments.length
      });

      return {
        order_id: order.id, order_no: order.order_no, customer: order.customer, process_type: order.process_type,
        assignments: newAssignments
      };
    });
    res.json({ success: true, total_orders: results.length, results });
    dataStore.autoSave();
  });

  // 获取分配给某个师傅的任务
  app.get('/api/agent/assignments/:workerName', requireAuth, (req, res) => {
    const workerName = decodeURIComponent(req.params.workerName);
    const tasks = dataStore.assignments.filter(a => a.worker === workerName);
    res.json(tasks);
  });

  // 获取所有分配结果
  app.get('/api/agent/assignments', requireAuth, (req, res) => {
    res.json(dataStore.assignments);
  });

  app.get('/api/agent/workflow/:processType', requireAuth, (req, res) => {
    const workflow = WORKFLOW_MAP[req.params.processType];
    if (!workflow) return res.status(404).json({ error: '未知的加工工艺' });
    res.json(workflow);
  });

  app.get('/api/agent/workflows', requireAuth, (req, res) => {
    res.json(WORKFLOW_MAP);
  });

  app.get('/api/agent/workload', requireAuth, (req, res) => {
    // 从分配数据中计算每个师傅的工作量
    const workload = {};
    dataStore.workers.filter(w => w.role === '师傅').forEach(w => {
      workload[w.name] = { worker: w.name, current_orders: 0, estimated_hours: 0 };
    });

    dataStore.assignments.forEach(a => {
      if (workload[a.worker]) {
        workload[a.worker].current_orders++;
        workload[a.worker].estimated_hours += (a.estimated_time || 0) / 60;
      }
    });

    res.json(Object.values(workload));
  });

  app.get('/api/agent/print/:workerName', requireAuth, (req, res) => {
    const workerName = decodeURIComponent(req.params.workerName);
    const tasks = dataStore.assignments.filter(a => a.worker === workerName);

    res.json({
      worker: workerName,
      date: new Date().toISOString().split('T')[0],
      tasks: tasks
    });
  });

  // ============================================
  // 订单状态更新 API
  // ============================================
  app.put('/api/schedule/:id/status', requireAuth, requireRole('管理员'), (req, res) => {
    const orderId = parseInt(req.params.id);
    const { status, userId } = req.body;

    const result = dataStore.updateOrderStatus(orderId, status, userId);
    if (!result.success) {
      return res.status(400).json(result);
    }

    const order = scheduleData.find(o => o.id === orderId);
    res.json({ success: true, message: '状态更新成功', order });
    dataStore.autoSave();
  });

  // 更新订单信息
  app.put('/api/schedule/:id', requireAuth, requireRole('管理员'), (req, res) => {
    const orderId = parseInt(req.params.id);
    const updates = req.body;

    const order = scheduleData.find(o => o.id === orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }

    // 更新字段
    const allowedFields = ['customer', 'process_type', 'category', 'priority', 'remark',
      'material', 'sheet_size', 'sheet_qty', 'slice_size', 'slice_qty',
      'punch_process', 'punch_size', 'punch_qty', 'due_date', 'style_no',
      'raw_width', 'raw_length', 'raw_thickness', 'edge_remark', 'product_sizes',
      'is_tiebu', 'is_tiebu_outsource', 'is_beijiao', 'is_beijiao_outsource', 'is_dianjiao'];

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        order[field] = updates[field];
      }
    });

    // 记录操作日志
    dataStore.logOperation(updates.userId, '更新订单信息', 'order', orderId, {
      updated_fields: Object.keys(updates).filter(k => k !== 'userId')
    });

    dataStore.autoSave();
    res.json({ success: true, message: '订单更新成功', order });
  });

  // 删除订单（软删除）
  app.delete('/api/schedule/:id', requireAuth, requireRole('管理员'), (req, res) => {
    const orderId = parseInt(req.params.id);
    const { userId } = req.body;

    const result = dataStore.updateOrderStatus(orderId, '已取消', userId);
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({ success: true, message: '订单已取消' });
    dataStore.autoSave();
  });

  // 复制订单
  app.post('/api/schedule/:id/copy', requireAuth, requireRole('管理员'), (req, res) => {
    const orderId = parseInt(req.params.id);
    const { userId } = req.body;

    const originalOrder = scheduleData.find(o => o.id === orderId);
    if (!originalOrder) {
      return res.status(404).json({ success: false, error: '原订单不存在' });
    }

    // 创建新订单
    const newOrder = {
      ...originalOrder,
      id: scheduleData.length + 1,
      order_no: 'YC' + String(scheduleData.length + 1).padStart(4, '0'),
      status: '待分配',
      completed: '',
      created_at: new Date().toISOString()
    };

    scheduleData.push(newOrder);

    // 记录操作日志
    dataStore.logOperation(userId, '复制订单', 'order', newOrder.id, {
      original_order_id: orderId
    });

    dataStore.autoSave();
    res.json({ success: true, message: '订单复制成功', order: newOrder });
  });

  // 开始工序
  app.put('/api/agent/assignment/:id/start', requireAuth, (req, res) => {
    const assignmentId = req.params.id;
    const { userId } = req.body;

    console.log('开始工序, assignmentId:', assignmentId);

    const assignment = dataStore.assignments.find(a => String(a.id) === String(assignmentId));
    if (!assignment) {
      console.log('未找到assignment, 现有IDs:', dataStore.assignments.slice(0, 3).map(a => a.id));
      return res.status(404).json({ success: false, error: '分配记录不存在' });
    }

    assignment.status = '进行中';
    assignment.started_at = new Date().toISOString();

    // 自动推导订单状态
    const newOrderStatus = dataStore.syncOrderStatus(assignment.order_id, userId);

    // 记录操作日志
    dataStore.logOperation(userId, '开始工序', 'assignment', assignmentId, {
      order_id: assignment.order_id,
      step_name: assignment.step_name,
      worker: assignment.worker,
      order_status: newOrderStatus
    });

    bus.emit(EVENTS.STEP_STARTED, { assignment, user: req.currentUser });

    res.json({ success: true, message: '工序开始', assignment, order_status: newOrderStatus });
    dataStore.autoSave();
  });

  // 完成工序
  app.put('/api/agent/assignment/:id/complete', requireAuth, (req, res) => {
    const assignmentId = req.params.id;
    const { userId, quantity } = req.body;

    const assignment = dataStore.assignments.find(a => String(a.id) === String(assignmentId));
    if (!assignment) {
      return res.status(404).json({ success: false, error: '分配记录不存在' });
    }

    assignment.status = '已完成';
    assignment.completed_at = new Date().toISOString();
    if (quantity) assignment.completed_quantity = quantity;

    // 记录操作日志
    dataStore.logOperation(userId, '完成工序', 'assignment', assignmentId, {
      order_id: assignment.order_id,
      step_name: assignment.step_name,
      worker: assignment.worker,
      quantity: quantity
    });

    // 找到下一个工序
    const orderAssignments = dataStore.assignments
      .filter(a => a.order_id === assignment.order_id)
      .sort((a, b) => a.step_order - b.step_order);

    const currentIndex = orderAssignments.findIndex(a => String(a.id) === String(assignmentId));
    const nextAssignment = orderAssignments[currentIndex + 1];

    // 如果有下一个工序，通知下一位师傅
    let nextWorker = null;
    if (nextAssignment && nextAssignment.status === '待开始') {
      nextWorker = nextAssignment.worker;
      dataStore.logOperation(userId, '通知下一位师傅', 'assignment', nextAssignment.id, {
        order_id: assignment.order_id,
        from_worker: assignment.worker,
        to_worker: nextWorker,
        step_name: nextAssignment.step_name
      });
    }

    // 自动推导订单状态
    const newOrderStatus = dataStore.syncOrderStatus(assignment.order_id, userId);

    bus.emit(EVENTS.STEP_COMPLETED, { assignment, nextWorker, orderStatus: newOrderStatus });
    // If order is completed, also emit ORDER_COMPLETED
    if (newOrderStatus === '已完成') {
      bus.emit(EVENTS.ORDER_COMPLETED, { orderId: assignment.order_id });
    }

    res.json({
      success: true,
      message: '工序完成',
      allCompleted: newOrderStatus === '已完成',
      nextWorker: nextWorker,
      order_id: assignment.order_id,
      order_status: newOrderStatus
    });
    dataStore.autoSave();
  });

  // 暂停工序
  app.put('/api/agent/assignment/:id/pause', requireAuth, (req, res) => {
    const assignmentId = req.params.id;
    const { userId, reason } = req.body;

    const assignment = dataStore.assignments.find(a => String(a.id) === String(assignmentId));
    if (!assignment) {
      return res.status(404).json({ success: false, error: '分配记录不存在' });
    }

    assignment.status = '暂停';
    assignment.pause_reason = reason;
    assignment.paused_at = new Date().toISOString();

    dataStore.logOperation(userId, '暂停工序', 'assignment', assignmentId, {
      order_id: assignment.order_id,
      step_name: assignment.step_name,
      reason: reason
    });

    res.json({ success: true, message: '工序已暂停' });
    dataStore.autoSave();
  });

  // 恢复工序
  app.put('/api/agent/assignment/:id/resume', requireAuth, (req, res) => {
    const assignmentId = req.params.id;
    const { userId } = req.body;

    const assignment = dataStore.assignments.find(a => String(a.id) === String(assignmentId));
    if (!assignment) {
      return res.status(404).json({ success: false, error: '分配记录不存在' });
    }

    assignment.status = '进行中';
    assignment.resumed_at = new Date().toISOString();

    dataStore.logOperation(userId, '恢复工序', 'assignment', assignmentId, {
      order_id: assignment.order_id,
      step_name: assignment.step_name
    });

    res.json({ success: true, message: '工序已恢复' });
    dataStore.autoSave();
  });

  // 检查订单是否可以完单
  app.get('/api/agent/check-complete/:orderId', requireAuth, (req, res) => {
    const orderId = parseInt(req.params.orderId);
    const orderAssignments = dataStore.assignments.filter(a => a.order_id === orderId);
    const allCompleted = orderAssignments.length > 0 && orderAssignments.every(a => a.status === '已完成');

    res.json({
      order_id: orderId,
      total_steps: orderAssignments.length,
      completed_steps: orderAssignments.filter(a => a.status === '已完成').length,
      canComplete: allCompleted
    });
  });

  // 获取订单的分配进度
  app.get('/api/agent/order-progress/:orderId', requireAuth, (req, res) => {
    const orderId = parseInt(req.params.orderId);
    const orderAssignments = dataStore.assignments
      .filter(a => a.order_id === orderId)
      .sort((a, b) => a.step_order - b.step_order);

    res.json(orderAssignments);
  });

  // ============================================
  // 库存 API
  // ============================================
  app.post('/api/inventory/issue', requireAuth, requireRole('管理员'), (req, res) => {
    const { orderId, materialName, quantity, userId } = req.body;
    const result = dataStore.issueMaterial(orderId, materialName, quantity, userId);
    if (result.success) {
      bus.emit(EVENTS.STOCK_ISSUED, { orderId, materialName, quantity });
    }
    res.json(result);
  });

  app.post('/api/inventory/inbound', requireAuth, requireRole('管理员'), (req, res) => {
    const { materialName, quantity, userId } = req.body;
    const result = dataStore.inboundMaterial(materialName, quantity, userId);
    if (result.success) {
      bus.emit(EVENTS.STOCK_INBOUND, { materialName, quantity });
    }
    res.json(result);
  });

  app.get('/api/inventory/alerts', requireAuth, (req, res) => {
    const alerts = dataStore.checkInventoryAlerts();
    res.json(alerts);
  });

  // 订单领料（自动扣减库存）
  app.post('/api/inventory/issue-for-order', requireAuth, requireRole('管理员'), (req, res) => {
    const { orderId, userId } = req.body;

    // 查找订单
    const order = scheduleData.find(o => o.id === orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }

    // 解析材料名称（从 material 字段提取）
    const materialName = order.material;
    if (!materialName) {
      return res.status(400).json({ success: false, error: '订单没有用料信息' });
    }

    // 解析数量（从 sheet_qty 字段提取）
    const quantityStr = order.sheet_qty || '0';
    const quantity = parseInt(quantityStr) || 0;

    if (quantity <= 0) {
      return res.status(400).json({ success: false, error: '订单数量无效' });
    }

    // 扣减库存
    const result = dataStore.issueMaterial(orderId, materialName, quantity, userId);
    res.json(result);
  });

  // ============================================
  // 提醒 API
  // ============================================
  app.get('/api/alerts', requireAuth, (req, res) => {
    const inventoryAlerts = dataStore.checkInventoryAlerts();
    const dueDateAlerts = dataStore.checkDueDateAlerts();

    res.json({
      inventory: inventoryAlerts,
      dueDate: dueDateAlerts,
      total: inventoryAlerts.length + dueDateAlerts.length
    });
  });

  // ============================================
  // 操作日志 API
  // ============================================
  app.get('/api/logs', requireAuth, requireRole('管理员'), (req, res) => {
    const { action, targetType, limit } = req.query;
    let logs = [...dataStore.operationLogs];

    if (action) logs = logs.filter(l => l.action === action);
    if (targetType) logs = logs.filter(l => l.target_type === targetType);

    logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (limit) logs = logs.slice(0, parseInt(limit));

    res.json(logs);
  });

  // 获取订单操作历史
  app.get('/api/logs/order/:orderId', requireAuth, requireRole('管理员'), (req, res) => {
    const orderId = parseInt(req.params.orderId);
    const logs = dataStore.operationLogs
      .filter(l => l.target_type === 'order' && l.target_id === orderId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(logs);
  });

  // 获取师傅操作历史
  app.get('/api/logs/worker/:workerId', requireAuth, requireRole('管理员'), (req, res) => {
    const workerId = parseInt(req.params.workerId);
    const logs = dataStore.operationLogs
      .filter(l => l.user_id === workerId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(logs);
  });

  // 获取订单状态历史
  app.get('/api/order-status-history/:orderId', requireAuth, (req, res) => {
    const orderId = parseInt(req.params.orderId);
    const history = dataStore.orderStatusHistory
      .filter(h => h.order_id === orderId)
      .sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at));
    res.json(history);
  });

  // ============================================
  // 样板管理 API
  // ============================================
  // 使用 dataStore.samples，如为空则初始化
  if (!dataStore.samples) dataStore.samples = [];

  // 获取所有样板
  app.get('/api/samples', requireAuth, (req, res) => {
    res.json(dataStore.samples);
  });

  // 获取单个样板
  app.get('/api/samples/:id', requireAuth, (req, res) => {
    const sample = dataStore.samples.find(s => s.id === req.params.id);
    if (!sample) return res.status(404).json({ success: false, error: '样板不存在' });
    res.json(sample);
  });

  // 创建样板
  app.post('/api/samples', requireAuth, (req, res) => {
    const sample = {
      id: dataStore.generateId(),
      ...req.body,
      created_at: new Date().toISOString()
    };
    dataStore.samples.push(sample);
    dataStore.logOperation(null, '创建样板', 'sample', sample.id, { sample_no: sample.sample_no });
    res.json({ success: true, sample });
    dataStore.autoSave();
  });

  // 更新样板
  app.put('/api/samples/:id', requireAuth, (req, res) => {
    const index = dataStore.samples.findIndex(s => s.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, error: '样板不存在' });
    dataStore.samples[index] = { ...dataStore.samples[index], ...req.body, updated_at: new Date().toISOString() };
    res.json({ success: true, sample: dataStore.samples[index] });
    dataStore.autoSave();
  });

  // 更新样板状态
  app.put('/api/samples/:id/status', requireAuth, (req, res) => {
    const sample = dataStore.samples.find(s => s.id === req.params.id);
    if (!sample) return res.status(404).json({ success: false, error: '样板不存在' });
    sample.status = req.body.status;
    sample.updated_at = new Date().toISOString();
    dataStore.logOperation(null, '更新样板状态', 'sample', sample.id, { status: sample.status });
    res.json({ success: true, sample });
    dataStore.autoSave();
  });

  // 删除样板
  app.delete('/api/samples/:id', requireAuth, requireRole('管理员'), (req, res) => {
    dataStore.samples = dataStore.samples.filter(s => s.id !== req.params.id);
    res.json({ success: true });
    dataStore.autoSave();
  });

  // ============================================
  // 客户管理 API
  // ============================================
  // 使用 dataStore.customers，如为空则初始化种子数据
  const SEED_CUSTOMERS = [
    { id: '1', name: '安源', contact: '', phone: '', level: '普通', payment_term: 30, address: '', notes: '', remark: '', order_count: 11, created_at: '2026-01-01' },
    { id: '2', name: '伊斯通', contact: '', phone: '', level: '普通', payment_term: 30, address: '', notes: '', remark: '', order_count: 5, created_at: '2026-01-01' },
    { id: '3', name: '正欲', contact: '', phone: '', level: '普通', payment_term: 30, address: '', notes: '', remark: '', order_count: 3, created_at: '2026-01-01' },
    { id: '4', name: '六点半', contact: '', phone: '', level: '普通', payment_term: 30, address: '', notes: '', remark: '', order_count: 3, created_at: '2026-01-01' },
    { id: '5', name: '枫华', contact: '', phone: '', level: '普通', payment_term: 30, address: '', notes: '', remark: '', order_count: 3, created_at: '2026-01-01' },
    { id: '6', name: '兴达', contact: '', phone: '', level: '普通', payment_term: 30, address: '', notes: '', remark: '', order_count: 2, created_at: '2026-01-01' },
    { id: '7', name: '立优', contact: '', phone: '', level: '普通', payment_term: 30, address: '', notes: '', remark: '', order_count: 2, created_at: '2026-01-01' },
    { id: '8', name: '雨田', contact: '', phone: '', level: '普通', payment_term: 30, address: '', notes: '', remark: '', order_count: 2, created_at: '2026-01-01' },
    { id: '9', name: '得景', contact: '', phone: '', level: '普通', payment_term: 30, address: '', notes: '', remark: '', order_count: 2, created_at: '2026-01-01' },
    { id: '10', name: '德坤', contact: '', phone: '', level: '普通', payment_term: 30, address: '', notes: '', remark: '', order_count: 2, created_at: '2026-01-01' },
    { id: '11', name: '宇坤', contact: '', phone: '', level: '普通', payment_term: 30, address: '', notes: '', remark: '', order_count: 1, created_at: '2026-01-01' },
    { id: '12', name: '展峰', contact: '', phone: '', level: '普通', payment_term: 30, address: '', notes: '', remark: '', order_count: 1, created_at: '2026-01-01' }
  ];
  if (!dataStore.customers || dataStore.customers.length === 0) {
    dataStore.customers = [...SEED_CUSTOMERS];
  }

  // 获取所有客户
  app.get('/api/customers', requireAuth, (req, res) => {
    res.json(dataStore.customers);
  });

  // 获取单个客户
  app.get('/api/customers/:id', requireAuth, (req, res) => {
    const customer = dataStore.customers.find(c => c.id === req.params.id);
    if (!customer) return res.status(404).json({ success: false, error: '客户不存在' });
    res.json(customer);
  });

  // 创建客户
  app.post('/api/customers', requireAuth, (req, res) => {
    const customer = {
      id: dataStore.generateId(),
      ...req.body,
      order_count: 0,
      created_at: new Date().toISOString()
    };
    dataStore.customers.push(customer);
    dataStore.logOperation(null, '创建客户', 'customer', customer.id, { name: customer.name });
    res.json({ success: true, customer });
    dataStore.autoSave();
  });

  // 更新客户
  app.put('/api/customers/:id', requireAuth, (req, res) => {
    const index = dataStore.customers.findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, error: '客户不存在' });
    dataStore.customers[index] = { ...dataStore.customers[index], ...req.body, updated_at: new Date().toISOString() };
    res.json({ success: true, customer: dataStore.customers[index] });
    dataStore.autoSave();
  });

  // 删除客户
  app.delete('/api/customers/:id', requireAuth, requireRole('管理员'), (req, res) => {
    dataStore.customers = dataStore.customers.filter(c => c.id !== req.params.id);
    res.json({ success: true });
    dataStore.autoSave();
  });

  // ============================================
  // Excel 导出 API (P1-8)
  // ============================================
  app.get('/api/export', requireAuth, (req, res) => {
    try {
      const XLSX = require('xlsx');

      // 准备数据
      const exportData = scheduleData.map(o => ({
        '客户': o.customer || '',
        '订单号': o.order_no || '',
        '款号': o.style_no || '',
        '加工工艺': o.process_type || '',
        '类别': o.category || '',
        '用料': o.material || '',
        '片材尺寸': o.sheet_size || '',
        '片材数量': o.sheet_qty || '',
        '切片尺寸': o.slice_size || '',
        '切片数量': o.slice_qty || '',
        '冲型工艺': o.punch_process || '',
        '冲型尺寸': o.punch_size || '',
        '冲型数量': o.punch_qty || '',
        '片材完成': o.sheet_done || '',
        '切片完成': o.slice_done || '',
        '冲型完成': o.punch_done || '',
        '完单': o.completed || '',
        '优先级': o.priority || '',
        '状态': o.status || '',
        '备注': o.remark || '',
        '交期': o.due_date || ''
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);

      // 设置列宽
      ws['!cols'] = [
        { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 10 },
        { wch: 25 }, { wch: 20 }, { wch: 8 }, { wch: 15 }, { wch: 8 },
        { wch: 12 }, { wch: 15 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
        { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 20 }, { wch: 12 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '排单总表');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=' + encodeURIComponent('生产排单表.xlsx'));
      res.send(buffer);
    } catch (error) {
      console.error('导出Excel失败:', error);
      res.status(500).json({ success: false, error: '导出失败: ' + error.message });
    }
  });
}

app.listen(PORT, () => {
  console.log('\n🚀 服务器运行在 http://localhost:' + PORT);
  console.log('\n📌 功能页面:');
  console.log('  - 排单总表: http://localhost:' + PORT + '/schedule.html');
  console.log('  - 库存管理: http://localhost:' + PORT + '/inventory.html');
  console.log('  - 工人派单: http://localhost:' + PORT + '/worker-sheet.html');
  console.log('\n💡 提示: 配置 .env 文件可启用数据库功能');
});

// 事件监听：记录所有 MES 事件到操作日志
bus.on(EVENTS.STEP_COMPLETED, (data) => {
  console.log('📢 [事件] 工序完成:', data.assignment?.step_name, '→ 通知:', data.nextWorker || '无');
});

bus.on(EVENTS.ORDER_COMPLETED, (data) => {
  console.log('🎉 [事件] 订单完成:', data.orderId);
});

bus.on(EVENTS.FEEDBACK_SUBMITTED, (data) => {
  console.log('⚠️ [事件] 新反馈:', data.feedback?.type, '-', data.feedback?.content);
});

bus.on(EVENTS.STOCK_LOW, (data) => {
  console.log('📊 [事件] 库存预警:', data.message);
});

module.exports = app;
