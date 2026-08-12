// 习惯：全站"坚持类"数据聚合中心（读 learner_profile.streaks / progress）
const store = require('../../utils/store');
const theme = require('../../utils/theme');
const dateUtil = require('../../utils/date');

const MODULE_NAMES = {
  poetry: { name: '诗词赏读', icon: '📜' },
  idiom: { name: '成语学习', icon: '🀄' },
  english: { name: '单词卡片', icon: '🔤' },
  quiz: { name: '知识闯关', icon: '🎯' },
  quote: { name: '每日一句', icon: '💬' },
  history: { name: '历史今天', icon: '📅' }
};

function uid() { return 'h' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }

// 按名称智能挑选 emoji / 颜色，让"背书""写作业"等更有辨识度
function pickSkin(name) {
  const n = (name || '').toLowerCase();
  if (/背书|作业|写|笔记|字/.test(n)) return { emoji: '✍️', color: '#b45309' };
  if (/读|书|阅读|诗词|英语|单词|学习/.test(n)) return { emoji: '📚', color: '#2f8f78' };
  if (/运动|跑|健身|瑜伽|游泳/.test(n)) return { emoji: '🏃', color: '#e0567a' };
  if (/喝水|水/.test(n)) return { emoji: '💧', color: '#2563eb' };
  if (/睡|觉|休息/.test(n)) return { emoji: '😴', color: '#7c5cff' };
  if (/音乐|琴|歌/.test(n)) return { emoji: '🎸', color: '#7c5cff' };
  return { emoji: '💪', color: '#3a9d6e' };
}

Page({
  data: {
    appStreak: 0,
    lastCheckin: '',
    modules: [],
    custom: [],
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
    // 自定义打卡：复用 habit 模块数据，前置展示以便快速打卡
    const habits = store.getHabits().map(h => {
      const done = h.done || {};
      const today = dateUtil.todayStr();
      return {
        id: h.id, name: h.name, emoji: h.emoji,
        streak: store.calcStreak(done),
        total: Object.keys(done).length,
        todayDone: !!done[today]
      };
    });
    this.setData({
      appStreak: (p.streaks.app && p.streaks.app.count) || 0,
      lastCheckin: p.streaks.lastCheckin || '',
      modules: mods,
      custom: habits,
      habitCount: (p.habits || []).length,
      movieCount: (p.progress.movie || []).length
    });
  },

  // 自定义打卡：弹窗输入名称，按关键词匹配图标/颜色后加入 habits
  addCustom() {
    wx.showModal({
      title: '添加自定义打卡',
      editable: true,
      placeholderText: '如：背书 / 写作业 / 运动',
      success: (r) => {
        if (!r.confirm) return;
        const name = (r.content || '').trim();
        if (!name) { wx.showToast({ title: '给打卡起个名字', icon: 'none' }); return; }
        const skin = pickSkin(name);
        store.addHabit({
          id: uid(), name, emoji: skin.emoji, color: skin.color,
          created: dateUtil.todayStr(), done: {}
        });
        wx.showToast({ title: '已添加', icon: 'success' });
        this.onShow();
      }
    });
  },

  // 今日打卡切换（复用 habit 模块逻辑，保持一致）
  customCheckin(e) {
    const id = e.currentTarget.dataset.id;
    const res = store.toggleHabitDay(id, dateUtil.todayStr());
    if (!res) return;
    wx.showToast({ title: res.done ? '已打卡 🔥' : '已取消', icon: 'none' });
    this.onShow();
  },

  goHabit() { wx.navigateTo({ url: '/subpackages/habit/index' }); },
  goMovie() { wx.navigateTo({ url: '/subpackages/movie/index' }); },
  goDiscover() { wx.switchTab({ url: '/pages/cover/cover' }); }
});
