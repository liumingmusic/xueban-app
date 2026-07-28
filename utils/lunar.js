// 干支纪年 + 生肖（传统以立春换年，此处以 2 月 4 日为界近似）
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

// 返回 { ganzhi: '丙午', zodiac: '马', label: '丙午马年' }
function ganzhiYear(date) {
  const d = date || new Date();
  let y = d.getFullYear();
  // 立春（约 2 月 4 日）前仍算上一干支年
  const m = d.getMonth() + 1, day = d.getDate();
  if (m < 2 || (m === 2 && day < 4)) y -= 1;
  const idx = ((y - 4) % 60 + 60) % 60;
  const ganzhi = GAN[idx % 10] + ZHI[idx % 12];
  const zodiac = ZODIAC[idx % 12];
  return { ganzhi, zodiac, label: ganzhi + zodiac + '年' };
}

module.exports = { ganzhiYear };
