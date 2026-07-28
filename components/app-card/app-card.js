// 通用应用卡片：读 apps.json 条目渲染，按 status 决定点击行为
Component({
  properties: {
    app: { type: Object, value: {} }
  },
  methods: {
    onTap() {
      const app = this.data.app;
      if (app.status === 'online') {
        wx.navigateTo({ url: app.entry });
      } else if (app.status === 'placeholder') {
        wx.navigateTo({ url: app.entry }); // 进入「敬请期待」占位页
      } else if (app.status === 'web') {
        wx.setClipboardData({
          data: app.entry,
          success() {
            wx.showModal({
              title: app.name + ' · 网页版',
              content: '链接已复制，请在浏览器中粘贴打开：\n' + app.entry,
              showCancel: false,
              confirmText: '好的'
            });
          }
        });
      }
    }
  }
});
