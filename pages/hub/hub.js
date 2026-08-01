// 今日中枢：当日聚合落地页（全部本地数据，不依赖外网）
const dateUtil = require('../../utils/date');
const theme = require('../../utils/theme');
const store = require('../../utils/store');
const digest = require('../../data/daily-digest.js');
const APPS = require('../../data/apps.js');

const APP_MAP = {};
APPS.forEach(a => { APP_MAP[a.id] = a; });

const DEFAULT_LAYOUT = [
  { key: 'poem', show: true },
  { key: 'idiom', show: true },
  { key: 'quote', show: true },
  { key: 'quiz', show: true },
  { key: 'review', show: true },
  { key: 'habit', show: true }
];

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
    habitOnline: false,
    habitTotal: 0,
    habitDone: 0,
    habitStreak: 0
  },

  onShow() {
    theme.apply(this);
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

    // 习惯打卡进度（与中枢 streak 联动）：今日完成数 / 总数 / 聚合连胜
    const habits = store.getHabits();
    const todayStr = dateUtil.todayStr();
    let habitDone = 0;
    habits.forEach(h => { if (h.done && h.done[todayStr]) habitDone += 1; });
    this.setData({
      habitTotal: habits.length,
      habitDone,
      habitStreak: (profile.streaks.habit && profile.streaks.habit.count) || 0
    });

    // 个性化首页：按 hubLayout（顺序 + 显隐）构建模块卡片
    const layout = (profile.hubLayout && profile.hubLayout.length) ? profile.hubLayout : DEFAULT_LAYOUT;
    const reviewDue = store.getDueReviews().length;
    const habitOnline = !!(APP_MAP.habit && APP_MAP.habit.status === 'online');
    const sections = [];
    layout.forEach(it => {
      if (!it.show) return;
      if (it.key === 'poem') sections.push({ key: 'poem', poem });
      else if (it.key === 'idiom') sections.push({ key: 'idiom', idiom, idiomLearned: (profile.mastered.idiom || []).indexOf(idiom.id) > -1 });
      else if (it.key === 'quote') sections.push({ key: 'quote', quote });
      else if (it.key === 'quiz') sections.push({ key: 'quiz', quizWrongCount, quizTotal });
      else if (it.key === 'review' && reviewDue > 0) sections.push({ key: 'review', reviewDue });
      else if (it.key === 'habit' && habitOnline) sections.push({ key: 'habit', habitDone, habitTotal: habits.length, habitStreak: (profile.streaks.habit && profile.streaks.habit.count) || 0, habitOnline: true });
    });
    this.setData({ sections });

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

  goSearch() { wx.navigateTo({ url: '/pages/search/search' }); },
  goManage() { wx.navigateTo({ url: '/pages/modules/modules' }); },

  // 个性化首页：按模块 key 统一跳转
  goSection(e) {
    const k = e.currentTarget.dataset.go;
    const map = {
      poem: '/subpackages/poetry/index',
      idiom: '/subpackages/idiom/index',
      quote: '/subpackages/quote/index',
      quiz: '/subpackages/quiz/index?mode=daily',
      review: '/subpackages/review/index',
      habit: '/subpackages/habit/index'
    };
    if (map[k]) wx.navigateTo({ url: map[k] });
  },

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
