// 知识关联网「拓展」rail：根据当前内容 tags 推荐兄弟模块入口
const links = require('../../utils/links');

Component({
  properties: {
    // 不限定类型，由 observer 统一规整成数组，避免上游传 undefined / 字符串时触发框架类型告警
    tags: { type: null, value: [] },
    exclude: { type: String, value: '' }
  },
  data: { related: [] },
  observers: {
    'tags, exclude'(tags, exclude) {
      const arr = Array.isArray(tags) ? tags : (tags == null ? [] : [tags]);
      this.setData({ related: links.getRelated(arr, exclude) });
    }
  },
  methods: {
    onTapRel(e) {
      const url = e.currentTarget.dataset.url;
      if (url) wx.navigateTo({ url });
    }
  }
});
