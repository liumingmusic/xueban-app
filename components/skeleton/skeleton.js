// 骨架屏组件：轻量、零依赖，可全局复用。
// 用法：<skeleton show="{{loading}}" variant="list" rows="6" />
//   variant: text | card | list
//   rows:    微光占位条数量（默认 3，范围 1~12）
//   circle:  是否在卡片变体左侧显示圆形头像占位（默认随 variant=card 自动开启）
Component({
  properties: {
    show: { type: Boolean, value: true },
    rows: { type: Number, value: 3 },
    variant: { type: String, value: 'text' }, // text | card | list
    circle: { type: Boolean, value: false }
  },
  data: { bars: [] },
  lifetimes: {
    attached() { this._build(); }
  },
  observers: {
    'rows': function () { this._build(); }
  },
  methods: {
    _build() {
      const n = Math.max(1, Math.min(12, this.data.rows || 3));
      const arr = [];
      for (let i = 0; i < n; i++) arr.push(i);
      this.setData({ bars: arr });
    }
  }
});
