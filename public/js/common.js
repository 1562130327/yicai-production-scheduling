/**
 * 溢彩包装 - 前端公共工具
 * 所有页面引入此文件以获得 XSS 防护和统一 API 调用
 */

// XSS 防护：转义用户数据后安全嵌入 HTML
function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// 统一 API 调用：自动带 token，401 时跳转登录
async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('authToken');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    window.location.href = '/login.html';
    return null;
  }
  return response;
}

// 登录状态检查：未登录自动跳转
function checkAuth() {
  const token = localStorage.getItem('authToken');
  const user = localStorage.getItem('currentUser');
  if (!token || !user) {
    window.location.href = '/login.html';
    return null;
  }
  return JSON.parse(user);
}
