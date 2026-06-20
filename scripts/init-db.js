const mysql = require('mysql2/promise');
require('dotenv').config();

async function initDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('✅ 数据库连接成功');

  // 创建库存表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      manufacturer VARCHAR(100) COMMENT '厂家',
      material VARCHAR(200) COMMENT '材质',
      specification VARCHAR(200) COMMENT '规格',
      original_stock DECIMAL(10,2) DEFAULT 0 COMMENT '原有库存',
      week_inbound DECIMAL(10,2) DEFAULT 0 COMMENT '一周累计入库',
      week_outbound DECIMAL(10,2) DEFAULT 0 COMMENT '一周累计出库',
      remaining_stock DECIMAL(10,2) DEFAULT 0 COMMENT '剩余库存',
      remark TEXT COMMENT '备注',
      week_start DATE COMMENT '周开始日期',
      week_end DATE COMMENT '周结束日期',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ inventory 表创建成功');

  // 创建库存每日明细表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS inventory_daily (
      id INT AUTO_INCREMENT PRIMARY KEY,
      inventory_id INT COMMENT '关联库存记录',
      record_date DATE COMMENT '日期',
      inbound DECIMAL(10,2) DEFAULT 0 COMMENT '入库数量',
      outbound DECIMAL(10,2) DEFAULT 0 COMMENT '出库数量',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ inventory_daily 表创建成功');

  // 创建生产排单表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_no VARCHAR(50) COMMENT '订单编号',
      style_no VARCHAR(100) COMMENT '款号',
      customer VARCHAR(100) COMMENT '客户',
      process_type VARCHAR(50) COMMENT '加工工艺',
      category VARCHAR(50) COMMENT '类别',
      priority VARCHAR(20) COMMENT '优先级',
      remark TEXT COMMENT '备注',

      -- 片材信息
      material VARCHAR(200) COMMENT '用料',
      sheet_size VARCHAR(100) COMMENT '片材尺寸',
      sheet_qty VARCHAR(50) COMMENT '片材数量',

      -- 切片信息
      slice_size VARCHAR(100) COMMENT '切片尺寸',
      slice_qty VARCHAR(50) COMMENT '切片数量',

      -- 冲型信息
      punch_process VARCHAR(100) COMMENT '冲型工艺',
      punch_size VARCHAR(100) COMMENT '冲型后尺寸',
      punch_qty VARCHAR(50) COMMENT '冲型数量',

      -- 生产进度
      completed_sheets DECIMAL(10,2) DEFAULT 0 COMMENT '已开片材数',
      completed_slices DECIMAL(10,2) DEFAULT 0 COMMENT '已切片材数',
      completed_punches DECIMAL(10,2) DEFAULT 0 COMMENT '已冲型数',
      is_completed BOOLEAN DEFAULT FALSE COMMENT '是否完单',

      order_date DATE COMMENT '下单日期',
      status VARCHAR(20) DEFAULT 'pending' COMMENT '状态',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ orders 表创建成功');

  // 创建客户表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) UNIQUE COMMENT '客户名称',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ customers 表创建成功');

  // 创建厂家表（供应商）
  await connection.query(`
    CREATE TABLE IF NOT EXISTS manufacturers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) UNIQUE COMMENT '厂家名称',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ manufacturers 表创建成功');

  await connection.end();
  console.log('\n🎉 数据库初始化完成！');
}

initDatabase().catch(console.error);
