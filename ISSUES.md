# 溢彩包装生产排单系统 - 问题清单

Claude 读这个文件就知道哪里需要改。按优先级排序。

---

## 🔴 P0 - 必须先做（核心功能缺失）

### 1. 数据重启丢失
- **现状**：所有数据存在内存变量里（`models/data-store.js`），服务器重启全丢
- **目标**：数据持久化到 JSON 文件，启动时加载，变更时保存
- **涉及文件**：`models/data-store.js`、`server-mock.js`
- **方案**：在 data-store.js 里加 `saveToFile()` / `loadFromFile()`，用 `fs` 读写 `data/*.json`

### 2. 新建订单不能保存
- **现状**：`public/new-order.html` 表单提交只弹 alert，没调 API
- **目标**：提交后调 `POST /api/schedule` 创建订单，状态为"待分配"
- **涉及文件**：`public/new-order.html`、`server-mock.js`
- **注意**：后端要新增 `POST /api/schedule` 接口

### 3. 没有权限控制
- **现状**：登录只存 localStorage，任何人可直接访问 `/admin.html` 和所有 API
- **目标**：
  - 师傅只能看自己的任务
  - 跟单员只能看自己录的订单
  - 管理员看全部
- **涉及文件**：`server-mock.js`（加中间件）、所有前端页面（检查登录态）
- **方案**：用简单的 session/token 机制，API 加权限校验中间件

### 4. 反馈系统不联动
- **现状**：反馈能提交，但不影响订单状态，不通知任何人
- **目标**：
  - 反馈提交后订单暂停
  - 通知上一步师傅 + 跟单员 + 管理员
  - 反馈处理后订单恢复
- **涉及文件**：`server-mock.js`（反馈API）、`public/worker-dashboard.html`（反馈UI）

---

## 🟡 P1 - 尽快做（功能不完整）

### 5. 工序流程缺"打包"步骤
- **现状**：WORKFLOW_MAP 里大部分工艺没有打包作为最后一步
- **目标**：所有工艺流程最后都加一步"打包→杨合进"
- **涉及文件**：`models/data-store.js`（WORKFLOW_MAP）、`server-mock.js`（WORKFLOW_MAP）

### 6. 车间地图数据不真实
- **现状**：机器状态硬编码，不反映真实分配情况
- **目标**：根据 assignments 数据动态显示哪些机器在用、哪些空闲
- **涉及文件**：`public/workshop-map.html`

### 7. 日报/绩效用随机数
- **现状**：`server-mock.js` 的 `/api/daily-report` 里师傅完成数是 `Math.random()`
- **目标**：从 assignments 数据里统计真实的完成情况
- **涉及文件**：`server-mock.js`

### 8. 导出 Excel 没实现
- **现状**：排单总表"导出Excel"按钮只弹 alert
- **目标**：用 SheetJS 生成 Excel 文件下载
- **涉及文件**：`public/schedule.html`、`server-mock.js`

### 9. 登录页名字不一致
- **现状**：登录页显示"老莫"、"老莫老婆"，但 data-store 里是"莫齐国"、"简翠花"
- **目标**：统一名称，建议用真名，备注别名
- **涉及文件**：`public/login.html`、`public/worker-dashboard.html`

---

## 🟢 P2 - 有空再做（优化项）

### 10. 库存 Excel 路径硬编码
- **现状**：写死 `C:/Users/Administrator/Desktop/最新版EVA库存表.xlsx`
- **目标**：改成 `.env` 配置或命令行参数
- **涉及文件**：`server-mock.js`、`.env`

### 11. PROJECT-HANDOFF.md 过时
- **现状**：还写着"待排产→生产中→已完成"
- **目标**：更新为"待分配→已分配→生产中→已完成"
- **涉及文件**：`PROJECT-HANDOFF.md`

### 12. 订单编辑功能不完整
- **现状**：`PUT /api/schedule/:id` 能更新字段，但前端没有编辑入口
- **目标**：在订单列表加"编辑"按钮，弹窗修改订单信息
- **涉及文件**：`public/schedule.html`

### 13. 移动端适配
- **现状**：部分页面表格太宽，手机上看不全
- **目标**：响应式布局，表格可横向滚动
- **涉及文件**：所有 public/*.html

---

## 状态机参考（已实现，不要改坏）

```
订单状态：待分配 → 已分配 → 生产中 → 已完成
                            ↘ 已取消 → 待分配（可恢复）

工序状态：待开始 → 进行中 → 已完成
                ↕
              暂停

自动推导规则：
- 无分配记录 → 待分配
- 全部待开始 → 已分配
- 有进行中/暂停 → 生产中
- 全部已完成 → 已完成
```

---

## 技术栈

- 前端：原生 HTML/CSS/JS，无框架
- 后端：Node.js + Express
- 数据：当前内存存储，目标 JSON 文件持久化
- 启动：`npm start`（即 `node server-mock.js`）
- 访问：http://localhost:3000

## 关键文件

- `server-mock.js` - 主服务器（所有 API）
- `models/data-store.js` - 数据模型 + 状态机
- `schedule-data.js` - 48条订单静态数据
- `public/` - 前端页面（23个 HTML）
- `PROJECT-HANDOFF.md` - 设计文档（部分过时）
