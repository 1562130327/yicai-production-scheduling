var allWorkers = [];

async function loadWorkers() {
  try {
    var response = await fetch('/api/workers');
    allWorkers = await response.json();
  } catch (error) {
    console.error('加载师傅数据失败:', error);
  }
}

async function loadMiscWorkers() {
  try {
    var response = await fetch('/api/casual-workers');
    var casuals = await response.json();
    renderMiscWorkers(casuals.filter(function(c) { return c.assignedTo === '杂活'; }));
  } catch (error) {
    console.error('加载零工数据失败:', error);
  }
}

function renderMiscWorkers(casuals) {
  var container = document.getElementById('miscSection');
  container.innerHTML = '';
  
  if (casuals.length === 0) {
    container.innerHTML = '<p style="color:#999;">暂无杂活零工</p>';
    return;
  }
  
  casuals.forEach(function(worker) {
    var div = document.createElement('div');
    div.className = 'misc-bubble';
    div.innerHTML = '<div class="misc-name">' + worker.name + '</div>' +
      '<div class="misc-type">' + worker.type + '</div>';
    container.appendChild(div);
  });
}

function showAddWorkerModal() {
  document.getElementById('workerFormTitle').textContent = '添加师傅';
  document.getElementById('workerForm').reset();
  document.getElementById('workerId').value = '';
  showModal('workerFormModal');
}

function showWorkerList() {
  var tbody = document.getElementById('workerTableBody');
  tbody.innerHTML = '';
  
  allWorkers.forEach(function(worker) {
    var tr = document.createElement('tr');
    tr.innerHTML = '<td>' + worker.name + '</td>' +
      '<td>' + (worker.skill || '-') + '</td>' +
      '<td>' + (worker.phone || '-') + '</td>' +
      '<td><button class="btn btn-edit" onclick="editWorker(' + worker.id + ')">编辑</button>' +
      '<button class="btn btn-delete" onclick="deleteWorker(' + worker.id + ')">删除</button></td>';
    tbody.appendChild(tr);
  });
  
  showModal('workerListModal');
}

async function editWorker(id) {
  var worker = allWorkers.find(function(w) { return w.id === id; });
  if (!worker) return;
  
  document.getElementById('workerFormTitle').textContent = '编辑师傅';
  document.getElementById('workerId').value = worker.id;
  document.getElementById('workerName').value = worker.name;
  document.getElementById('workerSkill').value = worker.skill || '';
  document.getElementById('workerPhone').value = worker.phone || '';
  showModal('workerFormModal');
}

async function deleteWorker(id) {
  if (!confirm('确定要删除这位师傅吗？')) return;
  
  try {
    await fetch('/api/workers/' + id, { method: 'DELETE' });
    showToast('删除成功');
    loadWorkers();
  } catch (error) {
    showToast('删除失败', 'error');
  }
}

document.getElementById('workerForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  var workerId = document.getElementById('workerId').value;
  var formData = {
    name: document.getElementById('workerName').value,
    skill: document.getElementById('workerSkill').value,
    phone: document.getElementById('workerPhone').value
  };
  
  try {
    var url = workerId ? '/api/workers/' + workerId : '/api/workers';
    var method = workerId ? 'PUT' : 'POST';
    
    await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    showToast(workerId ? '更新成功' : '添加成功');
    closeModal('workerFormModal');
    loadWorkers();
  } catch (error) {
    showToast('保存失败', 'error');
  }
});
