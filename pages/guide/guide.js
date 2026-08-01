// 新手引导：首次进入展示，结束置 guided=true
const store = require('../../utils/store');
const theme = require('../../utils/theme');

const SLIDES = [
  {
    emoji: '🌿',
    title: '欢迎来到雪伴',
    desc: '一个把诗词、成语、单词、历史揉进每日碎片时间的学习小筑。'
  },
  {
    emoji: '📚',
    title: '每天学一点',
    desc: '中枢每日为你精选一首诗、一个成语、一句箴言，三五分钟，轻松积累。'
  },
  {
    emoji: '🔁',
    title: '学了不忘',
    desc: '学过的会自动进入复习队列，按遗忘曲线提醒你巩固，告别背了就忘。'
  }
];

Page({
  data: { idx: 0, slides: SLIDES },
  onSlide(e) { this.setData({ idx: e.detail.current }); },
  next() {
    const next = this.data.idx + 1;
    if (next < SLIDES.length) {
      this.setData({ idx: next });
    } else {
      this.finish();
    }
  },
  skip() { this.finish(); },
  finish() {
    store.updateProfile({ guided: true });
    wx.navigateBack();
  }

  ,
  onShow() {
    theme.apply(this);
  }});
