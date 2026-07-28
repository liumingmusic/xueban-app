/* 远程加载器冒烟测试：模拟 wx + 模拟 GitHub raw 返回
 * 覆盖：首次拉取 / 版本相同走缓存 / 离线回退缓存 / 离线无缓存返回 null / 单词拉取 / 分片重组
 * 运行：node scripts/smoke-remote.js
 */
const path = require('path');
const fs = require('fs');
const BASE = '/Users/Zhuanz/WorkBuddy/2026-07-27-22-26-52/';
const manifest = JSON.parse(fs.readFileSync(path.join(BASE, 'github-data/manifest.json'), 'utf8'));

const store = {};
let OFFLINE = false;
let BLOCK_RAW = false; // 模拟主源(raw)被墙，逼走 jsDelivr 镜像
function fileFor(url) {
  // 兼容两种源：raw(…/xueban-data/main/xxx) 与 jsDelivr(…/xueban-data@main/xxx)
  const m = url.match(/xueban-data[/@]main\/(.+)$/);
  return m ? path.join(BASE, 'github-data', m[1]) : null;
}
global.wx = {
  getStorageSync: (k) => (k in store ? store[k] : ''),
  setStorageSync: (k, v) => { store[k] = v; },
  request(opt) {
    if (OFFLINE) return setTimeout(() => opt.fail(new Error('offline')), 0);
    if (BLOCK_RAW && opt.url.indexOf('raw.githubusercontent.com') !== -1) {
      return setTimeout(() => opt.fail(new Error('raw blocked')), 0);
    }
    const f = fileFor(opt.url);
    if (!f || !fs.existsSync(f)) return setTimeout(() => opt.fail(new Error('404')), 0);
    const txt = fs.readFileSync(f, 'utf8'); // 模拟 raw/jsDelivr 返回 text/plain 字符串
    setTimeout(() => opt.success({ statusCode: 200, data: txt }), 0);
  }
};
const remote = require(path.join(BASE, 'miniprogram/utils/remote.js'));

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  ✅', name); } else { fail++; console.log('  ❌', name); } }

(async () => {
  console.log('场景1：首次拉取 quiz');
  let r = await remote.fetchRemote('quiz');
  ok('数据 5690 题', r.data && r.data.length === 5690);
  ok('updated=true', r.updated === true);
  ok('offline=false', r.offline === false);
  ok('分片已写缓存', Array.isArray(store['remote_quiz_0']) && store['remote_quiz_0'].length === 1500);

  console.log('场景2：版本相同再拉 → 走缓存');
  r = await remote.fetchRemote('quiz');
  ok('cached=true', r.cached === true);
  ok('updated=false', r.updated === false);
  ok('数据一致', r.data.length === 5690);

  console.log('场景3：离线 + 有缓存 → 回退缓存');
  OFFLINE = true;
  r = await remote.fetchRemote('quiz');
  ok('offline=true & 回退缓存', r.offline === true && r.cached === true && r.data.length === 5690);

  console.log('场景4：离线 + 无缓存 → 返回 null');
  Object.keys(store).forEach((k) => { if (k.indexOf('remote_quiz') === 0 || k === 'remote_meta_quiz') delete store[k]; });
  r = await remote.fetchRemote('quiz');
  ok('data=null', r.data === null);
  ok('offline=true & cached=false', r.offline === true && r.cached === false);

  console.log('场景5：word 首次拉取 + 分片');
  OFFLINE = false;
  r = await remote.fetchRemote('word');
  ok('数据 4009 词', r.data && r.data.length === 4009);
  ok('分片数=3', Array.isArray(store['remote_word_0']) && Array.isArray(store['remote_word_2']));

  console.log('场景6：主源 raw 被墙 → 回退 jsDelivr 镜像');
  // 清掉 quiz 缓存，强制走网络；BLOCK_RAW 让 raw 全部失败，应自动回退镜像成功
  Object.keys(store).forEach((k) => { if (k.indexOf('remote_quiz') === 0 || k === 'remote_meta_quiz') delete store[k]; });
  BLOCK_RAW = true;
  r = await remote.fetchRemote('quiz');
  ok('镜像回退取到 5690 题', r.data && r.data.length === 5690);
  ok('updated=true(走网络非缓存)', r.updated === true);
  ok('offline=false', r.offline === false);
  BLOCK_RAW = false;

  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
})();
