// 学伴小筑 —— 应用外壳
const store = require('./utils/store');

App({
  onLaunch() {
    // 初始化学习者档案（不存在时用 profile-init 建档）
    store.init();
    // 记录"打开小程序"连续天数（中枢徽章用）
    store.appCheckin();
  },
  globalData: {
    version: '1.0.0'
  }
});
