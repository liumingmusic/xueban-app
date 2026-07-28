// 知识关联网「拓展」rail：根据当前内容 tags 推荐兄弟模块入口
const links = require('../../utils/links');

Component({
  properties: {
    tags: { type: Array, value: [] },
    exclude: { type: String, value: '' }
  },
  data: { related: [] },
  observers: {
    'tags, exclude'(tags, exclude) {
      this.setData({ related: links.getRelated(tags, exclude) });
    }
  },
  methods: {
    onTapRel(e) {
      const url = e.currentTarget.dataset.url;
      if (url) wx.navigateTo({ url });
    }
  }
});
