// 习惯打卡：微习惯管理 · 今日打卡 · 连胜 · 年度热力图
const dateUtil = require('../../utils/date');
const theme = require('../../utils/theme');
const store = require('../../utils/store');

const EMOJIS = ['💪', '📚', '🏃', '💧', '😴', '🧘', '✍️', '🎯', '🌿', '🎸', '💡', '🦷', '🍎', '🧹'];
const COLORS = ['#3a9d6e', '#2563eb', '#b45309', '#7c5cff', '#e0567a', '#2f8f78', '#d98324', '#4f8a6a'];

function uid() { return 'h' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }

// 近 7 天点阵
function weekDots(h) {
  const out = [];
  const base = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    const ds = dateUtil.todayStr(d);
    out.push({ date: ds, done: !!(h.done && h.done[ds]), isToday: i === 0 });
  }
  return out;
}

// 年度热力图（聚合所有习惯，最近约 52 周）
function buildHeatmap(habits) {
  const today = new Date();
  const end = new Date(today);
  const start = new Date(today);
  start.setDate(end.getDate() - 363);
  start.setDate(start.getDate() - start.getDay()); // 对齐到周日
  const doneMap = {};
  habits.forEach(h => { Object.keys(h.done || {}).forEach(d => { doneMap[d] = (doneMap[d] || 0) + 1; }); });
  const days = [];
  const cur = new Date(start);
  while (cur <= end) {
    const ds = dateUtil.todayStr(cur);
    const future = cur > today;
    const c = future ? 0 : (doneMap[ds] || 0);
    days.push({
      date: ds,
      count: future ? 0 : c,
      level: future ? -1 : (c === 0 ? 0 : c === 1 ? 1 : c <= 3 ? 2 : 3),
      future
    });
    cur.setDate(cur.getDate() + 1);
  }
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

Page({
  data: {
    habits: [],
    overview: { total: 0, checks: 0, best: 0, todayDone: 0, todayTotal: 0 },
    weeks: [],
    adding: false,
    name: '',
    emoji: '💪',
    color: '#3a9d6e',
    emojis: EMOJIS,
    colors: COLORS
  },

  onShow() {
    theme.apply(this); this.load(); },

  load() {
    const raw = store.getHabits();
    let checks = 0, best = 0;
    const today = dateUtil.todayStr();
    const habits = raw.map(h => {
      const done = h.done || {};
      const keys = Object.keys(done);
      checks += keys.length;
      const streak = store.calcStreak(done);
      if (streak > best) best = streak;
      return Object.assign({}, h, {
        done,
        total: keys.length,
        streak,
        todayDone: !!done[today],
        dots: weekDots(h)
      });
    });
    const todayDone = habits.filter(h => h.todayDone).length;
    this.setData({
      habits,
      overview: {
        total: habits.length,
        checks,
        best,
        todayDone,
        todayTotal: habits.length
      },
      weeks: buildHeatmap(raw)
    });
  },

  // 添加习惯
  toggleAdding() { this.setData({ adding: !this.data.adding, name: '' }); },
  onName(e) { this.setData({ name: e.detail.value }); },
  pickEmoji(e) { this.setData({ emoji: e.currentTarget.dataset.e }); },
  pickColor(e) { this.setData({ color: e.currentTarget.dataset.c }); },
  confirmAdd() {
    const name = (this.data.name || '').trim();
    if (!name) { wx.showToast({ title: '给习惯起个名字', icon: 'none' }); return; }
    store.addHabit({
      id: uid(), name, emoji: this.data.emoji, color: this.data.color,
      created: dateUtil.todayStr(), done: {}
    });
    this.setData({ adding: false, name: '' });
    wx.showToast({ title: '已添加', icon: 'success' });
    this.load();
  },

  // 今日打卡切换
  toggleToday(e) {
    const id = e.currentTarget.dataset.id;
    const res = store.toggleHabitDay(id, dateUtil.todayStr());
    if (!res) return;
    wx.showToast({ title: res.done ? '已打卡 🔥' : '已取消', icon: 'none' });
    this.load();
  },

  removeHabit(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    wx.showModal({
      title: '删除习惯',
      content: '确定删除「' + name + '」？打卡记录将一并清除',
      success: (r) => { if (r.confirm) { store.removeHabit(id); this.load(); } }
    });
  },

  backHub() { wx.switchTab({ url: '/pages/habit-hub/habit-hub' }); }
});
