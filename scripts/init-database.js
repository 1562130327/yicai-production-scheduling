require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function initDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true
  });

  const sql = fs.readFileSync(path.join(__dirname, 'init-database.sql'), 'utf8');
  await connection.query(sql);
  console.log('数据库初始化成功');
  await connection.end();
}

initDatabase().catch(console.error);
