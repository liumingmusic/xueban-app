// utils/tts.js
// 文本转语音（TTS）——零后端方案：依赖微信官方「同声传译」插件（WechatSI.textToSpeech）。
// 该插件由微信提供，无需自建任何服务端，适合纯前端小程序。
//
// 前置（仅需一次，纯平台配置，无后端代码）：
//   1. 登录 mp.weixin.qq.com → 设置 → 第三方设置 → 插件管理 → 添加插件「微信同声传译」。
//   2. 在 app.json 增加（version 以插件市场显示的最新版本为准，常见为 0.3.6）：
//        "plugins": { "WechatSI": { "version": "0.3.6", "provider": "wx069ba97219f66d99" } }
//   配置完成后 speak() 直接生效，业务代码无需改动。
//   若尚未配置，speak() 会优雅降级并提示，不会报错中断当前页面。

const PLUGIN = 'WechatSI';
let _plugin = undefined; // undefined=未探测, null=不可用, 对象=可用
let _audio = null;

function getPlugin() {
  if (_plugin !== undefined) return _plugin;
  try {
    _plugin = requirePlugin(PLUGIN);
  } catch (e) {
    _plugin = null; // 未在 app.json 声明插件，标记不可用，后续不再重试
  }
  return _plugin;
}

function audio() {
  if (!_audio) _audio = wx.createInnerAudioContext();
  return _audio;
}

/**
 * 朗读文本
 * @param {string} text 要朗读的内容
 * @param {object} [opts] { lang:'zh'|'en', onStart, onEnd, onError }
 */
function speak(text, opts) {
  opts = opts || {};
  text = (text == null ? '' : String(text)).trim();
  if (!text) {
    wx.showToast({ title: '没有可朗读的内容', icon: 'none' });
    return;
  }

  const plugin = getPlugin();
  if (!plugin || typeof plugin.textToSpeech !== 'function') {
    wx.showToast({
      title: '朗读需先在公众平台开通「微信同声传译」插件',
      icon: 'none',
      duration: 2600
    });
    if (opts.onError) opts.onError();
    return;
  }

  wx.showLoading({ title: '朗读生成中', mask: false });
  plugin.textToSpeech({
    lang: opts.lang === 'en' ? 'en_US' : 'zh_CN',
    tts: true,
    content: text,
    success(res) {
      wx.hideLoading();
      if (res && res.filename) {
        const a = audio();
        a.stop();
        a.offEnded();
        a.offError();
        a.src = res.filename;
        a.onEnded(() => { if (opts.onEnd) opts.onEnd(); });
        a.onError(() => {
          wx.showToast({ title: '朗读播放失败', icon: 'none' });
          if (opts.onError) opts.onError();
        });
        a.play();
        if (opts.onStart) opts.onStart();
      } else {
        wx.showToast({ title: '暂无可用语音', icon: 'none' });
        if (opts.onError) opts.onError();
      }
    },
    fail() {
      wx.hideLoading();
      wx.showToast({ title: '朗读生成失败，请稍后再试', icon: 'none' });
      if (opts.onError) opts.onError();
    }
  });
}

function stop() {
  if (_audio) _audio.stop();
}

module.exports = { speak, stop };
