/**
 * 溢彩包装 - 事件总线
 * 轻量级 MES 事件系统，用于工序传导、通知、审计
 */

const EventEmitter = require('events');

class MESEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // MES 事件多
  }
}

const bus = new MESEventBus();

// 事件类型常量
const EVENTS = {
  // 工序事件
  STEP_STARTED: 'step:started',
  STEP_COMPLETED: 'step:completed',
  STEP_PAUSED: 'step:paused',
  STEP_RESUMED: 'step:resumed',

  // 订单事件
  ORDER_CREATED: 'order:created',
  ORDER_ASSIGNED: 'order:assigned',
  ORDER_COMPLETED: 'order:completed',
  ORDER_CANCELLED: 'order:cancelled',
  ORDER_STATUS_CHANGED: 'order:status_changed',

  // 反馈事件
  FEEDBACK_SUBMITTED: 'feedback:submitted',
  FEEDBACK_RESOLVED: 'feedback:resolved',

  // 库存事件
  STOCK_LOW: 'stock:low',
  STOCK_ISSUED: 'stock:issued',
  STOCK_INBOUND: 'stock:inbound',

  // 通知事件
  NOTIFY_WORKER: 'notify:worker',
  NOTIFY_ADMIN: 'notify:admin',
};

module.exports = { bus, EVENTS };
