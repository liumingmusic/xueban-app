// 发现：应用广场，读 apps.json 按 category 分组渲染
// 新增模块 = apps.json 加一条 + 建分包，这里自动出现，tab 永远 5 个
const APPS = require('../../data/apps.js');

Page({
  data: { groups: [] },

  onLoad() {
    const order = [];
    const map = {};
    APPS.forEach(a => {
      if (!map[a.category]) { map[a.category] = []; order.push(a.category); }
      map[a.category].push(a);
    });
    this.setData({ groups: order.map(c => ({ category: c, apps: map[c] })) });
  }
});
