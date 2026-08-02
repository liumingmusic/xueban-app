// 每日诗词：内置 chinese-poetry 精选数据集（分包内离线）
// 视图：今日(单首) / 诗库(搜索+筛选) / 词牌(分类+词牌详情) / 回看(过去14天)
// 进阶：作者生平详情、农历干支+生肖、竖排排版
const dateUtil = require('../../utils/date');
const theme = require('../../utils/theme');
const store = require('../../utils/store');
const lunar = require('../../utils/lunar');
const tts = require('../../utils/tts');
const POEMS = require('./poems.js');
const AUTHORS = require('./authors.js');
const CIPAI = require('./cipai.js');

const STAGES = ['全部', '小学', '初中', '高中', '其他'];
const DYNASTIES = ['全部', '唐', '宋', '诗经', '元', '明', '其他'];

function fmtDate(d) {
  const y = d.getFullYear();
  const m = ('0' + (d.getMonth() + 1)).slice(-2);
  const day = ('0' + d.getDate()).slice(-2);
  return y + '-' + m + '-' + day;
}
function pastDates(n) {
  const out = [];
  const base = new Date();
  for (let i = 0; i < n; i++) {
    const x = new Date(base);
    x.setDate(base.getDate() - i);
    out.push(fmtDate(x));
  }
  return out;
}

Page({
  data: {
    view: 'detail',     // detail | list | cipaiDetail | author
    tab: 'today',       // today | library | cipai | history
    poem: null,
    authorBio: '',
    hasAuthorDetail: false,
    collected: false,
    showTrans: false,
    vertical: false,    // 竖排排版
    reading: false,     // 朗读进行中
    fromList: false,
    lunarLabel: '',     // 农历干支+生肖
    todayStr: '',
    // 诗库筛选
    query: '',
    stages: STAGES,
    dynasties: DYNASTIES,
    stageIdx: 0,
    dynastyIdx: 0,
    list: [],
    // 词牌
    cipaiGroups: null,  // [{title, names:[{name, count}]}]
    curCipai: null,     // { name, info, poems }
    // 作者详情
    author: null,
    // 回看
    historyList: []
  },

  onLoad(options) {
    const g = lunar.ganzhiYear(new Date());
    this.setData({ lunarLabel: '农历 ' + g.label, todayStr: fmtDate(new Date()) });
    let poem;
    if (options && options.id) {
      poem = POEMS.find(p => p.id === options.id);
    } else if (options && options.tag) {
      const cand = POEMS.filter(p => (p.tags || []).indexOf(options.tag) > -1);
      poem = cand.length ? cand[Math.floor(Math.random() * cand.length)] : null;
    }
    if (!poem) poem = POEMS[dateUtil.dailyIndex(POEMS.length, 'poem')];
    this.show(poem, false);
    store.moduleCheckin('poetry');
  },

  onShow() {
    theme.apply(this);
    if (this.data.poem) {
      this.setData({ collected: store.isMastered('poem', this.data.poem.id) });
    }
  },

  show(poem, fromList) {
    const a = AUTHORS[poem.author];
    this.setData({
      poem,
      authorBio: (a && (a.bio || a.profile)) || '',
      hasAuthorDetail: !!a,
      collected: store.isMastered('poem', poem.id),
      showTrans: false,
      view: 'detail',
      fromList: !!fromList
    });
    wx.setNavigationBarTitle({ title: poem.title });
  },

  switchTab(e) {
    const t = e.currentTarget.dataset.t;
    if (t === 'today') {
      this.setData({ tab: t, view: 'detail', fromList: false });
      return;
    }
    this.setData({ tab: t, view: 'list' });
    if (t === 'library') this.applyFilter();
    else if (t === 'cipai') this.buildCipai();
    else if (t === 'history') this.loadHistory();
  },

  backToList() { this.setData({ view: 'list' }); },
  backToDetail() { this.setData({ view: 'detail' }); },

  onSearch(e) {
    this.setData({ query: e.detail.value });
    this.applyFilter();
  },
  pickStage(e) { this.setData({ stageIdx: +e.currentTarget.dataset.i }); this.applyFilter(); },
  pickDynasty(e) { this.setData({ dynastyIdx: +e.currentTarget.dataset.i }); this.applyFilter(); },

  applyFilter() {
    const q = (this.data.query || '').trim().toLowerCase();
    const stage = STAGES[this.data.stageIdx];
    const dyn = DYNASTIES[this.data.dynastyIdx];
    const list = POEMS.filter(p => {
      if (stage !== '全部' && p.stage !== stage) return false;
      if (dyn !== '全部' && p.dynasty !== dyn) return false;
      if (q) {
        const hay = (p.title + ' ' + p.author + ' ' + (p.tags || []).join(' ') + ' ' + (p.content || []).join(' ') + ' ' + (p.theme || '')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    this.setData({ list });
  },

  /* ---------- 词牌分类 ---------- */
  buildCipai() {
    if (this.data.cipaiGroups) return;
    const used = CIPAI.usedCount || {};
    const mk = (names) => names.map(n => ({ name: n, count: used[n] || 0 }));
    const groups = [
      { title: '按篇幅 · 小令（58字内）', names: mk(CIPAI.classify.byLength['小令'] || []) },
      { title: '按篇幅 · 中调（59–90字）', names: mk(CIPAI.classify.byLength['中调'] || []) },
      { title: '按篇幅 · 长调（91字以上）', names: mk(CIPAI.classify.byLength['长调'] || []) },
      { title: '按声情 · 婉约', names: mk(CIPAI.classify.byTone['婉约'] || []) },
      { title: '按声情 · 豪放', names: mk(CIPAI.classify.byTone['豪放'] || []) },
      { title: '按声情 · 兼备', names: mk(CIPAI.classify.byTone['兼备'] || []) }
    ];
    this.setData({ cipaiGroups: groups });
  },

  openCipai(e) {
    const name = e.currentTarget.dataset.name;
    const info = (CIPAI.dict || {})[name] || null;
    // 注意：poems.js 中 cipai 字段为内嵌对象（含 name），需按 name 匹配
    const poems = POEMS.filter(p => {
      const c = p.cipai;
      return c && (c === name || c.name === name);
    }).map(p => ({ id: p.id, title: p.title, author: p.author, dynasty: p.dynasty }));
    this.setData({ curCipai: { name, info, poems }, view: 'cipaiDetail' });
  },

  /* ---------- 作者生平详情 ---------- */
  openAuthor() {
    const a = AUTHORS[this.data.poem.author];
    if (!a) return;
    const works = POEMS.filter(p => p.author === a.name)
      .map(p => ({ id: p.id, title: p.title, dynasty: p.dynasty }));
    this.setData({
      author: Object.assign({}, a, {
        works,
        identity: a.identity || [],
        repText: (a.rep || []).join('、')
      }),
      view: 'author'
    });
  },

  loadHistory() {
    const hl = pastDates(14).map(dateStr => {
      const idx = dateUtil.dailyIndex(POEMS.length, 'poem' + dateStr);
      const p = POEMS[idx];
      return { date: dateStr, id: p.id, title: p.title, dynasty: p.dynasty, author: p.author };
    });
    this.setData({ historyList: hl });
  },

  openPoem(e) {
    const p = POEMS.find(x => x.id === e.currentTarget.dataset.id);
    if (p) this.show(p, true);
  },
  openHistory(e) {
    const p = POEMS.find(x => x.id === e.currentTarget.dataset.id);
    if (p) this.show(p, true);
  },

  toggleTrans() { this.setData({ showTrans: !this.data.showTrans }); },
  toggleVertical() { this.setData({ vertical: !this.data.vertical }); },

  toggleCollect() {
    const { poem, collected } = this.data;
    if (collected) {
      store.unmarkMastered('poem', poem.id);
      this.setData({ collected: false });
      wx.showToast({ title: '已取消收藏', icon: 'none' });
    } else {
      store.markMastered('poem', poem.id, poem.title);
      this.setData({ collected: true });
      wx.showToast({ title: '已收入档案', icon: 'success' });
    }
  },

  random() {
    this.show(POEMS[Math.floor(Math.random() * POEMS.length)], true);
  },

  readAloud() {
    const p = this.data.poem;
    if (!p) return;
    const text = Array.isArray(p.content) ? p.content.join('') : (p.content || '');
    tts.speak(text, {
      lang: 'zh',
      onStart: () => this.setData({ reading: true }),
      onEnd: () => this.setData({ reading: false }),
      onError: () => this.setData({ reading: false })
    });
  },

  onShareAppMessage() {
    const p = this.data.poem;
    return { title: p.title + ' — ' + p.author, path: '/subpackages/poetry/index?id=' + p.id, imageUrl: '/assets/branding/share-card.jpg' };
  },

  onShareTimeline() {
    const p = this.data.poem;
    return { title: p.title + ' — ' + p.author, query: 'id=' + p.id, imageUrl: '/assets/branding/share-card.jpg' };
  }
});
