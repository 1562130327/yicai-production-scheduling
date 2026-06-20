var processColors = {
  '片材': 'bubble-sheet',
  '切片': 'bubble-slice',
  '冲型': 'bubble-punch',
  '背胶': 'bubble-glue',
  '片材切片': 'bubble-slice',
  '片材冲型': 'bubble-punch',
  '切片冲型': 'bubble-punch',
  '片材背胶': 'bubble-glue',
  '背胶冲型': 'bubble-punch',
  '片材切片冲型': 'bubble-punch',
  '片材背胶切片冲型': 'bubble-punch',
  '库存冲型': 'bubble-punch',
  '库存切片冲型': 'bubble-punch',
  '片材贴布': 'bubble-sheet',
  '片材背胶切片': 'bubble-glue',
  '片材背胶冲型': 'bubble-punch',
  '片材背胶切片冲型': 'bubble-punch',
  '库存切片': 'bubble-slice',
  '库存片材': 'bubble-sheet'
};

async function loadBubbles() {
  try {
    var response = await fetch(API_BASE + '/grouped');
    var grouped = await response.json();
    renderBubbles(grouped);
  } catch (error) {
    console.error('加载气泡数据失败:', error);
  }
}

function renderBubbles(groupedData) {
  var container = document.getElementById('bubblesContainer');
  container.innerHTML = '';
  
  if (groupedData.length === 0) {
    container.innerHTML = '<p style="color:#999;font-size:16px;">暂无订单数据</p>';
    return;
  }
  
  var maxCount = Math.max.apply(null, groupedData.map(function(item) { return item.count; }));
  
  groupedData.forEach(function(item) {
    var bubble = createBubble(item, maxCount);
    container.appendChild(bubble);
  });
}

function createBubble(item, maxCount) {
  var bubble = document.createElement('div');
  var minSize = 120;
  var maxSize = 220;
  var size = minSize + ((item.count / maxCount) * (maxSize - minSize));
  var colorClass = processColors[item.process_type] || 'bubble-default';
  
  bubble.className = 'bubble ' + colorClass;
  bubble.style.width = size + 'px';
  bubble.style.height = size + 'px';
  
  bubble.innerHTML = '<div class="bubble-process">' + item.process_type + '</div>' +
    '<div class="bubble-count">' + item.count + ' 单</div>' +
    '<div class="bubble-hint">点击查看详情</div>';
  
  bubble.onclick = function() {
    currentProcessType = item.process_type;
    showOrderList(item.process_type);
  };
  
  return bubble;
}
