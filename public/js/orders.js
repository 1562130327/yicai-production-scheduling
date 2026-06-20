async function showOrderList(processType) {
  try {
    var response = await fetch(API_BASE + '?process_type=' + encodeURIComponent(processType));
    currentOrders = await response.json();
    document.getElementById('modalTitle').textContent = processType + '类订单（' + currentOrders.length + '单）';
    renderOrderTable(currentOrders);
    showModal('orderListModal');
  } catch (error) {
    console.error('加载订单列表失败:', error);
    showToast('加载订单列表失败', 'error');
  }
}

function renderOrderTable(orders) {
  var tbody = document.getElementById('orderTableBody');
  tbody.innerHTML = '';
  
  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;">暂无订单</td></tr>';
    return;
  }
  
  orders.forEach(function(order) {
    var tr = document.createElement('tr');
    var size = order.sheet_size || order.slice_size || order.punch_size || '-';
    var qty = order.sheet_qty || order.slice_qty || order.punch_qty || '-';
    
    tr.innerHTML = '<td>' + (order.customer || '-') + '</td>' +
      '<td>' + (order.material || '-') + '</td>' +
      '<td>' + size + '</td>' +
      '<td>' + qty + '</td>' +
      '<td><span class="priority-tag ' + getPriorityClass(order.priority) + '">' + (order.priority || '普通') + '</span></td>' +
      '<td><span class="status-tag ' + getStatusClass(order.status) + '">' + (order.status || '待开始') + '</span></td>' +
      '<td><button class="btn btn-edit" onclick="editOrder(' + order.id + ')">编辑</button>' +
      '<button class="btn btn-delete" onclick="deleteOrder(' + order.id + ')">删除</button></td>';
    tbody.appendChild(tr);
  });
}

function getPriorityClass(priority) {
  if (priority === '特急') return 'priority-critical';
  if (priority === '注意') return 'priority-urgent';
  if (priority === '低') return 'priority-low';
  return 'priority-normal';
}

async function showUrgentOrders() {
  try {
    var response = await fetch(API_BASE);
    var allOrders = await response.json();
    // 筛选紧急和注意的订单
    var urgentOrders = allOrders.filter(function(order) {
      return order.priority === '特急' || order.priority === '注意';
    });
    currentOrders = urgentOrders;
    currentProcessType = null;
    document.getElementById('modalTitle').textContent = '紧急/注意订单（' + urgentOrders.length + '单）';
    renderOrderTable(urgentOrders);
    showModal('orderListModal');
  } catch (error) {
    console.error('加载紧急订单失败:', error);
    showToast('加载紧急订单失败', 'error');
  }
}

function getStatusClass(status) {
  if (status === '已完成') return 'status-completed';
  if (status === '进行中') return 'status-progress';
  return 'status-pending';
}

function filterOrders() {
  var search = document.getElementById('searchInput').value.toLowerCase();
  var filtered = currentOrders.filter(function(order) {
    return (order.customer && order.customer.toLowerCase().indexOf(search) >= 0) ||
      (order.order_no && order.order_no.toLowerCase().indexOf(search) >= 0) ||
      (order.material && order.material.toLowerCase().indexOf(search) >= 0);
  });
  renderOrderTable(filtered);
}

function showAddOrderModal() {
  document.getElementById('formTitle').textContent = '新增订单';
  document.getElementById('orderForm').reset();
  document.getElementById('orderId').value = '';
  showModal('orderFormModal');
}

async function editOrder(id) {
  try {
    var response = await fetch(API_BASE + '/' + id);
    var order = await response.json();
    
    document.getElementById('formTitle').textContent = '编辑订单';
    document.getElementById('orderId').value = order.id;
    document.getElementById('customer').value = order.customer || '';
    document.getElementById('processType').value = order.process_type || '';
    document.getElementById('material').value = order.material || '';
    document.getElementById('priority').value = order.priority || '普通';
    document.getElementById('sheetSize').value = order.sheet_size || '';
    document.getElementById('sheetQty').value = order.sheet_qty || '';
    document.getElementById('sliceSize').value = order.slice_size || '';
    document.getElementById('sliceQty').value = order.slice_qty || '';
    document.getElementById('punchSize').value = order.punch_size || '';
    document.getElementById('punchQty').value = order.punch_qty || '';
    document.getElementById('remark').value = order.remark || '';
    
    showModal('orderFormModal');
  } catch (error) {
    console.error('获取订单详情失败:', error);
    showToast('获取订单详情失败', 'error');
  }
}

async function deleteOrder(id) {
  if (!confirm('确定要删除这个订单吗？')) return;
  
  try {
    await fetch(API_BASE + '/' + id, { method: 'DELETE' });
    showToast('删除成功');
    loadStats();
    loadBubbles();
    if (currentProcessType) showOrderList(currentProcessType);
  } catch (error) {
    console.error('删除订单失败:', error);
    showToast('删除失败', 'error');
  }
}

document.getElementById('orderForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  var orderId = document.getElementById('orderId').value;
  var formData = {
    customer: document.getElementById('customer').value,
    process_type: document.getElementById('processType').value,
    material: document.getElementById('material').value,
    priority: document.getElementById('priority').value,
    sheet_size: document.getElementById('sheetSize').value,
    sheet_qty: document.getElementById('sheetQty').value,
    slice_size: document.getElementById('sliceSize').value,
    slice_qty: document.getElementById('sliceQty').value,
    punch_size: document.getElementById('punchSize').value,
    punch_qty: document.getElementById('punchQty').value,
    remark: document.getElementById('remark').value
  };
  
  try {
    var url = orderId ? (API_BASE + '/' + orderId) : API_BASE;
    var method = orderId ? 'PUT' : 'POST';
    
    await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    showToast(orderId ? '更新成功' : '新增成功');
    closeModal('orderFormModal');
    loadStats();
    loadBubbles();
    if (currentProcessType) showOrderList(currentProcessType);
  } catch (error) {
    console.error('保存订单失败:', error);
    showToast('保存失败', 'error');
  }
});
