#!/usr/bin/env node
/**
 * 生成 tabBar 图标（81x81 PNG，普通态淡墨 / 选中态青瓷绿）
 * 纯 Node 实现 PNG 编码（zlib + CRC32），不依赖第三方库
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const S = 81; // 输出尺寸
const OUT = path.join(__dirname, '../assets/tab');
fs.mkdirSync(OUT, { recursive: true });

/* ---------- PNG 编码 ---------- */
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(rgba, w, h) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- 形状定义（返回 0~1 覆盖率，坐标 0..1） ---------- */
const dist = (x, y, a, b) => Math.hypot(x - a, y - b);
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
const W = 0.075; // 线宽

const shapes = {
  // 中枢：同心圆 + 中点（枢纽）
  hub(x, y) {
    const d = dist(x, y, 0.5, 0.5);
    return (Math.abs(d - 0.30) < W) || d < 0.10 ||
      segDist(x, y, 0.5, 0.5, 0.5, 0.14) < W * 0.7 ||
      segDist(x, y, 0.5, 0.5, 0.86, 0.5) < W * 0.7;
  },
  // 发现：2x2 圆角方格
  cover(x, y) {
    const cells = [[0.29, 0.29], [0.71, 0.29], [0.29, 0.71], [0.71, 0.71]];
    return cells.some(([cx, cy]) => Math.max(Math.abs(x - cx), Math.abs(y - cy)) < 0.155 && dist(x, y, cx, cy) < 0.21);
  },
  // 习惯：圆环 + 对勾
  habit(x, y) {
    const d = dist(x, y, 0.5, 0.5);
    if (Math.abs(d - 0.36) < W * 0.8) return true;
    return segDist(x, y, 0.32, 0.52, 0.45, 0.65) < W || segDist(x, y, 0.45, 0.65, 0.70, 0.36) < W;
  },
  // 数据：三根柱
  stats(x, y) {
    const bars = [[0.24, 0.45], [0.5, 0.25], [0.76, 0.58]];
    return bars.some(([bx, top]) => Math.abs(x - bx) < 0.075 && y > top && y < 0.80) ||
      (y > 0.80 && y < 0.84 && x > 0.14 && x < 0.86);
  },
  // 我：人形
  mine(x, y) {
    if (dist(x, y, 0.5, 0.32) < 0.15) return true;
    const d = dist(x, y, 0.5, 0.95);
    return d < 0.42 && y > 0.56 && y < 0.82;
  }
};

/* ---------- 渲染（4x 超采样抗锯齿） ---------- */
function render(shapeFn, color) {
  const [r, g, b] = color;
  const buf = Buffer.alloc(S * S * 4);
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      let cov = 0;
      for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
        const x = (px + (sx + 0.5) / 2) / S, y = (py + (sy + 0.5) / 2) / S;
        if (shapeFn(x, y)) cov++;
      }
      const a = Math.round((cov / 4) * 255);
      const i = (py * S + px) * 4;
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
    }
  }
  return encodePNG(buf, S, S);
}

const GRAY = [138, 129, 117];   // #8A8175
const GREEN = [47, 143, 120];   // #2f8f78

Object.keys(shapes).forEach(name => {
  fs.writeFileSync(path.join(OUT, name + '.png'), render(shapes[name], GRAY));
  fs.writeFileSync(path.join(OUT, name + '-on.png'), render(shapes[name], GREEN));
  console.log('icon:', name, '+ selected');
});
console.log('DONE');
