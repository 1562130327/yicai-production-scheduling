# 溢彩包装 - 智能分配Agent设计文档

## 一、Agent概述

### 1.1 目标
开发一个智能分配Agent，实现：
- 订单自动分配给合适的师傅
- 工序流程自动生成
- 生产资源智能调度
- 任务单自动打印

### 1.2 核心价值
- 减少管理员手动分配工作量
- 提高订单分配准确率
- 优化生产流程效率
- 降低人为错误

---

## 二、业务逻辑

### 2.1 订单生命周期

```
订单创建 → 智能分配 → 师傅认领 → 生产进行 → 工序完成 → 订单完单
   ↓           ↓           ↓           ↓           ↓
  跟单员      Agent       师傅        师傅        管理员
```

### 2.2 师傅职责映射

| 师傅 | 负责工序 | 机器 | 技能要求 |
|------|----------|------|----------|
| 郑思远 | 横竖分切（打边） | 横竖分切机 | 开料、分切 |
| 伍乾进 | 破片 | 破片机 | 片材加工 |
| 老莫 | 直切、改回填 | 直切机、改回填机 | 切片类 |
| 李乐 | 冲型 | 100T冲床、新旧自动冲床 | 冲型类 |
| 老莫老婆 | 背胶、点胶 | 热熔胶机、点胶机 | 胶水类 |
| 杨合进 | 杂活 | 无 | 打包、排废 |

### 2.3 工艺流程映射

| 加工工艺 | 流程步骤 | 负责师傅 |
|----------|----------|----------|
| 片材 | 横竖分切 → 破片 | 郑思远 → 伍乾进 |
| 片材切片 | 横竖分切 → 破片 → 直切 | 郑思远 → 伍乾进 → 老莫 |
| 片材冲型 | 横竖分切 → 破片 → 冲型 | 郑思远 → 伍乾进 → 李乐 |
| 片材切片冲型 | 横竖分切 → 破片 → 直切 → 冲型 | 郑思远 → 伍乾进 → 老莫 → 李乐 |
| 切片冲型 | 直切 → 冲型 | 老莫 → 李乐 |
| 片材背胶冲型 | 横竖分切 → 破片 → 冲型 → 背胶 | 郑思远 → 伍乾进 → 李乐 → 老莫老婆 |
| 片材背胶切片冲型 | 横竖分切 → 破片 → 直切 → 冲型 → 背胶 | 郑思远 → 伍乾进 → 老莫 → 李乐 → 老莫老婆 |
| 片材贴布切片冲型 | 横竖分切 → 破片 → 贴布 → 直切 → 冲型 | 郑思远 → 伍乾进 → 外发 → 老莫 → 李乐 |
| 库存冲型 | 冲型 | 李乐 |
| 库存切片冲型 | 直切 → 冲型 | 老莫 → 李乐 |
| 库存切片 | 直切 | 老莫 |
| 库存片材 | 直接出库 | 无 |

---

## 三、智能分配算法

### 3.1 订单分配规则

```javascript
function assignOrder(order) {
  // 1. 根据工艺确定流程步骤
  const workflow = getWorkflow(order.process_type);

  // 2. 根据流程步骤分配师傅
  const assignments = workflow.map(step => ({
    step_name: step.name,
    worker_id: getWorkerByStep(step.name),
    machine_id: getMachineByStep(step.name),
    casual_workers: estimateCasualWorkers(step.name, order)
  }));

  // 3. 考虑师傅当前工作量
  const optimizedAssignments = optimizeByWorkload(assignments);

  // 4. 考虑订单优先级
  const finalAssignments = adjustByPriority(optimizedAssignments, order.priority);

  return finalAssignments;
}
```

### 3.2 零工需求估算

```javascript
function estimateCasualWorkers(stepName, order) {
  const baseWorkers = {
    '横竖分切': 2,
    '破片': 1,
    '直切': 1,
    '冲型': 2,
    '背胶': 1,
    '贴布': 2,
    '打包': 1,
    '排废': 1
  };

  // 根据订单数量调整
  const quantity = parseInt(order.sheet_qty) || 0;
  let workers = baseWorkers[stepName] || 1;

  if (quantity > 100) workers += 1;
  if (quantity > 200) workers += 1;

  return workers;
}
```

### 3.3 工作量优化

```javascript
function optimizeByWorkload(assignments) {
  // 获取每个师傅当前任务数
  const workerLoad = getWorkerLoad();

  // 按工作量排序，优先分配给负载低的师傅
  return assignments.sort((a, b) => {
    const loadA = workerLoad[a.worker_id] || 0;
    const loadB = workerLoad[b.worker_id] || 0;
    return loadA - loadB;
  });
}
```

---

## 四、API接口设计

### 4.1 智能分配接口

```
POST /api/agent/assign
- 输入: 订单ID或订单数据
- 输出: 分配结果（流程步骤、师傅、机器、零工需求）

GET /api/agent/workload
- 获取所有师傅当前工作量

POST /api/agent/optimize
- 重新优化所有订单分配

GET /api/agent/suggestions
- 获取分配建议
```

### 4.2 打印接口

```
GET /api/print/worker/:workerId
- 获取师傅的任务单数据

GET /api/print/order/:orderId
- 获取订单的打印数据

POST /api/print/batch
- 批量生成任务单
```

---

## 五、数据库设计

### 5.1 新增表

```sql
-- 订单分配表
CREATE TABLE order_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  step_name VARCHAR(50) NOT NULL,
  step_order INT DEFAULT 0,
  worker_id INT,
  machine_id INT,
  casual_worker_count INT DEFAULT 0,
  status ENUM('待开始', '进行中', '已完成') DEFAULT '待开始',
  estimated_time INT,  -- 预估时间（分钟）
  actual_time INT,     -- 实际时间
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (worker_id) REFERENCES workers(id),
  FOREIGN KEY (machine_id) REFERENCES machines(id)
);

-- 零工记录表
CREATE TABLE casual_worker_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT,
  assignment_id INT,
  worker_count INT DEFAULT 0,
  record_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (assignment_id) REFERENCES order_assignments(id)
);
```

---

## 六、前端界面

### 6.1 管理员调度界面

```
/admin-schedule.html
- 订单分配看板
- 师傅工作量可视化
- 拖拽调整分配
- 一键生成任务单
```

### 6.2 师傅任务打印页面

```
/print-tasks.html
- 选择师傅
- 预览任务单
- 打印A4任务单
- 支持批量打印
```

---

## 七、任务单设计

### 7.1 A4任务单布局

```
┌─────────────────────────────────────────┐
│        溢彩包装 - 生产任务单              │
│        师傅: XXX    日期: 2026-06-20    │
├─────────────────────────────────────────┤
│ 订单1: YC0001 - 安源                    │
│ 工艺: 片材切片                          │
│ 用料: 白色38°B料EVA（岳东）             │
│ 片材尺寸: 1.44m*3.06m*25mm             │
│ 数量: 60张                             │
│ 切片尺寸: 100*234*25mm                 │
│ 切片数量: 500片                        │
├─────────────────────────────────────────┤
│ 订单2: YC0002 - 兴达                    │
│ 工艺: 片材冲型                          │
│ 用料: 黑色高发泡1800（易升）            │
│ 片材尺寸: 1.5m*2.4m*10mm              │
│ 数量: 2张                              │
│ 冲型尺寸: 50*80*10mm                   │
│ 冲型数量: 200件                        │
└─────────────────────────────────────────┘
```

---

## 八、开发计划

### 阶段1: 核心算法 (1天)
- [x] 设计分配算法
- [ ] 实现工艺流程映射
- [ ] 实现师傅分配逻辑

### 阶段2: API开发 (1天)
- [ ] 智能分配接口
- [ ] 工作量查询接口
- [ ] 打印数据接口

### 阶段3: 前端界面 (1天)
- [ ] 调度看板界面
- [ ] 任务单打印页面

### 阶段4: 测试优化 (1天)
- [ ] 功能测试
- [ ] 性能优化
- [ ] 用户反馈

---

## 九、验证标准

1. **分配准确率** > 95%
2. **响应时间** < 1秒
3. **打印格式** 符合A4纸张标准
4. **用户满意度** > 90%
