// 发现：应用广场，读 apps.json 按 category 分组渲染
// 新增模块 = apps.json 加一条 + 建分包，这里自动出现，tab 永远 5 个
const APPS = require('../../data/apps.js');
const theme = require('../../utils/theme');
const store = require('../../utils/store');

// 模块展示名（与 streaks.modules 的 key 对齐）
const MODULE_LABEL = {
  poem:    { name: '今日诗词', seal: '诗', color: '#2f8f78', entry: '/subpackages/poetry/index' },
  idiom:   { name: '成语故事', seal: '语', color: '#2f8f78', entry: '/subpackages/idiom/index' },
  quote:   { name: '每日一句', seal: '言', color: '#3a78a8', entry: '/subpackages/quote/index' },
  english: { name: '每日单词', seal: '英', color: '#4f8a6a', entry: '/subpackages/english/index' },
  quiz:    { name: '知识闯关', seal: '闯', color: '#2563eb', entry: '/subpackages/quiz/index' },
  history: { name: '历史上的今天', seal: '史', color: '#b45309', entry: '/subpackages/history/index' }
};

Page({
  data: { groups: [], recent: [], hasRecent: false },

  onLoad() {
    const order = [];
    const map = {};
    APPS.forEach(a => {
      if (!map[a.category]) { map[a.category] = []; order.push(a.category); }
      map[a.category].push(a);
    });
    this.setData({ groups: order.map(c => ({ category: c, apps: map[c] })) });
  },

  onShow() {
    theme.apply(this);
    // 最近在学：从 profile.streaks.modules 取最近打卡过的模块
    const p = store.getProfile();
    const ms = (p.streaks && p.streaks.modules) || {};
    const list = Object.keys(ms)
      .filter(k => ms[k] && ms[k].last)
      .map(k => ({
        key: k,
        name: (MODULE_LABEL[k] && MODULE_LABEL[k].name) || k,
        seal: (MODULE_LABEL[k] && MODULE_LABEL[k].seal) || '·',
        color: (MODULE_LABEL[k] && MODULE_LABEL[k].color) || '#8A8175',
        entry: (MODULE_LABEL[k] && MODULE_LABEL[k].entry) || '',
        count: ms[k].count || 0,
        last: ms[k].last
      }))
      .sort((a, b) => (b.last > a.last ? 1 : -1))
      .slice(0, 4);
    this.setData({ recent: list, hasRecent: list.length > 0 });
  },

  goRecent(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.navigateTo({ url });
  }
});
