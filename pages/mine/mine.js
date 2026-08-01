// 我：档案概览 / 数据导出导入 / 网页版跳转
const store = require('../../utils/store');
const APPS = require('../../data/apps.js');

Page({
  data: {
    summary: {},
    webApps: []
  },

  onShow() {
    const p = store.getProfile();
    this.setData({
      summary: {
        createdAt: p.createdAt,
        mastered: (p.mastered.idiom || []).length + (p.mastered.word || []).length + (p.mastered.poem || []).length,
        wrong: (p.wrongBank.quiz || []).length + (p.wrongBank.english || []).length,
        streak: (p.streaks.app && p.streaks.app.count) || 0
      },
      webApps: APPS.filter(a => a.status === 'web')
    });
  },

  // 导出：写入本地文件 + 复制到剪贴板
  exportData() {
    const json = store.exportJson();
    const fsm = wx.getFileSystemManager();
    const path = wx.env.USER_DATA_PATH + '/learner_profile_backup.json';
    try {
      fsm.writeFileSync(path, json, 'utf8');
    } catch (e) { /* 文件写入失败不影响剪贴板导出 */ }
    wx.setClipboardData({
      data: json,
      success() {
        wx.showModal({
          title: '已导出',
          content: '学习档案 JSON 已复制到剪贴板，可粘贴到备忘录等处保存。',
          showCancel: false
        });
      }
    });
  },

  // 导入：从剪贴板读取 JSON
  importData() {
    wx.getClipboardData({
      success(res) {
        wx.showModal({
          title: '导入档案',
          content: '将用剪贴板中的 JSON 覆盖当前档案，确定继续？',
          success(m) {
            if (!m.confirm) return;
            try {
              store.importJson(res.data);
              wx.showToast({ title: '导入成功', icon: 'success' });
            } catch (e) {
              wx.showToast({ title: '剪贴板不是有效档案', icon: 'none' });
            }
          }
        });
      }
    });
  },

  resetData() {
    wx.showModal({
      title: '清空档案',
      content: '将清空已学记录、错题本与连续天数，此操作不可恢复。',
      confirmColor: '#e64340',
      success(m) {
        if (m.confirm) {
          store.reset();
          wx.showToast({ title: '已重置', icon: 'success' });
        }
      }
    });
  },

  copyWeb(e) {
    const url = e.currentTarget.dataset.url;
    const name = e.currentTarget.dataset.name;
    wx.setClipboardData({
      data: url,
      success() {
        wx.showModal({
          title: name + ' · 网页版',
          content: '链接已复制，请在浏览器中粘贴打开：\n' + url,
          showCancel: false,
          confirmText: '好的'
        });
      }
    });
  },

  onShareAppMessage() {
    const p = store.getProfile();
    const idiomN = (p.mastered.idiom || []).length;
    const wordN = (p.mastered.word || []).length;
    const poemN = (p.mastered.poem || []).length;
    return {
      title: `我的学习足迹 · 雪伴：已学 ${idiomN} 个成语 / ${wordN} 个单词 / ${poemN} 首诗词`,
      path: '/pages/mine/mine',
      imageUrl: '/assets/branding/share-card.jpg'
    };
  }
});
