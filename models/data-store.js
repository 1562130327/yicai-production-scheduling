/**
 * 溢彩包装 - 统一数据存储
 * 所有模块共享的数据存储中心
 * 支持 JSON 文件持久化
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

// ============================================
// 数据持久化
// ============================================
function loadFromFile() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      console.log('📂 无持久化数据，使用默认数据');
      return;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const saved = JSON.parse(raw);
    if (saved.orders) orders.length = 0, orders.push(...saved.orders);
    if (saved.assignments) assignments.length = 0, assignments.push(...saved.assignments);
    if (saved.feedbacks) feedbacks.length = 0, feedbacks.push(...saved.feedbacks);
    if (saved.operationLogs) operationLogs.length = 0, operationLogs.push(...saved.operationLogs);
    if (saved.inventory) inventory.length = 0, inventory.push(...saved.inventory);
    if (saved.inventoryTransactions) inventoryTransactions.length = 0, inventoryTransactions.push(...saved.inventoryTransactions);
    if (saved.orderStatusHistory) orderStatusHistory.length = 0, orderStatusHistory.push(...saved.orderStatusHistory);
    if (saved.samples) samples.length = 0, samples.push(...saved.samples);
    if (saved.customers) customers.length = 0, customers.push(...saved.customers);
    console.log(`📂 已加载持久化数据: ${orders.length}个订单, ${assignments.length}个分配`);
  } catch (err) {
    console.error('❌ 加载持久化数据失败:', err.message);
  }
}

function saveToFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const data = {
      orders, orderStatusHistory, assignments, feedbacks,
      operationLogs, inventory, inventoryTransactions,
      samples, customers,
      _savedAt: new Date().toISOString()
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('❌ 保存数据失败:', err.message);
  }
}

function autoSave() {
  saveToFile();
}

// ============================================
// 订单数据
// ============================================
let orders = [];
let orderStatusHistory = []; // 订单状态历史

// 订单状态机
const ORDER_STATUS = {
  PENDING_ASSIGN: '待分配',   // 跟单员已录入，等待管理员分配
  ASSIGNED: '已分配',         // 管理员已分配，等待师傅开始
  IN_PROGRESS: '生产中',      // 至少一个工序进行中
  COMPLETED: '已完成',        // 所有工序完成
  CANCELLED: '已取消'         // 已取消
};

// 状态流转规则
const STATUS_FLOW = {
  '待分配': ['已分配', '已取消'],
  '已分配': ['生产中', '已取消'],
  '生产中': ['已完成', '已取消'],
  '已完成': [],
  '已取消': ['待分配']
};

// 工序状态
const ASSIGNMENT_STATUS = {
  PENDING: '待开始',
  IN_PROGRESS: '进行中',
  PAUSED: '暂停',
  COMPLETED: '已完成'
};

// ============================================
// 分配数据
// ============================================
let assignments = []; // 订单分配记录

// ============================================
// 库存数据
// ============================================
let inventory = [];
let inventoryTransactions = []; // 库存流水

// ============================================
// 师傅数据
// ============================================
let workers = [
  // 固定岗位师傅
  { id: 1, name: '郑思远', phone: '', specialty: '横竖分切机', role: '师傅', is_fixed: true, description: '打边、分切' },
  { id: 2, name: '伍乾进', phone: '', specialty: '破片机', role: '师傅', is_fixed: true, description: '开片' },
  { id: 3, name: '莫齐国', phone: '', specialty: '直切机', role: '师傅', is_fixed: true, description: '精准切片' },
  { id: 4, name: '李乐', phone: '', specialty: '冲床（全部）', role: '师傅', is_fixed: true, description: '4台冲床' },
  // 非固定岗位（优先考虑）
  { id: 5, name: '周忠琼', phone: '', specialty: '冲床（辅助）', role: '师傅', is_fixed: false, description: '主要冲床，可调岗' },
  { id: 6, name: '简翠花', phone: '', specialty: '热熔胶机、点胶机', role: '师傅', is_fixed: false, description: '背胶、点胶' },
  { id: 7, name: '杨合进', phone: '', specialty: '打包', role: '师傅', is_fixed: false, description: '成品打包' },
  // 管理员
  { id: 8, name: '潘光龙', phone: '', specialty: '管理', role: '管理员' },
  { id: 9, name: '潘朝森', phone: '', specialty: '管理', role: '管理员' },
  // 跟单员
  { id: 10, name: '罗巧芳', phone: '', specialty: '跟单', role: '跟单员' },
  { id: 11, name: '曾小芳', phone: '', specialty: '跟单', role: '跟单员' },
  { id: 12, name: '彭鸿媛', phone: '', specialty: '跟单', role: '跟单员' }
];

// ============================================
// 机器数据
// ============================================
let machines = [
  // 横竖分切机（郑思远）
  { id: 1, name: '横竖分切机', worker_id: 1, worker_name: '郑思远', status: '正常', casual_workers: 1, description: '打边、分切，需1-3零工配合' },

  // 破片机（伍乾进）
  { id: 2, name: '破片机', worker_id: 2, worker_name: '伍乾进', status: '正常', casual_workers: 3, description: '开片，固定3零工' },

  // 直切机（莫齐国）
  { id: 3, name: '直切机', worker_id: 3, worker_name: '莫齐国', status: '正常', casual_workers: 0, description: '精准切片，不需要零工' },

  // 冲床（李乐负责全部）
  { id: 4, name: '新自动冲床', worker_id: 4, worker_name: '李乐', status: '正常', casual_workers: 2, description: '自动冲，需2人操作' },
  { id: 5, name: '旧自动冲床', worker_id: 4, worker_name: '李乐', status: '正常', casual_workers: 2, description: '自动冲，需2人操作' },
  { id: 6, name: '100T冲床A面', worker_id: 4, worker_name: '李乐', status: '正常', casual_workers: 1, description: '手动冲，需1人操作' },
  { id: 7, name: '100T冲床B面', worker_id: 4, worker_name: '李乐', status: '正常', casual_workers: 1, description: '手动冲，需1人操作' },

  // 背胶/点胶（简翠花）
  { id: 8, name: '热熔胶机', worker_id: 6, worker_name: '简翠花', status: '正常', casual_workers: 1, description: '背胶' },
  { id: 9, name: '点胶机1', worker_id: 6, worker_name: '简翠花', status: '正常', casual_workers: 1, description: '点胶' },
  { id: 10, name: '点胶机2', worker_id: 6, worker_name: '简翠花', status: '正常', casual_workers: 1, description: '点胶' },

  // 杂活
  { id: 11, name: '排废机1', worker_id: 7, worker_name: '杨合进', status: '正常', casual_workers: 0, description: '排废' },
  { id: 12, name: '排废机2', worker_id: 7, worker_name: '杨合进', status: '正常', casual_workers: 0, description: '排废' },
  { id: 13, name: '改回填机', worker_id: 3, worker_name: '莫齐国', status: '正常', casual_workers: 0, description: '改回填' },
  { id: 14, name: '排废改回填机', worker_id: 3, worker_name: '莫齐国', status: '正常', casual_workers: 0, description: '排废改回填' }
];

// ============================================
// 反馈数据
// ============================================
let feedbacks = [];

// ============================================
// 样板数据
// ============================================
let samples = [];

// ============================================
// 客户数据
// ============================================
let customers = [];

// ============================================
// 操作日志
// ============================================
let operationLogs = [];

// ============================================
// 工艺流程定义
// ============================================
const WORKFLOW_MAP = {
  // ===== 基础工艺 =====
  '片材': [
    { step_name: '横竖分切', step_order: 1, worker: '郑思远', machine: '横竖分切机', base_workers: 2, description: '打边、分切' },
    { step_name: '破片', step_order: 2, worker: '伍乾进', machine: '破片机', base_workers: 3, description: '开片' },
    { step_name: '打包', step_order: 3, worker: '杨合进', machine: '-', base_workers: 0, description: '成品打包' }
  ],
  '片材切片': [
    { step_name: '横竖分切', step_order: 1, worker: '郑思远', machine: '横竖分切机', base_workers: 2, description: '打边、分切' },
    { step_name: '破片', step_order: 2, worker: '伍乾进', machine: '破片机', base_workers: 3, description: '开片' },
    { step_name: '直切', step_order: 3, worker: '莫齐国', machine: '直切机', base_workers: 0, description: '精准切片' },
    { step_name: '打包', step_order: 4, worker: '杨合进', machine: '-', base_workers: 0, description: '成品打包' }
  ],
  '片材冲型': [
    { step_name: '横竖分切', step_order: 1, worker: '郑思远', machine: '横竖分切机', base_workers: 2, description: '打边、分切' },
    { step_name: '破片', step_order: 2, worker: '伍乾进', machine: '破片机', base_workers: 3, description: '开片' },
    { step_name: '冲型', step_order: 3, worker: '李乐', machine: '冲床', base_workers: 2, description: '冲型' },
    { step_name: '打包', step_order: 4, worker: '杨合进', machine: '-', base_workers: 0, description: '成品打包' }
  ],
  '片材切片冲型': [
    { step_name: '横竖分切', step_order: 1, worker: '郑思远', machine: '横竖分切机', base_workers: 2, description: '打边、分切' },
    { step_name: '破片', step_order: 2, worker: '伍乾进', machine: '破片机', base_workers: 3, description: '开片' },
    { step_name: '直切', step_order: 3, worker: '莫齐国', machine: '直切机', base_workers: 0, description: '切片' },
    { step_name: '冲型', step_order: 4, worker: '李乐', machine: '冲床', base_workers: 2, description: '冲型' },
    { step_name: '打包', step_order: 5, worker: '杨合进', machine: '-', base_workers: 0, description: '成品打包' }
  ],
  '切片冲型': [
    { step_name: '直切', step_order: 1, worker: '莫齐国', machine: '直切机', base_workers: 0, description: '切片' },
    { step_name: '冲型', step_order: 2, worker: '李乐', machine: '冲床', base_workers: 2, description: '冲型' },
    { step_name: '打包', step_order: 3, worker: '杨合进', machine: '-', base_workers: 0, description: '成品打包' }
  ],

  // ===== 背胶工艺 =====
  '片材背胶': [
    { step_name: '横竖分切', step_order: 1, worker: '郑思远', machine: '横竖分切机', base_workers: 2, description: '打边、分切' },
    { step_name: '破片', step_order: 2, worker: '伍乾进', machine: '破片机', base_workers: 3, description: '开片' },
    { step_name: '背胶', step_order: 3, worker: '简翠花', machine: '热熔胶机', base_workers: 1, description: '背胶' },
    { step_name: '打包', step_order: 4, worker: '杨合进', machine: '-', base_workers: 0, description: '成品打包' }
  ],
  '片材背胶冲型': [
    { step_name: '横竖分切', step_order: 1, worker: '郑思远', machine: '横竖分切机', base_workers: 2, description: '打边、分切' },
    { step_name: '破片', step_order: 2, worker: '伍乾进', machine: '破片机', base_workers: 3, description: '开片' },
    { step_name: '冲型', step_order: 3, worker: '李乐', machine: '冲床', base_workers: 2, description: '冲型' },
    { step_name: '背胶', step_order: 4, worker: '简翠花', machine: '热熔胶机', base_workers: 1, description: '背胶' },
    { step_name: '打包', step_order: 5, worker: '杨合进', machine: '-', base_workers: 0, description: '成品打包' }
  ],
  '片材背胶切片': [
    { step_name: '横竖分切', step_order: 1, worker: '郑思远', machine: '横竖分切机', base_workers: 2, description: '打边、分切' },
    { step_name: '破片', step_order: 2, worker: '伍乾进', machine: '破片机', base_workers: 3, description: '开片' },
    { step_name: '背胶', step_order: 3, worker: '简翠花', machine: '热熔胶机', base_workers: 1, description: '背胶' },
    { step_name: '直切', step_order: 4, worker: '莫齐国', machine: '直切机', base_workers: 0, description: '切片' },
    { step_name: '打包', step_order: 5, worker: '杨合进', machine: '-', base_workers: 0, description: '成品打包' }
  ],
  '片材背胶切片冲型': [
    { step_name: '横竖分切', step_order: 1, worker: '郑思远', machine: '横竖分切机', base_workers: 2, description: '打边、分切' },
    { step_name: '破片', step_order: 2, worker: '伍乾进', machine: '破片机', base_workers: 3, description: '开片' },
    { step_name: '背胶', step_order: 3, worker: '简翠花', machine: '热熔胶机', base_workers: 1, description: '背胶' },
    { step_name: '直切', step_order: 4, worker: '莫齐国', machine: '直切机', base_workers: 0, description: '切片' },
    { step_name: '冲型', step_order: 5, worker: '李乐', machine: '冲床', base_workers: 2, description: '冲型' },
    { step_name: '打包', step_order: 6, worker: '杨合进', machine: '-', base_workers: 0, description: '成品打包' }
  ],

  // ===== 贴布工艺 =====
  '片材贴布': [
    { step_name: '横竖分切', step_order: 1, worker: '郑思远', machine: '横竖分切机', base_workers: 2, description: '打边、分切' },
    { step_name: '破片', step_order: 2, worker: '伍乾进', machine: '破片机', base_workers: 3, description: '开片' },
    { step_name: '贴布', step_order: 3, worker: '外发加工', machine: '-', base_workers: 0, description: '贴布（外发）' },
    { step_name: '打包', step_order: 4, worker: '杨合进', machine: '-', base_workers: 0, description: '成品打包' }
  ],
  '片材贴布冲型': [
    { step_name: '横竖分切', step_order: 1, worker: '郑思远', machine: '横竖分切机', base_workers: 2, description: '打边、分切' },
    { step_name: '破片', step_order: 2, worker: '伍乾进', machine: '破片机', base_workers: 3, description: '开片' },
    { step_name: '贴布', step_order: 3, worker: '外发加工', machine: '-', base_workers: 0, description: '贴布（外发）' },
    { step_name: '冲型', step_order: 4, worker: '李乐', machine: '冲床', base_workers: 2, description: '冲型' },
    { step_name: '打包', step_order: 5, worker: '杨合进', machine: '-', base_workers: 0, description: '成品打包' }
  ],
  '片材贴布切片': [
    { step_name: '横竖分切', step_order: 1, worker: '郑思远', machine: '横竖分切机', base_workers: 2, description: '打边、分切' },
    { step_name: '破片', step_order: 2, worker: '伍乾进', machine: '破片机', base_workers: 3, description: '开片' },
    { step_name: '贴布', step_order: 3, worker: '外发加工', machine: '-', base_workers: 0, description: '贴布（外发）' },
    { step_name: '直切', step_order: 4, worker: '莫齐国', machine: '直切机', base_workers: 0, description: '切片' },
    { step_name: '打包', step_order: 5, worker: '杨合进', machine: '-', base_workers: 0, description: '成品打包' }
  ],
  '片材贴布切片冲型': [
    { step_name: '横竖分切', step_order: 1, worker: '郑思远', machine: '横竖分切机', base_workers: 2, description: '打边、分切' },
    { step_name: '破片', step_order: 2, worker: '伍乾进', machine: '破片机', base_workers: 3, description: '开片' },
    { step_name: '贴布', step_order: 3, worker: '外发加工', machine: '-', base_workers: 0, description: '贴布（外发）' },
    { step_name: '直切', step_order: 4, worker: '莫齐国', machine: '直切机', base_workers: 0, description: '切片' },
    { step_name: '冲型', step_order: 5, worker: '李乐', machine: '冲床', base_workers: 2, description: '冲型' },
    { step_name: '打包', step_order: 6, worker: '杨合进', machine: '-', base_workers: 0, description: '成品打包' }
  ],

  // ===== 背胶+贴布工艺 =====
  '片材背胶贴布': [
    { step_name: '横竖分切', step_order: 1, worker: '郑思远', machine: '横竖分切机', base_workers: 2, description: '打边、分切' },
    { step_name: '破片', step_order: 2, worker: '伍乾进', machine: '破片机', base_workers: 3, description: '开片' },
    { step_name: '背胶', step_order: 3, worker: '简翠花', machine: '热熔胶机', base_workers: 1, description: '背胶' },
    { step_name: '贴布', step_order: 4, worker: '外发加工', machine: '-', base_workers: 0, description: '贴布（外发）' },
    { step_name: '打包', step_order: 5, worker: '杨合进', machine: '-', base_workers: 0, description: '成品打包' }
  ],
  '片材背胶贴布冲型': [
    { step_name: '横竖分切', step_order: 1, worker: '郑思远', machine: '横竖分切机', base_workers: 2, description: '打边、分切' },
    { step_name: '破片', step_order: 2, worker: '伍乾进', machine: '破片机', base_workers: 3, description: '开片' },
    { step_name: '背胶', step_order: 3, worker: '简翠花', machine: '热熔胶机', base_workers: 1, description: '背胶' },
    { step_name: '贴布', step_order: 4, worker: '外发加工', machine: '-', base_workers: 0, description: '贴布（外发）' },
    { step_name: '冲型', step_order: 5, worker: '李乐', machine: '冲床', base_workers: 2, description: '冲型' },
    { step_name: '打包', step_order: 6, worker: '杨合进', machine: '-', base_workers: 0, description: '成品打包' }
  ],
  '片材背胶贴布切片冲型': [
    { step_name: '横竖分切', step_order: 1, worker: '郑思远', machine: '横竖分切机', base_workers: 2, description: '打边、分切' },
    { step_name: '破片', step_order: 2, worker: '伍乾进', machine: '破片机', base_workers: 3, description: '开片' },
    { step_name: '背胶', step_order: 3, worker: '简翠花', machine: '热熔胶机', base_workers: 1, description: '背胶' },
    { step_name: '贴布', step_order: 4, worker: '外发加工', machine: '-', base_workers: 0, description: '贴布（外发）' },
    { step_name: '直切', step_order: 5, worker: '莫齐国', machine: '直切机', base_workers: 0, description: '切片' },
    { step_name: '冲型', step_order: 6, worker: '李乐', machine: '冲床', base_workers: 2, description: '冲型' },
    { step_name: '打包', step_order: 7, worker: '杨合进', machine: '-', base_workers: 0, description: '成品打包' }
  ],

  // ===== 点胶工艺（冲型后点胶，与背胶互斥）=====
  '片材切片冲型点胶': [
    { step_name: '横竖分切', step_order: 1, worker: '郑思远', machine: '横竖分切机', base_workers: 2, description: '打边、分切' },
    { step_name: '破片', step_order: 2, worker: '伍乾进', machine: '破片机', base_workers: 3, description: '开片' },
    { step_name: '直切', step_order: 3, worker: '莫齐国', machine: '直切机', base_workers: 0, description: '切片' },
    { step_name: '冲型', step_order: 4, worker: '李乐', machine: '冲床', base_workers: 2, description: '冲型' },
    { step_name: '点胶', step_order: 5, worker: '简翠花', machine: '点胶机', base_workers: 1, description: '点胶（冲型后）' },
    { step_name: '打包', step_order: 6, worker: '杨合进', machine: '-', base_workers: 0, description: '成品打包' }
  ],
  '片材背胶冲型点胶': [
    { step_name: '横竖分切', step_order: 1, worker: '郑思远', machine: '横竖分切机', base_workers: 2, description: '打边、分切' },
    { step_name: '破片', step_order: 2, worker: '伍乾进', machine: '破片机', base_workers: 3, description: '开片' },
    { step_name: '冲型', step_order: 3, worker: '李乐', machine: '冲床', base_workers: 2, description: '冲型' },
    { step_name: '背胶', step_order: 4, worker: '简翠花', machine: '热熔胶机', base_workers: 1, description: '背胶' },
    { step_name: '点胶', step_order: 5, worker: '简翠花', machine: '点胶机', base_workers: 1, description: '点胶（冲型后）' },
    { step_name: '打包', step_order: 6, worker: '杨合进', machine: '-', base_workers: 0, description: '成品打包' }
  ],
  '片材背胶切片冲型点胶': [
    { step_name: '横竖分切', step_order: 1, worker: '郑思远', machine: '横竖分切机', base_workers: 2, description: '打边、分切' },
    { step_name: '破片', step_order: 2, worker: '伍乾进', machine: '破片机', base_workers: 3, description: '开片' },
    { step_name: '背胶', step_order: 3, worker: '简翠花', machine: '热熔胶机', base_workers: 1, description: '背胶' },
    { step_name: '直切', step_order: 4, worker: '莫齐国', machine: '直切机', base_workers: 0, description: '切片' },
    { step_name: '冲型', step_order: 5, worker: '李乐', machine: '冲床', base_workers: 2, description: '冲型' },
    { step_name: '点胶', step_order: 6, worker: '简翠花', machine: '点胶机', base_workers: 1, description: '点胶（冲型后）' },
    { step_name: '打包', step_order: 7, worker: '杨合进', machine: '-', base_workers: 0, description: '成品打包' }
  ],
  '片材贴布切片冲型点胶': [
    { step_name: '横竖分切', step_order: 1, worker: '郑思远', machine: '横竖分切机', base_workers: 2, description: '打边、分切' },
    { step_name: '破片', step_order: 2, worker: '伍乾进', machine: '破片机', base_workers: 3, description: '开片' },
    { step_name: '贴布', step_order: 3, worker: '外发加工', machine: '-', base_workers: 0, description: '贴布（外发）' },
    { step_name: '直切', step_order: 4, worker: '莫齐国', machine: '直切机', base_workers: 0, description: '切片' },
    { step_name: '冲型', step_order: 5, worker: '李乐', machine: '冲床', base_workers: 2, description: '冲型' },
    { step_name: '点胶', step_order: 6, worker: '简翠花', machine: '点胶机', base_workers: 1, description: '点胶（冲型后）' },
    { step_name: '打包', step_order: 7, worker: '杨合进', machine: '-', base_workers: 0, description: '成品打包' }
  ],

  // ===== 打包流程（最后一步）=====
  '打包': [
    { step_name: '打包', step_order: 1, worker: '杨合进', machine: '-', base_workers: 0, description: '成品打包' }
  ],

  // ===== 库存工艺（优先处理库存）=====
  '库存片材': [
    { step_name: '直接出库', step_order: 1, worker: '-', machine: '-', base_workers: 0, description: '库存直接出' }
  ],
  '库存切片': [
    { step_name: '直切', step_order: 1, worker: '莫齐国', machine: '直切机', base_workers: 0, description: '库存料切片' },
    { step_name: '打包', step_order: 2, worker: '杨合进', machine: '-', base_workers: 0, description: '成品打包' }
  ],
  '库存冲型': [
    { step_name: '冲型', step_order: 1, worker: '李乐', machine: '冲床', base_workers: 2, description: '库存料冲型' },
    { step_name: '打包', step_order: 2, worker: '杨合进', machine: '-', base_workers: 0, description: '成品打包' }
  ],
  '库存切片冲型': [
    { step_name: '直切', step_order: 1, worker: '莫齐国', machine: '直切机', base_workers: 0, description: '库存料切片' },
    { step_name: '冲型', step_order: 2, worker: '李乐', machine: '冲床', base_workers: 2, description: '库存料冲型' },
    { step_name: '打包', step_order: 3, worker: '杨合进', machine: '-', base_workers: 0, description: '成品打包' }
  ]
};

// ============================================
// 工具函数
// ============================================

// 生成ID
function generateId() {
  return Date.now() + Math.random().toString(36).substr(2, 9);
}

// 记录操作日志
function logOperation(userId, action, targetType, targetId, details = {}) {
  operationLogs.push({
    id: generateId(),
    user_id: userId,
    action: action,
    target_type: targetType,
    target_id: targetId,
    details: details,
    created_at: new Date().toISOString()
  });
  // autoSave 由 API handler 统一在最后调用，避免双重写盘
}

// 校验状态流转是否合法
function validateStatusTransition(currentStatus, newStatus) {
  const allowed = STATUS_FLOW[currentStatus];
  if (!allowed) return { valid: false, error: `未知状态: ${currentStatus}` };
  if (!allowed.includes(newStatus)) {
    return { valid: false, error: `${currentStatus} 不能变为 ${newStatus}，允许: ${allowed.join('/')}` };
  }
  return { valid: true };
}

// 根据工序状态自动推导订单状态
function deriveOrderStatus(orderId) {
  const orderAssignments = assignments.filter(a => a.order_id === orderId);

  // 没有分配记录 → 待分配
  if (orderAssignments.length === 0) return '待分配';

  const statuses = orderAssignments.map(a => a.status);

  // 所有工序已完成 → 已完成
  if (statuses.every(s => s === '已完成')) return '已完成';

  // 有工序进行中或暂停 → 生产中
  if (statuses.some(s => s === '进行中' || s === '暂停')) return '生产中';

  // 全部待开始 → 已分配
  if (statuses.every(s => s === '待开始')) return '已分配';

  // 混合状态（部分完成部分待开始）→ 生产中
  return '生产中';
}

// 同步订单状态（自动推导 + 写入）
function syncOrderStatus(orderId, userId = null) {
  const order = scheduleDataRef ? scheduleDataRef.find(o => o.id === orderId) : orders.find(o => o.id === orderId);
  if (!order) return null;

  const newStatus = deriveOrderStatus(orderId);
  const oldStatus = order.status;

  if (oldStatus === newStatus) return newStatus;
  if (oldStatus === '已取消' || oldStatus === '已完成') return oldStatus;

  order.status = newStatus;
  if (newStatus === '已完成') {
    order.completed = '完单';
    order.completed_at = new Date().toISOString();
  }

  orderStatusHistory.push({
    id: generateId(),
    order_id: orderId,
    from_status: oldStatus,
    to_status: newStatus,
    changed_by: userId,
    changed_at: new Date().toISOString()
  });

  logOperation(userId, '状态自动推导', 'order', orderId, { from: oldStatus, to: newStatus });

  return newStatus;
}

// 外部注入的 scheduleData 引用（server-mock.js 设置）
let scheduleDataRef = null;

function setScheduleDataRef(ref) {
  scheduleDataRef = ref;
}

// 更新订单状态（手动，需校验）
function updateOrderStatus(orderId, newStatus, userId = null) {
  const order = scheduleDataRef ? scheduleDataRef.find(o => o.id === orderId) : orders.find(o => o.id === orderId);
  if (!order) return { success: false, error: '订单不存在' };

  const oldStatus = order.status;
  const check = validateStatusTransition(oldStatus, newStatus);
  if (!check.valid) return { success: false, error: check.error };

  order.status = newStatus;
  if (newStatus === '已完成') {
    order.completed = '完单';
    order.completed_at = new Date().toISOString();
  }
  if (newStatus === '已取消') {
    order.completed = '已取消';
  }

  orderStatusHistory.push({
    id: generateId(),
    order_id: orderId,
    from_status: oldStatus,
    to_status: newStatus,
    changed_by: userId,
    changed_at: new Date().toISOString()
  });

  logOperation(userId, '更新订单状态', 'order', orderId, { from: oldStatus, to: newStatus });

  return { success: true, from: oldStatus, to: newStatus };
}

// 检查订单是否可以完单
function canCompleteOrder(orderId) {
  return deriveOrderStatus(orderId) === '已完成';
}

// 自动完单（通过同步推导）
function autoCompleteOrder(orderId, userId = null) {
  return syncOrderStatus(orderId, userId);
}

// 领料扣减库存
function issueMaterial(orderId, materialName, quantity, userId = null) {
  // 查找库存
  const inventoryItem = inventory.find(i => i.material === materialName);
  if (!inventoryItem) {
    return { success: false, error: '库存中没有该材料' };
  }

  // 检查库存是否充足
  if (inventoryItem.remaining_stock < quantity) {
    return { success: false, error: '库存不足' };
  }

  // 扣减库存
  inventoryItem.remaining_stock -= quantity;
  inventoryItem.week_outbound = (inventoryItem.week_outbound || 0) + quantity;

  // 记录流水
  inventoryTransactions.push({
    id: generateId(),
    inventory_id: inventoryItem.id,
    type: 'outbound',
    quantity: quantity,
    related_order_id: orderId,
    transaction_date: new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString()
  });

  // 记录操作日志
  logOperation(userId, '领料出库', 'inventory', inventoryItem.id, {
    order_id: orderId,
    material: materialName,
    quantity: quantity
  });

  return { success: true, remaining: inventoryItem.remaining_stock };
}

// 入库
function inboundMaterial(materialName, quantity, userId = null) {
  const inventoryItem = inventory.find(i => i.material === materialName);
  if (!inventoryItem) {
    return { success: false, error: '库存中没有该材料' };
  }

  inventoryItem.remaining_stock += quantity;
  inventoryItem.week_inbound = (inventoryItem.week_inbound || 0) + quantity;

  inventoryTransactions.push({
    id: generateId(),
    inventory_id: inventoryItem.id,
    type: 'inbound',
    quantity: quantity,
    transaction_date: new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString()
  });

  logOperation(userId, '入库', 'inventory', inventoryItem.id, {
    material: materialName,
    quantity: quantity
  });

  return { success: true, remaining: inventoryItem.remaining_stock };
}

// 检查库存预警
function checkInventoryAlerts() {
  const alerts = [];
  inventory.forEach(item => {
    if (item.remaining_stock <= 0) {
      alerts.push({ type: 'danger', item: item, message: `${item.material} 库存为0` });
    } else if (item.remaining_stock <= 10) {
      alerts.push({ type: 'warning', item: item, message: `${item.material} 库存不足(${item.remaining_stock})` });
    }
  });
  return alerts;
}

// 检查交期提醒
function checkDueDateAlerts() {
  const alerts = [];
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const orderList = scheduleDataRef || orders;
  orderList.forEach(order => {
    if (order.due_date && order.completed !== '完单') {
      const dueDate = new Date(order.due_date);
      if (dueDate < today) {
        alerts.push({ type: 'danger', order: order, message: `${order.order_no} 已逾期` });
      } else if (dueDate <= tomorrow) {
        alerts.push({ type: 'warning', order: order, message: `${order.order_no} 明天到期` });
      }
    }
  });
  return alerts;
}

// 导出模块
module.exports = {
  // 数据
  orders,
  orderStatusHistory,
  assignments,
  inventory,
  inventoryTransactions,
  workers,
  machines,
  feedbacks,
  samples,
  customers,
  operationLogs,
  WORKFLOW_MAP,
  ORDER_STATUS,
  STATUS_FLOW,
  ASSIGNMENT_STATUS,

  // 函数
  generateId,
  logOperation,
  validateStatusTransition,
  deriveOrderStatus,
  syncOrderStatus,
  setScheduleDataRef,
  updateOrderStatus,
  canCompleteOrder,
  autoCompleteOrder,
  issueMaterial,
  inboundMaterial,
  checkInventoryAlerts,
  checkDueDateAlerts,

  // 持久化
  loadFromFile,
  saveToFile,
  autoSave
};
