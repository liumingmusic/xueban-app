// 习惯：全站"坚持类"数据聚合中心（读 learner_profile.streaks / progress）
const store = require('../../utils/store');
const theme = require('../../utils/theme');

const MODULE_NAMES = {
  poetry: { name: '诗词赏读', icon: '📜' },
  idiom: { name: '成语学习', icon: '🀄' },
  english: { name: '单词卡片', icon: '🔤' },
  quiz: { name: '知识闯关', icon: '🎯' },
  quote: { name: '每日一句', icon: '💬' },
  history: { name: '历史今天', icon: '📅' }
};

Page({
  data: {
    appStreak: 0,
    lastCheckin: '',
    modules: [],
    habitCount: 0,
    movieCount: 0
  },

  onShow() {
    theme.apply(this);
    const p = store.getProfile();
    const mods = [];
    const ms = (p.streaks && p.streaks.modules) || {};
    Object.keys(ms).forEach(k => {
      const meta = MODULE_NAMES[k] || { name: k, icon: '📌' };
      mods.push({
        id: k, name: meta.name, icon: meta.icon,
        count: ms[k].count || 0, total: ms[k].total || 0, last: ms[k].last || ''
      });
    });
    mods.sort((a, b) => b.count - a.count);
    this.setData({
      appStreak: (p.streaks.app && p.streaks.app.count) || 0,
      lastCheckin: p.streaks.lastCheckin || '',
      modules: mods,
      habitCount: (p.habits || []).length,
      movieCount: (p.progress.movie || []).length
    });
  },

  goHabit() { wx.navigateTo({ url: '/subpackages/habit/index' }); },
  goMovie() { wx.navigateTo({ url: '/subpackages/movie/index' }); },
  goDiscover() { wx.switchTab({ url: '/pages/cover/cover' }); }
});
