const XLSX = require('xlsx');
const mysql = require('mysql2/promise');
require('dotenv').config();

// 创建数据库连接
async function getConnection() {
  return await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
}

// 获取或创建记录，返回ID
async function getOrCreate(connection, table, nameField, name) {
  if (!name) return null;

  const [existing] = await connection.query(
    `SELECT id FROM ${table} WHERE ${nameField} = ?`,
    [name]
  );

  if (existing.length > 0) {
    return existing[0].id;
  }

  const [result] = await connection.query(
    `INSERT INTO ${table} (${nameField}) VALUES (?)`,
    [name]
  );
  return result.insertId;
}

// 解析库存表 - 只取最新 sheet (6.15-6.21)
function parseInventorySheet(filePath) {
  const workbook = XLSX.readFile(filePath);

  // 只取最新的 sheet (6.15-6.21)
  const targetSheet = '6.15-6.21';

  if (!workbook.SheetNames.includes(targetSheet)) {
    console.error('❌ 未找到最新库存 sheet:', targetSheet);
    console.error('可用 sheets:', workbook.SheetNames);
    return [];
  }

  console.log('📦 使用最新库存 sheet:', targetSheet);
  const raw = XLSX.utils.sheet_to_json(workbook.Sheets[targetSheet], { header: 1 });

  const records = [];
  let currentSupplier = '';

  // 跳过表头（前2行）
  for (let i = 2; i < raw.length; i++) {
    const row = raw[i];
    if (!row) continue;

    // 提取厂家（可能在第0列或合并单元格）
    const supplier = row[0] || currentSupplier;
    if (row[0]) currentSupplier = row[0];

    const material = row[1]; // 材质
    const spec = row[2];     // 规格

    if (!material || !spec) continue;

    // 解析库存数据
    const originalStock = parseFloat(row[3]) || 0;

    // 计算一周出入库
    let weekIn = 0, weekOut = 0;
    for (let j = 4; j <= 17; j += 2) {
      weekIn += parseFloat(row[j]) || 0;
      weekOut += parseFloat(row[j + 1]) || 0;
    }

    records.push({
      supplier,
      material,
      specification: spec,
      originalStock,
      weekIn,
      weekOut,
      currentStock: originalStock + weekIn - weekOut
    });
  }

  return records;
}

// 解析生产排单表
function parseOrdersSheet(filePath) {
  const workbook = XLSX.readFile(filePath);
  const raw = XLSX.utils.sheet_to_json(workbook.Sheets['生产排单表'], { header: 1 });

  console.log('📋 解析生产排单表');
  const records = [];

  for (let i = 2; i < raw.length; i++) {
    const row = raw[i];
    if (!row || !row[2]) continue; // 跳过空行

    const customer = row[2];     // 客户
    const processType = row[3];  // 加工工艺
    const category = row[4];     // 类别
    const priority = row[5] || '普通';
    const remark = row[6];

    // 材料信息（用于关联库存）
    const materialInfo = row[7] || '';  // 用料，如"白色38°B料EVA（岳东）"
    const sheetSpec = row[8];           // 片材尺寸
    const sheetQty = row[9];            // 片材数量

    // 切片信息
    const sliceSpec = row[10];
    const sliceQty = row[11];

    // 冲型信息
    const punchProcess = row[12];
    const punchSpec = row[13];
    const punchQty = row[14];

    // 生产进度
    const sheetCompleted = parseFloat(row[15]) || 0;
    const sliceCompleted = parseFloat(row[16]) || 0;
    const punchCompleted = parseFloat(row[17]) || 0;
    const isCompleted = row[18] === '完单';

    // 解析材料信息 - 提取材质和供应商
    // 格式如: "白色38°B料EVA（岳东）" 或 "黑色高发泡1800（易升）"
    let materialName = materialInfo;
    let supplierName = '';
    const match = materialInfo.match(/(.+?)（(.+?)）/);
    if (match) {
      materialName = match[1].trim();
      supplierName = match[2].trim();
    }

    records.push({
      customer,
      processType,
      category,
      priority,
      remark,
      materialName,
      supplierName,
      materialInfo,
      sheetSpec,
      sheetQty,
      sliceSpec,
      sliceQty,
      punchProcess,
      punchSpec,
      punchQty,
      sheetCompleted,
      sliceCompleted,
      punchCompleted,
      isCompleted
    });
  }

  return records;
}

// 主导入函数
async function importAll() {
  const conn = await getConnection();
  console.log('✅ 数据库连接成功\n');

  try {
    // ============================================
    // 1. 导入库存数据
    // ============================================
    console.log('========== 导入库存数据 ==========');
    const inventoryRecords = parseInventorySheet('C:/Users/Administrator/Desktop/最新版EVA库存表).xlsx');
    console.log(`解析到 ${inventoryRecords.length} 条库存记录`);

    const inventoryMap = {}; // 用于后续关联: key="supplier/material/spec" -> inventory_id

    for (const item of inventoryRecords) {
      // 获取或创建供应商
      const supplierId = await getOrCreate(conn, 'suppliers', 'name', item.supplier);

      // 获取或创建材料
      const materialId = await getOrCreate(conn, 'materials', 'name', item.material);

      if (!supplierId || !materialId) continue;

      // 插入或更新库存
      const [existing] = await conn.query(
        'SELECT id FROM inventory WHERE supplier_id = ? AND material_id = ? AND specification = ?',
        [supplierId, materialId, item.specification]
      );

      let inventoryId;
      if (existing.length > 0) {
        // 更新现有库存
        inventoryId = existing[0].id;
        await conn.query(
          'UPDATE inventory SET stock_qty = ? WHERE id = ?',
          [item.currentStock, inventoryId]
        );
      } else {
        // 插入新库存
        const [result] = await conn.query(
          `INSERT INTO inventory (supplier_id, material_id, specification, stock_qty)
           VALUES (?, ?, ?, ?)`,
          [supplierId, materialId, item.specification, item.currentStock]
        );
        inventoryId = result.insertId;
      }

      // 记录库存流水
      if (item.weekIn > 0) {
        await conn.query(
          `INSERT INTO inventory_transactions (inventory_id, type, quantity, transaction_date, remark)
           VALUES (?, 'inbound', ?, '2025-06-21', '初始化导入：一周累计入库')`,
          [inventoryId, item.weekIn]
        );
      }
      if (item.weekOut > 0) {
        await conn.query(
          `INSERT INTO inventory_transactions (inventory_id, type, quantity, transaction_date, remark)
           VALUES (?, 'outbound', ?, '2025-06-21', '初始化导入：一周累计出库')`,
          [inventoryId, item.weekOut]
        );
      }

      // 记录映射关系
      const mapKey = `${item.supplier}/${item.material}/${item.specification}`;
      inventoryMap[mapKey] = inventoryId;
    }

    console.log('✅ 库存数据导入完成\n');

    // ============================================
    // 2. 导入订单数据
    // ============================================
    console.log('========== 导入订单数据 ==========');
    const orderRecords = parseOrdersSheet('C:/Users/Administrator/Desktop/生产排单表_美化版.xlsx');
    console.log(`解析到 ${orderRecords.length} 条订单记录`);

    let orderIndex = 1;
    for (const item of orderRecords) {
      // 获取或创建客户
      const customerId = await getOrCreate(conn, 'customers', 'name', item.customer);

      // 生成订单号
      const orderNo = `YC${String(orderIndex++).padStart(4, '0')}`;

      // 查找材料ID
      let materialId = null;
      if (item.materialName) {
        const [mat] = await conn.query('SELECT id FROM materials WHERE name LIKE ?', [`%${item.materialName}%`]);
        if (mat.length > 0) materialId = mat[0].id;
      }

      // 确定订单状态
      let status = '待排产';
      if (item.isCompleted) status = '已完成';
      else if (item.sheetCompleted > 0 || item.sliceCompleted > 0 || item.punchCompleted > 0) status = '生产中';

      // 解析数量
      const parseQty = (str) => {
        if (!str) return 0;
        const num = parseFloat(str.toString().replace(/[^0-9.]/g, ''));
        return isNaN(num) ? 0 : num;
      };

      // 插入订单
      const [orderResult] = await conn.query(
        `INSERT INTO orders (
          order_no, customer_id, process_type, category, priority, remark,
          sheet_material_id, sheet_spec, sheet_qty, sheet_completed,
          slice_spec, slice_qty, slice_completed,
          punch_process, punch_spec, punch_qty, punch_completed,
          status, order_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
        [
          orderNo, customerId, item.processType, item.category, item.priority, item.remark,
          materialId, item.sheetSpec, parseQty(item.sheetQty), item.sheetCompleted,
          item.sliceSpec, parseQty(item.sliceQty), item.sliceCompleted,
          item.punchProcess, item.punchSpec, parseQty(item.punchQty), item.punchCompleted,
          status
        ]
      );

      const orderId = orderResult.insertId;

      // 关联领料记录（如果有材料信息）
      if (materialId && item.supplierName) {
        const mapKey = `${item.supplierName}/${item.materialName}/${item.sheetSpec}`;
        const inventoryId = inventoryMap[mapKey];

        if (inventoryId) {
          await conn.query(
            `INSERT INTO order_materials (order_id, inventory_id, required_qty, issued_qty, status)
             VALUES (?, ?, ?, ?, ?)`,
            [orderId, inventoryId, parseQty(item.sheetQty), item.sheetCompleted,
             item.sheetCompleted > 0 ? '已领料' : '待领料']
          );
        }
      }
    }

    console.log('✅ 订单数据导入完成\n');

    // 输出统计
    const [stats] = await conn.query(`
      SELECT
        (SELECT COUNT(*) FROM suppliers) as suppliers,
        (SELECT COUNT(*) FROM materials) as materials,
        (SELECT COUNT(*) FROM inventory) as inventory,
        (SELECT COUNT(*) FROM orders) as orders,
        (SELECT SUM(stock_qty) FROM inventory) as total_stock
    `);

    console.log('📊 导入统计：');
    console.log(`  供应商: ${stats[0].suppliers} 个`);
    console.log(`  材料种类: ${stats[0].materials} 种`);
    console.log(`  库存记录: ${stats[0].inventory} 条`);
    console.log(`  订单数量: ${stats[0].orders} 条`);
    console.log(`  总库存量: ${stats[0].total_stock || 0}`);

  } catch (err) {
    console.error('❌ 导入出错:', err);
  } finally {
    await conn.end();
  }

  console.log('\n🎉 数据导入完成！');
}

importAll().catch(console.error);
