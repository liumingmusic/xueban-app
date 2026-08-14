// 统一空 / 错误 / 加载态组件
// 纯 CSS 变量驱动，自动适配暗色（.app-root.dark 覆盖变量即可）
Component({
  properties: {
    type: { type: String, value: 'empty' },     // empty | error | loading
    icon: { type: String, value: '' },           // emoji；不传则用默认
    title: { type: String, value: '' },
    sub: { type: String, value: '' },
    showRetry: { type: Boolean, value: false },
    retryText: { type: String, value: '重试' }
  },
  methods: {
    onRetry() { this.triggerEvent('retry'); }
  }
});
