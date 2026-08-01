// 观影追踪：电影记录本 · 类型统计 · 月历标记
const dateUtil = require('../../utils/date');
const theme = require('../../utils/theme');
const store = require('../../utils/store');

const GENRES = ['剧情', '喜剧', '动作', '科幻', '爱情', '动画', '悬疑', '惊悚', '纪录', '奇幻', '战争', '犯罪'];
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

function uid() { return 'm' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }

function buildMonth(movies, year, month) {
  const first = new Date(year, month, 1);
  const startW = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const ym = year + '-' + dateUtil.pad(month + 1);
  const markMap = {};
  movies.forEach(m => {
    if (m.date && m.date.slice(0, 7) === ym) markMap[m.date] = (markMap[m.date] || 0) + 1;
  });
  const cells = [];
  for (let i = 0; i < startW; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = ym + '-' + dateUtil.pad(d);
    cells.push({ day: d, date: ds, count: markMap[ds] || 0 });
  }
  return cells;
}

Page({
  data: {
    movies: [],
    stats: { total: 0, avg: '0.0', thisYear: 0 },
    genreStats: [],
    monthLabel: '',
    monthCells: [],
    weekHead: WEEK,
    monthOffset: 0,
    // 添加表单
    adding: false,
    title: '',
    date: dateUtil.todayStr(),
    rating: 0,
    genres: GENRES,
    selected: [],
    note: ''
  },

  onShow() {
    theme.apply(this); this.load(); },

  load() {
    const raw = store.getMovies();
    const movies = raw.map(m => Object.assign({}, m));
    const total = movies.length;
    let sum = 0;
    movies.forEach(m => { sum += (m.rating || 0); });
    const y = new Date().getFullYear();
    const thisYear = movies.filter(m => m.date && m.date.slice(0, 4) === '' + y).length;
    // 类型统计
    const cnt = {};
    movies.forEach(m => (m.genres || []).forEach(g => { cnt[g] = (cnt[g] || 0) + 1; }));
    const max = Math.max(1, ...Object.values(cnt));
    const genreStats = Object.keys(cnt).map(g => ({ name: g, count: cnt[g], pct: Math.round(cnt[g] / max * 100) }))
      .sort((a, b) => b.count - a.count);

    this.setData({
      movies,
      stats: { total, avg: total ? (sum / total).toFixed(1) : '0.0', thisYear },
      genreStats
    });
    this.refreshMonth();
  },

  refreshMonth() {
    const off = this.data.monthOffset;
    const base = new Date();
    const d = new Date(base.getFullYear(), base.getMonth() + off, 1);
    const y = d.getFullYear(), m = d.getMonth();
    const cells = buildMonth(store.getMovies(), y, m);
    this.setData({
      monthLabel: y + '年' + (m + 1) + '月',
      monthCells: cells
    });
  },

  prevMonth() { this.setData({ monthOffset: this.data.monthOffset - 1 }); this.refreshMonth(); },
  nextMonth() { this.setData({ monthOffset: this.data.monthOffset + 1 }); this.refreshMonth(); },

  // 添加
  toggleAdding() { this.setData({ adding: !this.data.adding, title: '', rating: 0, selected: [], note: '' }); },
  onTitle(e) { this.setData({ title: e.detail.value }); },
  onNote(e) { this.setData({ note: e.detail.value }); },
  onDate(e) { this.setData({ date: e.detail.value }); },
  setRating(e) { this.setData({ rating: +e.currentTarget.dataset.r }); },
  pickGenre(e) {
    const g = e.currentTarget.dataset.g;
    const sel = this.data.selected.slice();
    const i = sel.indexOf(g);
    if (i > -1) sel.splice(i, 1); else sel.push(g);
    this.setData({ selected: sel });
  },
  confirmAdd() {
    const title = (this.data.title || '').trim();
    if (!title) { wx.showToast({ title: '片名不能为空', icon: 'none' }); return; }
    if (!this.data.rating) { wx.showToast({ title: '给个评分吧', icon: 'none' }); return; }
    store.addMovie({
      id: uid(), title, date: this.data.date, rating: this.data.rating,
      genres: this.data.selected.slice(), note: (this.data.note || '').trim()
    });
    this.setData({ adding: false, title: '', rating: 0, selected: [], note: '' });
    wx.showToast({ title: '已记录', icon: 'success' });
    this.load();
  },

  removeMovie(e) {
    const id = e.currentTarget.dataset.id;
    const title = e.currentTarget.dataset.title;
    wx.showModal({
      title: '删除记录',
      content: '确定删除「' + title + '」？',
      success: (r) => { if (r.confirm) { store.removeMovie(id); this.load(); } }
    });
  },

  backHub() { wx.switchTab({ url: '/pages/habit-hub/habit-hub' }); }
});
