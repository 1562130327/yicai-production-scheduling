# 生产排单管理系统

气泡式布局的生产排单管理系统，支持订单增删改查、公网访问和Excel导出。

## 功能

- 🫧 气泡式布局，按加工工艺分组
- 📊 实时统计订单数据
- 🔍 订单搜索和筛选
- ✏️ 增删改查功能
- 📤 Excel导出

## 快速开始

### 1. 配置数据库

编辑 `.env` 文件，填入云数据库信息：

```
DB_HOST=your_cloud_db_host
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=production_scheduling
PORT=3000
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 导入Excel数据（可选）

```bash
node scripts/migrate-excel.js "C:\path\to\生产排单表.xlsx"
```

### 4. 启动服务

```bash
npm start
```

访问 http://localhost:3000

## 部署到公网

### 方案1: 云服务器

1. 购买云服务器（推荐2核4G）
2. 安装 Node.js 14+
3. 上传项目文件
4. 配置 `.env`
5. 使用 PM2 启动：`pm2 start server.js`

### 方案2: 内网穿透

使用 ngrok 或 frp 暴露本地服务。

## 技术栈

- 前端: HTML5 + CSS3 + JavaScript
- 后端: Node.js + Express
- 数据库: MySQL
- Excel: SheetJS
