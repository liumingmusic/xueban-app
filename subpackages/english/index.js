// 英语卡片：每日一词 + 全量词库浏览（搜索/词书筛选/收藏/生词本/发音）
//          + 百词斩式背诵流（看词选义/看义选词/听音选义/拼写 · 每日计划 · 斩掉/跳过 · 词书掌握度）
// API 域名 api.dictionaryapi.dev 需在公众平台配置 request 合法域名
const dateUtil = require('../../utils/date');
const theme = require('../../utils/theme');
const store = require('../../utils/store');
const request = require('../../utils/request');
const remote = require('../../utils/remote');
const shareCard = require('../../utils/shareCard');
const analytics = require('../../utils/analytics');

const LEVELS = ['全部', 'PRIMARY', 'JUNIOR', 'SENIOR', 'CET4', 'CET6', 'KAOYAN', 'IELTS'];
const LEVEL_LABELS = ['全部', '小学', '初中', '高中', '四级', '六级', '考研', '雅思'];
const GOALS = [10, 20, 30, 50];
const MODES = ['wordToCn', 'cnToWord', 'audioToCn', 'spell'];
const MODE_LABELS = { wordToCn: '看词选义', cnToWord: '看义选词', audioToCn: '听音选义', spell: '拼写' };

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 把音频路径解析为可播放的远程地址：相对路径（data/audio/xxx.mp3）走数据 CDN 镜像，与远程词库同源
function audioFull(p) {
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  return remote.MIRROR + '/' + p;
}

Page({
  data: {
    view: 'detail', tab: 'today',
    word: null, known: false, inWrong: false, favorited: false,
    audioUrl: '', reviewList: [], showReview: false,
    isToday: true, fromList: false,
    query: '', levels: LEVEL_LABELS, levelIdx: 0, list: [],
    // ---- 背诵流 ----
    studyPhase: 'setup',   // setup | quiz | done
    bookIdx: 0,            // 词书（对应 LEVELS）
    goals: GOALS,
    goalIdx: 1,            // 默认 20
    dailyDone: 0,
    bookTotal: 0,
    bookMastered: 0,
    bookPct: 0,
    sq: null,              // 当前背诵题 { mode, modeLabel, w, options, answer, picked, answered, correct }
    spellInput: '',
    sessionCount: 0,
    remoteState: 'loading',
    wordCount: 0
  },

  onLoad(options) {
    this.loadWords(options);
    analytics.track('content_view', { module: 'word', id: (options && options.id) || 'daily' });
    if (options && options.ref === 'share') {
      wx.showToast({ title: (store.getProfile().guided ? '好友分享 · 欢迎回来' : '欢迎通过分享加入学伴小筑 🌿'), icon: 'none' });
    }
  },

  async loadWords(options) {
    this.setData({ remoteState: 'loading' });
    const r = await remote.fetchRemote('word');
    if (r.data && r.data.length) {
      this.words = r.data;
      this.setData({ wordCount: r.data.length, remoteState: r.offline ? 'offline' : 'ready' });
      if (options && options.id) {
        const w = this.words.find(x => x.word === options.id);
        if (w) { this.show(w, false); this.loadReview(); return; }
      }
      if (options && options.tab === 'review') this.setData({ showReview: true });
      this.show(this.words[dateUtil.dailyIndex(this.words.length, 'word')], false);
      this.loadReview();
      if (options && options.tab === 'study') this.switchTab({ currentTarget: { dataset: { t: 'study' } } });
    } else {
      this.setData({ remoteState: 'empty' });
    }
  },

  onUnload() { if (this._audio) { this._audio.destroy(); this._audio = null; } },

  loadReview() {
    const p = store.getProfile();
    this.setData({ reviewList: (p.wrongBank.english || []).slice(0, 30) });
  },

  refreshMarks() {
    const w = this.data.word; if (!w) return;
    const id = w.word;
    const p = store.getProfile();
    this.setData({
      known: (p.mastered.word || []).indexOf(id) > -1,
      inWrong: (p.wrongBank.english || []).some(x => x.id === id),
      favorited: store.isFavorite('word', id)
    });
  },

  show(word, fromList) {
    const id = word.word;
    const p = store.getProfile();
    this.setData({
      word, fromList: !!fromList,
      known: (p.mastered.word || []).indexOf(id) > -1,
      inWrong: (p.wrongBank.english || []).some(w => w.id === id),
      favorited: store.isFavorite('word', id),
      audioUrl: audioFull(word.audio), view: 'detail'
    });
    // 仅当词库未内置音频时，才运行时向 dictionaryapi.dev 取音（已带本地音频则不再请求，避免限流）
    if (!word.audio) this.fetchAudio(id);
    shareCard.prepareCard(this, { title: word.word, subtitle: word.cn, tag: '英语', color: '#7c5cff' });
  },

  async fetchAudio(w) {
    try {
      const data = await request.get('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(w), { timeout: 6000 });
      if (this.data.word.word !== w) return;
      const phon = (data[0] && data[0].phonetics) || [];
      const hit = phon.find(x => x.audio);
      if (hit && hit.audio) this.setData({ audioUrl: hit.audio });
    } catch (e) { /* 离线降级 */ }
  },

  play() {
    const url = this.data.audioUrl;
    if (!url) { wx.showToast({ title: '当前离线，暂无真人发音', icon: 'none' }); return; }
    if (!this._audio) this._audio = wx.createInnerAudioContext();
    this._audio.src = url; this._audio.play();
  },

  markKnown() {
    const w = this.data.word;
    store.markMastered('word', w.word, w.word);
    store.removeWrong('english', w.word);
    store.moduleCheckin('english');
    this.setData({ known: true, inWrong: false });
    this.loadReview();
    wx.showToast({ title: '认识 +1', icon: 'success' });
  },

  markUnknown() {
    const w = this.data.word;
    store.addWrong('english', { id: w.word, word: w.word, cn: w.cn, phonetic: w.phonetic });
    store.addReview({ module: 'word', id: w.word, label: w.word });
    this.setData({ inWrong: true });
    this.loadReview();
    wx.showToast({ title: '已加入生词本', icon: 'none' });
  },

  toggleFavorite() {
    const w = this.data.word;
    const now = store.toggleFavorite('word', w.word, { title: w.word, sub: w.cn, color: '#7c5cff' });
    this.setData({ favorited: now });
    wx.showToast({ title: now ? '已收藏' : '已取消收藏', icon: now ? 'success' : 'none' });
  },

  random() { this.setData({ isToday: false }); this.show(this.words[Math.floor(Math.random() * this.words.length)], true); },
  backToday() { this.setData({ isToday: true }); this.show(this.words[dateUtil.dailyIndex(this.words.length, 'word')], false); },

  switchTab(e) {
    const t = e.currentTarget.dataset.t;
    if (t === 'study') {
      this.setData({ tab: t, view: 'study' });
      this.initStudy();
      return;
    }
    this.setData({ tab: t, view: 'list' });
    if (t === 'library') this.applyFilter();
  },
  backToList() { this.setData({ view: 'list' }); },

  onSearch(e) { this.setData({ query: e.detail.value }); this.applyFilter(); },
  pickLevel(e) { this.setData({ levelIdx: +e.currentTarget.dataset.i }); this.applyFilter(); },

  applyFilter() {
    const q = (this.data.query || '').trim().toLowerCase();
    const lv = LEVELS[this.data.levelIdx];
    const list = this.words.filter(w => {
      if (lv !== '全部' && w.level !== lv) return false;
      if (q) {
        const hay = (w.word + ' ' + (w.cn || '') + ' ' + (w.en || '')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    this.setData({ list });
  },

  openWord(e) {
    const w = this.words.find(x => x.word === e.currentTarget.dataset.id);
    if (w) this.show(w, true);
  },
  // 同义词/反义词标签点击：跳到该词卡片（词库有则跳，无则提示）
  tapWord(e) {
    const target = e.currentTarget.dataset.word;
    const w = this.words && this.words.find(x => x.word === target);
    if (w) { this.setData({ isToday: false }); this.show(w, true); }
    else wx.showToast({ title: '词库暂无「' + target + '」', icon: 'none' });
  },
  tapReview(e) {
    const id = e.currentTarget.dataset.id;
    const w = this.words.find(x => x.word === id);
    if (w) { this.setData({ isToday: false, showReview: false }); this.show(w, true); }
  },
  removeReview(e) {
    const id = e.currentTarget.dataset.id;
    store.removeWrong('english', id);
    this.loadReview();
  },
  toggleReview() { this.setData({ showReview: !this.data.showReview }); },

  /* ================= 背诵流 ================= */
  initStudy() {
    const es = store.getEnglishState();
    let bookIdx = LEVELS.indexOf(es.book);
    if (bookIdx < 0) bookIdx = 0;
    let goalIdx = GOALS.indexOf(es.dailyGoal);
    if (goalIdx < 0) goalIdx = 1;
    this.setData({ studyPhase: 'setup', bookIdx, goalIdx, dailyDone: es.dailyDone, spellInput: '' });
    this.refreshBookStats(bookIdx);
  },

  refreshBookStats(bookIdx) {
    const lv = LEVELS[bookIdx];
    const p = store.getProfile();
    const masteredSet = {};
    (p.mastered.word || []).forEach(w => { masteredSet[w] = 1; });
    const inBook = lv === '全部' ? this.words : this.words.filter(w => w.level === lv);
    const mastered = inBook.filter(w => masteredSet[w.word]).length;
    this.setData({
      bookTotal: inBook.length,
      bookMastered: mastered,
      bookPct: inBook.length ? Math.round(mastered / inBook.length * 100) : 0
    });
  },

  pickBook(e) {
    const i = +e.currentTarget.dataset.i;
    store.updateEnglishState({ book: LEVELS[i] });
    this.setData({ bookIdx: i });
    this.refreshBookStats(i);
  },

  pickGoal(e) {
    const i = +e.currentTarget.dataset.i;
    store.updateEnglishState({ dailyGoal: GOALS[i] });
    this.setData({ goalIdx: i });
  },

  startStudy() {
    const es = store.getEnglishState();
    if (es.dailyDone >= GOALS[this.data.goalIdx]) {
      this.setData({ studyPhase: 'done', dailyDone: es.dailyDone });
      return;
    }
    // 队列：本书中未掌握的词，优先没背过的
    const lv = LEVELS[this.data.bookIdx];
    const p = store.getProfile();
    const masteredSet = {};
    (p.mastered.word || []).forEach(w => { masteredSet[w] = 1; });
    const studiedSet = {};
    (es.studied || []).forEach(w => { studiedSet[w] = 1; });
    const inBook = (lv === '全部' ? this.words : this.words.filter(w => w.level === lv)).filter(w => !masteredSet[w.word]);
    if (!inBook.length) {
      wx.showToast({ title: '这本词书已全部斩掉！', icon: 'none' });
      return;
    }
    const fresh = inBook.filter(w => !studiedSet[w.word]);
    const old = inBook.filter(w => studiedSet[w.word]);
    this._studyQueue = shuffle(fresh).concat(shuffle(old));
    this._bookWords = lv === '全部' ? this.words : this.words.filter(w => w.level === lv);
    this.setData({ studyPhase: 'quiz', sessionCount: 0 });
    this.nextStudyWord();
  },

  nextStudyWord() {
    const es = store.getEnglishState();
    if (es.dailyDone >= GOALS[this.data.goalIdx]) {
      this.setData({ studyPhase: 'done', dailyDone: es.dailyDone });
      wx.showToast({ title: '今日计划完成 🎉', icon: 'none' });
      return;
    }
    if (!this._studyQueue || !this._studyQueue.length) {
      this.setData({ studyPhase: 'done', dailyDone: es.dailyDone });
      return;
    }
    const w = this._studyQueue.shift();
    // 挑题型：无音频不出听音题；单词太长/含空格不出拼写题
    let modes = MODES.slice();
    if (!w.audio) modes = modes.filter(m => m !== 'audioToCn');
    if (w.word.length > 12 || w.word.indexOf(' ') > -1) modes = modes.filter(m => m !== 'spell');
    const mode = modes[Math.floor(Math.random() * modes.length)];

    let options = [], answer = -1;
    if (mode === 'cnToWord') {
      const opts = shuffle(this._bookWords.filter(x => x.word !== w.word)).slice(0, 3).map(x => x.word);
      options = shuffle(opts.concat(w.word));
      answer = options.indexOf(w.word);
    } else if (mode !== 'spell') {
      const opts = shuffle(this._bookWords.filter(x => x.word !== w.word && x.cn)).slice(0, 3).map(x => x.cn);
      options = shuffle(opts.concat(w.cn));
      answer = options.indexOf(w.cn);
    }
    this.setData({
      sq: {
        mode, modeLabel: MODE_LABELS[mode], w,
        options, answer, picked: -1, answered: false, correct: false
      },
      spellInput: '',
      dailyDone: es.dailyDone
    });
    if (mode === 'audioToCn') this.playStudy();
  },

  playStudy() {
    const sq = this.data.sq;
    if (!sq || !sq.w.audio) { wx.showToast({ title: '离线暂无音频', icon: 'none' }); return; }
    if (!this._audio) this._audio = wx.createInnerAudioContext();
    this._audio.src = audioFull(sq.w.audio); this._audio.play();
  },

  pickStudy(e) {
    const sq = this.data.sq;
    if (!sq || sq.answered || sq.mode === 'spell') return;
    const i = +e.currentTarget.dataset.i;
    this.judgeStudy(i === sq.answer, i);
  },

  onSpellInput(e) { this.setData({ spellInput: e.detail.value }); },

  submitSpell() {
    const sq = this.data.sq;
    if (!sq || sq.answered) return;
    const ok = (this.data.spellInput || '').trim().toLowerCase() === sq.w.word.toLowerCase();
    this.judgeStudy(ok, -1);
  },

  judgeStudy(correct, picked) {
    const sq = this.data.sq;
    sq.answered = true; sq.correct = correct; sq.picked = picked;
    this.setData({ sq });
    if (correct) {
      const es = store.englishStudied(sq.w.word);
      store.moduleCheckin('english');
      this.setData({ dailyDone: es.dailyDone });
    } else {
      store.addWrong('english', { id: sq.w.word, word: sq.w.word, cn: sq.w.cn, phonetic: sq.w.phonetic });
      this.loadReview();
    }
  },

  studyNext() {
    this.setData({ sessionCount: this.data.sessionCount + 1 });
    this.nextStudyWord();
  },

  // 斩掉：直接标记已掌握，计入今日
  zhanWord() {
    const sq = this.data.sq;
    if (!sq) return;
    store.markMastered('word', sq.w.word, sq.w.word);
    store.removeWrong('english', sq.w.word);
    const es = store.englishStudied(sq.w.word);
    this.setData({ dailyDone: es.dailyDone });
    wx.showToast({ title: '⚔️ 已斩掉', icon: 'none' });
    this.refreshBookStats(this.data.bookIdx);
    this.nextStudyWord();
  },

  // 跳过：不计数换下一词
  skipWord() {
    const sq = this.data.sq;
    if (sq && this._studyQueue) this._studyQueue.push(sq.w); // 回到队尾
    this.nextStudyWord();
  },

  exitStudy() { this.initStudy(); },

  onShareAppMessage() {
    const w = this.data.word;
    return shareCard.buildShare(this, { title: w.word + ' — ' + w.cn, path: '/subpackages/english/index?id=' + w.word });
  },

  onShareTimeline() {
    const w = this.data.word;
    return { title: w.word + ' — ' + w.cn, query: 'id=' + w.word, imageUrl: '/assets/branding/share-card.jpg' };
  },

  onShow() {
    theme.apply(this);
  }});
