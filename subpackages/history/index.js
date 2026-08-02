// 历史上的今天：Wikimedia On This Day API（zh），失败降级到分包内快照
// API 域名 api.wikimedia.org 需在公众平台配置 request 合法域名
const dateUtil = require('../../utils/date');
const theme = require('../../utils/theme');
const store = require('../../utils/store');
const request = require('../../utils/request');
const FALLBACK = require('./fallback.js');

// 提取条目：附维基条目缩略图（懒加载）与外部链接（点按复制）
function pick(arr) {
  return (arr || []).map(e => {
    const pg = (e.pages && e.pages[0]) || null;
    return {
      year: e.year, text: e.text,
      thumb: (pg && pg.thumbnail && pg.thumbnail.source) || '',
      link: (pg && pg.content_urls && pg.content_urls.desktop && pg.content_urls.desktop.page) || ''
    };
  });
}
function normalizeWikimedia(data) {
  return {
    featured: pick(data.selected).slice(0, 3),
    events: pick(data.events),
    births: pick(data.births).slice(0, 12),
    deaths: pick(data.deaths).slice(0, 12),
    holidays: pick(data.holidays)
  };
}
function normalizeFallback(snap) {
  const sec = snap.sections || {};
  return {
    featured: (snap.featured || []).map(e => ({ year: e.year, text: e.text })),
    events: (sec.events || []).map(e => ({ year: e.year, text: e.text })),
    births: (sec.births || []).map(e => ({ year: e.year, text: e.text })),
    deaths: (sec.deaths || []).map(e => ({ year: e.year, text: e.text })),
    holidays: (sec.holidays || []).map(e => ({ year: '', text: e.text }))
  };
}
function filterList(arr, q) {
  if (!q) return arr;
  const t = q.toLowerCase();
  return arr.filter(e => ('' + e.text).toLowerCase().indexOf(t) > -1 || ('' + e.year).indexOf(t) > -1);
}

Page({
  data: {
    dateCn: '', dateStr: '',
    loading: true, offline: false, offlineDate: '',
    featured: [], events: [], births: [], deaths: [], holidays: [],
    tabs: ['events', 'births', 'deaths', 'holidays'],
    tab: 'events',
    query: '',
    shownEvents: [], shownBirths: [], shownDeaths: [], shownHolidays: []
  },

  onLoad() {
    const now = new Date();
    this.setData({ dateCn: dateUtil.formatCn(), dateStr: dateUtil.pad(now.getMonth() + 1) + '-' + dateUtil.pad(now.getDate()) });
    this.fetch();
    store.moduleCheckin('history');
  },

  async fetch(mm, dd) {
    if (!mm || !dd) { const n = new Date(); mm = dateUtil.pad(n.getMonth() + 1); dd = dateUtil.pad(n.getDate()); }
    this.setData({ loading: true });
    try {
      const data = await request.get('https://api.wikimedia.org/feed/v1/wikipedia/zh/onthisday/all/' + mm + '/' + dd, { timeout: 9000 });
      const n = normalizeWikimedia(data);
      this.setData({ loading: false, offline: false, dateStr: mm + '-' + dd, ...n });
      this.applySearch();
    } catch (e) {
      const n = normalizeFallback(FALLBACK);
      this.setData({ loading: false, offline: true, offlineDate: FALLBACK.monthDay || '', ...n });
      this.applySearch();
    }
  },

  onDatePick(e) {
    const v = e.detail.value; // YYYY-MM-DD
    const parts = v.split('-');
    this.fetch(parts[1], parts[2]);
  },

  switchTab(e) { this.setData({ tab: e.currentTarget.dataset.tab }); },

  onSearch(e) { this.setData({ query: e.detail.value }); this.applySearch(); },

  applySearch() {
    const q = this.data.query;
    this.setData({
      shownEvents: filterList(this.data.events, q),
      shownBirths: filterList(this.data.births, q),
      shownDeaths: filterList(this.data.deaths, q),
      shownHolidays: filterList(this.data.holidays, q)
    });
  },

  retry() { this.fetch(); },

  // 条目点按：复制维基外链（小程序内不能直接打开外部网页）
  copyLink(e) {
    const link = e.currentTarget.dataset.link;
    if (!link) return;
    wx.setClipboardData({
      data: link,
      success() { wx.showToast({ title: '维基链接已复制，可到浏览器打开', icon: 'none' }); }
    });
  },

  // 今日海报：复制网页版海报页链接（网页版支持 SVG 海报导出）
  copyPoster() {
    wx.setClipboardData({
      data: 'https://liumingmusic.github.io/this-day-in-history/',
      success() { wx.showToast({ title: '网页版链接已复制，浏览器打开可生成今日海报', icon: 'none' }); }
    });
  },

  onShareAppMessage() {
    return { title: '历史上的今天 · ' + this.data.dateCn, path: '/subpackages/history/index', imageUrl: '/assets/branding/share-card.jpg' };
  },

  onShareTimeline() {
    return { title: '历史上的今天 · ' + this.data.dateCn, query: '', imageUrl: '/assets/branding/share-card.jpg' };
  },

  onShow() {
    theme.apply(this);
  }});
