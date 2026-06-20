# 溢彩包装 - MES 逻辑链适配文档

给 Claude 看的。完整描述小工厂 MES 的所有逻辑链，以及如何适配溢彩包装的业务。

---

## 一、系统定位

溢彩包装是一个 **7人小工厂**，做 EVA 材料加工。工艺流程固定，师傅分工明确。
需要的是 **轻量级 MES**，不是企业级 ERP。核心诉求：

1. 师傅手机上能看到自己的任务
2. 完成后自动通知下一个人
3. 管理员能看到所有订单进度
4. 库存不够时自动预警
5. 数据不能丢

---

## 二、核心逻辑链

### 逻辑链1：订单全生命周期

#### MES 怎么做
每个订单有明确的状态，状态只能按规则流转，不能跳级。

#### 溢彩包装适配

```
跟单员录入订单
    ↓
【待分配】→ 管理员看到待分配列表，点"分配"按钮
    ↓
【已分配】→ 系统自动按工艺生成工序流程，分配给对应师傅
    ↓
【生产中】→ 至少一个师傅在干活
    ↓
【已完成】→ 所有工序完成，自动完单
    ↓
任何阶段都可以【已取消】→ 可以恢复成【待分配】
```

#### 实现方法

```javascript
// 状态定义
const ORDER_STATUS = {
  PENDING_ASSIGN: '待分配',
  ASSIGNED: '已分配', 
  IN_PROGRESS: '生产中',
  COMPLETED: '已完成',
  CANCELLED: '已取消'
}

// 状态流转规则（只能按这个走）
const STATUS_FLOW = {
  '待分配': ['已分配', '已取消'],
  '已分配': ['生产中', '已取消'],
  '生产中': ['已完成', '已取消'],
  '已完成': [],  // 终态
  '已取消': ['待分配']  // 可恢复
}

// 自动推导：根据工序状态算出订单状态
function deriveOrderStatus(orderId) {
  const assignments = getAssignments(orderId)
  
  if (assignments.length === 0) return '待分配'
  if (assignments.every(a => a.status === '已完成')) return '已完成'
  if (assignments.some(a => a.status === '进行中' || a.status === '暂停')) return '生产中'
  if (assignments.every(a => a.status === '待开始')) return '已分配'
  
  return '生产中'
}
```

---

### 逻辑链2：工序自动传导（事件驱动）

#### MES 怎么做
师傅完成工序 → 系统触发事件 → 自动通知下一个师傅 → 更新订单状态

#### 溢彩包装适配

```
郑思远完成"横竖分切"
    ↓ 触发事件：工序完成
    ↓
系统做3件事：
    1. 更新这个工序状态为"已完成"
    2. 通知下一个师傅伍乾进："轮到你了，订单YC0001的破片工序"
    3. 更新订单状态（自动推导）
    ↓
伍乾进收到通知（飞书/微信/页面弹窗）
    ↓
伍乾进点"开始" → 触发事件：工序开始
    ↓
系统做2件事：
    1. 更新工序状态为"进行中"
    2. 更新订单状态为"生产中"
```

#### 事件类型定义

```javascript
const EVENTS = {
  // 工序相关
  STEP_STARTED: '工序开始',      // 师傅点了开始
  STEP_COMPLETED: '工序完成',    // 师傅点了完成
  STEP_PAUSED: '工序暂停',      // 师傅点了暂停
  STEP_RESUMED: '工序恢复',     // 师傅点了恢复
  
  // 订单相关
  ORDER_ASSIGNED: '订单已分配',  // 管理员分配完成
  ORDER_COMPLETED: '订单已完成', // 所有工序完成
  ORDER_CANCELLED: '订单已取消',
  
  // 反馈相关
  FEEDBACK_SUBMITTED: '反馈提交',  // 师傅提交反馈
  FEEDBACK_RESOLVED: '反馈处理',   // 反馈已解决
  
  // 库存相关
  STOCK_LOW: '库存不足',         // 库存低于阈值
  STOCK_ISSUED: '领料出库',      // 订单领料
}
```

#### 事件处理器

```javascript
// 处理器1：工序完成
function handleStepCompleted(event) {
  const { orderId, stepName, worker, nextWorker } = event.data
  
  // 1. 自动推导订单状态
  syncOrderStatus(orderId)
  
  // 2. 通知下一个师傅
  if (nextWorker) {
    notifyWorker(nextWorker, {
      title: '轮到你了',
      content: `${worker}完成了${stepName}，请开始你的工序`,
      orderId: orderId
    })
  }
  
  // 3. 如果是最后一个工序，触发订单完成
  if (isLastStep(orderId, stepName)) {
    emitEvent(EVENTS.ORDER_COMPLETED, { orderId })
  }
}

// 处理器2：反馈提交
function handleFeedbackSubmitted(event) {
  const { orderId, feedbackType, content, worker } = event.data
  
  // 1. 暂停订单
  pauseOrder(orderId)
  
  // 2. 根据反馈类型通知不同人
  if (feedbackType === '材料问题' || feedbackType === '人员不足') {
    notifyAdmin('跟单员+管理员', { orderId, content, worker })
  } else if (feedbackType === '机器故障') {
    notifyAdmin('管理员', { orderId, content, worker })
  } else {
    // 通知上一步师傅 + 管理员
    const prevWorker = getPreviousWorker(orderId, stepName)
    notifyMultiple([prevWorker, '管理员'], { orderId, content, worker })
  }
}

// 处理器3：库存不足
function handleStockLow(event) {
  const { material, currentStock, needed } = event.data
  
  // 通知管理员采购
  notifyAdmin('管理员', {
    title: '库存预警',
    content: `${material}库存不足，当前${currentStock}，需要${needed}`
  })
}
```

#### 实现方式（简单版，用 Node.js EventEmitter）

```javascript
const EventEmitter = require('events')
const bus = new EventEmitter()

// 注册所有处理器
bus.on(EVENTS.STEP_COMPLETED, handleStepCompleted)
bus.on(EVENTS.FEEDBACK_SUBMITTED, handleFeedbackSubmitted)
bus.on(EVENTS.STOCK_LOW, handleStockLow)
bus.on(EVENTS.ORDER_COMPLETED, handleOrderCompleted)

// 在API里触发事件
app.put('/api/assignment/:id/complete', (req, res) => {
  // ... 更新工序状态 ...
  
  // 触发事件
  bus.emit(EVENTS.STEP_COMPLETED, {
    data: {
      orderId: assignment.order_id,
      stepName: assignment.step_name,
      worker: assignment.worker,
      nextWorker: nextAssignment?.worker
    }
  })
  
  res.json({ success: true })
})
```

---

### 逻辑链3：资源调度

#### MES 怎么做
分配订单时自动检查：师傅有没有空？机器有没有空？零工够不够？

#### 溢彩包装适配

```
管理员点"分配"订单YC0001（片材切片冲型）
    ↓
系统自动检查：
    ├─ 郑思远（横竖分切）：当前有2个任务，还能接
    ├─ 伍乾进（破片）：当前有3个任务，还能接
    ├─ 莫齐国（直切）：当前有0个任务，空闲
    ├─ 李乐（冲床）：当前有5个任务，满了！
    └─ 零工：需要2人，当前有3人可用
    ↓
结果：李乐满了，提示管理员
    ├─ 选项1：等李乐有空再分配
    ├─ 选项2：分配给周忠琼（冲床辅助）
    └─ 选项3：强制分配（加急）
```

#### 实现方法

```javascript
// 检查师傅工作量
function checkWorkerAvailability(workerName) {
  const activeTasks = assignments.filter(
    a => a.worker === workerName && 
    (a.status === '待开始' || a.status === '进行中')
  )
  
  const maxTasks = {
    '郑思远': 5,   // 横竖分切机
    '伍乾进': 5,   // 破片机
    '莫齐国': 3,   // 直切机
    '李乐': 8,     // 4台冲床
    '简翠花': 4,   // 背胶/点胶
    '杨合进': 3    // 打包
  }
  
  return {
    worker: workerName,
    currentTasks: activeTasks.length,
    maxTasks: maxTasks[workerName] || 5,
    available: activeTasks.length < maxTasks[workerName],
    estimatedHours: activeTasks.reduce((sum, t) => sum + (t.estimated_time || 0), 0) / 60
  }
}

// 检查机器可用性
function checkMachineAvailability(machineName) {
  const machine = machines.find(m => m.name === machineName)
  const activeAssignment = assignments.find(
    a => a.machine === machineName && a.status === '进行中'
  )
  
  return {
    machine: machineName,
    status: activeAssignment ? '使用中' : '空闲',
    currentTask: activeAssignment || null
  }
}

// 分配前检查所有资源
function checkAllResources(processType, quantity) {
  const workflow = WORKFLOW_MAP[processType]
  const issues = []
  
  workflow.forEach(step => {
    const worker = checkWorkerAvailability(step.worker)
    if (!worker.available) {
      issues.push(`${step.worker}工作量已满（${worker.currentTasks}/${worker.maxTasks}）`)
    }
    
    const machine = checkMachineAvailability(step.machine)
    if (machine.status === '使用中') {
      issues.push(`${step.machine}正在使用中`)
    }
  })
  
  return {
    canAssign: issues.length === 0,
    issues: issues,
    suggestions: issues.length > 0 ? getSuggestions(processType) : []
  }
}
```

---

### 逻辑链4：物料管理

#### MES 怎么做
订单创建时算用料 → 领料时扣库存 → 库存低时预警 → 能追溯每批料去向

#### 溢彩包装适配

```
跟单员录入订单：黑色EVA 10张，1.44m*3.05m*12mm
    ↓
系统自动计算：
    ├─ 需要原材料：黑色38°B料EVA（福能）
    ├─ 规格：1.44m*3.05m*60mm
    ├─ 一床可开：60/12 = 5张
    ├─ 需要原材料：10/5 = 2张
    └─ 检查库存：当前有15张，够用
    ↓
订单分配后自动领料：
    ├─ 库存：15 → 13（扣2张）
    ├─ 记录：这批料用在YC0001
    └─ 如果库存<5，触发预警
    ↓
库存追溯：
    ├─ 这批黑色EVA还剩多少？
    ├─ 用在哪些订单了？
    └─ 谁领的？什么时候领的？
```

#### 实现方法

```javascript
// 订单创建时计算用料
function calculateMaterial(order) {
  const THICKNESS_RULES = { 58: 60, 54: 55 }
  const SIZE_RULES = { 1: 1.05, 1.2: 1.27, 1.4: 1.46, 1.5: 1.55, 3: 3.07 }
  
  const actualThickness = THICKNESS_RULES[order.productThickness] || order.productThickness
  const sheetsPerBed = Math.floor(order.rawThickness / actualThickness)
  
  const sheetsNeeded = Math.ceil(order.quantity / sheetsPerBed)
  
  return {
    material: order.material,
    sheetsNeeded: sheetsNeeded,
    rawMaterial: order.rawMaterial,
    rawSpec: `${order.rawWidth}m*${order.rawLength}m*${order.rawThickness}mm`
  }
}

// 领料（订单分配时自动调用）
function issueMaterial(orderId, materialName, quantity) {
  const item = inventory.find(i => i.material === materialName)
  if (!item) return { success: false, error: '库存中没有该材料' }
  if (item.remaining_stock < quantity) {
    // 触发库存不足事件
    emitEvent(EVENTS.STOCK_LOW, {
      material: materialName,
      currentStock: item.remaining_stock,
      needed: quantity
    })
    return { success: false, error: '库存不足' }
  }
  
  // 扣减库存
  item.remaining_stock -= quantity
  
  // 记录流水
  inventoryTransactions.push({
    type: 'outbound',
    material: materialName,
    quantity: quantity,
    related_order_id: orderId,
    timestamp: new Date()
  })
  
  return { success: true, remaining: item.remaining_stock }
}

// 库存预警检查
function checkStockAlerts() {
  const alerts = []
  const MIN_STOCK = 10  // 最低库存阈值
  
  inventory.forEach(item => {
    if (item.remaining_stock <= MIN_STOCK) {
      alerts.push({
        material: item.material,
        current: item.remaining_stock,
        threshold: MIN_STOCK,
        level: item.remaining_stock === 0 ? 'danger' : 'warning'
      })
    }
  })
  
  return alerts
}

// 库存追溯
function traceMaterial(materialName) {
  const transactions = inventoryTransactions.filter(t => t.material === materialName)
  
  return {
    material: materialName,
    currentStock: inventory.find(i => i.material === materialName)?.remaining_stock,
    history: transactions.map(t => ({
      type: t.type === 'inbound' ? '入库' : '出库',
      quantity: t.quantity,
      orderId: t.related_order_id,
      timestamp: t.timestamp
    }))
  }
}
```

---

### 逻辑链5：反馈处理

#### MES 怎么做
师傅发现问题 → 提交反馈 → 系统自动暂停订单 → 通知相关人员 → 处理后恢复

#### 溢彩包装适配

```
伍乾进发现材料有问题
    ↓
提交反馈：
    ├─ 类型：材料质量问题
    ├─ 订单：YC0001
    ├─ 工序：破片
    └─ 内容：这批EVA有气泡，无法使用
    ↓
系统自动处理：
    ├─ 1. 暂停订单YC0001
    ├─ 2. 记录反馈时间、人员
    └─ 3. 通知：跟单员 + 管理员
    ↓
管理员处理：
    ├─ 选项1：换材料 → 恢复订单
    ├─ 选项2：退给供应商 → 暂停更久
    └─ 选项3：调整工艺 → 恢复订单
    ↓
处理完成 → 订单恢复生产
```

#### 反馈类型和通知规则

```javascript
const FEEDBACK_RULES = {
  '材料数量问题': {
    notify: ['跟单员', '管理员'],
    pauseOrder: true,
    autoAction: null
  },
  '材料质量问题': {
    notify: ['跟单员', '管理员'],
    pauseOrder: true,
    autoAction: null
  },
  '弄坏材料': {
    notify: ['管理员'],
    pauseOrder: true,
    autoAction: null
  },
  '人员不足': {
    notify: ['管理员'],
    pauseOrder: false,  // 不暂停，等调配
    autoAction: 'suggest_reassign'
  },
  '机器故障': {
    notify: ['管理员'],
    pauseOrder: true,
    autoAction: 'suggest_alternative_machine'
  }
}
```

#### 实现方法

```javascript
// 提交反馈
function submitFeedback(orderId, workerId, stepName, feedbackType, content) {
  // 1. 创建反馈记录
  const feedback = {
    id: generateId(),
    order_id: orderId,
    worker_id: workerId,
    step_name: stepName,
    type: feedbackType,
    content: content,
    status: '待处理',
    created_at: new Date()
  }
  feedbacks.push(feedback)
  
  // 2. 根据规则处理
  const rule = FEEDBACK_RULES[feedbackType]
  
  // 3. 暂停订单
  if (rule.pauseOrder) {
    pauseOrderAssignments(orderId, stepName)
    syncOrderStatus(orderId)
  }
  
  // 4. 通知相关人员
  const notifyList = rule.notify
  notifyList.forEach(role => {
    const users = getUsersByRole(role)
    users.forEach(user => {
      notifyUser(user.id, {
        title: `新反馈：${feedbackType}`,
        content: `订单${orderId}，工序${stepName}：${content}`,
        feedbackId: feedback.id
      })
    })
  })
  
  // 5. 触发事件
  emitEvent(EVENTS.FEEDBACK_SUBMITTED, feedback)
  
  return feedback
}

// 处理反馈
function resolveFeedback(feedbackId, resolution, resolvedBy) {
  const feedback = feedbacks.find(f => f.id === feedbackId)
  if (!feedback) return null
  
  feedback.status = '已处理'
  feedback.resolution = resolution
  feedback.resolved_by = resolvedBy
  feedback.resolved_at = new Date()
  
  // 恢复订单
  resumeOrderAssignments(feedback.order_id)
  syncOrderStatus(feedback.order_id)
  
  // 通知提交人
  notifyUser(feedback.worker_id, {
    title: '反馈已处理',
    content: `你的反馈已处理：${resolution}`,
    feedbackId: feedback.id
  })
  
  emitEvent(EVENTS.FEEDBACK_RESOLVED, feedback)
  
  return feedback
}
```

---

### 逻辑链6：数据采集与报表

#### MES 怎么做
师傅每次操作都记录时间、数量 → 统计效率 → 发现瓶颈 → 改进

#### 溢彩包装适配

```
师傅每次操作自动记录：
    ├─ 开始时间：2026-06-21 08:00
    ├─ 完成时间：2026-06-21 09:30
    ├─ 实际工时：90分钟
    ├─ 完成数量：50张
    ├─ 不良品：2张
    └─ 效率：50/90 = 0.56张/分钟
    ↓
统计报表：
    ├─ 每个师傅的效率趋势
    ├─ 每个工序的平均工时
    ├─ 哪个工序是瓶颈
    ├─ 不良品率
    └─ 订单准时交付率
```

#### 实现方法

```javascript
// 记录工序开始
function recordStepStart(assignmentId, workerId) {
  const assignment = assignments.find(a => a.id === assignmentId)
  assignment.started_at = new Date()
  assignment.started_by = workerId
}

// 记录工序完成
function recordStepComplete(assignmentId, quantity, defectQuantity) {
  const assignment = assignments.find(a => a.id === assignmentId)
  assignment.completed_at = new Date()
  assignment.completed_quantity = quantity
  assignment.defect_quantity = defectQuantity || 0
  
  // 计算实际工时（分钟）
  const startTime = new Date(assignment.started_at)
  const endTime = new Date(assignment.completed_at)
  assignment.actual_time = Math.round((endTime - startTime) / 1000 / 60)
  
  // 计算效率
  assignment.efficiency = quantity / assignment.actual_time
}

// 生成日报
function generateDailyReport(date) {
  const dayStart = new Date(date)
  const dayEnd = new Date(date)
  dayEnd.setDate(dayEnd.getDate() + 1)
  
  const dayAssignments = assignments.filter(a => {
    const completed = new Date(a.completed_at)
    return completed >= dayStart && completed < dayEnd && a.status === '已完成'
  })
  
  // 按师傅统计
  const workerStats = {}
  dayAssignments.forEach(a => {
    if (!workerStats[a.worker]) {
      workerStats[a.worker] = {
        worker: a.worker,
        completedTasks: 0,
        totalQuantity: 0,
        totalDefects: 0,
        totalMinutes: 0
      }
    }
    const stats = workerStats[a.worker]
    stats.completedTasks++
    stats.totalQuantity += a.completed_quantity || 0
    stats.totalDefects += a.defect_quantity || 0
    stats.totalMinutes += a.actual_time || 0
  })
  
  // 按工序统计
  const stepStats = {}
  dayAssignments.forEach(a => {
    if (!stepStats[a.step_name]) {
      stepStats[a.step_name] = {
        step: a.step_name,
        completedTasks: 0,
        avgTime: 0,
        totalTime: 0
      }
    }
    const stats = stepStats[a.step_name]
    stats.completedTasks++
    stats.totalTime += a.actual_time || 0
  })
  
  // 计算平均工时
  Object.values(stepStats).forEach(s => {
    s.avgTime = s.completedTasks > 0 ? Math.round(s.totalTime / s.completedTasks) : 0
  })
  
  return {
    date: date,
    workerStats: Object.values(workerStats),
    stepStats: Object.values(stepStats),
    totalOrders: dayAssignments.length,
    totalDefects: Object.values(workerStats).reduce((sum, s) => sum + s.totalDefects, 0)
  }
}

// 发现瓶颈工序
function findBottleneck() {
  const stepAvgTimes = {}
  
  assignments.filter(a => a.status === '已完成').forEach(a => {
    if (!stepAvgTimes[a.step_name]) {
      stepAvgTimes[a.step_name] = { total: 0, count: 0 }
    }
    stepAvgTimes[a.step_name].total += a.actual_time || 0
    stepAvgTimes[a.step_name].count++
  })
  
  const bottlenecks = Object.entries(stepAvgTimes).map(([step, data]) => ({
    step,
    avgTime: Math.round(data.total / data.count),
    count: data.count
  }))
  
  bottlenecks.sort((a, b) => b.avgTime - a.avgTime)
  
  return bottlenecks[0]  // 最慢的工序就是瓶颈
}
```

---

### 逻辑链7：权限控制

#### MES 怎么做
不同角色看到不同数据，能做不同操作。

#### 溢彩包装适配

```
角色权限矩阵：

功能              师傅    跟单员    管理员
─────────────────────────────────────────
看自己的任务       ✅      ❌       ✅
看所有订单         ❌      ❌       ✅
看自己录的订单     ❌      ✅       ✅
录入订单           ❌      ✅       ✅
分配订单           ❌      ❌       ✅
开始/完成工序      ✅      ❌       ✅
提交反馈           ✅      ✅       ✅
处理反馈           ❌      ❌       ✅
看库存             ❌      ✅       ✅
看报表             ❌      ❌       ✅
管理师傅           ❌      ❌       ✅
```

#### 实现方法

```javascript
// 中间件：检查登录态
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ error: '未登录' })
  }
  
  const user = verifyToken(token)
  if (!user) {
    return res.status(401).json({ error: '登录已过期' })
  }
  
  req.user = user
  next()
}

// 中间件：检查角色
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '没有权限' })
    }
    next()
  }
}

// 中间件：检查数据权限
function checkDataAccess(req, res, next) {
  const user = req.user
  
  if (user.role === '管理员') {
    // 管理员看所有
    next()
  } else if (user.role === '跟单员') {
    // 跟单员只看自己录的
    req.query.created_by = user.id
    next()
  } else if (user.role === '师傅') {
    // 师傅只看自己的任务
    req.query.worker = user.name
    next()
  }
}

// 使用示例
app.get('/api/schedule', requireAuth, checkDataAccess, (req, res) => {
  // 自动过滤，师傅只看到自己的订单
  let orders = getAllOrders()
  
  if (req.query.worker) {
    const workerAssignments = assignments.filter(a => a.worker === req.query.worker)
    const orderIds = [...new Set(workerAssignments.map(a => a.order_id))]
    orders = orders.filter(o => orderIds.includes(o.id))
  }
  
  res.json(orders)
})

app.post('/api/agent/assign', requireAuth, requireRole('管理员'), (req, res) => {
  // 只有管理员能分配
  // ...
})
```

---

### 逻辑链8：实时通知

#### MES 怎么做
事情发生时立刻通知相关人员，不用刷新页面。

#### 溢彩包装适配

```
通知方式（从简单到复杂）：

1. 页面内弹窗（最简单）
   └─ 师傅在工作台页面时，弹窗提醒

2. 浏览器通知（中等）
   └─ 即使不在页面，浏览器也能弹通知

3. 飞书/微信推送（最实用）
   └─ 师傅不看电脑也能收到手机通知
```

#### 实现方法

```javascript
// 方式1：WebSocket（页面内实时通知）
const WebSocket = require('ws')
const wss = new WebSocket.Server({ port: 8081 })

const clients = new Map()  // userId -> websocket

wss.on('connection', (ws, req) => {
  const userId = new URL(req.url, 'http://localhost').searchParams.get('userId')
  clients.set(userId, ws)
  
  ws.on('close', () => {
    clients.delete(userId)
  })
})

// 发送通知给指定用户
function notifyUser(userId, message) {
  const ws = clients.get(userId)
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message))
  }
}

// 方式2：飞书机器人推送（推荐）
const axios = require('axios')

const FEISHU_WEBHOOK = 'https://open.feishu.cn/open-apis/bot/v2/hook/xxx'

async function notifyFeishu(title, content, users) {
  await axios.post(FEISHU_WEBHOOK, {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: title }
      },
      elements: [
        {
          tag: 'div',
          text: { tag: 'plain_text', content: content }
        }
      ]
    }
  })
}

// 方式3：微信小程序订阅消息
async function notifyWechat(openid, templateId, data) {
  const accessToken = await getWechatAccessToken()
  
  await axios.post(`https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`, {
    touser: openid,
    template_id: templateId,
    data: data
  })
}
```

---

## 三、完整事件流图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         溢彩包装事件流                              │
└─────────────────────────────────────────────────────────────────────┘

跟单员录入订单
    │
    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ 计算用料     │───▶│ 检查库存     │───▶│ 创建订单     │
│              │    │              │    │ 状态：待分配  │
└──────────────┘    └──────────────┘    └──────────────┘
                         │
                         ▼ 库存不足
                    ┌──────────────┐
                    │ 通知管理员   │
                    │ 采购材料     │
                    └──────────────┘

管理员分配订单
    │
    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ 检查资源     │───▶│ 分配师傅     │───▶│ 自动领料     │
│ 师傅+机器    │    │ 生成工序     │    │ 扣减库存     │
└──────────────┘    └──────────────┘    └──────────────┘
                         │
                         ▼
                    ┌──────────────┐
                    │ 通知第一个   │
                    │ 师傅开始     │
                    └──────────────┘

师傅完成工序
    │
    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ 记录工时     │───▶│ 更新工序状态 │───▶│ 通知下一个   │
│ 数量+不良品  │    │              │    │ 师傅         │
└──────────────┘    └──────────────┘    └──────────────┘
                         │
                         ▼ 最后一个工序
                    ┌──────────────┐
                    │ 订单自动完成 │
                    │ 通知管理员   │
                    └──────────────┘

师傅提交反馈
    │
    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ 暂停订单     │───▶│ 通知相关人   │───▶│ 等待处理     │
│              │    │              │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
                                              │
                                              ▼ 处理完成
                                        ┌──────────────┐
                                        │ 恢复订单     │
                                        │ 通知师傅     │
                                        └──────────────┘
```

---

## 四、技术实现要点

### 1. 事件系统（用 Node.js EventEmitter）
```javascript
const EventEmitter = require('events')
const bus = new EventEmitter()

// 注册处理器
bus.on('工序完成', handleStepCompleted)
bus.on('反馈提交', handleFeedbackSubmitted)
bus.on('库存不足', handleStockLow)

// 触发事件
bus.emit('工序完成', { orderId, stepName, worker })
```

### 2. 数据持久化（JSON 文件）
```javascript
const fs = require('fs')

function saveData() {
  fs.writeFileSync('./data/orders.json', JSON.stringify(orders, null, 2))
  fs.writeFileSync('./data/assignments.json', JSON.stringify(assignments, null, 2))
  fs.writeFileSync('./data/inventory.json', JSON.stringify(inventory, null, 2))
}

function loadData() {
  orders = JSON.parse(fs.readFileSync('./data/orders.json'))
  assignments = JSON.parse(fs.readFileSync('./data/assignments.json'))
  inventory = JSON.parse(fs.readFileSync('./data/inventory.json'))
}
```

### 3. 通知系统（飞书机器人）
```javascript
async function notifyWorker(workerName, message) {
  const worker = workers.find(w => w.name === workerName)
  if (!worker?.feishu_id) return
  
  await notifyFeishu(message.title, message.content, [worker.feishu_id])
}
```

### 4. 权限中间件
```javascript
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const user = verifyToken(token)
  if (!user) return res.status(401).json({ error: '未登录' })
  req.user = user
  next()
}
```

---

## 五、实现优先级

### P0（第一周）
1. 数据持久化（JSON文件）
2. 事件系统（EventEmitter）
3. 工序自动传导（完成→通知下一个）
4. 权限控制（基础版）

### P1（第二周）
5. 反馈联动（暂停+通知）
6. 库存联动（领料+预警）
7. 飞书/微信通知
8. 导出Excel

### P2（第三周）
9. 工时记录
10. 日报统计
11. 瓶颈分析
12. 微信小程序

---

## 六、给 Claude 的指令

实现时请遵循以下原则：

1. **每个功能都要有事件**：做完一个动作要触发事件，不能默默完成
2. **状态机不能跳级**：待分配→已分配→生产中→已完成，不能乱跳
3. **自动推导**：订单状态从工序状态推导，不用手动设置
4. **通知要到位**：每个事件都要通知相关人员
5. **数据要持久**：所有数据存JSON文件，重启不丢
6. **权限要校验**：后端校验，不是前端隐藏

关键文件：
- `server-mock.js` - 主服务器，所有API
- `models/data-store.js` - 数据模型+状态机
- `models/event-bus.js` - 事件系统（新增）
- `models/notifier.js` - 通知系统（新增）
- `models/auth.js` - 权限模块（新增）
- `data/` - JSON数据文件（新增）
