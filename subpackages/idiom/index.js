// 成语故事：每日一成语 + 全量手册浏览（搜索/筛选/三态标记/近反义跳转/回看）
const dateUtil = require('../../utils/date');
const theme = require('../../utils/theme');
const store = require('../../utils/store');
const tts = require('../../utils/tts');
const IDIOMS = require('./idioms.js');
const shareCard = require('../../utils/shareCard');

const STAGES = ['全部', '小学', '初中', '高中'];
const INITIALS = ['全部', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'W', 'X', 'Y', 'Z'];

function fmtDate(d) {
  const y = d.getFullYear(); const m = ('0' + (d.getMonth() + 1)).slice(-2); const day = ('0' + d.getDate()).slice(-2);
  return y + '-' + m + '-' + day;
}
function pastDates(n) {
  const out = []; const base = new Date();
  for (let i = 0; i < n; i++) { const x = new Date(base); x.setDate(base.getDate() - i); out.push(fmtDate(x)); }
  return out;
}
function topThemes(n) {
  const cnt = {};
  IDIOMS.forEach(x => (x.tags || []).forEach(t => { cnt[t] = (cnt[t] || 0) + 1; }));
  return ['全部'].concat(Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).slice(0, n));
}

Page({
  data: {
    view: 'detail', tab: 'today',
    idiom: null,
    favorited: false, learned: false, tolearn: false,
    reading: false,     // 朗读进行中
    fromList: false,
    query: '',
    stages: STAGES, stageIdx: 0,
    themes: ['全部'], themeIdx: 0,
    initials: INITIALS, initialIdx: 0,
    list: [],
    historyList: [],
    // 我的学习
    myPct: 0, myLearnedCount: 0, myTotal: IDIOMS.length,
    myLearned: [], myToLearn: []
  },

  onLoad(options) {
    let idiom;
    if (options && options.id) idiom = IDIOMS.find(i => i.id === options.id);
    else if (options && options.word) idiom = IDIOMS.find(i => i.word === options.word);
    else if (options && options.tag) {
      const cand = IDIOMS.filter(i => (i.tags || []).indexOf(options.tag) > -1);
      idiom = cand.length ? cand[Math.floor(Math.random() * cand.length)] : null;
    }
    if (!idiom) idiom = IDIOMS[dateUtil.dailyIndex(IDIOMS.length, 'idiom')];
    this.setData({ themes: topThemes(10) });
    this.show(idiom, false);
  },

  onShow() {
    theme.apply(this); if (this.data.idiom) this.refreshMarks(); },

  refreshMarks() {
    const id = this.data.idiom.id;
    this.setData({
      favorited: store.isFavorite('idiom', id),
      learned: store.isMastered('idiom', id),
      tolearn: store.isToLearn(id)
    });
  },

  show(idiom, fromList) {
    this.setData({ idiom, view: 'detail', fromList: !!fromList });
    wx.setNavigationBarTitle({ title: idiom.word });
    shareCard.prepareCard(this, { title: idiom.word, subtitle: (idiom.explanation || '').slice(0, 24), tag: '成语', color: '#7c5cff' });
    this.refreshMarks();
  },

  switchTab(e) {
    const t = e.currentTarget.dataset.t;
    this.setData({ tab: t, view: 'list' });
    if (t === 'library') this.applyFilter();
    else if (t === 'history') this.loadHistory();
    else if (t === 'my') this.loadMyStudy();
  },

  // 「我的学习」：掌握进度条 + 已认识 / 待学习分组
  loadMyStudy() {
    const p = store.getProfile();
    const learnedIds = p.mastered.idiom || [];
    const toLearnIds = (p.idiomState && p.idiomState.toLearn) || [];
    const pick = ids => ids.map(id => IDIOMS.find(x => x.id === id)).filter(Boolean)
      .map(i => ({ id: i.id, word: i.word, pinyin: i.pinyin, stage: i.stage }));
    this.setData({
      myLearnedCount: learnedIds.length,
      myPct: IDIOMS.length ? Math.round(learnedIds.length / IDIOMS.length * 100) : 0,
      myLearned: pick(learnedIds),
      myToLearn: pick(toLearnIds)
    });
  },
  backToList() { this.setData({ view: 'list' }); },

  onSearch(e) { this.setData({ query: e.detail.value }); this.applyFilter(); },
  pickStage(e) { this.setData({ stageIdx: +e.currentTarget.dataset.i }); this.applyFilter(); },
  pickTheme(e) { this.setData({ themeIdx: +e.currentTarget.dataset.i }); this.applyFilter(); },
  pickInitial(e) { this.setData({ initialIdx: +e.currentTarget.dataset.i }); this.applyFilter(); },

  applyFilter() {
    const q = (this.data.query || '').trim().toLowerCase();
    const stage = STAGES[this.data.stageIdx];
    const theme = this.data.themes[this.data.themeIdx];
    const initial = INITIALS[this.data.initialIdx];
    const list = IDIOMS.filter(i => {
      if (stage !== '全部' && i.stage !== stage) return false;
      if (theme !== '全部' && (i.tags || []).indexOf(theme) < 0) return false;
      if (initial !== '全部' && i.initial !== initial) return false;
      if (q) {
        const hay = (i.word + ' ' + (i.explanation || '') + ' ' + (i.story || '') + ' ' + (i.tags || []).join(' ')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    this.setData({ list });
  },

  loadHistory() {
    const hl = pastDates(30).map(dateStr => {
      const idx = dateUtil.dailyIndex(IDIOMS.length, 'idiom' + dateStr);
      const i = IDIOMS[idx];
      return { date: dateStr, id: i.id, word: i.word, pinyin: i.pinyin, stage: i.stage };
    });
    this.setData({ historyList: hl });
  },

  openIdiom(e) {
    const i = IDIOMS.find(x => x.id === e.currentTarget.dataset.id);
    if (i) this.show(i, true);
  },
  openHistory(e) {
    const i = IDIOMS.find(x => x.id === e.currentTarget.dataset.id);
    if (i) this.show(i, true);
  },
  // 近义/反义点击跳转
  jumpRel(e) {
    const word = e.currentTarget.dataset.word;
    const i = IDIOMS.find(x => x.word === word);
    if (i) this.show(i, true);
    else wx.showToast({ title: '手册中暂无「' + word + '」', icon: 'none' });
  },

  toggleFavorite() {
    const { idiom } = this.data;
    const now = store.toggleFavorite('idiom', idiom.id, { title: idiom.word, sub: (idiom.explanation || '').slice(0, 30), color: '#7c5cff' });
    this.setData({ favorited: now });
    wx.showToast({ title: now ? '已收藏' : '已取消收藏', icon: now ? 'success' : 'none' });
  },
  markLearned() {
    const { idiom, learned } = this.data;
    if (learned) { store.unmarkMastered('idiom', idiom.id); this.setData({ learned: false }); wx.showToast({ title: '已取消已学', icon: 'none' }); }
    else { store.markMastered('idiom', idiom.id, idiom.word); store.moduleCheckin('idiom'); this.setData({ learned: true }); wx.showToast({ title: '已学会，记入档案！', icon: 'success' }); }
  },
  toggleToLearn() {
    const now = store.toggleToLearn(this.data.idiom.id);
    this.setData({ tolearn: now });
    wx.showToast({ title: now ? '已加入待学习' : '已移出待学习', icon: 'none' });
  },

  random() { this.show(IDIOMS[Math.floor(Math.random() * IDIOMS.length)], true); },
  readAloud() {
    const i = this.data.idiom;
    if (!i) return;
    const text = i.word + '：' + (i.explanation || '');
    tts.speak(text, {
      lang: 'zh',
      onStart: () => this.setData({ reading: true }),
      onEnd: () => this.setData({ reading: false }),
      onError: () => this.setData({ reading: false })
    });
  },

  onShareAppMessage() {
    const i = this.data.idiom;
    return shareCard.buildShare(this, { title: i.word + ' — ' + i.explanation.slice(0, 20), path: '/subpackages/idiom/index?id=' + i.id });
  },

  onShareTimeline() {
    const i = this.data.idiom;
    return { title: i.word + ' — 成语之美，今日一词', query: 'id=' + i.id, imageUrl: '/assets/branding/share-card.jpg' };
  }
});
