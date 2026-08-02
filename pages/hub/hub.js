// 今日中枢：当日聚合落地页（全部本地数据，不依赖外网）
const dateUtil = require('../../utils/date');
const theme = require('../../utils/theme');
const store = require('../../utils/store');
const digest = require('../../data/daily-digest.js');
const APPS = require('../../data/apps.js');
const remote = require('../../utils/remote');
const HISTORY_TODAY = require('../../data/history-today.js');
const analytics = require('../../utils/analytics');

// 计入「今日目标」的每日学习模块（与 moduleCheckin 触达的模块对齐）
const DAILY_GOAL_MODS = ['poem', 'idiom', 'quote', 'english', 'quiz'];

const APP_MAP = {};
APPS.forEach(a => { APP_MAP[a.id] = a; });

const DEFAULT_LAYOUT = [
  { key: 'poem', show: true },
  { key: 'idiom', show: true },
  { key: 'quote', show: true },
  { key: 'quiz', show: true },
  { key: 'review', show: true },
  { key: 'habit', show: true },
  { key: 'english', show: true },
  { key: 'history', show: true }
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
    habitStreak: 0,
    englishWord: null,
    englishOffline: false,
    historyEvents: [],
    // 今日目标卡
    goalDone: 0,
    goalTarget: 5,
    // 闯关战绩（quizState 已记录但未充分展示）
    quizPoints: 0,
    quizStreak: 0,
    quizLevel: '启蒙'
  },

  onShow() {
    theme.apply(this);
    const profile = store.getProfile();

    // 本地变量：供 setData 与下方 renderSections 共用（Page 方法内 data 字段不在词法作用域）
    const quizWrongCount = (profile.wrongBank.quiz || []).length;
    const quizTotal = digest.quizCount;
    const todayStr = dateUtil.todayStr();

    // 今日目标：今日已打卡的每日模块数 / 目标数
    const ms = (profile.streaks && profile.streaks.modules) || {};
    let goalDone = 0;
    DAILY_GOAL_MODS.forEach(m => { if (ms[m] && ms[m].last === todayStr) goalDone += 1; });
    const quizState = profile.quizState || { points: 0, streak: 0 };

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
      quizWrongCount,
      quizTotal,
      reviewDue: store.getDueReviews().length,
      // 打卡提醒卡片：habit 上线后才显示
      habitOnline: APP_MAP.habit && APP_MAP.habit.status === 'online',
      // 今日目标
      goalDone,
      goalTarget: profile.dailyGoal || DAILY_GOAL_MODS.length,
      // 闯关战绩
      quizPoints: quizState.points,
      quizStreak: quizState.streak,
      quizLevel: store.quizLevel(quizState.points)
    });

    // 习惯打卡进度（与中枢 streak 联动）：今日完成数 / 总数 / 聚合连胜
    const habits = store.getHabits();
    let habitDone = 0;
    habits.forEach(h => { if (h.done && h.done[todayStr]) habitDone += 1; });
    this.setData({
      habitTotal: habits.length,
      habitDone,
      habitStreak: (profile.streaks.habit && profile.streaks.habit.count) || 0
    });

    // 历史预览（本地同步数据，零网络，不转圈）
    this.setData({ historyEvents: HISTORY_TODAY.events });

    // 个性化首页：按 hubLayout（顺序 + 显隐）构建模块卡片
    this.renderSections(profile);

    // 埋点：中枢曝光（每次进入 tab 上报一次）
    analytics.track('hub_view', { goal_done: goalDone, streak: this.data.streak });

    // 每日单词为远程数据（带缓存），异步加载后自动刷新 english 卡片
    this.loadDailyWord();

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

  // 按 profile.hubLayout 构建首页模块卡片（english 单词异步回来后会再次调用刷新）
  renderSections(profile) {
    const layout = (profile.hubLayout && profile.hubLayout.length) ? profile.hubLayout : DEFAULT_LAYOUT;
    const reviewDue = store.getDueReviews().length;
    const habitOnline = !!(APP_MAP.habit && APP_MAP.habit.status === 'online');
    const habits = store.getHabits();
    const todayStr = dateUtil.todayStr();
    let habitDone = 0;
    habits.forEach(h => { if (h.done && h.done[todayStr]) habitDone += 1; });
    const sections = [];
    layout.forEach(it => {
      if (!it.show) return;
      if (it.key === 'poem') sections.push({ key: 'poem', poem: this.data.poem });
      else if (it.key === 'idiom') sections.push({ key: 'idiom', idiom: this.data.idiom, idiomLearned: this.data.idiomLearned });
      else if (it.key === 'quote') sections.push({ key: 'quote', quote: this.data.quote });
      else if (it.key === 'quiz') sections.push({ key: 'quiz', quizWrongCount: this.data.quizWrongCount, quizTotal: this.data.quizTotal, quizPoints: this.data.quizPoints, quizStreak: this.data.quizStreak, quizLevel: this.data.quizLevel });
      else if (it.key === 'review' && reviewDue > 0) sections.push({ key: 'review', reviewDue });
      else if (it.key === 'habit' && habitOnline) sections.push({ key: 'habit', habitDone, habitTotal: habits.length, habitStreak: (profile.streaks.habit && profile.streaks.habit.count) || 0, habitOnline: true });
      else if (it.key === 'english') sections.push({ key: 'english', word: this.data.englishWord, offline: this.data.englishOffline });
      else if (it.key === 'history') sections.push({ key: 'history', events: this.data.historyEvents });
    });
    this.setData({ sections });
  },

  // 每日单词：远程拉取（带 Storage 缓存），取当日词条；失败降级为离线态
  async loadDailyWord() {
    try {
      const r = await remote.fetchRemote('word');
      if (r.data && r.data.length) {
        const w = r.data[dateUtil.dailyIndex(r.data.length, 'word')];
        const norm = { word: w.word, cn: (Array.isArray(w.cn) ? w.cn[0] : w.cn) || w.en || '' };
        this.setData({ englishWord: norm, englishOffline: r.offline });
      } else {
        this.setData({ englishWord: null, englishOffline: true });
      }
    } catch (e) {
      this.setData({ englishWord: null, englishOffline: true });
    }
    this.renderSections(store.getProfile());
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
      habit: '/subpackages/habit/index',
      english: '/subpackages/english/index',
      history: '/subpackages/history/index'
    };
    if (map[k]) {
      analytics.track('module_open', { module: k });
      wx.navigateTo({ url: map[k] });
    }
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
  },

  // 朋友圈分享（纯前端，无需后端）
  onShareTimeline() {
    const p = store.getProfile();
    const streak = (p.streaks.app && p.streaks.app.count) || 0;
    return {
      title: `学伴小筑 · 我已连续学习 ${streak} 天，今天也要进步一点点`,
      query: '',
      imageUrl: '/assets/branding/share-card.jpg'
    };
  }
});
