const API_BASE = '/api/orders';
let currentOrders = [];
let currentProcessType = null;

document.addEventListener('DOMContentLoaded', function() {
  loadStats();
  loadOrderBubbles();
  loadMachines();
  loadWorkers();
  loadMiscWorkers();

  // 给统计卡片添加点击事件
  document.querySelector('.stat-urgent').onclick = function() {
    showUrgentOrders();
  };
  document.querySelector('.stat-urgent').style.cursor = 'pointer';
});

async function loadStats() {
  try {
    var response = await fetch(API_BASE + '/stats');
    var stats = await response.json();
    document.getElementById('totalOrders').textContent = stats.total;
    document.getElementById('urgentOrders').textContent = stats.urgent;
    document.getElementById('completedOrders').textContent = stats.completed;
    document.getElementById('inProgressOrders').textContent = stats.inProgress;
  } catch (error) {
    console.error('加载统计数据失败:', error);
  }
}

async function loadOrderBubbles() {
  try {
    var response = await fetch(API_BASE + '/grouped');
    var grouped = await response.json();
    renderOrderBubbles(grouped);
  } catch (error) {
    console.error('加载订单气泡失败:', error);
  }
}

var processColors = {
  '片材': 'mini-sheet',
  '片材切片': 'mini-slice',
  '片材冲型': 'mini-punch',
  '片材背胶切片冲型': 'mini-mixed',
  '库存冲型': 'mini-default',
  '切片冲型': 'mini-punch',
  '片材贴布切片冲型': 'mini-mixed',
  '片材切片冲型': 'mini-mixed',
  '库存切片冲型': 'mini-default',
  '片材背胶冲型': 'mini-glue'
};

function renderOrderBubbles(grouped) {
  var container = document.getElementById('orderBubblesRow');
  container.innerHTML = '';
  
  grouped.forEach(function(item) {
    var div = document.createElement('div');
    var colorClass = processColors[item.process_type] || 'mini-default';
    div.className = 'order-mini-bubble ' + colorClass;
    div.textContent = item.process_type + ' (' + item.count + '单)';
    div.onclick = function() {
      currentProcessType = item.process_type;
      showOrderList(item.process_type);
    };
    container.appendChild(div);
  });
}

function showModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

window.onclick = function(event) {
  if (event.target.classList.contains('modal')) {
    event.target.classList.remove('active');
  }
}

function showToast(message, type) {
  type = type || 'success';
  var toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:15px 25px;background:' +
    (type === 'success' ? '#2ecc71' : '#e74c3c') +
    ';color:white;border-radius:8px;box-shadow:0 4px 15px rgba(0,0,0,0.2);z-index:2000;';
  document.body.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 3000);
}
