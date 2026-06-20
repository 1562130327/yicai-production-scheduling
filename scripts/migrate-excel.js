require("dotenv").config();
const XLSX = require("xlsx");
const mysql = require("mysql2/promise");
const path = require("path");

async function migrateExcel() {
  var excelPath = process.argv[2];
  if (!excelPath) {
    console.error("请提供Excel文件路径");
    console.log("用法: node scripts/migrate-excel.js <excel文件路径>");
    process.exit(1);
  }
  
  var workbook = XLSX.readFile(excelPath);
  var sheetName = workbook.SheetNames[0];
  var worksheet = workbook.Sheets[sheetName];
  var data = XLSX.utils.sheet_to_json(worksheet);
  
  console.log("读取到 " + data.length + " 条记录");
  
  var connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  
  var fieldMapping = {
    "订单编号": "order_no",
    "款号": "style_no",
    "客户": "customer",
    "加工工艺": "process_type",
    "类别": "category",
    "优先级": "priority",
    "备注": "remark",
    "用料": "material",
    "片材尺寸": "sheet_size",
    "片材总数": "sheet_qty",
    "切片尺寸": "slice_size",
    "切片总数": "slice_qty",
    "冲型工艺": "punch_process",
    "冲型后尺寸": "punch_size",
    "冲型数量": "punch_qty",
    "下单日期": "order_date"
  };
  
  var successCount = 0;
  var errorCount = 0;
  
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    try {
      var mappedData = {};
      for (var excelField in fieldMapping) {
        var dbField = fieldMapping[excelField];
        if (row[excelField] !== undefined && row[excelField] !== null) {
          mappedData[dbField] = String(row[excelField]);
        }
      }
      if (!mappedData.customer) continue;
      
      var fields = Object.keys(mappedData);
      var values = Object.values(mappedData);
      var placeholders = fields.map(function() { return "?"; }).join(", ");
      var query = "INSERT INTO orders (" + fields.join(", ") + ") VALUES (" + placeholders + ")";
      await connection.execute(query, values);
      successCount++;
    } catch (error) {
      console.error("导入失败:", error.message);
      errorCount++;
    }
  }
  
  console.log("导入完成: 成功 " + successCount + " 条, 失败 " + errorCount + " 条");
  await connection.end();
}

migrateExcel().catch(console.error);
