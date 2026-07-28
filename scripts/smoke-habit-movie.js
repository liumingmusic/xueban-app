// 习惯/观影 逻辑冒烟：用 wx storage stub 模拟，验证 store 层读写/连胜/统计
const path = require('path');

// ---- wx 存储 stub ----
const _store = {};
global.wx = {
  getStorageSync(k) { return _store[k]; },
  setStorageSync(k, v) { _store[k] = v; }
};

const store = require('../utils/store');
const dateUtil = require('../utils/date');

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  [PASS] ' + name); }
  else { fail++; console.log('  [FAIL] ' + name); }
}

function ymd(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return dateUtil.todayStr(d);
}

console.log('== 习惯 ==');
store.addHabit({ id: 'h1', name: '阅读', emoji: '📚', color: '#3a9d6e', created: ymd(0), done: {} });
store.addHabit({ id: 'h2', name: '跑步', emoji: '🏃', color: '#2563eb', created: ymd(0), done: {} });
ok('getHabits 返回 2 条', store.getHabits().length === 2);

// 今日打卡切换
let r = store.toggleHabitDay('h1', ymd(0));
ok('今日打卡 done=true', r.done === true);
r = store.toggleHabitDay('h1', ymd(0));
ok('再次切换取消 done=false', r.done === false);

// 连胜：昨天+今天
store.addHabit({ id: 'h3', name: '喝水', emoji: '💧', color: '#2f8f78', created: ymd(0), done: {} });
const h3 = store.getHabits().find(h => h.id === 'h3');
h3.done = {}; h3.done[ymd(-1)] = true; h3.done[ymd(0)] = true;
store.saveHabits(store.getHabits());
ok('calcStreak(昨+今)=2', store.calcStreak(h3.done) === 2);

// 仅今天
const onlyToday = { [ymd(0)]: true };
ok('calcStreak(仅今)=1', store.calcStreak(onlyToday) === 1);

// 仅昨天（今天未打）→ 从昨天起算=1
const onlyYest = { [ymd(-1)]: true };
ok('calcStreak(仅昨)=1', store.calcStreak(onlyYest) === 1);

// 断档
const gap = { [ymd(-3)]: true, [ymd(0)]: true };
ok('calcStreak(断档)=1', store.calcStreak(gap) === 1);

// 删除
store.removeHabit('h2');
ok('removeHabit 后剩 2 条', store.getHabits().length === 2);

console.log('== 观影 ==');
store.addMovie({ id: 'm1', title: '星际穿越', date: ymd(0), rating: 5, genres: ['科幻', '剧情'], note: '神作' });
store.addMovie({ id: 'm2', title: '功夫熊猫', date: ymd(-2), rating: 4, genres: ['动画', '喜剧'], note: '' });
store.addMovie({ id: 'm3', title: '盗梦空间', date: ymd(0), rating: 5, genres: ['科幻', '悬疑'], note: '烧脑' });
ok('getMovies 返回 3 条', store.getMovies().length === 3);

const ms = store.getMovies();
const avg = (ms.reduce((s, m) => s + m.rating, 0) / ms.length).toFixed(1);
ok('平均评分=4.7', avg === '4.7');

const cnt = {};
ms.forEach(m => m.genres.forEach(g => cnt[g] = (cnt[g] || 0) + 1));
ok('科幻类型出现 2 次', cnt['科幻'] === 2);
ok('类型统计覆盖 5 种', Object.keys(cnt).length === 5);

// 删除
store.removeMovie('m3');
ok('removeMovie 后剩 2 条', store.getMovies().length === 2);

// 本年统计
const y = new Date().getFullYear();
const thisYear = store.getMovies().filter(m => m.date.slice(0, 4) === '' + y).length;
ok('本年记录=2', thisYear === 2);

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
