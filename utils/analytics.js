// 前端埋点：封装 wx.reportAnalytics，失败静默（绝不阻塞业务）
// 纯前端、免费，数据进入微信小程序后台「数据分析」面板。
// 约定：事件名 snake_case；data 的值仅允许 number / string。
function track(event, data) {
  try {
    if (event && typeof wx !== 'undefined' && typeof wx.reportAnalytics === 'function') {
      wx.reportAnalytics(event, data || {});
    }
  } catch (e) { /* 埋点异常不影响主流程 */ }
}

module.exports = { track };
