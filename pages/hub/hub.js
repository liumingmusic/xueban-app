// 今日中枢：当日聚合落地页（全部本地数据，不依赖外网）
const dateUtil = require('../../utils/date');
const store = require('../../utils/store');
const digest = require('../../data/daily-digest.js');
const APPS = require('../../data/apps.js');

const APP_MAP = {};
APPS.forEach(a => { APP_MAP[a.id] = a; });

Page({
  data: {
    greeting: '',
    dateCn: '',
    streak: 0,
    poem: null,
    idiom: null,
    idiomLearned: false,
    quote: null,
    quizWrongCount: 0,
    quizTotal: 0,
    reviewDue: 0,
    habitOnline: false
  },

  onShow() {
    const profile = store.getProfile();

    // 每日稳定选取（与各分包同算法同序，选中同一条）
    const poem = digest.poems[dateUtil.dailyIndex(digest.poems.length, 'poem')];
    const idiom = digest.idioms[dateUtil.dailyIndex(digest.idioms.length, 'idiom')];
    const quote = digest.quotes[dateUtil.dailyIndex(digest.quotes.length, 'quote')];

    this.setData({
      greeting: dateUtil.greeting(),
      dateCn: dateUtil.formatCn(),
      streak: (profile.streaks.app && profile.streaks.app.count) || 0,
      poem,
      idiom,
      idiomLearned: (profile.mastered.idiom || []).indexOf(idiom.id) > -1,
      quote,
      quizWrongCount: (profile.wrongBank.quiz || []).length,
      quizTotal: digest.quizCount,
      reviewDue: store.getDueReviews().length,
      // 打卡提醒卡片：habit 上线后才显示（当前为 placeholder，隐藏）
      habitOnline: APP_MAP.habit && APP_MAP.habit.status === 'online'
    });

    // 中枢 tab 角标：有待复习时显示红点数字（订阅提醒的零后端替代方案）
    const due = store.getDueReviews().length;
    if (due > 0) {
      wx.setTabBarBadge({ index: 0, text: String(due) });
    } else {
      wx.removeTabBarBadge({ index: 0 });
    }

    // 新手引导：首次进入自动展示，跳过/完成后置 guided=true 不再打扰
    if (!store.getProfile().guided) {
      wx.navigateTo({ url: '/pages/guide/guide' });
    }
  },

  noop() {}, // 阻止 related-rail 点击冒泡触发整卡跳转

  goPoetry() { wx.navigateTo({ url: '/subpackages/poetry/index' }); },
  goIdiom() { wx.navigateTo({ url: '/subpackages/idiom/index' }); },
  goQuote() { wx.navigateTo({ url: '/subpackages/quote/index' }); },
  goQuiz() { wx.navigateTo({ url: '/subpackages/quiz/index?mode=daily' }); },
  goHabit() { wx.navigateTo({ url: '/subpackages/habit/index' }); },
  goReview() { wx.navigateTo({ url: '/subpackages/review/index' }); },

  onShareAppMessage() {
    const p = store.getProfile();
    const streak = (p.streaks.app && p.streaks.app.count) || 0;
    const due = store.getDueReviews().length;
    const poemN = (p.mastered.poem || []).length;
    return {
      title: `我在雪伴连续学习 ${streak} 天，已掌握 ${poemN} 首诗词，今天还有 ${due} 个待复习！`,
      path: '/pages/hub/hub',
      imageUrl: '/assets/branding/share-card.jpg'
    };
  }
});
