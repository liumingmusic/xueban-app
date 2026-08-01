// 今日复习：展示到期待复习项，完成后按 SRS 推后下次日期
const store = require('../../utils/store');
const dateUtil = require('../../utils/date');

// 模块中文名映射
const MODULE_CN = { poem: '诗词', idiom: '成语', word: '单词' };

Page({
  data: {
    list: [],        // 到期待复习项
    empty: false,
    today: ''
  },

  onShow() {
    this.loadDue();
  },

  loadDue() {
    const today = dateUtil.todayStr();
    const due = store.getDueReviews(today).map(r => ({
      module: r.module,
      moduleCn: MODULE_CN[r.module] || r.module,
      id: r.id,
      label: r.label || r.id,
      level: r.level || 0
    }));
    this.setData({ list: due, empty: due.length === 0, today });
  },

  // 完成一次复习：推后下次复习日，并从当前列表移除
  onDone(e) {
    const { module, id } = e.currentTarget.dataset;
    const r = store.reviewDone(module, id);
    if (r) {
      const next = `已复习，下次在 ${r.interval} 天后`;
      wx.showToast({ title: next, icon: 'none' });
    }
    this.loadDue();
  },

  goBack() { wx.navigateBack({ delta: 1 }); }
});
