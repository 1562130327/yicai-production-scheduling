async function loadMachines() {
  try {
    var response = await fetch('/api/machines');
    var machines = await response.json();
    renderMachines(machines);
  } catch (error) {
    console.error('加载机器数据失败:', error);
  }
}

function renderMachines(machines) {
  var container = document.getElementById('machineContainer');
  container.innerHTML = '';
  
  machines.forEach(function(machine) {
    var div = document.createElement('div');
    div.className = 'machine-bubble';
    
    var statusClass = 'status-idle';
    if (machine.status === '运行中') statusClass = 'status-running';
    if (machine.status === '维护中') statusClass = 'status-maintenance';
    
    var workersHtml = '';
    if (machine.workers && machine.workers.length > 0) {
      workersHtml = '<div class="machine-workers"><strong>师傅:</strong><br>';
      machine.workers.forEach(function(w) {
        workersHtml += '<span class="worker-tag">' + w.name + '</span>';
      });
      workersHtml += '</div>';
    }
    
    var casualHtml = '';
    if (machine.casualWorkers && machine.casualWorkers.length > 0) {
      casualHtml = '<div class="machine-workers"><strong>零工:</strong><br>';
      machine.casualWorkers.forEach(function(c) {
        casualHtml += '<span class="casual-tag">' + c.name + '</span>';
      });
      casualHtml += '</div>';
    }
    
    div.innerHTML = '<div class="machine-name">' + machine.name + '</div>' +
      '<div style="text-align:center;"><span class="machine-status ' + statusClass + '">' + machine.status + '</span></div>' +
      workersHtml + casualHtml;
    
    container.appendChild(div);
  });
}
