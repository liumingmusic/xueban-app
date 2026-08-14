// 数据：全站成长可视化（读 mastered / wrongBank / streaks / activity）
const store = require('../../utils/store');
const theme = require('../../utils/theme');
const dateUtil = require('../../utils/date');

Page({
  data: {
    counts: [],
    wrongs: [],
    heatWeeks: [],
    reviewCount: 0,
    createdAt: '',
    maxCount: 1,
    quizPoints: 0,
    quizStreak: 0,
    quizLevel: '启蒙',
    achievements: [],
    isEmpty: false
  },

  onShow() {
    theme.apply(this);
    const p = store.getProfile();

    const counts = [
      { label: '已学成语', num: (p.mastered.idiom || []).length, color: '#2f8f78' },
      { label: '已记单词', num: (p.mastered.word || []).length, color: '#4f8a6a' },
      { label: '收藏诗词', num: (p.mastered.poem || []).length, color: '#b45309' }
    ];
    const maxCount = Math.max(1, ...counts.map(c => c.num));
    counts.forEach(c => { c.pct = Math.round((c.num / maxCount) * 100); });

    const wrongs = [
      { label: '闯关错题', num: (p.wrongBank.quiz || []).length, color: '#2563eb' },
      { label: '生词本', num: (p.wrongBank.english || []).length, color: '#7c5cff' }
    ];

    // 近 12 周活跃热力（activity: { 'YYYY-MM-DD': n }）
    const act = p.activity || {};
    const today = new Date();
    const weeks = [];
    // 从 11 周前的周一开始
    const start = new Date(today);
    start.setDate(start.getDate() - start.getDay() - 7 * 11 + 1);
    for (let w = 0; w < 12; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const cur = new Date(start);
        cur.setDate(start.getDate() + w * 7 + d);
        const key = dateUtil.todayStr(cur);
        const n = act[key] || 0;
        let lv = 0;
        if (n >= 8) lv = 3; else if (n >= 4) lv = 2; else if (n >= 1) lv = 1;
        days.push({ key, lv, future: cur > today });
      }
      weeks.push(days);
    }

    // 闯关战绩（quizState 已记录但未充分展示）
    const qs = p.quizState || { points: 0, streak: 0 };

    // 成就里程碑（纯本地计算，基于连续天数 / 积分 / 掌握量）
    const appStreakN = (p.streaks && p.streaks.app && p.streaks.app.count) || 0;
    const totalMastered = (p.mastered.idiom || []).length + (p.mastered.word || []).length + (p.mastered.poem || []).length;
    let bestMod = 0;
    const mods = p.streaks.modules || {};
    Object.keys(mods).forEach(k => { if ((mods[k].count || 0) > bestMod) bestMod = mods[k].count; });
    const achievements = [
      { key: 'open7', emoji: '🌱', title: '初来乍到', desc: '连续打开 7 天', unlocked: appStreakN >= 7 },
      { key: 'open30', emoji: '🌿', title: '半月有成', desc: '连续打开 30 天', unlocked: appStreakN >= 30 },
      { key: 'open100', emoji: '🌳', title: '百日为伴', desc: '连续打开 100 天', unlocked: appStreakN >= 100 },
      { key: 'learn7', emoji: '📖', title: '手不释卷', desc: '单模块连学 7 天', unlocked: bestMod >= 7 },
      { key: 'points500', emoji: '🏅', title: '学霸认证', desc: '积分达 500', unlocked: (qs.points || 0) >= 500 },
      { key: 'points1500', emoji: '👑', title: '宗师之境', desc: '积分达 1500', unlocked: (qs.points || 0) >= 1500 },
      { key: 'qstreak10', emoji: '⚡', title: '连胜十方', desc: '闯关连胜 10', unlocked: (qs.streak || 0) >= 10 },
      { key: 'master50', emoji: '🌟', title: '小有所成', desc: '掌握内容 50+', unlocked: totalMastered >= 50 }
    ];

    // 空状态：无任何学习痕迹时给首用引导
    const isEmpty = (p.mastered.idiom || []).length === 0
      && (p.mastered.word || []).length === 0
      && (p.mastered.poem || []).length === 0
      && (p.wrongBank.quiz || []).length === 0
      && (p.wrongBank.english || []).length === 0
      && (p.reviewQueue || []).length === 0;

    this.setData({
      counts, maxCount, wrongs,
      heatWeeks: weeks,
      reviewDue: store.getDueReviews().length,
      reviewCount: (p.reviewQueue || []).length,
      createdAt: p.createdAt,
      quizPoints: qs.points,
      quizStreak: qs.streak,
      quizLevel: store.quizLevel(qs.points),
      achievements,
      isEmpty
    });
  },

  goQuiz() { wx.navigateTo({ url: '/subpackages/quiz/index?mode=wrong' }); },
  goEnglish() { wx.navigateTo({ url: '/subpackages/english/index?tab=review' }); },
  goReview() { wx.navigateTo({ url: '/subpackages/review/index' }); }
});
