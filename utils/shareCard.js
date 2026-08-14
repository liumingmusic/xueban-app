/**
 * 动态分享卡片：用离屏 canvas 生成「专属内容卡片图」（纯前端 / 零后端）。
 * - prepareCard(page, opts)：在 onLoad/onReady 异步生成，存到 page._shareCard
 * - buildShare(page, fallback)：在 onShareAppMessage 里取用，未生成时回落 fallback（静态图）
 * 任何异常都会静默回落，绝不阻塞或崩溃分享流程。
 */
const FALLBACK = '/assets/branding/share-card.jpg';

function wrapText(ctx, text, x, y, maxW, lh, maxLines) {
  if (!text) return;
  const chars = String(text).split('');
  let line = '';
  let lines = 0;
  for (let i = 0; i < chars.length; i++) {
    const test = line + chars[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      y += lh;
      line = chars[i];
      lines++;
      if (lines >= maxLines - 1) {
        let rest = line + chars.slice(i + 1).join('');
        while (rest.length && ctx.measureText(rest + '…').width > maxW) rest = rest.slice(0, -1);
        ctx.fillText(rest + (i < chars.length - 1 ? '…' : ''), x, y);
        return;
      }
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
}

function drawCard(opts) {
  return new Promise((resolve) => {
    try {
      if (!wx.createOffscreenCanvas) { resolve(''); return; }
      const w = 600, h = 480;
      const canvas = wx.createOffscreenCanvas({ type: '2d', width: w, height: h });
      const ctx = canvas.getContext('2d');
      // 背景
      ctx.fillStyle = '#FBF7F0';
      ctx.fillRect(0, 0, w, h);
      // 顶部色带
      const color = opts.color || '#2f8f78';
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, 16);
      // 标签
      ctx.fillStyle = color;
      ctx.font = '30px sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(opts.tag || '学伴小筑', 40, 48);
      // 标题（自动换行，最多 3 行）
      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 46px sans-serif';
      wrapText(ctx, opts.title || '', 40, 120, w - 80, 64, 3);
      // 副标题（最多 2 行）
      if (opts.subtitle) {
        ctx.fillStyle = '#6b7280';
        ctx.font = '28px sans-serif';
        wrapText(ctx, opts.subtitle, 40, 330, w - 80, 40, 2);
      }
      // 底部签名
      ctx.fillStyle = '#9ca3af';
      ctx.font = '24px sans-serif';
      ctx.fillText('—— 学伴小筑', 40, h - 48);
      wx.canvasToTempFilePath({
        canvas,
        success: r => resolve(r.tempFilePath || ''),
        fail: () => resolve('')
      });
    } catch (e) {
      resolve('');
    }
  });
}

function prepareCard(page, opts) {
  drawCard(opts).then(path => { if (path) page._shareCard = path; });
}

function buildShare(page, fallback) {
  const obj = Object.assign({}, fallback);
  if (page._shareCard) obj.imageUrl = page._shareCard;
  else if (!obj.imageUrl) obj.imageUrl = FALLBACK;
  // 统一追加分享来源标记，供回流承接（新用户引导 / 欢迎提示）
  if (obj.path && obj.path.indexOf('ref=share') === -1) {
    obj.path += (obj.path.indexOf('?') > -1 ? '&' : '?') + 'ref=share';
  }
  return obj;
}

module.exports = { drawCard, prepareCard, buildShare, FALLBACK };
