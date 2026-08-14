const digest = require('../../data/daily-digest.js');
const theme = require('../../utils/theme');
const remote = require('../../utils/remote');
const store = require('../../utils/store');

const MODULES = [
  { key: 'poem', name: '诗词', color: 'var(--c-poetry)' },
  { key: 'idiom', name: '成语', color: 'var(--c-idiom)' },
  { key: 'word', name: '单词', color: 'var(--c-english)' },
  { key: 'quote', name: '每日一句', color: 'var(--c-quote)' }
];
const COLOR = { poem: 'var(--c-poetry)', idiom: 'var(--c-idiom)', word: 'var(--c-english)', quote: 'var(--c-quote)' };

Page({
  data: {
    keyword: '',
    filter: 'all',
    modules: [{ key: 'all', name: '全部' }].concat(MODULES),
    examples: [
      { kw: '静夜思' }, { kw: '李白' }, { kw: '画龙点睛' },
      { kw: '守株待兔' }, { kw: 'apple' }, { kw: 'book' }, { kw: '努力' }
    ],
    groups: [],
    total: 0,
    wordsReady: false,
    wordsOffline: false,
    searched: false
  },

  _timer: null,
  _words: [],

  onLoad() {
    this._poems = digest.poems || [];
    this._idioms = digest.idioms || [];
    this._quotes = digest.quotes || [];
    this._loadWords();
  },

  async _loadWords() {
    try {
      const r = await remote.fetchRemote('word');
      if (r && r.data && r.data.length) {
        this._words = r.data;
        this.setData({ wordsReady: true, wordsOffline: !!r.offline });
        if (this.data.keyword) this.doSearch();
      } else {
        this.setData({ wordsReady: true, wordsOffline: true });
      }
    } catch (e) {
      this.setData({ wordsReady: true, wordsOffline: true });
    }
  },

  onFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.k });
    this.doSearch();
  },

  onInput(e) {
    const kw = e.detail.value;
    this.setData({ keyword: kw });
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => this.doSearch(), 200);
  },

  onClear() {
    this.setData({ keyword: '', groups: [], total: 0, searched: false });
  },

  onExample(e) {
    const kw = e.currentTarget.dataset.kw;
    this.setData({ keyword: kw, filter: 'all' });
    this.doSearch();
  },

  doSearch() {
    const kw = (this.data.keyword || '').trim().toLowerCase();
    if (!kw) { this.setData({ groups: [], total: 0, searched: false }); return; }
    const f = this.data.filter;
    const groups = [];

    if (f === 'all' || f === 'poem') {
      const items = this._poems.filter(p => {
        const hay = (p.title + ' ' + p.author + ' ' + (p.dynasty || '') + ' ' + (p.tags || []).join(' ') + ' ' + (p.first || []).join('')).toLowerCase();
        return hay.indexOf(kw) > -1;
      }).slice(0, 20).map(p => ({
        id: p.id, title: p.title, sub: (p.dynasty || '') + ' · ' + (p.author || ''),
        extra: (p.first || []).join('')
      }));
      if (items.length) groups.push({ key: 'poem', name: '诗词', color: COLOR.poem, items });
    }

    if (f === 'all' || f === 'idiom') {
      const items = this._idioms.filter(it => {
        const hay = (it.word + ' ' + (it.pinyin || '') + ' ' + (it.brief || '') + ' ' + (it.tags || []).join(' ')).toLowerCase();
        return hay.indexOf(kw) > -1;
      }).slice(0, 20).map(it => ({
        id: it.id, title: it.word, sub: it.pinyin || '', extra: (it.brief || '').slice(0, 24)
      }));
      if (items.length) groups.push({ key: 'idiom', name: '成语', color: COLOR.idiom, items });
    }

    if (f === 'all' || f === 'word') {
      const items = this._words.filter(w => {
        const exs = (w.examples || []).map(e => (e.en || '') + ' ' + (e.cn || '')).join(' ');
        const hay = (w.word + ' ' + (w.cn || '') + ' ' + (w.en || '') + ' ' + exs).toLowerCase();
        return hay.indexOf(kw) > -1;
      }).slice(0, 20).map(w => {
        // 副标题：优先展示命中的例句片段，否则展示中文释义
        let extra = w.cn || '';
        const base = (w.word + ' ' + (w.cn || '') + ' ' + (w.en || '')).toLowerCase();
        if (base.indexOf(kw) === -1) {
          const hit = (w.examples || []).find(e =>
            ((e.en || '') + ' ' + (e.cn || '')).toLowerCase().indexOf(kw) > -1);
          if (hit) extra = (hit.en || '') + (hit.cn ? (' · ' + hit.cn) : '');
        }
        return { id: w.word, title: w.word, sub: w.level || '', extra };
      });
      if (items.length) groups.push({ key: 'word', name: '单词', color: COLOR.word, items });
    }

    if (f === 'all' || f === 'quote') {
      const items = this._quotes.filter(q => {
        const hay = ((q.text || '') + ' ' + (q.from || '') + ' ' + (q.author || '')).toLowerCase();
        return hay.indexOf(kw) > -1;
      }).slice(0, 20).map((q, i) => ({
        id: 'q' + i, title: '「' + (q.text || '').slice(0, 18) + '」',
        sub: q.from || '', extra: q.author || ''
      }));
      if (items.length) groups.push({ key: 'quote', name: '每日一句', color: COLOR.quote, items });
    }

    const total = groups.reduce((s, g) => s + g.items.length, 0);
    this.setData({ groups, total, searched: true });
  },

  tapItem(e) {
    const { mod, id } = e.currentTarget.dataset;
    let url = '';
    if (mod === 'poem') url = '/subpackages/poetry/index?id=' + encodeURIComponent(id);
    else if (mod === 'idiom') url = '/subpackages/idiom/index?id=' + encodeURIComponent(id);
    else if (mod === 'word') url = '/subpackages/english/index?id=' + encodeURIComponent(id);
    else if (mod === 'quote') url = '/subpackages/quote/index';
    if (url) wx.navigateTo({ url });
  },

  onShow() {
    theme.apply(this);
  }
});
