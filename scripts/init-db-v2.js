const mysql = require('mysql2/promise');
require('dotenv').config();

async function initDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  console.log('✅ 数据库连接成功');

  // 创建数据库（如果不存在）
  await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.query(`USE ${process.env.DB_NAME}`);

  // ============================================
  // 1. 基础数据表
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
  console.log('✅ customers 表创建成功');

  // 厂家/供应商表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL COMMENT '厂家名称',
      contact VARCHAR(100) COMMENT '联系人',
      phone VARCHAR(20) COMMENT '电话',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB COMMENT='供应商/厂家表'
  `);
  console.log('✅ suppliers 表创建成功');

  // ============================================
  // 2. 库存系统
  // ============================================

  // 材料表（库存的物料主数据）
  await connection.query(`
    CREATE TABLE IF NOT EXISTS materials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) UNIQUE COMMENT '材料编码',
      name VARCHAR(200) NOT NULL COMMENT '材料名称/材质',
      category VARCHAR(50) COMMENT '分类（EVA、XPE、橡胶等）',
      unit VARCHAR(20) DEFAULT '张' COMMENT '计量单位',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB COMMENT='材料主数据表'
  `);
  console.log('✅ materials 表创建成功');

  // 库存表（按供应商+材料+规格）
  await connection.query(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      supplier_id INT NOT NULL COMMENT '供应商ID',
      material_id INT NOT NULL COMMENT '材料ID',
      specification VARCHAR(200) COMMENT '规格（如 1m*3m*60mm）',
      stock_qty DECIMAL(10,2) DEFAULT 0 COMMENT '当前库存数量',
      min_stock DECIMAL(10,2) DEFAULT 0 COMMENT '安全库存',
      max_stock DECIMAL(10,2) DEFAULT 0 COMMENT '最大库存',
      last_inbound_date DATE COMMENT '最近入库日期',
      last_outbound_date DATE COMMENT '最近出库日期',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (material_id) REFERENCES materials(id),
      UNIQUE KEY uk_supplier_material_spec (supplier_id, material_id, specification)
    ) ENGINE=InnoDB COMMENT='库存表'
  `);
  console.log('✅ inventory 表创建成功');

  // 库存流水表（出入库记录）
  await connection.query(`
    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      inventory_id INT NOT NULL COMMENT '库存记录ID',
      type ENUM('inbound', 'outbound', 'adjust') NOT NULL COMMENT '类型：入库/出库/调整',
      quantity DECIMAL(10,2) NOT NULL COMMENT '数量',
      related_order_id INT COMMENT '关联订单ID（出库时）',
      remark TEXT COMMENT '备注',
      operator VARCHAR(50) COMMENT '操作人',
      transaction_date DATE COMMENT '业务日期',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (inventory_id) REFERENCES inventory(id)
    ) ENGINE=InnoDB COMMENT='库存流水表'
  `);
  console.log('✅ inventory_transactions 表创建成功');

  // ============================================
  // 3. 生产排单系统
  // ============================================

  // 订单表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_no VARCHAR(50) UNIQUE COMMENT '订单编号',
      style_no VARCHAR(100) COMMENT '款号',
      customer_id INT COMMENT '客户ID',

      -- 加工信息
      process_type VARCHAR(50) COMMENT '加工工艺（片材/切片/冲型/背胶）',
      category VARCHAR(50) COMMENT '类别',
      priority ENUM('低', '普通', '注意', '特急') DEFAULT '普通' COMMENT '优先级',
      remark TEXT COMMENT '备注',

      -- 片材工序
      sheet_material_id INT COMMENT '片材材料ID',
      sheet_spec VARCHAR(100) COMMENT '片材规格',
      sheet_qty DECIMAL(10,2) DEFAULT 0 COMMENT '片材需求量',
      sheet_completed DECIMAL(10,2) DEFAULT 0 COMMENT '已开片材数',

      -- 切片工序
      slice_spec VARCHAR(100) COMMENT '切片规格',
      slice_qty DECIMAL(10,2) DEFAULT 0 COMMENT '切片需求量',
      slice_completed DECIMAL(10,2) DEFAULT 0 COMMENT '已切片数',

      -- 冲型工序
      punch_process VARCHAR(100) COMMENT '冲型工艺',
      punch_spec VARCHAR(100) COMMENT '冲型后规格',
      punch_qty DECIMAL(10,2) DEFAULT 0 COMMENT '冲型需求量',
      punch_completed DECIMAL(10,2) DEFAULT 0 COMMENT '已冲型数',

      -- 背胶工序
      glue_completed DECIMAL(10,2) DEFAULT 0 COMMENT '已背胶数',

      -- 状态
      status ENUM('待排产', '生产中', '已完成', '已取消') DEFAULT '待排产' COMMENT '订单状态',
      is_urgent BOOLEAN DEFAULT FALSE COMMENT '是否加急',

      -- 时间
      order_date DATE COMMENT '下单日期',
      due_date DATE COMMENT '交货日期',
      completed_at DATETIME COMMENT '完单时间',

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (sheet_material_id) REFERENCES materials(id)
    ) ENGINE=InnoDB COMMENT='生产订单表'
  `);
  console.log('✅ orders 表创建成功');

  // 订单领料记录
  await connection.query(`
    CREATE TABLE IF NOT EXISTS order_materials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL COMMENT '订单ID',
      inventory_id INT NOT NULL COMMENT '库存ID',
      required_qty DECIMAL(10,2) COMMENT '需求数量',
      issued_qty DECIMAL(10,2) DEFAULT 0 COMMENT '已发料数量',
      returned_qty DECIMAL(10,2) DEFAULT 0 COMMENT '退回数量',
      status ENUM('待领料', '已领料', '已退料') DEFAULT '待领料',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (inventory_id) REFERENCES inventory(id)
    ) ENGINE=InnoDB COMMENT='订单领料记录'
  `);
  console.log('✅ order_materials 表创建成功');

  // 生产进度日志
  await connection.query(`
    CREATE TABLE IF NOT EXISTS production_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL COMMENT '订单ID',
      stage ENUM('片材', '切片', '冲型', '背胶', '质检', '包装') COMMENT '工序',
      quantity DECIMAL(10,2) COMMENT '完成数量',
      worker VARCHAR(50) COMMENT '操作工人',
      remark TEXT COMMENT '备注',
      log_date DATE COMMENT '日期',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    ) ENGINE=InnoDB COMMENT='生产进度日志'
  `);
  console.log('✅ production_logs 表创建成功');

  await connection.end();
  console.log('\n🎉 数据库初始化完成！');
  console.log('\n📊 表结构说明：');
  console.log('  customers - 客户表');
  console.log('  suppliers - 供应商表');
  console.log('  materials - 材料主数据');
  console.log('  inventory - 库存表（按供应商+材料+规格）');
  console.log('  inventory_transactions - 库存流水');
  console.log('  orders - 生产订单');
  console.log('  order_materials - 订单领料');
  console.log('  production_logs - 生产日志');
}

initDatabase().catch(console.error);
