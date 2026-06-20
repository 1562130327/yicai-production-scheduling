const XLSX = require('xlsx');
const mysql = require('mysql2/promise');
require('dotenv').config();

// 解析库存表数据
function parseInventoryData(filePath) {
  const workbook = XLSX.readFile(filePath);

  // 找到 6.15-6.21 sheet
  const targetSheet = workbook.SheetNames.find(name =>
    name.includes('6.15') || name.includes('6.21') || name.includes('6.15-6.21')
  );

  if (!targetSheet) {
    console.log('未找到 6.15-6.21 sheet，使用第一个sheet');
    targetSheet = workbook.SheetNames[0];
  }

  console.log('使用库存 sheet:', targetSheet);

  const raw = XLSX.utils.sheet_to_json(workbook.Sheets[targetSheet], { header: 1 });
  const records = [];

  // 跳过表头行（前2行）
  for (let i = 2; i < raw.length; i++) {
    const row = raw[i];
    if (!row || !row[0]) continue; // 跳过空行

    const manufacturer = row[0]; // 厂家
    const material = row[1];     // 材质
    const specification = row[2]; // 规格
    const originalStock = parseFloat(row[3]) || 0; // 原有库存

    // 计算一周累计
    let weekInbound = 0;
    let weekOutbound = 0;

    // 入库和出库数据在 row[4] 到 row[17]，交替排列
    for (let j = 4; j <= 17; j += 2) {
      weekInbound += parseFloat(row[j]) || 0;  // 入库
      weekOutbound += parseFloat(row[j + 1]) || 0; // 出库
    }

    // 剩余库存可能在 row[19] 或计算得出
    const remainingStock = originalStock + weekInbound - weekOutbound;

    records.push({
      manufacturer,
      material,
      specification,
      originalStock,
      weekInbound,
      weekOutbound,
      remainingStock,
      remark: row[18] || ''
    });
  }

  return records;
}

// 解析生产排单表数据
function parseOrdersData(filePath) {
  const workbook = XLSX.readFile(filePath);
  const raw = XLSX.utils.sheet_to_json(workbook.Sheets['生产排单表'], { header: 1 });
  const records = [];

  // 跳过表头行（前2行）
  for (let i = 2; i < raw.length; i++) {
    const row = raw[i];
    if (!row || !row[0]) continue; // 跳过空行

    const orderNo = row[0] || `ORD${String(i - 1).padStart(4, '0')}`;
    const styleNo = row[1] || '';
    const customer = row[2] || '';
    const processType = row[3] || '';
    const category = row[4] || '';
    const priority = row[5] || '普通';
    const remark = row[6] || '';

    // 片材信息
    const material = row[7] || '';
    const sheetSize = row[8] || '';
    const sheetQty = row[9] || '';

    // 切片信息
    const sliceSize = row[10] || '';
    const sliceQty = row[11] || '';

    // 冲型信息
    const punchProcess = row[12] || '';
    const punchSize = row[13] || '';
    const punchQty = row[14] || '';

    // 生产进度
    const completedSheets = parseFloat(row[15]) || 0;
    const completedSlices = parseFloat(row[16]) || 0;
    const completedPunches = parseFloat(row[17]) || 0;
    const isCompleted = row[18] === '完单' || row[18] === '是';

    records.push({
      orderNo,
      styleNo,
      customer,
      processType,
      category,
      priority,
      remark,
      material,
      sheetSize,
      sheetQty,
      sliceSize,
      sliceQty,
      punchProcess,
      punchSize,
      punchQty,
      completedSheets,
      completedSlices,
      completedPunches,
      isCompleted
    });
  }

  return records;
}

// 导入数据到数据库
async function importData() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('✅ 数据库连接成功');

  // 导入库存数据
  try {
    const inventoryData = parseInventoryData('C:/Users/Administrator/Desktop/最新版EVA库存表).xlsx');
    console.log(`📦 解析到 ${inventoryData.length} 条库存记录`);

    for (const item of inventoryData) {
      // 检查厂家是否存在
      const [existingManufacturer] = await connection.query(
        'SELECT id FROM manufacturers WHERE name = ?',
        [item.manufacturer]
      );

      if (existingManufacturer.length === 0) {
        await connection.query('INSERT INTO manufacturers (name) VALUES (?)', [item.manufacturer]);
      }

      // 插入库存记录
      await connection.query(`
        INSERT INTO inventory
          (manufacturer, material, specification, original_stock,
           week_inbound, week_outbound, remaining_stock,
           week_start, week_end, remark)
        VALUES (?, ?, ?, ?, ?, ?, ?, '2025-06-15', '2025-06-21', ?)
      `, [
        item.manufacturer,
        item.material,
        item.specification,
        item.originalStock,
        item.weekInbound,
        item.weekOutbound,
        item.remainingStock,
        item.remark
      ]);
    }

    console.log('✅ 库存数据导入完成');
  } catch (err) {
    console.error('❌ 导入库存数据出错:', err.message);
  }

  // 导入订单数据
  try {
    const ordersData = parseOrdersData('C:/Users/Administrator/Desktop/生产排单表_美化版.xlsx');
    console.log(`📋 解析到 ${ordersData.length} 条订单记录`);

    for (const item of ordersData) {
      // 检查客户是否存在
      const [existingCustomer] = await connection.query(
        'SELECT id FROM customers WHERE name = ?',
        [item.customer]
      );

      if (existingCustomer.length === 0 && item.customer) {
        await connection.query('INSERT INTO customers (name) VALUES (?)', [item.customer]);
      }

      // 插入订单记录
      await connection.query(`
        INSERT INTO orders
          (order_no, style_no, customer, process_type, category, priority, remark,
           material, sheet_size, sheet_qty,
           slice_size, slice_qty,
           punch_process, punch_size, punch_qty,
           completed_sheets, completed_slices, completed_punches,
           is_completed, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `, [
        item.orderNo,
        item.styleNo,
        item.customer,
        item.processType,
        item.category,
        item.priority,
        item.remark,
        item.material,
        item.sheetSize,
        item.sheetQty,
        item.sliceSize,
        item.sliceQty,
        item.punchProcess,
        item.punchSize,
        item.punchQty,
        item.completedSheets,
        item.completedSlices,
        item.completedPunches,
        item.isCompleted
      ]);
    }

    console.log('✅ 订单数据导入完成');
  } catch (err) {
    console.error('❌ 导入订单数据出错:', err.message);
  }

  await connection.end();
  console.log('\n🎉 数据导入完成！');
}

importData().catch(console.error);
