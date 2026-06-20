async function exportExcel() {
  try {
    var response = await fetch(API_BASE + '/export');
    var blob = await response.blob();
    var url = window.URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '生产排单表.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showToast('导出成功');
  } catch (error) {
    console.error('导出失败:', error);
    showToast('导出失败', 'error');
  }
}
