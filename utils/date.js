// 日期工具：今日字符串 / 问候 / 每日稳定随机
function pad(n) { return n < 10 ? '0' + n : '' + n; }

function todayStr(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function monthDay(d) {
  d = d || new Date();
  return pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function formatCn(d) {
  d = d || new Date();
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 · 周' + week;
}

// 按时段问候
function greeting(d) {
  const h = (d || new Date()).getHours();
  if (h < 5) return '夜深了';
  if (h < 9) return '早上好';
  if (h < 12) return '上午好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  if (h < 22) return '晚上好';
  return '夜深了';
}

// 字符串 hash（每日稳定选取用）
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

// 当日在长度 len 中的稳定下标（中枢与各分包共用同一算法，保证选中同一条）
function dailyIndex(len, salt) {
  if (!len) return 0;
  return hashStr(todayStr() + (salt || '')) % len;
}

// 两个 YYYY-MM-DD 相差天数
function daysBetween(a, b) {
  const ta = new Date(a + 'T00:00:00').getTime();
  const tb = new Date(b + 'T00:00:00').getTime();
  return Math.round((tb - ta) / 86400000);
}

module.exports = { pad, todayStr, monthDay, formatCn, greeting, hashStr, dailyIndex, daysBetween };
