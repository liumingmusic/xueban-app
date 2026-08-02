// 学习者档案（learner_profile）读写封装
// 全局唯一，跨分包共享；所有模块的"已学/错题/连续天数/进度"都写在这里
const dateUtil = require('./date');
const INIT = require('../data/profile-init');

const KEY = 'learner_profile';

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function init() {
  const p = wx.getStorageSync(KEY);
  if (!p || !p.createdAt) {
    const fresh = clone(INIT);
    fresh.createdAt = dateUtil.todayStr();
    wx.setStorageSync(KEY, fresh);
  }
}

function getProfile() {
  let p = wx.getStorageSync(KEY);
  if (!p || !p.createdAt) { init(); p = wx.getStorageSync(KEY); }
  // 兼容旧档案：补齐新字段
  const base = clone(INIT);
  for (const k of Object.keys(base)) {
    if (p[k] === undefined) p[k] = base[k];
  }
  // 兼容旧档案：补齐 hubLayout 中缺失的在线内容模块（默认显示，追加在末尾不破坏用户已排顺序）
  if (Array.isArray(p.hubLayout)) {
    const NEED = ['english', 'history'];
    let changed = false;
    for (const k of NEED) {
      if (!p.hubLayout.some(x => x.key === k)) { p.hubLayout.push({ key: k, show: true }); changed = true; }
    }
    if (changed) saveProfile(p);
  }
  return p;
}

function saveProfile(p) { wx.setStorageSync(KEY, p); return p; }

function updateProfile(patch) {
  const p = getProfile();
  Object.assign(p, patch);
  return saveProfile(p);
}

/* ---------- 已学 ---------- */
// 间隔重复（SRS）梯度：学会后依次在第 1/2/4/7/15/30 天复习
const SRS_LADDER = [1, 2, 4, 7, 15, 30];

function markMastered(module, id, label) {
  const p = getProfile();
  if (!p.mastered[module]) p.mastered[module] = [];
  if (p.mastered[module].indexOf(id) === -1) {
    p.mastered[module].push(id);
    touchActivity(p);
    saveProfile(p);
    addReview({ module, id, label });
    return true;
  }
  return false;
}

function unmarkMastered(module, id) {
  const p = getProfile();
  const arr = p.mastered[module] || [];
  const i = arr.indexOf(id);
  if (i > -1) { arr.splice(i, 1); removeReview(module, id); saveProfile(p); }
}

function isMastered(module, id) {
  const p = getProfile();
  return (p.mastered[module] || []).indexOf(id) > -1;
}

/* ---------- 错题 / 错词 ---------- */
function addWrong(module, item) {
  const p = getProfile();
  if (!p.wrongBank[module]) p.wrongBank[module] = [];
  const exists = p.wrongBank[module].some(w => w.id === item.id);
  if (!exists) {
    item.addedAt = dateUtil.todayStr();
    p.wrongBank[module].unshift(item);
    // 错题过多时保留最近 200 条
    if (p.wrongBank[module].length > 200) p.wrongBank[module].length = 200;
    touchActivity(p);
    saveProfile(p);
  }
}

function removeWrong(module, id) {
  const p = getProfile();
  const arr = p.wrongBank[module] || [];
  const i = arr.findIndex(w => w.id === id);
  if (i > -1) { arr.splice(i, 1); saveProfile(p); }
}

/* ---------- 复习队列（SRS） ---------- */
// item: { module, id, label }
function addReview(item) {
  const p = getProfile();
  if (!p.reviewQueue) p.reviewQueue = [];
  const dup = p.reviewQueue.find(r => r.module === item.module && r.id === item.id);
  if (!dup) {
    const today = dateUtil.todayStr();
    p.reviewQueue.unshift({
      module: item.module,
      id: item.id,
      label: item.label || '',
      level: 0,
      interval: SRS_LADDER[0],
      nextReview: dateUtil.addDays(today, SRS_LADDER[0]),
      addedAt: today
    });
    if (p.reviewQueue.length > 100) p.reviewQueue.length = 100;
    saveProfile(p);
  }
}

function removeReview(module, id) {
  const p = getProfile();
  const i = p.reviewQueue.findIndex(r => r.module === module && r.id === id);
  if (i > -1) { p.reviewQueue.splice(i, 1); saveProfile(p); }
}

// 今天及之前到期的待复习项
function getDueReviews(today) {
  today = today || dateUtil.todayStr();
  const p = getProfile();
  return (p.reviewQueue || []).filter(r => r.nextReview <= today);
}

// 完成一次复习：按 SRS 梯度把下次复习日推后
function reviewDone(module, id) {
  const p = getProfile();
  const r = (p.reviewQueue || []).find(x => x.module === module && x.id === id);
  if (!r) return null;
  const today = dateUtil.todayStr();
  let nextLevel = r.level + 1;
  if (nextLevel >= SRS_LADDER.length) nextLevel = SRS_LADDER.length - 1;
  const interval = SRS_LADDER[nextLevel];
  r.level = nextLevel;
  r.interval = interval;
  r.lastReview = today;
  r.nextReview = dateUtil.addDays(today, interval);
  saveProfile(p);
  return r;
}

function getReviewQueue() {
  const p = getProfile();
  return p.reviewQueue || [];
}

/* ---------- 连续天数 ---------- */
// 打开小程序连续天数（中枢徽章）
function appCheckin() {
  const p = getProfile();
  const today = dateUtil.todayStr();
  const s = p.streaks.app || { last: '', count: 0 };
  if (s.last !== today) {
    if (s.last && dateUtil.daysBetween(s.last, today) === 1) s.count += 1;
    else s.count = 1;
    s.last = today;
    p.streaks.app = s;
    p.streaks.lastCheckin = today;
    touchActivity(p);
    saveProfile(p);
  }
  return s;
}

// 各模块学习打卡（如诗词朗读、成语学习）
function moduleCheckin(module) {
  const p = getProfile();
  const today = dateUtil.todayStr();
  if (!p.streaks.modules) p.streaks.modules = {};
  const s = p.streaks.modules[module] || { last: '', count: 0, total: 0 };
  if (s.last !== today) {
    if (s.last && dateUtil.daysBetween(s.last, today) === 1) s.count += 1;
    else s.count = 1;
    s.last = today;
    s.total = (s.total || 0) + 1;
    p.streaks.modules[module] = s;
    touchActivity(p);
    saveProfile(p);
  }
  return s;
}

/* ---------- 活跃度（热力图数据） ---------- */
function touchActivity(p) {
  const own = !p;
  if (own) p = getProfile();
  if (!p.activity) p.activity = {};
  const today = dateUtil.todayStr();
  p.activity[today] = (p.activity[today] || 0) + 1;
  if (own) saveProfile(p);
}

/* ---------- 收藏（跨模块通用） ---------- */
function toggleFavorite(module, id) {
  const p = getProfile();
  if (!p.favorites) p.favorites = {};
  if (!p.favorites[module]) p.favorites[module] = [];
  const arr = p.favorites[module];
  const i = arr.indexOf(id);
  if (i > -1) { arr.splice(i, 1); saveProfile(p); return false; }
  arr.unshift(id);
  saveProfile(p);
  return true;
}

function isFavorite(module, id) {
  const p = getProfile();
  return !!(p.favorites && p.favorites[module] && p.favorites[module].indexOf(id) > -1);
}

function getFavorites(module) {
  const p = getProfile();
  return (p.favorites && p.favorites[module]) || [];
}

/* ---------- 成语：待学习标记（与已认识互斥由调用方保证） ---------- */
function toggleToLearn(id) {
  const p = getProfile();
  if (!p.idiomState) p.idiomState = { toLearn: [] };
  const arr = p.idiomState.toLearn;
  const i = arr.indexOf(id);
  if (i > -1) { arr.splice(i, 1); saveProfile(p); return false; }
  arr.unshift(id);
  saveProfile(p);
  return true;
}

function isToLearn(id) {
  const p = getProfile();
  return !!(p.idiomState && p.idiomState.toLearn.indexOf(id) > -1);
}

/* ---------- 英语：词书 / 每日计划 ---------- */
function getEnglishState() {
  const p = getProfile();
  if (!p.englishState) { p.englishState = { book: '', dailyGoal: 20, dailyDate: '', dailyDone: 0, studied: [] }; saveProfile(p); }
  // 跨天重置当日已背
  const today = dateUtil.todayStr();
  if (p.englishState.dailyDate !== today) {
    p.englishState.dailyDate = today;
    p.englishState.dailyDone = 0;
    saveProfile(p);
  }
  return p.englishState;
}

function updateEnglishState(patch) {
  const p = getProfile();
  Object.assign(p.englishState, patch);
  saveProfile(p);
  return p.englishState;
}

function englishStudied(word) {
  const p = getProfile();
  const es = p.englishState;
  if (es.studied.indexOf(word) === -1) es.studied.push(word);
  const today = dateUtil.todayStr();
  if (es.dailyDate !== today) { es.dailyDate = today; es.dailyDone = 0; }
  es.dailyDone += 1;
  touchActivity(p);
  saveProfile(p);
  return es;
}

/* ---------- 闯关：积分 / 等级 / 连胜 / 答题日历 ---------- */
function getQuizState() {
  const p = getProfile();
  if (!p.quizState) {
    p.quizState = { points: 0, streak: 0, lastPlayDate: '', calendar: {}, settings: { restEnabled: true, restEvery: 10 } };
    saveProfile(p);
  }
  if (!p.quizState.settings) p.quizState.settings = { restEnabled: true, restEvery: 10 };
  return p.quizState;
}

function quizLevel(points) {
  if (points >= 1500) return '宗师';
  if (points >= 500) return '学霸';
  return '启蒙';
}

// 记一局成绩：加积分、更新连胜、记答题日历
function quizRecordRound(opts) {
  const p = getProfile();
  const qs = getQuizState();
  const today = dateUtil.todayStr();
  qs.points += opts.points || 0;
  // 连胜：昨天有答题则 +1，断档重置为 1；同日不重复加
  if (qs.lastPlayDate !== today) {
    if (qs.lastPlayDate && dateUtil.daysBetween(qs.lastPlayDate, today) === 1) qs.streak += 1;
    else qs.streak = 1;
    qs.lastPlayDate = today;
  }
  qs.calendar[today] = (qs.calendar[today] || 0) + (opts.answered || 0);
  p.quizState = qs;
  touchActivity(p);
  saveProfile(p);
  return qs;
}

function quizUpdateSettings(patch) {
  const p = getProfile();
  const qs = getQuizState();
  Object.assign(qs.settings, patch);
  p.quizState = qs;
  saveProfile(p);
  return qs.settings;
}

/* ---------- 习惯打卡（habits） ---------- */
// 单条 habit: { id, name, emoji, color, created, done: { 'YYYY-MM-DD': true } }
function getHabits() {
  const p = getProfile();
  if (!p.habits) p.habits = [];
  return p.habits;
}

function saveHabits(arr) {
  const p = getProfile();
  p.habits = arr;
  // 聚合习惯连胜写入 streaks.habit，与学习连续天数并列
  let best = 0;
  arr.forEach(h => { if ((h.streak || 0) > best) best = h.streak; });
  p.streaks.habit = { count: best, updated: dateUtil.todayStr() };
  touchActivity(p);
  saveProfile(p);
  return p.habits;
}

// 从某天往前数连续打卡天数（今天没打卡则从昨天起算，允许"今天还没打但仍显示昨日连胜"）
function calcStreak(done) {
  if (!done) return 0;
  let t = new Date();
  if (!done[dateUtil.todayStr(t)]) t.setDate(t.getDate() - 1); // 今天未打卡，连胜从昨天算
  if (!done[dateUtil.todayStr(t)]) return 0;
  let s = 0;
  while (done[dateUtil.todayStr(t)]) {
    s += 1;
    t.setDate(t.getDate() - 1);
  }
  return s;
}

function addHabit(h) {
  const hs = getHabits();
  hs.unshift(h);
  return saveHabits(hs);
}

function removeHabit(id) {
  const hs = getHabits().filter(h => h.id !== id);
  return saveHabits(hs);
}

// 切换某天打卡状态，返回 { done, streak }
function toggleHabitDay(id, dateStr) {
  const hs = getHabits();
  const h = hs.find(x => x.id === id);
  if (!h) return null;
  h.done = h.done || {};
  let now;
  if (h.done[dateStr]) { delete h.done[dateStr]; now = false; }
  else { h.done[dateStr] = true; now = true; }
  h.streak = calcStreak(h.done);
  saveHabits(hs);
  return { done: now, streak: h.streak };
}

/* ---------- 观影追踪（progress.movie） ---------- */
// 单条 movie: { id, title, date, rating(1-5), genres:[], note }
function getMovies() {
  const p = getProfile();
  if (!p.progress) p.progress = {};
  if (!p.progress.movie) p.progress.movie = [];
  return p.progress.movie;
}

function saveMovies(arr) {
  const p = getProfile();
  if (!p.progress) p.progress = {};
  p.progress.movie = arr;
  touchActivity(p);
  saveProfile(p);
  return p.progress.movie;
}

function addMovie(m) {
  const ms = getMovies();
  ms.unshift(m);
  return saveMovies(ms);
}

function removeMovie(id) {
  const ms = getMovies().filter(m => m.id !== id);
  return saveMovies(ms);
}

/* ---------- 导出 / 导入 ---------- */
function exportJson() { return JSON.stringify(getProfile(), null, 2); }

function importJson(str) {
  const obj = JSON.parse(str);
  if (!obj || !obj.mastered || !obj.wrongBank) throw new Error('不是有效的学习者档案');
  saveProfile(obj);
  return obj;
}

function reset() {
  const fresh = clone(INIT);
  fresh.createdAt = dateUtil.todayStr();
  saveProfile(fresh);
}

module.exports = {
  init, getProfile, saveProfile, updateProfile,
  markMastered, unmarkMastered, isMastered,
  addWrong, removeWrong,
  addReview, removeReview, getDueReviews, reviewDone, getReviewQueue,
  appCheckin, moduleCheckin, touchActivity,
  toggleFavorite, isFavorite, getFavorites,
  toggleToLearn, isToLearn,
  getEnglishState, updateEnglishState, englishStudied,
  getQuizState, quizLevel, quizRecordRound, quizUpdateSettings,
  getHabits, saveHabits, addHabit, removeHabit, toggleHabitDay, calcStreak,
  getMovies, saveMovies, addMovie, removeMovie,
  exportJson, importJson, reset
};
