// 首页个性化：模块显隐 + 顺序（上/下）管理，偏好存 profile.hubLayout
const store = require('../../utils/store');
const theme = require('../../utils/theme');

const META = {
  poem: { name: '今日诗词', icon: '📜', desc: '每日精选一首诗词' },
  idiom: { name: '今日成语', icon: '🀄', desc: '每日一个成语典故' },
  quote: { name: '每日一句', icon: '💬', desc: '每日一句金句' },
  quiz: { name: '闯关挑战', icon: '🎯', desc: 'K12 题库每日挑战' },
  review: { name: '今日复习', icon: '🔁', desc: 'SRS 待复习提醒' },
  habit: { name: '习惯打卡', icon: '🌿', desc: '微习惯坚持与连胜' }
};

const DEFAULT_LAYOUT = [
  { key: 'poem', show: true },
  { key: 'idiom', show: true },
  { key: 'quote', show: true },
  { key: 'quiz', show: true },
  { key: 'review', show: true },
  { key: 'habit', show: true }
];

function toView(layout) {
  return layout.map(x => Object.assign({ key: x.key, show: x.show }, META[x.key]));
}

Page({
  data: { list: [] },

  onShow() {
    theme.apply(this);
    const p = store.getProfile();
    const layout = (p.hubLayout && p.hubLayout.length) ? p.hubLayout : DEFAULT_LAYOUT;
    this.setData({ list: toView(layout) });
  },

  toggle(e) {
    const i = +e.currentTarget.dataset.i;
    const list = this.data.list.slice();
    list[i].show = e.detail.value;
    this.setData({ list });
    this.persist(list);
  },

  moveUp(e) { this.swap(+e.currentTarget.dataset.i, -1); },
  moveDown(e) { this.swap(+e.currentTarget.dataset.i, 1); },

  swap(i, dir) {
    const j = i + dir;
    const list = this.data.list.slice();
    if (j < 0 || j >= list.length) return;
    const t = list[i]; list[i] = list[j]; list[j] = t;
    this.setData({ list });
    this.persist(list);
  },

  persist(list) {
    store.updateProfile({ hubLayout: list.map(x => ({ key: x.key, show: x.show })) });
  },

  reset() {
    store.updateProfile({ hubLayout: DEFAULT_LAYOUT.map(x => ({ key: x.key, show: x.show })) });
    this.onShow();
    wx.showToast({ title: '已恢复默认', icon: 'none' });
  }
});
