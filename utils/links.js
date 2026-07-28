// 知识关联网：tag -> 兄弟模块跳转
const LINKS = require('../data/links.js');
const APPS = require('../data/apps.js');

const APP_MAP = {};
APPS.forEach(a => { APP_MAP[a.id] = a; });

// 每个模块的保底关联（tag 无命中时也能"拓展"）
const DEFAULTS = {
  idiom: [
    { module: 'poetry', label: '每日诗词', params: {} },
    { module: 'quiz', label: '语文闯关', params: { subject: '语文' } }
  ],
  poetry: [
    { module: 'idiom', label: '成语故事', params: {} },
    { module: 'quiz', label: '语文闯关', params: { subject: '语文' } }
  ],
  english: [
    { module: 'quiz', label: '知识闯关', params: {} },
    { module: 'quote', label: '每日一句', params: {} }
  ],
  history: [
    { module: 'quiz', label: '历史闯关', params: { subject: '历史' } },
    { module: 'idiom', label: '历史成语', params: { tag: '历史' } }
  ],
  quiz: [
    { module: 'idiom', label: '成语故事', params: {} },
    { module: 'english', label: '英语卡片', params: {} }
  ],
  quote: [
    { module: 'poetry', label: '每日诗词', params: {} },
    { module: 'idiom', label: '成语故事', params: {} }
  ]
};

function buildQuery(params) {
  const keys = Object.keys(params || {});
  if (!keys.length) return '';
  return '?' + keys.map(k => k + '=' + encodeURIComponent(params[k])).join('&');
}

// tags: 当前内容的标签数组; exclude: 当前所在模块 id（不推荐自己）
function getRelated(tags, exclude) {
  const out = [];
  const seen = {};
  const push = (rel) => {
    if (rel.module === exclude) return;
    const app = APP_MAP[rel.module];
    if (!app || app.status !== 'online') return; // 未上线模块不进关联网
    const key = rel.module + '|' + rel.label;
    if (seen[key]) return;
    seen[key] = true;
    out.push({
      module: rel.module,
      label: rel.label,
      icon: app.icon,
      color: app.color,
      url: app.entry + buildQuery(rel.params)
    });
  };
  (tags || []).forEach(t => (LINKS[t] || []).forEach(push));
  if (out.length < 2 && DEFAULTS[exclude]) DEFAULTS[exclude].forEach(push);
  return out.slice(0, 4);
}

module.exports = { getRelated, buildQuery, APP_MAP };
