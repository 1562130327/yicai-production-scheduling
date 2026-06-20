require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const ordersRouter = require('./routes/orders');
const scheduleRouter = require('./routes/schedule-v2');
const inventoryRouter = require('./routes/inventory');
const workersRouter = require('./routes/workers');
const machinesRouter = require('./routes/machines');
const orderProgressRouter = require('./routes/order-progress');
const feedbacksRouter = require('./routes/feedbacks');
const calculatorRouter = require('./routes/calculator');
const dailyReportRouter = require('./routes/daily-report');
const agentRouter = require('./routes/agent');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/orders', ordersRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/workers', workersRouter);
app.use('/api/machines', machinesRouter);
app.use('/api/order-progress', orderProgressRouter);
app.use('/api/feedbacks', feedbacksRouter);
app.use('/api/calculator', calculatorRouter);
app.use('/api/daily-report', dailyReportRouter);
app.use('/api/agent', agentRouter);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('服务器运行在 http://localhost:' + PORT);
});

module.exports = app;
