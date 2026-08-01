// 主题与字号工具：暗色模式 + 字号三档（0 小 / 1 标准 / 2 大）
// 用法：页面 onShow 中调用 theme.apply(this)；根容器需带 class="app-root {{themeClass}} {{fontClass}}"

const KEY_T = 'xueban_theme';   // 'light' | 'dark'
const KEY_F = 'xueban_font';    // 0 | 1 | 2

function getTheme() { try { return wx.getStorageSync(KEY_T) || 'light'; } catch (e) { return 'light'; } }
function setTheme(t) { try { wx.setStorageSync(KEY_T, t); } catch (e) {} }

// 返回 0/1/2 整数
function getFont() { try { const f = parseInt(wx.getStorageSync(KEY_F), 10); return isNaN(f) ? 1 : f; } catch (e) { return 1; } }
function setFont(f) { try { wx.setStorageSync(KEY_F, f); } catch (e) {} }

function apply(page) {
  const t = getTheme();
  const f = getFont();
  if (page && typeof page.setData === 'function') {
    page.setData({
      themeClass: t === 'dark' ? 'dark' : '',
      fontClass: 'fs' + f
    });
  }
  // 原生导航栏 + 页面底色同步
  try {
    const dark = t === 'dark';
    wx.setBackgroundColor({ backgroundColor: dark ? '#15171c' : '#FBF7F0' });
    wx.setNavigationBarColor({
      frontColor: dark ? '#ffffff' : '#000000',
      backgroundColor: dark ? '#15171c' : '#FBF7F0'
    });
  } catch (e) {}
}

module.exports = { getTheme, setTheme, getFont, setFont, apply };
