const mysql = require('mysql2/promise');
require('dotenv').config();

async function initFullDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  console.log('数据库连接成功');

  // 创建数据库
  await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.query(`USE ${process.env.DB_NAME}`);

  // ============================================
  // 基础数据表
  // ============================================

  // 客户表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL COMMENT '客户名称',
      contact VARCHAR(100) COMMENT '联系人',
      phone VARCHAR(20) COMMENT '电话',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB COMMENT='客户表'
  `);
  console.log(' customers 表创建成功');

  // 供应商表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL COMMENT '厂家名称',
      contact VARCHAR(100) COMMENT '联系人',
      phone VARCHAR(20) COMMENT '电话',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB COMMENT='供应商表'
  `);
  console.log(' suppliers 表创建成功');

  // 材料表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS materials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) UNIQUE COMMENT '材料编码',
      name VARCHAR(200) NOT NULL COMMENT '材料名称',
      category VARCHAR(50) COMMENT '分类',
      unit VARCHAR(20) DEFAULT '张' COMMENT '单位',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB COMMENT='材料表'
  `);
  console.log(' materials 表创建成功');

  // 库存表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      supplier_id INT NOT NULL COMMENT '供应商ID',
      material_id INT NOT NULL COMMENT '材料ID',
      specification VARCHAR(200) COMMENT '规格',
      stock_qty DECIMAL(10,2) DEFAULT 0 COMMENT '当前库存',
      min_stock DECIMAL(10,2) DEFAULT 0 COMMENT '安全库存',
      last_inbound_date DATE COMMENT '最近入库日期',
      last_outbound_date DATE COMMENT '最近出库日期',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (material_id) REFERENCES materials(id),
      UNIQUE KEY uk_supplier_material_spec (supplier_id, material_id, specification)
    ) ENGINE=InnoDB COMMENT='库存表'
  `);
  console.log(' inventory 表创建成功');

  // 库存流水表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      inventory_id INT NOT NULL COMMENT '库存ID',
      type ENUM('inbound', 'outbound', 'adjust') NOT NULL COMMENT '类型',
      quantity DECIMAL(10,2) NOT NULL COMMENT '数量',
      related_order_id INT COMMENT '关联订单',
      remark TEXT COMMENT '备注',
      operator VARCHAR(50) COMMENT '操作人',
      transaction_date DATE COMMENT '业务日期',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (inventory_id) REFERENCES inventory(id)
    ) ENGINE=InnoDB COMMENT='库存流水表'
  `);
  console.log(' inventory_transactions 表创建成功');

  // ============================================
  // 人员和机器表
  // ============================================

  // 用户表（管理员、跟单员、师傅）
  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) UNIQUE NOT NULL COMMENT '姓名',
      role ENUM('管理员', '跟单员', '师傅') NOT NULL COMMENT '角色',
      phone VARCHAR(20) COMMENT '电话',
      password VARCHAR(100) COMMENT '密码（可选，师傅不用密码）',
      is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB COMMENT='用户表'
  `);
  console.log(' users 表创建成功');

  // 师傅表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS workers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT COMMENT '关联用户ID',
      name VARCHAR(50) UNIQUE NOT NULL COMMENT '姓名',
      phone VARCHAR(20) COMMENT '电话',
      specialty VARCHAR(200) COMMENT '擅长工序',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB COMMENT='师傅表'
  `);
  console.log(' workers 表创建成功');

  // 机器表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS machines (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL COMMENT '机器名称',
      worker_id INT COMMENT '负责师傅',
      status ENUM('正常', '维修', '停用') DEFAULT '正常' COMMENT '状态',
      description TEXT COMMENT '说明',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (worker_id) REFERENCES workers(id)
    ) ENGINE=InnoDB COMMENT='机器表'
  `);
  console.log(' machines 表创建成功');

  // 零工记录表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS casual_workers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      record_date DATE NOT NULL COMMENT '日期',
      type ENUM('打杂', '配合') NOT NULL COMMENT '类型',
      count INT DEFAULT 0 COMMENT '人数',
      machine_id INT COMMENT '配合的机器',
      remark TEXT COMMENT '备注',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (machine_id) REFERENCES machines(id)
    ) ENGINE=InnoDB COMMENT='零工记录表'
  `);
  console.log(' casual_workers 表创建成功');

  // ============================================
  // 订单和流程表
  // ============================================

  // 订单表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_no VARCHAR(50) UNIQUE COMMENT '订单编号',
      style_no VARCHAR(100) COMMENT '款号',
      customer_id INT COMMENT '客户ID',
      process_type VARCHAR(100) COMMENT '加工工艺',
      category VARCHAR(50) COMMENT '类别',
      priority ENUM('低', '普通', '注意', '特急') DEFAULT '普通' COMMENT '优先级',
      remark TEXT COMMENT '备注',
      material_info VARCHAR(500) COMMENT '用料信息',
      sheet_spec VARCHAR(100) COMMENT '片材规格',
      sheet_qty DECIMAL(10,2) DEFAULT 0 COMMENT '片材数量',
      sheet_completed DECIMAL(10,2) DEFAULT 0 COMMENT '已开片材',
      slice_spec VARCHAR(100) COMMENT '切片规格',
      slice_qty DECIMAL(10,2) DEFAULT 0 COMMENT '切片数量',
      slice_completed DECIMAL(10,2) DEFAULT 0 COMMENT '已切片',
      punch_process VARCHAR(100) COMMENT '冲型工艺',
      punch_spec VARCHAR(100) COMMENT '冲型规格',
      punch_qty DECIMAL(10,2) DEFAULT 0 COMMENT '冲型数量',
      punch_completed DECIMAL(10,2) DEFAULT 0 COMMENT '已冲型',
      glue_completed DECIMAL(10,2) DEFAULT 0 COMMENT '已背胶',
      status ENUM('待排产', '生产中', '已完成', '已取消') DEFAULT '待排产' COMMENT '状态',
      is_urgent BOOLEAN DEFAULT FALSE COMMENT '是否加急',
      due_date DATE COMMENT '交货日期',
      order_date DATE COMMENT '下单日期',
      completed_at DATETIME COMMENT '完单时间',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    ) ENGINE=InnoDB COMMENT='订单表'
  `);
  console.log(' orders 表创建成功');

  // 订单流程进度表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS order_progress (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL COMMENT '订单ID',
      step_name VARCHAR(50) NOT NULL COMMENT '工序名称',
      step_order INT DEFAULT 0 COMMENT '工序顺序',
      worker_id INT COMMENT '负责师傅',
      machine_id INT COMMENT '使用机器',
      status ENUM('待开始', '进行中', '已完成') DEFAULT '待开始' COMMENT '状态',
      quantity DECIMAL(10,2) DEFAULT 0 COMMENT '完成数量',
      casual_worker_count INT DEFAULT 0 COMMENT '需要零工人数',
      started_at DATETIME COMMENT '开始时间',
      completed_at DATETIME COMMENT '完成时间',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (worker_id) REFERENCES workers(id),
      FOREIGN KEY (machine_id) REFERENCES machines(id)
    ) ENGINE=InnoDB COMMENT='订单流程进度表'
  `);
  console.log(' order_progress 表创建成功');

  // ============================================
  // 反馈系统
  // ============================================

  // 反馈表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS feedbacks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT COMMENT '订单ID',
      from_worker_id INT COMMENT '反馈人',
      to_worker_id INT COMMENT '接收人',
      type ENUM('数量问题', '材料问题', '人员不足', '机器故障') NOT NULL COMMENT '类型',
      content TEXT NOT NULL COMMENT '内容',
      status ENUM('待处理', '处理中', '已解决') DEFAULT '待处理' COMMENT '状态',
      reply TEXT COMMENT '回复',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (from_worker_id) REFERENCES workers(id),
      FOREIGN KEY (to_worker_id) REFERENCES workers(id)
    ) ENGINE=InnoDB COMMENT='反馈表'
  `);
  console.log(' feedbacks 表创建成功');

  // ============================================
  // 算料规则
  // ============================================

  // 算料规则表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS calculation_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      rule_name VARCHAR(100) COMMENT '规则名称',
      from_value DECIMAL(10,2) COMMENT '原值',
      to_value DECIMAL(10,2) COMMENT '换算后值',
      rule_type ENUM('厚度换算', '尺寸换算') NOT NULL COMMENT '规则类型',
      description TEXT COMMENT '说明',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB COMMENT='算料规则表'
  `);
  console.log(' calculation_rules 表创建成功');

  // 日报表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS daily_reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      report_date DATE UNIQUE NOT NULL COMMENT '日期',
      total_orders INT DEFAULT 0 COMMENT '总订单数',
      completed_orders INT DEFAULT 0 COMMENT '完成订单数',
      in_progress_orders INT DEFAULT 0 COMMENT '进行中订单数',
      urgent_orders INT DEFAULT 0 COMMENT '紧急订单数',
      feedback_count INT DEFAULT 0 COMMENT '反馈数量',
      summary TEXT COMMENT '日报摘要',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB COMMENT='日报表'
  `);
  console.log(' daily_reports 表创建成功');

  await connection.end();
  console.log('\n数据库初始化完成！');
}

initFullDatabase().catch(console.error);
