#!/usr/bin/env node
/**
 * 工程自检：
 * 1. 所有 json 可解析
 * 2. app.json 页面/分包路径 4 件套齐全，tabBar 图标存在
 * 3. 所有 js 语法检查（node --check）
 * 4. 主包 / 各分包体积（主包 < 2MB，单分包 < 2MB，总量 < 20MB）
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let errors = 0;
const err = m => { console.log('  [FAIL]', m); errors++; };
const ok = m => console.log('  [ ok ]', m);

function walk(dir, fn) {
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, fn);
    else fn(p);
  });
}

/* 1. JSON */
console.log('== JSON 合法性 ==');
let jsonN = 0;
walk(ROOT, p => {
  if (!p.endsWith('.json') || p.includes('/scripts/')) return;
  jsonN++;
  try { JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { err(path.relative(ROOT, p) + ' ' + e.message); }
});
ok(jsonN + ' 个 json 全部可解析' + (errors ? '（有失败见上）' : ''));

/* 2. 页面路径 */
console.log('== app.json 路径 ==');
const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
const checkPage = base => {
  ['js', 'json', 'wxml', 'wxss'].forEach(ext => {
    if (!fs.existsSync(path.join(ROOT, base + '.' + ext))) err(base + '.' + ext + ' 缺失');
  });
};
app.pages.forEach(checkPage);
(app.subpackages || []).forEach(sp => sp.pages.forEach(pg => checkPage(sp.root + '/' + pg)));
app.tabBar.list.forEach(t => {
  if (!fs.existsSync(path.join(ROOT, t.iconPath))) err(t.iconPath + ' 缺失');
  if (!fs.existsSync(path.join(ROOT, t.selectedIconPath))) err(t.selectedIconPath + ' 缺失');
  if (app.pages.indexOf(t.pagePath) === -1) err('tab 页 ' + t.pagePath + ' 不在主包 pages');
});
ok('主包 ' + app.pages.length + ' 页 + ' + app.subpackages.length + ' 个分包 + 10 个 tab 图标');

/* 2.5 组件引用 */
console.log('== 组件引用 ==');
walk(ROOT, p => {
  if (!p.endsWith('.json') || p.includes('/scripts/') || path.basename(p).startsWith('app')) return;
  let j;
  try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return; }
  Object.values(j.usingComponents || {}).forEach(c => {
    const base = c.startsWith('/') ? path.join(ROOT, c.slice(1)) : path.resolve(path.dirname(p), c);
    if (!fs.existsSync(base + '.js')) err(path.relative(ROOT, p) + ' -> ' + c);
  });
});
ok('组件路径检查完成');

/* 3. JS 语法 */
console.log('== JS 语法 ==');
let jsN = 0;
walk(ROOT, p => {
  if (!p.endsWith('.js') || p.includes('/scripts/')) return;
  jsN++;
  try { execSync(process.execPath + ' --check "' + p + '"', { stdio: 'pipe' }); }
  catch (e) { err(path.relative(ROOT, p) + '\n' + e.stderr.toString().slice(0, 300)); }
});
ok(jsN + ' 个 js 语法检查通过' + (errors ? '（有失败见上）' : ''));

/* 4. 体积 */
console.log('== 体积 ==');
function dirSize(dir, excludeSub) {
  let s = 0;
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    if (excludeSub && (f === 'subpackages' || f === 'scripts' || f === '.git')) return;
    if (fs.statSync(p).isDirectory()) s += dirSize(p, false);
    else s += fs.statSync(p).size;
  });
  return s;
}
const MB = 1024 * 1024;
const main = dirSize(ROOT, true);
console.log('  主包:', (main / MB).toFixed(2) + 'MB', main < 2 * MB ? 'OK (<2MB)' : '!! 超限');
if (main >= 2 * MB) errors++;
let total = main;
fs.readdirSync(path.join(ROOT, 'subpackages')).forEach(sp => {
  const s = dirSize(path.join(ROOT, 'subpackages', sp), false);
  total += s;
  const bad = s >= 2 * MB;
  if (bad) errors++;
  console.log('  分包 ' + sp + ':', (s / MB).toFixed(2) + 'MB', bad ? '!! 超限' : 'OK');
});
console.log('  总量:', (total / MB).toFixed(2) + 'MB', total < 20 * MB ? 'OK (<20MB)' : '!! 超限');

console.log(errors ? '\n共 ' + errors + ' 个问题' : '\n全部通过 ✓');
process.exit(errors ? 1 : 0);
