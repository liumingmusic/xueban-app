// 每日一句：Hitokoto 一言 API + 分包内离线文案保底
// API 域名 v1.hitokoto.cn 需在公众平台配置 request 合法域名
const dateUtil = require('../../utils/date');
const theme = require('../../utils/theme');
const store = require('../../utils/store');
const analytics = require('../../utils/analytics');
const LOCAL = require('./quotes.js').quotes;
const shareCard = require('../../utils/shareCard');

function fmtDate(d) {
  const y = d.getFullYear(); const m = ('0' + (d.getMonth() + 1)).slice(-2); const day = ('0' + d.getDate()).slice(-2);
  return y + '-' + m + '-' + day;
}
function pastDates(n) {
  const out = []; const base = new Date();
  for (let i = 0; i < n; i++) { const x = new Date(base); x.setDate(base.getDate() - i); out.push(fmtDate(x)); }
  return out;
}

Page({
  data: {
    view: 'detail', tab: 'today',
    quote: null, offline: false, isToday: true, favorited: false, fromList: false,
    loading: false,
    favList: [], historyList: []
  },

  onLoad(options) {
    this.setData({ quote: this.dailyQuote() });
    this.genShareCard();
    store.moduleCheckin('quote');
    analytics.track('content_view', { module: 'quote', id: 'daily' });
    if (options && options.ref === 'share') {
      wx.showToast({ title: (store.getProfile().guided ? '好友分享 · 欢迎回来' : '欢迎通过分享加入学伴小筑 🌿'), icon: 'none' });
    }
  },
  onShow() {
    theme.apply(this); if (this.data.quote) this.setData({ favorited: this.isFav(this.data.quote) }); },

  dailyQuote() { return LOCAL[dateUtil.dailyIndex(LOCAL.length, 'quote')]; },

  // 生成当前句子的动态分享卡片（失败静默回落）
  genShareCard() {
    const q = this.data.quote;
    if (!q) return;
    shareCard.prepareCard(this, { title: '「' + q.text + '」', subtitle: q.from || '', tag: '金句', color: '#2f8f78' });
  },

  // 本地随机一句（离线可用、即时、排除当前句）
  changeOne() {
    const pool = LOCAL;
    if (pool.length <= 1) return;
    let idx;
    do { idx = Math.floor(Math.random() * pool.length); } while (pool[idx].text === this.data.quote.text);
    const q = pool[idx];
    this.setData({ quote: q, isToday: false, offline: false, favorited: this.isFav(q), view: 'detail', fromList: false });
    this.genShareCard();
  },

  backToday() {
    this.setData({ quote: this.dailyQuote(), isToday: true, offline: false, favorited: this.isFav(this.dailyQuote()), view: 'detail' });
    this.genShareCard();
  },

  // 收藏（页内管理 quoteFavs 数组，存完整文案便于列表回填）
  isFav(q) {
    const favs = (store.getProfile().quoteFavs) || [];
    return favs.some(x => x.text === q.text);
  },
  toggleFav() {
    const q = this.data.quote;
    const p = store.getProfile();
    p.quoteFavs = p.quoteFavs || [];
    const i = p.quoteFavs.findIndex(x => x.text === q.text);
    let favorited;
    if (i > -1) { p.quoteFavs.splice(i, 1); favorited = false; }
    else { p.quoteFavs.unshift(q); favorited = true; }
    store.saveProfile(p);
    this.setData({ favorited });
    wx.showToast({ title: favorited ? '已收藏' : '已取消收藏', icon: favorited ? 'success' : 'none' });
  },

  copy() {
    const q = this.data.quote;
    wx.setClipboardData({ data: '「' + q.text + '」—— ' + (q.from || ''), success() { wx.showToast({ title: '已复制', icon: 'success' }); } });
  },

  // 回看
  switchTab(e) {
    const t = e.currentTarget.dataset.t;
    this.setData({ tab: t, view: 'list' });
    if (t === 'fav') this.setData({ favList: (store.getProfile().quoteFavs) || [] });
    else if (t === 'history') this.loadHistory();
  },
  backToList() { this.setData({ view: 'list' }); },
  loadHistory() {
    const hl = pastDates(14).map(dateStr => {
      const q = LOCAL[dateUtil.dailyIndex(LOCAL.length, 'quote' + dateStr)];
      return { date: dateStr, text: q.text, from: q.from, author: q.author, type: q.type };
    });
    this.setData({ historyList: hl });
  },
  openQuote(e) {
    const text = e.currentTarget.dataset.text;
    const q = (this.data.favList.find(x => x.text === text)) || (this.data.historyList.find(x => x.text === text));
    if (q) { this.setData({ quote: q, favorited: this.isFav(q), view: 'detail', fromList: true }); this.genShareCard(); }
  },
  delFav(e) {
    const text = e.currentTarget.dataset.text;
    const p = store.getProfile();
    p.quoteFavs = (p.quoteFavs || []).filter(x => x.text !== text);
    store.saveProfile(p);
    this.setData({ favList: p.quoteFavs, favorited: this.data.quote.text === text ? false : this.data.favorited });
  },

  onShareAppMessage() {
    const q = this.data.quote;
    return shareCard.buildShare(this, { title: '「' + q.text + '」—— ' + (q.from || ''), path: '/subpackages/quote/index' });
  },

  onShareTimeline() {
    const q = this.data.quote;
    return { title: '「' + q.text + '」—— ' + (q.from || ''), query: '', imageUrl: '/assets/branding/share-card.jpg' };
  }
});
