// 网络请求封装：超时 + 顺序降级
// 所有外网 API（词典 / Hitokoto / Wikimedia）都经这里；失败自动走离线数据
function get(url, opts) {
  opts = opts || {};
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'GET',
      timeout: opts.timeout || 8000,
      header: opts.header || {},
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data);
        else reject(new Error('HTTP ' + res.statusCode));
      },
      fail(err) { reject(new Error(err.errMsg || 'request fail')); }
    });
  });
}

// 依次尝试多个来源，全部失败则 reject（调用方兜底离线数据）
async function firstOk(tasks) {
  let lastErr;
  for (const t of tasks) {
    try { return await t(); } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('all sources failed');
}

module.exports = { get, firstOk };
