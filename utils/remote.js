// 远程数据加载器：从 GitHub 仓库拉取大块内容数据
// 机制：manifest 版本比对 → 拉取分片 JSON → 写 Storage 分片缓存（单 key < 1MB）→ 返回 { data, offline, cached, updated }
// 题库 / 单词 走此通道；诗词/成语/语录仍本地打包（仅源码在 GitHub 维护）。
// 双源容错：主源 raw.githubusercontent.com（官方直读），失败回退 cdn.jsdelivr.net 镜像（国内更稳）。
const REPO = 'liumingmusic/xueban-data';
const BRANCH = 'main';
const BASE = 'https://raw.githubusercontent.com/' + REPO + '/' + BRANCH;           // 主源（向后兼容导出）
const MIRROR = 'https://cdn.jsdelivr.net/gh/' + REPO + '@' + BRANCH;               // 回退源（jsDelivr CDN 镜像）
const BASES = [BASE, MIRROR];

const CACHE_PREFIX = 'remote_';
const META_PREFIX = 'remote_meta_';
const VERSION_KEY = 'remote_versions';

function getVersions() {
  try { return wx.getStorageSync(VERSION_KEY) || {}; } catch (e) { return {}; }
}
function setVersion(mod, v) {
  const vs = getVersions();
  vs[mod] = v;
  try { wx.setStorageSync(VERSION_KEY, vs); } catch (e) {}
}
function readCache(mod, fileCount) {
  const shards = [];
  for (let i = 0; i < fileCount; i++) {
    const s = wx.getStorageSync(CACHE_PREFIX + mod + '_' + i);
    if (s === '' || s === undefined || s === null) return null;
    shards.push(s);
  }
  return [].concat.apply([], shards);
}
function req(url, timeout) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: url,
      timeout: timeout || 15000,
      success: (r) => {
        if (r.statusCode !== 200) return reject(new Error('http' + r.statusCode));
        let d = r.data;
        // raw.githubusercontent.com 返回 text/plain，需手动解析
        if (typeof d === 'string') {
          try { d = JSON.parse(d); } catch (e) { return reject(e); }
        }
        resolve(d);
      },
      fail: reject
    });
  });
}
// 双源容错：依次尝试 BASES，首个成功即返回；全部失败才 reject
async function reqAny(path, timeout) {
  let lastErr;
  for (let i = 0; i < BASES.length; i++) {
    try { return await req(BASES[i] + path, timeout); }
    catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('all sources failed: ' + path);
}

/**
 * 拉取某模块远程数据
 * @param {string} mod 模块名（manifest.modules 的 key）
 * @returns {Promise<{data:Array|null, offline:boolean, cached:boolean, updated:boolean}>}
 */
async function fetchRemote(mod) {
  const cachedMeta = wx.getStorageSync(META_PREFIX + mod) || null;
  try {
    const manifest = await reqAny('/manifest.json', 8000);
    const m = manifest && manifest.modules && manifest.modules[mod];
    if (!m || !m.files || !m.files.length) throw new Error('no module ' + mod);

    // 缓存命中且版本最新 → 直接读缓存
    if (cachedMeta && cachedMeta.version >= m.version && cachedMeta.files === m.files.length) {
      const data = readCache(mod, m.files.length);
      if (data) return { data: data, offline: false, cached: true, updated: false };
    }

    // 拉取所有分片（远程已切片，单文件 < 1MB）
    const parts = [];
    for (const f of m.files) parts.push(await reqAny('/' + f, 15000));
    const data = [].concat.apply([], parts);

    // 写缓存
    parts.forEach((p, i) => {
      try { wx.setStorageSync(CACHE_PREFIX + mod + '_' + i, p); } catch (e) {}
    });
    try { wx.setStorageSync(META_PREFIX + mod, { version: m.version, files: m.files.length }); } catch (e) {}
    setVersion(mod, m.version);

    return { data: data, offline: false, cached: false, updated: true };
  } catch (e) {
    // 网络失败 / 离线 → 回退到已缓存
    if (cachedMeta) {
      const data = readCache(mod, cachedMeta.files);
      if (data) return { data: data, offline: true, cached: true, updated: false };
    }
    return { data: null, offline: true, cached: false, updated: false };
  }
}

module.exports = { fetchRemote, BASE, MIRROR, BASES, REPO, BRANCH };
