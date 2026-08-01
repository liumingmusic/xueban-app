// 知识闯关：内置 K12 全量题库（与网页版一致，共 5690 题，含单选/判断/多选/填空四种题型，分两片存放）
//   bank.js 在本分包；bank2.js 在主包 data/（主包对分包可见）
// 进阶：积分/等级/连胜、题库总览（难度占比+学科钻取）、错题重练（你的答案回显）、
//       休息卡护眼、OpenTDB 英文拓展、清空进度
const store = require('../../utils/store');
const theme = require('../../utils/theme');
const request = require('../../utils/request');
const remote = require('../../utils/remote');

const STAGES = ['全部', '小学', '初中', '高中'];
const ROUND = 10; // 每轮题数
const WRONG_IN_ROUND = 3; // 每轮回流错题上限
const DIFF_POINTS = { 1: 5, 2: 10, 3: 15 }; // 按难度积分

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function norm(s) {
  return (s || '').trim().replace(/\s+/g, '').replace(/[，。、？！,.!?；;：:""''（）()]/g, '');
}

function answerText(q) {
  if (q.type === 'blank') return (q.answers || []).join(' / ');
  if (q.type === 'multiple') return q.answer.map(x => q.options[x]).join('、');
  return q.options[q.answer];
}

const LETTER = ['A', 'B', 'C', 'D', 'E', 'F'];
function yourText(q, pickedVal, userInput) {
  if (q.type === 'blank') return userInput || '（未填写）';
  if (q.type === 'multiple') {
    const arr = Array.isArray(pickedVal) ? pickedVal : [];
    return arr.length ? arr.slice().sort((a, b) => a - b).map(x => q.options[x]).join('、') : '（未选择）';
  }
  return pickedVal > -1 ? q.options[pickedVal] : '（未选择）';
}

Page({
  data: {
    phase: 'setup', // setup | quiz | rest | result | overview
    stages: STAGES,
    stageIdx: 0,
    subjects: ['全部'],
    subjectIdx: 0,
    wrongCount: 0,
    // 积分 / 等级 / 连胜
    points: 0,
    level: '启蒙',
    streak: 0,
    restEnabled: true,
    // 题库总览
    overview: null, // { total, diffs:[{d,label,count,pct}], subjects:[{name,count,d1,d2,d3,p1,p2,p3}] }
    // quiz phase
    queue: [],
    cur: null,
    curIdx: 0,
    total: 0,
    picked: -1,      // single/tf: 选中下标; multiple: 选中下标数组; blank: 忽略
    userInput: '',   // blank 填空内容
    multi: false,    // 当前题是否多选
    blank: false,    // 当前题是否填空
    answered: false, // 是否已判分/展示讲解
    correct: false,
    yourAnswer: '',  // 答错时回显你的答案
    score: 0,
    roundPoints: 0,  // 本轮获得积分
    fromWrongBank: false,
    isEnglishRound: false, // OpenTDB 英文拓展轮
    loadingEn: false,
    // 休息卡
    restSeconds: 0,
    remoteState: 'loading',
    bankCount: 0
  },

  onLoad(options) {
    this.refreshState();
    this.loadBank(options);
  },

  loadBank(options) {
    this.setData({ remoteState: 'loading' });
    remote.fetchRemote('quiz').then((r) => {
      if (r.data && r.data.length) {
        this.bank = r.data;
        this.setData({ bankCount: r.data.length, remoteState: r.offline ? 'offline' : 'ready' });
        this.refreshSubjects(0);
        if (options && options.subject) {
          const subs = this.data.subjects;
          const i = subs.indexOf(options.subject);
          if (i > -1) this.setData({ subjectIdx: i });
        }
        if (options && options.mode === 'wrong' && this.data.wrongCount > 0) {
          this.startWrongOnly();
        }
      } else {
        this.setData({ remoteState: 'empty' });
      }
    });
  },

  onUnload() { this.clearRestTimer(); },

  refreshState() {
    const p = store.getProfile();
    const qs = store.getQuizState();
    this.setData({
      wrongCount: (p.wrongBank.quiz || []).length,
      points: qs.points,
      level: store.quizLevel(qs.points),
      streak: qs.streak,
      restEnabled: qs.settings.restEnabled !== false
    });
  },

  refreshSubjects(stageIdx) {
    const stage = STAGES[stageIdx];
    const set = {};
    this.bank.forEach(q => {
      if (stage === '全部' || q.stage === stage) set[q.subject] = 1;
    });
    this.setData({
      subjects: ['全部'].concat(Object.keys(set).sort()),
      subjectIdx: 0
    });
  },

  pickStage(e) {
    const i = +e.currentTarget.dataset.i;
    this.setData({ stageIdx: i });
    this.refreshSubjects(i);
  },

  pickSubject(e) {
    this.setData({ subjectIdx: +e.currentTarget.dataset.i });
  },

  toggleRest() {
    const on = !this.data.restEnabled;
    store.quizUpdateSettings({ restEnabled: on });
    this.setData({ restEnabled: on });
  },

  /* ---------- 题库总览（难度占比 + 学科钻取） ---------- */
  openOverview() {
    if (!this.data.overview) {
      const diffCnt = { 1: 0, 2: 0, 3: 0 };
      const subMap = {};
      this.bank.forEach(q => {
        const d = q.difficulty || 2;
        diffCnt[d] = (diffCnt[d] || 0) + 1;
        if (!subMap[q.subject]) subMap[q.subject] = { name: q.subject, count: 0, d1: 0, d2: 0, d3: 0 };
        subMap[q.subject].count += 1;
        subMap[q.subject]['d' + d] += 1;
      });
      const total = this.bank.length;
      const labels = { 1: '基础', 2: '进阶', 3: '挑战' };
      const diffs = [1, 2, 3].map(d => ({
        d, label: labels[d], count: diffCnt[d],
        pct: Math.round(diffCnt[d] / total * 100)
      }));
      const subjects = Object.keys(subMap).sort().map(k => {
        const s = subMap[k];
        return Object.assign({}, s, {
          p1: Math.round(s.d1 / s.count * 100),
          p2: Math.round(s.d2 / s.count * 100),
          p3: Math.round(s.d3 / s.count * 100)
        });
      });
      this.setData({ overview: { total, diffs, subjects } });
    }
    this.setData({ phase: 'overview' });
  },

  closeOverview() { this.setData({ phase: 'setup' }); },

  // 总览钻取：点学科直接开一轮该学科
  drillSubject(e) {
    const name = e.currentTarget.dataset.name;
    this.setData({ stageIdx: 0 });
    this.refreshSubjects(0);
    const i = this.data.subjects.indexOf(name);
    this.setData({ subjectIdx: i > -1 ? i : 0, phase: 'setup' });
    this.start();
  },

  /* ---------- 开始一轮 ---------- */
  start() {
    const stage = STAGES[this.data.stageIdx];
    const subject = this.data.subjects[this.data.subjectIdx];
    const p = store.getProfile();

    // 1. 错题回流（匹配当前筛选）
    let wrongs = (p.wrongBank.quiz || []).filter(w =>
      (stage === '全部' || w.stage === stage) &&
      (subject === '全部' || w.subject === subject)
    );
    wrongs = shuffle(wrongs).slice(0, WRONG_IN_ROUND).map(w => {
      const orig = this.bank.find(q => q.id === w.id);
      return orig ? Object.assign({}, orig, { _fromWrong: true }) : null;
    }).filter(Boolean);

    // 2. 新题补齐
    const wrongIds = {};
    wrongs.forEach(w => { wrongIds[w.id] = 1; });
    const pool = this.bank.filter(q =>
      !wrongIds[q.id] &&
      (stage === '全部' || q.stage === stage) &&
      (subject === '全部' || q.subject === subject)
    );
    const news = shuffle(pool).slice(0, ROUND - wrongs.length);

    const queue = shuffle(wrongs.concat(news));
    if (!queue.length) {
      wx.showToast({ title: '该筛选下暂无题目', icon: 'none' });
      return;
    }
    this.beginRound(queue, false);
  },

  startWrongOnly() {
    const p = store.getProfile();
    const wrongs = shuffle(p.wrongBank.quiz || []).slice(0, ROUND).map(w => {
      const orig = this.bank.find(q => q.id === w.id);
      return orig ? Object.assign({}, orig, { _fromWrong: true }) : null;
    }).filter(Boolean);
    if (!wrongs.length) return;
    this.beginRound(wrongs, false);
  },

  /* ---------- OpenTDB 英文拓展 ---------- */
  async startEnglish() {
    if (this.data.loadingEn) return;
    this.setData({ loadingEn: true });
    wx.showLoading({ title: '拉取英文题…' });
    try {
      const res = await request.get('https://opentdb.com/api.php?amount=10&type=multiple&encode=url3986', { timeout: 10000 });
      wx.hideLoading();
      if (!res || res.response_code !== 0 || !res.results || !res.results.length) throw new Error('empty');
      const dec = decodeURIComponent;
      const queue = res.results.map((r, i) => {
        const correct = dec(r.correct_answer);
        const options = shuffle([correct].concat(r.incorrect_answers.map(dec)));
        return {
          id: 'en-' + Date.now() + '-' + i,
          stage: 'EN', subject: dec(r.category),
          difficulty: r.difficulty === 'easy' ? 1 : r.difficulty === 'medium' ? 2 : 3,
          question: dec(r.question),
          type: 'single',
          options,
          answer: options.indexOf(correct),
          knowledge: 'OpenTDB · ' + dec(r.category),
          explain: '', _english: true
        };
      });
      this.beginRound(queue, true);
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '英文题库连接失败，请稍后再试', icon: 'none' });
    }
    this.setData({ loadingEn: false });
  },

  beginRound(queue, isEnglish) {
    this.setData({
      phase: 'quiz', queue, curIdx: 0, total: queue.length,
      score: 0, roundPoints: 0, isEnglishRound: !!isEnglish
    });
    this.showQ(0);
  },

  showQ(i) {
    const q = this.data.queue[i];
    this.setData({
      cur: Object.assign({}, q, { _answerText: answerText(q) }),
      curIdx: i,
      picked: (q.type === 'multiple') ? [] : -1,
      userInput: '',
      answered: false,
      correct: false,
      yourAnswer: '',
      multi: q.type === 'multiple',
      blank: q.type === 'blank',
      fromWrongBank: !!q._fromWrong
    });
  },

  // 单选 / 判断：点选项即时判分
  pick(e) {
    if (this.data.answered || this.data.multi || this.data.blank) return;
    const i = +e.currentTarget.dataset.i;
    const q = this.data.cur;
    this.judge(i === q.answer, i);
  },

  // 多选：点选项切换选中态
  toggle(e) {
    if (this.data.answered) return;
    const i = +e.currentTarget.dataset.i;
    let picked = Array.isArray(this.data.picked) ? this.data.picked.slice() : [];
    const at = picked.indexOf(i);
    if (at > -1) picked.splice(at, 1); else picked.push(i);
    this.setData({ picked });
  },

  // 填空：输入
  onInput(e) {
    this.setData({ userInput: e.detail.value });
  },

  // 多选 / 填空：提交判分
  submit() {
    if (this.data.answered) return;
    const q = this.data.cur;
    let correct = false;
    if (q.type === 'multiple') {
      const sel = (Array.isArray(this.data.picked) ? this.data.picked : []).slice().sort((a, b) => a - b);
      const ans = q.answer.slice().sort((a, b) => a - b);
      correct = sel.length === ans.length && sel.every((v, idx) => v === ans[idx]);
    } else if (q.type === 'blank') {
      const ans = (q.answers || []).map(norm);
      correct = ans.indexOf(norm(this.data.userInput)) > -1;
    }
    this.judge(correct, this.data.picked);
  },

  judge(correct, pickedVal) {
    const q = this.data.cur;
    const your = yourText(q, pickedVal, this.data.userInput);
    this.setData({ answered: true, correct, picked: pickedVal, yourAnswer: your });
    if (correct) {
      const pts = DIFF_POINTS[q.difficulty] || 10;
      this.setData({ score: this.data.score + 1, roundPoints: this.data.roundPoints + pts });
      if (q._fromWrong) store.removeWrong('quiz', q.id); // 错题答对，消灭出库
    } else if (!q._english) {
      // 错题入档案（含题目快照，供中枢/数据页展示；英文拓展题不入错题本）
      store.addWrong('quiz', {
        id: q.id, stage: q.stage, subject: q.subject,
        question: q.question.slice(0, 80), knowledge: q.knowledge
      });
    }
  },

  next() {
    const i = this.data.curIdx + 1;
    if (i >= this.data.total) {
      this.finishRound();
    } else {
      this.showQ(i);
    }
  },

  finishRound() {
    store.moduleCheckin('quiz');
    const qs = store.quizRecordRound({ points: this.data.roundPoints, answered: this.data.total });
    const p = store.getProfile();
    this.setData({
      wrongCount: (p.wrongBank.quiz || []).length,
      points: qs.points,
      level: store.quizLevel(qs.points),
      streak: qs.streak
    });
    // 休息卡护眼：开启时每轮结束先休息 20 秒（可跳过）
    if (this.data.restEnabled) {
      this.setData({ phase: 'rest', restSeconds: 20 });
      this.clearRestTimer();
      this._restTimer = setInterval(() => {
        const s = this.data.restSeconds - 1;
        if (s <= 0) { this.skipRest(); }
        else this.setData({ restSeconds: s });
      }, 1000);
    } else {
      this.setData({ phase: 'result' });
    }
  },

  clearRestTimer() {
    if (this._restTimer) { clearInterval(this._restTimer); this._restTimer = null; }
  },

  skipRest() {
    this.clearRestTimer();
    this.setData({ phase: 'result' });
  },

  again() {
    this.setData({ phase: 'setup' });
    this.refreshState();
  },

  /* ---------- 清空进度 ---------- */
  clearProgress() {
    wx.showModal({
      title: '清空闯关进度',
      content: '将清零积分、连胜、答题日历，并清空闯关错题本。此操作不可恢复，确定吗？',
      confirmText: '清空',
      confirmColor: '#e64340',
      success: (res) => {
        if (!res.confirm) return;
        const p = store.getProfile();
        p.quizState = { points: 0, streak: 0, lastPlayDate: '', calendar: {}, settings: p.quizState ? p.quizState.settings : { restEnabled: true, restEvery: 10 } };
        p.wrongBank.quiz = [];
        store.saveProfile(p);
        this.refreshState();
        wx.showToast({ title: '已清空', icon: 'success' });
      }
    });
  },

  onShareAppMessage() {
    return {
      title: '知识闯关：' + (this.data.bankCount || 5690) + ' 题 K12 题库，快来挑战！',
      path: '/subpackages/quiz/index',
      imageUrl: '/assets/branding/share-card.jpg'
    };
  }

  ,
  onShow() {
    theme.apply(this);
  }});
