const express = require('express');
const cors = require('cors');
const path = require('path');
const XLSX = require('xlsx');
const mockOrders = require('./mock-data');
const { workers, machines, casualWorkers, assignments } = require('./mock-data-extended');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== 订单 API ==========
app.get('/api/orders', (req, res) => {
  let orders = [...mockOrders];
  if (req.query.process_type) {
    orders = orders.filter(o => o.process_type === req.query.process_type);
  }
  if (req.query.search) {
    const search = req.query.search.toLowerCase();
    orders = orders.filter(o => 
      (o.customer && o.customer.toLowerCase().includes(search)) ||
      (o.material && o.material.toLowerCase().includes(search))
    );
  }
  res.json(orders);
});

app.get('/api/orders/stats', (req, res) => {
  res.json({
    total: mockOrders.length,
    urgent: mockOrders.filter(o => ['注意', '特急'].includes(o.priority)).length,
    completed: mockOrders.filter(o => o.status === '已完成').length,
    inProgress: mockOrders.filter(o => o.status === '进行中').length
  });
});

app.get('/api/orders/grouped', (req, res) => {
  const groups = {};
  mockOrders.forEach(o => {
    groups[o.process_type] = (groups[o.process_type] || 0) + 1;
  });
  const result = Object.entries(groups).map(([process_type, count]) => ({ process_type, count }));
  result.sort((a, b) => b.count - a.count);
  res.json(result);
});

app.get('/api/orders/export', (req, res) => {
  const worksheet = XLSX.utils.json_to_sheet(mockOrders.map(o => ({
    '客户': o.customer, '加工工艺': o.process_type, '用料': o.material,
    '片材尺寸': o.sheet_size, '片材数量': o.sheet_qty,
    '切片尺寸': o.slice_size, '切片数量': o.slice_qty,
    '冲型尺寸': o.punch_size, '冲型数量': o.punch_qty,
    '优先级': o.priority, '状态': o.status
  })));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '生产排单表');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=production-schedule.xlsx');
  res.send(buffer);
});

app.get('/api/orders/:id', (req, res) => {
  const order = mockOrders.find(o => o.id === parseInt(req.params.id));
  if (!order) return res.status(404).json({ error: '订单不存在' });
  res.json(order);
});

// ========== 师傅 API ==========
app.get('/api/workers', (req, res) => {
  res.json(workers);
});

app.post('/api/workers', (req, res) => {
  const newWorker = { id: workers.length + 1, ...req.body };
  workers.push(newWorker);
  res.status(201).json(newWorker);
});

app.put('/api/workers/:id', (req, res) => {
  const idx = workers.findIndex(w => w.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: '师傅不存在' });
  workers[idx] = { ...workers[idx], ...req.body };
  res.json(workers[idx]);
});

app.delete('/api/workers/:id', (req, res) => {
  const idx = workers.findIndex(w => w.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: '师傅不存在' });
  workers.splice(idx, 1);
  res.json({ message: '删除成功' });
});

// ========== 机器 API ==========
app.get('/api/machines', (req, res) => {
  const result = machines.map(m => {
    const assignedWorkers = assignments
      .filter(a => a.machineId === m.id)
      .map(a => workers.find(w => w.id === a.workerId))
      .filter(Boolean);
    const assignedCasual = casualWorkers.filter(c => c.assignedTo === m.name);
    return { ...m, workers: assignedWorkers, casualWorkers: assignedCasual };
  });
  res.json(result);
});

app.get('/api/machines/:id', (req, res) => {
  const machine = machines.find(m => m.id === parseInt(req.params.id));
  if (!machine) return res.status(404).json({ error: '机器不存在' });
  const assignedWorkers = assignments
    .filter(a => a.machineId === machine.id)
    .map(a => workers.find(w => w.id === a.workerId))
    .filter(Boolean);
  const assignedCasual = casualWorkers.filter(c => c.assignedTo === machine.name);
  res.json({ ...machine, workers: assignedWorkers, casualWorkers: assignedCasual });
});

// ========== 零工 API ==========
app.get('/api/casual-workers', (req, res) => {
  res.json(casualWorkers);
});

app.post('/api/casual-workers', (req, res) => {
  const newWorker = { id: casualWorkers.length + 1, ...req.body };
  casualWorkers.push(newWorker);
  res.status(201).json(newWorker);
});

app.delete('/api/casual-workers/:id', (req, res) => {
  const idx = casualWorkers.findIndex(c => c.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: '零工不存在' });
  casualWorkers.splice(idx, 1);
  res.json({ message: '删除成功' });
});

// ========== 总览 API ==========
app.get('/api/overview', (req, res) => {
  const machineOverview = machines.map(m => {
    const assignedWorkers = assignments
      .filter(a => a.machineId === m.id)
      .map(a => workers.find(w => w.id === a.workerId))
      .filter(Boolean);
    const assignedCasual = casualWorkers.filter(c => c.assignedTo === m.name);
    return { ...m, workers: assignedWorkers, casualWorkers: assignedCasual };
  });
  
  const miscCasualWorkers = casualWorkers.filter(c => c.assignedTo === '杂活');
  
  res.json({
    orders: { total: mockOrders.length, grouped: getOrdersGrouped() },
    machines: machineOverview,
    workers: workers,
    miscCasualWorkers: miscCasualWorkers
  });
});

function getOrdersGrouped() {
  const groups = {};
  mockOrders.forEach(o => { groups[o.process_type] = (groups[o.process_type] || 0) + 1; });
  return Object.entries(groups).map(([process_type, count]) => ({ process_type, count }));
}


// ========== 库存 API ==========
const inventoryData = require('./inventory-data');

app.get('/api/inventory', (req, res) => {
  res.json(inventoryData);
});

app.get('/api/inventory/materials', (req, res) => {
  let materials = [...inventoryData.materials];
  if (req.query.supplier) {
    materials = materials.filter(m => m.supplier === req.query.supplier);
  }
  if (req.query.search) {
    const search = req.query.search.toLowerCase();
    materials = materials.filter(m => 
      m.name.toLowerCase().includes(search) || 
      m.spec.toLowerCase().includes(search) ||
      m.supplier.toLowerCase().includes(search)
    );
  }
  res.json(materials);
});

app.get('/api/inventory/check', (req, res) => {
  const { material, spec } = req.query;
  if (!material) {
    return res.status(400).json({ error: '请提供材料名称' });
  }
  
  let query = inventoryData.materials;
  if (material) {
    query = query.filter(m => m.name.toLowerCase().includes(material.toLowerCase()));
  }
  if (spec) {
    query = query.filter(m => m.spec.toLowerCase().includes(spec.toLowerCase()));
  }
  
  const totalStock = query.reduce((sum, m) => sum + m.stock, 0);
  res.json({
    materials: query,
    totalStock: totalStock,
    sufficient: totalStock > 0
  });
});

app.post('/api/inventory/use', (req, res) => {
  const { materialId, quantity, orderId } = req.body;
  const material = inventoryData.materials.find(m => m.id === materialId);
  
  if (!material) {
    return res.status(404).json({ error: '材料不存在' });
  }
  
  if (material.stock < quantity) {
    return res.status(400).json({ 
      error: '库存不足', 
      available: material.stock,
      requested: quantity 
    });
  }
  
  material.stock -= quantity;
  res.json({ 
    success: true, 
    material: material,
    used: quantity,
    remaining: material.stock
  });
});

app.post('/api/inventory/restock', (req, res) => {
  const { materialId, quantity } = req.body;
  const material = inventoryData.materials.find(m => m.id === materialId);
  
  if (!material) {
    return res.status(404).json({ error: '材料不存在' });
  }
  
  material.stock += quantity;
  res.json({ 
    success: true, 
    material: material,
    added: quantity,
    newStock: material.stock
  });
});

app.listen(PORT, () => {
  console.log('服务器运行在 http://localhost:' + PORT);
});

