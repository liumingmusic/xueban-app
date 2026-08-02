// 我的收藏：聚合成语 / 单词 / 金句 / 已掌握诗词，一处查看、点击直达原文
// 纯前端，零后端；数据来自本地档案 store
const store = require('../../utils/store');
const theme = require('../../utils/theme');

const META = {
  idiom: { name: '成语', color: '#7c5cff', path: '/subpackages/idiom/index?id=' },
  word:  { name: '英语单词', color: '#7c5cff', path: '/subpackages/english/index?id=' },
  quote: { name: '金句', color: '#2f8f78', path: '/subpackages/quote/index' }
};

Page({
  data: { themeClass: '', fontClass: '', groups: [], poemCount: 0, isEmpty: true },

  onShow() {
    theme.apply(this);
    this.load();
  },

  load() {
    const p = store.getProfile();
    const groups = [];
    // 成语 / 单词：通用收藏（toggleFavorite 已带 title/sub/color）
    ['idiom', 'word'].forEach(m => {
      const items = store.getFavorites(m).map(x => ({
        key: m,
        id: x._id,
        title: x.title || '已收藏内容',
        sub: x.sub || '',
        color: x.color || META[m].color
      }));
      if (items.length) groups.push({ key: m, name: META[m].name, color: META[m].color, items });
    });
    // 金句：独立 quoteFavs（存全文）
    const quotes = (p.quoteFavs || []).map(q => ({
      key: 'quote', id: q.text, title: '「' + q.text + '」', sub: q.from || '', color: META.quote.color
    }));
    if (quotes.length) groups.push({ key: 'quote', name: META.quote.name, color: META.quote.color, items: quotes });

    const poemCount = (p.mastered && p.mastered.poem || []).length;
    const total = groups.reduce((s, g) => s + g.items.length, 0) + poemCount;
    this.setData({ groups, poemCount, isEmpty: total === 0 });
  },

  openItem(e) {
    const { key, id } = e.currentTarget.dataset;
    const url = key === 'quote' ? META.quote.path : META[key].path + id;
    wx.navigateTo({ url });
  },

  goPoem() { wx.navigateTo({ url: '/subpackages/poetry/index' }); }
});
