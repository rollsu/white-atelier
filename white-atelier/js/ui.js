(function () {
  'use strict';
  const KEY = 'pomo-alchemy-save-v2';
  const DURS = [{ m: 30, label: '30분' }, { m: 60, label: '1시간' }, { m: 120, label: '2시간' }, { m: 180, label: '3시간' }];
  const DLABEL = { 30: '30분', 60: '1시간', 120: '2시간', 180: '3시간' };
  const RAR = { common: '일반', uncommon: '고급', rare: '희귀', epic: '영웅', legendary: '전설' };
  const TIER = { 1: '1등급 · 일반', 2: '2등급 · 고급', 3: '3등급 · 희귀', 4: '4등급 · 전설' };
  const EFF = {
    xp_boost: '연금술 경험치', yield_boost: '장기 채집 수확량', herb_bonus: '단기 채집 추가 재료',
    rare_chance: '희귀 재료 확률', weather_shield: '날씨 보호막', weather_ward: '날씨 피해 방지', cooldown_cut: '단기 채집 대기 단축',
    brew_chance: '조합 성공 확률', brew_refund: '재료 환급',
  };
  const UNIT = { expedition: '장기', short: '단기', gather: '채집', brew: '조합', charge: '회' };
  const CATN = Alchemy.CATS;
  const CAT_ORDER = Alchemy.CAT_ORDER;
  const RORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const HUB_IDS = ['camp', 'market', 'tool_street', 'town_hall'];

  const G = Alchemy.createGame(DATA);
  const $ = (s) => document.querySelector(s);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };

  // 화면 색상: 자동(기기 설정을 따름) / 라이트 / 다크. 고른 값은 이 브라우저에 기억한다.
  const THEME_KEY = 'white-atelier-theme';
  function applyTheme(mode) {
    const root = document.documentElement;
    if (mode === 'light' || mode === 'dark') root.setAttribute('data-theme', mode);
    else root.removeAttribute('data-theme');
    document.querySelectorAll('[data-theme-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeSet === (mode || 'auto'))));
  }
  (function initTheme() {
    const saved = store.get(THEME_KEY);
    applyTheme(saved === 'light' || saved === 'dark' ? saved : 'auto');
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-theme-set]');
      if (!b) return;
      const mode = b.dataset.themeSet;
      if (mode === 'auto') store.del(THEME_KEY); else store.set(THEME_KEY, mode);
      applyTheme(mode);
    });
  })();

  // ------------------------------------------------------------ 완료 알림 (우선 임의로 정한 방식)
  // 장기 채집이 끝나거나 이동이 끝나면: 화면 안 알림(토스트) + 짧은 소리 + (다른 탭에 있으면) 탭 제목 깜빡임과 브라우저 팝업.
  // 창을 닫아 둔 동안 끝난 것은 알릴 수 없고, 다시 열 때 일지에 정산된다.
  const NOTIFY_KEY = 'white-atelier-notify';
  const BASE_TITLE = document.title;
  let notifyOn = store.get(NOTIFY_KEY) !== '0';          // 기본 켜짐
  let booting = true;                                      // 시작할 때 정산된 채집은 알리지 않는다
  let audioCtx = null, titleTimer = null, toastTimer = null;
  const toastEl = document.createElement('div');
  toastEl.id = 'toast'; toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite'); toastEl.hidden = true;
  document.body.appendChild(toastEl);
  function toast(msg) {
    toastEl.textContent = msg; toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 6000);
  }
  // 제작 결과: 화면 가운데에 오버레이로 뜨고, 화면을 클릭해야 사라진다. (Esc·Enter 도 닫는다)
  let bannerTimer = null;
  function closeBanner() {
    const el = document.getElementById('result-banner');
    if (!el || el.className !== 'show') return;
    el.className = 'hide';
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { el.className = ''; el.innerHTML = ''; }, 240);
  }
  function resultBanner(ok, title, detail) {
    let el = document.getElementById('result-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'result-banner'; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-live', 'assertive');
      el.addEventListener('click', closeBanner);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'Enter') closeBanner(); });
      document.body.appendChild(el);
    }
    clearTimeout(bannerTimer);
    el.innerHTML = '<div class="rb-card ' + (ok ? 'win' : 'lose') + '"><b>' + title + '</b>' + (detail ? '<span>' + detail + '</span>' : '') + '<i>화면을 누르면 닫힙니다</i></div>';
    el.className = 'show';
  }
  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const t0 = audioCtx.currentTime;
      [[660, 0], [880, 0.2]].forEach((p) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine'; o.frequency.value = p[0];
        g.gain.setValueAtTime(0.0001, t0 + p[1]);
        g.gain.exponentialRampToValueAtTime(0.18, t0 + p[1] + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + p[1] + 0.4);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(t0 + p[1]); o.stop(t0 + p[1] + 0.45);
      });
    } catch (e) { /* 소리를 낼 수 없으면 조용히 넘어간다 */ }
  }
  function stopTitleFlash() { clearInterval(titleTimer); titleTimer = null; document.title = BASE_TITLE; }
  function startTitleFlash(t) {
    stopTitleFlash();
    let on = true; document.title = '✔ ' + t;
    titleTimer = setInterval(() => { on = !on; document.title = on ? '✔ ' + t : BASE_TITLE; }, 1000);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) stopTitleFlash(); });
  function notify(title, body) {
    if (booting || !notifyOn) return;
    toast(title + ' — ' + body);
    beep();
    if (document.hidden) {
      startTitleFlash(title);
      if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification(title, { body: body, tag: 'white-atelier' }); } catch (e) { /* 일부 브라우저는 생성자를 막는다 */ }
      }
    }
  }
  // 효과음 · 배경음: 파일 없이 브라우저 소리로 만든다. 배경음은 기본으로 꺼져 있고, 설정 메뉴에서 켠다.
  const BGM_KEY = 'white-atelier-bgm';
  let bgmOn = store.get(BGM_KEY) === '1', bgmTimer = null, bgmStep = 0;
  function audio() {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  function tone(freq, t0, dur, vol, type) {
    const c = audio(), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.6, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function chime(kind) {
    if (booting || !notifyOn) return;
    try {
      const t = audio().currentTime, seq = kind === 'chapter' ? [523, 659, 784, 1047] : [784, 988];
      seq.forEach((f, i) => tone(f, t + i * 0.16, 0.9, 0.12, 'triangle'));
    } catch (e) { /* 소리를 낼 수 없으면 조용히 넘어간다 */ }
  }
  // 계절마다 음계가 다른, 느리고 조용한 배경음 (몇 초마다 음 하나)
  const SCALES = { spring: [262, 294, 330, 392, 440], summer: [294, 330, 370, 440, 494], autumn: [220, 262, 294, 330, 392], winter: [196, 247, 294, 330, 392] };
  function bgmPlay() {
    try {
      const sc = SCALES[G.seasonId()] || SCALES.spring, t = audio().currentTime;
      bgmStep = (bgmStep + 1 + Math.floor(Math.random() * 2)) % sc.length;
      tone(sc[bgmStep], t, 5, 0.035, 'sine');
      if (Math.random() < 0.4) tone(sc[(bgmStep + 2) % sc.length] / 2, t + 0.4, 6, 0.025, 'triangle');
    } catch (e) { /* 무시 */ }
  }
  function setBgm(on) {
    bgmOn = on; store.set(BGM_KEY, on ? '1' : '0');
    clearInterval(bgmTimer); bgmTimer = null;
    if (on) { bgmPlay(); bgmTimer = setInterval(bgmPlay, 3200); }
    const b = $('#bgmbtn');
    if (b) { b.textContent = on ? '배경음 켜짐 · 끄기' : '배경음 꺼짐 · 켜기'; b.setAttribute('aria-pressed', String(on)); }
  }
  function renderSettings() {
    const bb = $('#bgmbtn');
    if (bb) { bb.textContent = bgmOn ? '배경음 켜짐 · 끄기' : '배경음 꺼짐 · 켜기'; bb.setAttribute('aria-pressed', String(bgmOn)); }
    const nb = $('#notifybtn');
    if (nb) { nb.textContent = notifyOn ? '알림 켜짐 · 끄기' : '알림 꺼짐 · 켜기'; nb.setAttribute('aria-pressed', String(notifyOn)); }
    const pb = $('#permbtn'), pt = $('#permtxt');
    if (!pb || !pt) return;
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    pb.disabled = perm !== 'default';
    pt.textContent = perm === 'granted' ? '다른 탭에 있을 때 브라우저 팝업으로도 알려 준다.' :
      perm === 'denied' ? '브라우저에서 알림이 차단되어 있다. 주소창의 사이트 설정에서 허용하면 팝업도 쓸 수 있다.' :
      perm === 'unsupported' ? '이 브라우저는 팝업 알림을 지원하지 않는다. 화면 안 알림과 소리만 쓴다.' :
      '허용하면 다른 탭에 있을 때도 팝업으로 알려 준다.';
  }

  // ------------------------------------------------------------ 저장 내보내기 · 불러오기
  // 파일에는 이 브라우저 저장(localStorage)에 들어가는 내용을 그대로 담는다. 불러올 때는 글자 속 < > 를 지워 화면에 코드가 섞이지 않게 한다.
  function scrub(v) {
    if (typeof v === 'string') return v.replace(/[<>]/g, '');
    if (Array.isArray(v)) return v.map(scrub);
    if (v && typeof v === 'object') {
      const o = {};
      Object.keys(v).forEach((k) => { o[k.replace(/[<>]/g, '')] = scrub(v[k]); });
      return o;
    }
    return v;
  }
  function saveStamp() {
    const d = new Date(), p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }
  function exportSave() {
    persist();
    const raw = store.get(KEY);
    const data = raw ? JSON.parse(raw) : { state: G.state, T: T, logs: logs, pins: pins, fast: fast };
    const payload = { app: 'white-atelier', version: 3, exportedAt: new Date().toISOString(), data: data };
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '화이트아틀리에-저장-' + saveStamp() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return a.download;
  }
  function importSaveText(text) {
    const bad = (message) => ({ ok: false, message: message });
    let p;
    try { p = JSON.parse(text); } catch (e) { return bad('파일을 읽을 수 없다. 내보낸 저장 파일(.json)이 맞는지 확인하자.'); }
    if (!p || p.app !== 'white-atelier' || !p.data || !p.data.state) return bad('화이트 아틀리에의 저장 파일이 아니다.');
    if (p.version > 3) return bad('더 새로운 버전에서 내보낸 저장 파일이라 불러올 수 없다.');
    const d = scrub(p.data);
    if (!d.state || d.state.v !== 2) return bad('저장 형식이 맞지 않는다.');
    const backup = JSON.stringify(G.state);
    try { G.load(d.state); } catch (e) { G.load(JSON.parse(backup)); return bad('저장 데이터가 올바르지 않아 불러오지 못했다.'); }
    logs = Array.isArray(d.logs) ? d.logs : [];
    pins = Array.isArray(d.pins) ? d.pins : [];
    logSeq = logs.concat(pins).reduce((a, l) => Math.max(a, l.id || 0), 0);
    logs.forEach((l) => { if (!l.id) l.id = ++logSeq; });
    pins.forEach((l) => { if (!l.id) l.id = ++logSeq; });
    fast = d.fast !== false;
    T = d.T || null;
    applySpeed();
    if (G.state.phase === 'expedition' && !T) { G.state.phase = 'idle'; G.state.currentExpedition = null; }
    if (G.state.phase !== 'expedition') T = null;
    picked = []; UI.ov = null; selArea = G.state.location;
    log('저장 파일을 불러왔다.', 'sys');
    persist(); render();
    return { ok: true };
  }

  let T = null;            //{ minutes, total(ms), endAt(ms) }  장기 채집 타이머
  const UI = { tab: 'main', brewMode: 'potion', marketMode: 'sell', bookMode: 'recipe', bookRar: '*',goodsFilter: '*',
    bagCat: '*', bagRar: '*', pickCat: '*', pickRar: '*', sellCat: '*', sellRar: '*', buyRar: '*', bookCat: '*', pickQ: '', bagMode: 'item', potTier: '*', potQ: '', mapZoom: 1, ov: null, goodQ: '' };
  let picked = [];
  let fast = true;
  let logs = [];

  function now() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  let pins = [];           // 일지 맨 위에 고정해 둔 기록 (복사본이라 일지에서 밀려나도 남는다)
  let logSeq = 0;
  const PIN_MAX = 10;
  function log(m, c) { logs.push({ id: ++logSeq, t: now(), c: c || '', m: m }); if (logs.length > 120) logs.shift(); }
  function herbName(id) { return G.herbs[id].name; }
  function msPerMin() { return fast ? 1000 : 60000; }
  function capTxt() { const c = G.storageCap(); return c >= 1e6 ? '∞' : c; }
  function applySpeed() {
    G.config.shortCooldownSec = fast ? 3 : 30;
    G.config.minCooldownSec = fast ? 1 : 5;
    G.config.manaRegenSec = fast ? 1 : 6;     // 마나 1 회복에 걸리는 시간(초)
    G.config.infiniteStorage = fast;          // 테스트 중에는 창고 무제한
    G.config.minuteMs = msPerMin();           // 이동·재사용 시간이 쓰는 "게임 1분"의 길이
  }
  const ABN = {};
  Alchemy.ABILITY_KEYS.forEach((k) => { ABN[k] = Alchemy.ABILITIES[k].name; });
  // 엔진이 쌓아 둔 능력 레벨업·특수 스킬 획득을 일지에 옮긴다
  function flushEvents() {
    G.drainEvents().forEach((e) => {
      if (e.type === 'alch') log('연금술사 레벨이 올랐다! Lv.' + e.lv + (e.n > 0 ? ' · 기능치 +' + e.n + ' (능력 탭에서 능력을 올릴 수 있다)' : ''), 'good');
      else if (e.type === 'level') log(ABN[e.key] + ' 능력이 Lv.' + e.lv + '이(가) 되었다.', 'good');
      else if (e.type === 'rent') log('매주 월요일 임대료 ' + won(e.due) + '을(를) 낼 때가 되었다.' + (e.weeks > 1 ? ' (' + e.weeks + '주 치)' : '') +
        (e.debt ? ' 금화가 모자라 ' + won(e.debt) + '이 연체로 남았다. 돈이 생기는 대로 갚는다.' : ' ' + won(e.paid) + '을(를) 냈다.'), e.debt ? 'bad' : 'sys');
      else if (e.type === 'debt') log('연체된 임대료 ' + won(e.paid) + '을(를) 갚았다.' + (e.debt ? ' (남은 연체 ' + won(e.debt) + ')' : ' 연체를 모두 갚았다.'), 'good');
      else if (e.type === 'overflow') log('창고가 가득 차서 재료 ' + e.n + '개는 보류되었다. 거점에서 자리를 만든 뒤 받을 수 있다.', 'bad');
      else if (e.type === 'fatigue') log('쉬지 않고 오래 채집해 피로가 쌓였다. (피로 ' + e.stacks + '단계 · 장기 채집 보상 -' + e.stacks * 10 + '%) 거점에서 쉬면 풀린다.', 'bad');
      else if (e.type === 'clue') log('세계수의 단서를 얻었다 (' + e.n + '/' + Alchemy.CFG8.CLUES + ') — ' + e.text, 'legend');
      else if (e.type === 'route') log('모든 단서가 모였다. 대대륙으로 가는 길이 어렴풋이 보인다…! (아직 갈 수는 없다)', 'legend');
      else if (e.type === 'chapter') { log('이야기가 이어진다 — ' + G.chapter(e.i).title + ' (보상 ' + won(e.gold) + ')', 'legend'); chime('chapter'); }
      else if (e.type === 'ach') { log('업적 달성: ' + (G.achList().find((a) => a.id === e.id) || {}).name + ' (보상 ' + won(e.gold) + ')', 'legend'); toast('업적 달성 — ' + (G.achList().find((a) => a.id === e.id) || {}).name); chime('ach'); }
      else if (e.type === 'scene') { log(G.npcOf(e.npc).name + '의 이야기가 열렸다 (호감도 ' + e.h + '칸). 세계수 이야기에서 다시 읽을 수 있다.' + (e.gift ? ' 선물: ' + e.gift : ''), 'legend'); UI.sceneQ = (UI.sceneQ || []).concat([e]); chime('ach'); }
      else if (e.type === 'tree') { log('세계수 묘목이 \'' + e.name + '\'(으)로 자랐다!', 'legend'); chime('chapter'); }
      else if (e.type === 'ending') log('세계수가 마을을 감싸 안았다. 이야기의 끝에 닿았다. 하지만 마을의 하루는 계속된다.', 'legend');
      else log('특수 스킬을 얻었다: ' + e.name + ' (' + ABN[e.key] + ' Lv.' + e.lv + ')', 'legend');
    });
  }
  function won(n) { return n.toLocaleString('ko-KR') + ' G'; }

  // ------------------------------------------------------------ 저장 · 불러오기
  function persist() {
    G.markSeen();
    store.set(KEY, JSON.stringify({ state: G.state, T: T, logs: logs.slice(-80), pins: pins, fast: fast, away: awaySnap() }));
  }
  let prevAway = null;
  setInterval(() => { if (!booting) persist(); }, 30000);       // 마지막으로 열어 둔 시각을 남긴다 (자리를 비운 사이 요약용)
  (function boot() {
    const raw = store.get(KEY);
    if (raw) {
      try {
        const d = JSON.parse(raw);
        prevAway = d.away || null;
        if (d.state) G.load(d.state);
        logs = d.logs || [];
        pins = d.pins || [];
        logSeq = logs.concat(pins).reduce((a, l) => Math.max(a, l.id || 0), 0);
        logs.forEach((l) => { if (!l.id) l.id = ++logSeq; });
        pins.forEach((l) => { if (!l.id) l.id = ++logSeq; });
        fast = d.fast !== false;
        T = d.T || null;
      } catch (e) { logs = []; T = null; }
    }
    applySpeed();
    if (G.state.phase === 'expedition' && !T) {      // 타이머 정보를 잃었으면 벌점 없이 되돌린다
      G.state.phase = 'idle'; G.state.currentExpedition = null;
    }
    if (G.state.phase !== 'expedition') T = null;
    if (!G.state.introSeen) UI.ov = 'intro';       // 처음 시작하는 사람에게 초대장을 펼친다
    if (!logs.length) {
      logs.push({ id: ++logSeq, t: now(), c: 'sys', m: '중앙 마을 별나루의 거점에 도착했다. 마을에서는 채집을 할 수 없으니, 지도를 펼쳐 다섯 땅으로 떠나 보자.' });
      logs.push({ id: ++logSeq, t: now(), c: 'sys', m: '모은 재료와 물약, 물건은 중앙 거래소에서 팔 수 있다. 번 돈으로 도구 거리에서 낫·곡괭이·증류기 같은 도구를 장만하자.' });
    }
  })();

  // ------------------------------------------------------------ 장기 채집 타이머
  function levelMsg() {}          // 레벨업 알림은 flushEvents 가 맡는다
  function expiredNote(list) {
    const u = Array.from(new Set(list || []));
    return u.length ? ' (효과 소진: ' + u.map((t) => EFF[t] || t).join(', ') + ')' : '';
  }
  function finish() {
    const src = T;
    T = null;
    const r = G.completeExpedition();
    if (!r.ok) { log(r.message, 'bad'); return; }
    if (UI.ov === 'scroll' && src && src.script) {          // 스크롤을 펼쳐 둔 채 끝나면 마지막 줄과 결과를 보여 준다
      UI.scrollDone = { script: src.script, area: r.area, minutes: r.minutes, xp: r.xp, herbs: r.herbs.map((h) => h.name + ' ×' + h.amount).join(', ') };
    }
    log(G.areas[r.area].name + '에서 ' + DLABEL[r.minutes] + ' 채집을 마쳤다. 경험치 +' + r.xp + ' · 예리 +' + r.abilityXp + expiredNote(r.expired), 'good');
    log('수확: ' + r.herbs.map((h) => h.name + ' ×' + h.amount).join(', ') + (r.basketExtra ? ' (바구니 덕에 ' + r.basketExtra + '번 더 뽑았다)' : ''), 'good');
    if (r.weather) log(endWeatherNote(r.weather), r.weather.bad && !r.weather.by ? 'bad' : 'sys');
    if (r.legendary) log('전설의 기운이 닿아 '+ herbName(r.legendary) + ' 한 포기를 더 얻었다!', 'legend');
    levelMsg(r.levelsGained);
    persist(); render();
    notify('장기 채집 완료', G.areas[r.area].name + ' ' + DLABEL[r.minutes] + ' · ' + r.herbs.reduce((a, h) => a + h.amount, 0) + '개 수확');
  }
  function finishTravel() {
    const r = G.completeTravel();
    if (!r.ok) return;
    log(r.message, 'sys');
    selArea = G.state.location;
    persist(); render();
    notify('이동 완료', G.areas[r.area].name + '에 도착했다');
  }
  // 탭 제목에 남은 시간을 보여 준다 (다른 탭에 있어도 얼마나 남았는지 알 수 있다)
  function updateTitle() {
    if (titleTimer) return;                    // 완료 알림이 깜빡이는 동안은 그대로 둔다
    let t = BASE_TITLE;
    if (T) t = '⏳ ' + fmt(Math.ceil(Math.max(0, T.endAt - Date.now()) / msPerMin() * 60)) + ' 채집 중 · ' + BASE_TITLE;
    else if (G.state.phase === 'travel') t = '🚶 ' + fmt(Math.ceil(G.travelLeftMs() / msPerMin() * 60)) + ' 이동 중 · ' + BASE_TITLE;
    if (document.title !== t) document.title = t;
  }
  function tickLoop() {
    if (T && Date.now() >= T.endAt) finish();
    if (G.state.phase === 'travel' && G.travelLeftMs() <= 0) finishTravel();
    G.checkRent();
    if (G.events.length) { persist(); render(); }       // 임대료 같은 백그라운드 소식을 일지에 옮긴다
    drawTimer();
    drawMana();
    updateScroll();
    updateTitle();
    // 날씨가 바뀌면 화면을 새로 그린다 (메인 탭의 예보와 채집 정보를 맞춘다)
    const sig = G.forecast().map((f) => f.now.id).join('|') + G.seasonInfo().id;
    if (wxSig && sig !== wxSig && UI.tab === 'main') { wxSig = sig; render(); } else wxSig = sig;
  }
  let wxSig = '';
  function drawMana() {
    const max = G.manaMax(), cur = Math.min(max, G.manaNow());
    const t = $('#manaTxt'), f = $('#manafill');
    if (t) t.textContent = Math.floor(cur) + ' / ' + max;
    if (f) f.style.width = (cur / max * 100) + '%';
  }
  setInterval(tickLoop, 250);

  function fmt(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const p = (n) => String(n).padStart(2, '0');
    return (h ? h + ':' : '') + p(m) + ':' + p(s);
  }

  function drawTimer() {
    const clock = $('#clock'), fill = $('#barfill'), bar = $('#bar'), kind = $('#tkind');
    if (T) {
      const leftMs = Math.max(0, T.endAt - Date.now());
      const gameSec = Math.ceil(leftMs / msPerMin() * 60);
      clock.textContent = fmt(gameSec);
      clock.className = 'clock focus';
      bar.className = 'bar focus';
      fill.style.width = ((1 - leftMs / T.total) * 100) + '%';
      kind.textContent = '장기 채집 ' + DLABEL[T.minutes] + ' · ' + G.areas[G.state.currentExpedition.area].name + (fast ? ' · 빠른 시간' : '');
    } else if (G.state.phase === 'travel') {
      const ct = G.state.currentTravel, leftMs = G.travelLeftMs();
      clock.textContent = fmt(Math.ceil(leftMs / msPerMin() * 60));
      clock.className = 'clock';
      bar.className = 'bar';
      fill.style.width = ((1 - leftMs / (ct.minutes * msPerMin())) * 100) + '%';
      kind.textContent = '이동 중 · ' + G.areas[ct.from].name + ' → ' + G.areas[ct.to].name + (ct.broom ? ' · 마법의 빗자루' : '') + (fast ? ' · 빠른 시간' : '');
    } else {
      clock.textContent = '--:--'; clock.className = 'clock idle';
      bar.className = 'bar'; fill.style.width = '0%';
      kind.textContent = '대기 중';
    }
    const sb = $('#shortbtn');
    if (sb) {
      const left = G.shortCooldownLeft();
      const rest = G.shortLeft(), full = G.storageUsed() >= G.storageCap();
      sb.disabled = left > 0 || rest <= 0 || full;
      sb.textContent = rest <= 0 ? '오늘의 단기 채집을 모두 했다' : full ? '창고가 가득 찼다' :
        (left > 0 ? '단기 채집 · ' + Math.ceil(left / 1000) + '초 뒤' : '단기 채집') + ' (남은 ' + rest + '회)';
    }
  }

  // ------------------------------------------------------------ 공통 조각
  function effLabel(a) {
    let v = '';
    if (['xp_boost', 'yield_boost', 'brew_refund'].includes(a.type)) v = ' +' + a.value + '%';
    else if (a.type === 'brew_chance') v = ' +' + a.value + '%p';
    else if (a.type === 'herb_bonus') v = ' +' + a.value;
    else if (a.type === 'cooldown_cut') v = ' -' + a.value + '초';
    else if (a.type === 'rare_chance') v = ' +' + (a.value * 10) + '%';
    return (EFF[a.type] || a.type) + v + ' · ' + a.remaining + (UNIT[a.unit] || '');
  }
  function stat(k, v, cls) { return '<div class="stat"><span class="k">' + k + '</span><span class="v' + (cls ? ' ' + cls : '') + '">' + v + '</span></div>'; }
  function rarSpan(r) { return '<span class="rar ' + r + '">' + RAR[r] + '</span>'; }

  // ------------------------------------------------------------ 날씨 · 계절
  function fmtIn(ms) {
    const m = Math.max(1, Math.ceil(ms / msPerMin()));
    return m >= 60 ? Math.floor(m / 60) + '시간' + (m % 60 ? ' ' + (m % 60) + '분' : '') : m + '분';
  }
  function wxChip(w) { return '<span class="chip wx' + (w.bad ? ' bad' : '') + '">' + w.name + '</span>'; }
  function wxEffect(w) {
    const bits = [];
    if (w.bad) bits.push('보호받지 못하면 보상 -30%, 단기 채집은 허탕 위험');
    else if (w.yld > 1) bits.push('수확 +' + Math.round((w.yld - 1) * 100) + '%');
    else if (w.yld < 1) bits.push('수확 -' + Math.round((1 - w.yld) * 100) + '%');
    if (w.traits.length) bits.push(w.traits.join('·') + ' 기운 재료가 잘 나온다');
    return bits.join(' · ') || '특별한 영향 없음';
  }
  function protectionNote() {
    const fx = G.activeEffects();
    const ward = fx.find((a) => a.type === 'weather_ward'), shield = fx.find((a) => a.type === 'weather_shield');
    return ward ? '방지 물약이 지켜 준다 (' + ward.remaining + '채집)' : shield ? '보호막이 지켜 준다 (' + shield.remaining + '회)' : '';
  }
  function startWeatherNote(w) {
    if (!w) return '';
    if (w.bad) return w.by ? w.name + '이지만 ' + (w.by === 'ward' ? '방지 물약' : '보호막') + ' 덕에 안전하다.' : '날씨가 나쁘다(' + w.name + '). 보상이 줄어든다.';
    return '날씨는 ' + w.name + (w.yld > 1 ? ' — 보상이 늘어난다.' : '.');
  }
  function endWeatherNote(w) {
    if (w.bad) return w.by ? w.name + '을(를) ' + (w.by === 'ward' ? '방지 물약' : '보호막') + ' 덕에 무사히 넘겼다.' : w.name + ' 때문에 보상이 줄었다.';
    return w.yld > 1 ? '좋은 날씨(' + w.name + ') 덕에 보상이 늘었다.' : '';
  }
  // 날씨 예보 오버레이의 내용 (지도 도구줄의 "날씨 예보" 버튼으로 연다)
  function forecastHtml() {
    const si = G.seasonInfo(), se = G.seasonEffects();
    let h = '<div class="fcast"><div class="sec">' + si.name + (si.daysLeft ? ' · 다음 계절까지 ' + si.daysLeft + '일' : '') + ' · 계절 재료 ' + si.traits.join('·') + '</div>' +
      '<div class="notice" style="margin:0 0 12px">' + si.name + '의 영향 · 이동 시간 +' + Math.round(se.travelAdd * 100) + '% · ' + se.debuff + '</div>' +
      '<div class="tblwrap"><table class="tbl"><thead><tr><th>지역</th><th>지금</th><th>다음</th><th>변화까지</th></tr></thead><tbody>';
    G.forecast().forEach((f) => {
      h += '<tr><td>' + f.name + '</td><td>' + wxChip(f.now) + '</td><td>' + wxChip(f.next) + '</td><td>' + fmtIn(f.now.startsInMs) + '</td></tr>';
    });
    return h + '</tbody></table></div><p class="note" style="margin:12px 0 0">나쁜 날씨(폭풍·눈보라·폭염·화산재)에는 정화 계열 "방지 물약"이나 평온 계열 "보호막" 물약을 미리 마셔 두자. 계절 기운의 재료는 더 잘 나오고 거래소에서 조금 더 비싸다.</p></div>';
  }

  function itemSort(a, b) {
    return RORDER.indexOf(b.rarity) - RORDER.indexOf(a.rarity) || CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat) || (a.name < b.name ? -1 : 1);
  }
  function invItems(cat, rar) {
    return G.herbList.filter((h) => G.herbCount(h.id) > 0 && (cat === '*' || h.cat === cat) && (!rar || rar === '*' || h.rarity === rar)).sort(itemSort);
  }
  // 등급 선택 버튼: 전설 → 일반. 가방과 연금술(재료 고르기)에서 쓴다.
  function rarBar(key) {
    const opts = [['*', '모든 등급']].concat(RORDER.slice().reverse().map((r) => [r, RAR[r]]));
    return '<div class="pick fbar rarbar">' + opts.map((x) =>
      '<button class="' + (x[0] === '*' ? '' : 'c-' + x[0]) + '" data-act="ui" data-key="' + key + '" data-val="' + x[0] + '" aria-pressed="' + (UI[key] === x[0]) + '">' + x[1] + '</button>').join('') + '</div>';
  }
  function catBar(key) {
    const cur = UI[key];
    const opts = [['*', '전체']].concat(CAT_ORDER.map((c) => [c, CATN[c]]));
    return '<div class="pick fbar">' + opts.map((x) =>
      '<button data-act="ui" data-key="' + key + '" data-val="' + x[0] + '" aria-pressed="' + (cur === x[0]) + '">' + x[1] + '</button>').join('') + '</div>';
  }
  function seg(key, list) {
    return '<div class="seg" role="group">' + list.map((x) =>
      '<button data-act="ui" data-key="' + key + '" data-val="' + x[0] + '" aria-pressed="' + (UI[key] === x[0]) + '">' + x[1] + '</button>').join('') + '</div>';
  }
  function itemRow(h, right, price) {
    return '<div class="row"><div class="info"><div class="name">' + h.name + ' ' + rarSpan(h.rarity) +
      ' <span class="sub">' + CATN[h.cat] + ' · ' + h.traits.join('·') + '</span></div>' + (price || '') + '</div>' + right + '</div>';
  }
  function reqText(req) {
    return req.map((r) => CATN[r[0]] + (r[2] ? '(' + r[2] + ')' : '') + ' ×' + r[1]).join(' · ');
  }
  function pickText(pick) {
    return Object.keys(pick).map((id) => herbName(id) + ' ×' + pick[id]).join(', ');
  }

  // ------------------------------------------------------------ 화면 그리기
  function renderStatus() {
    const s = G.state;
    const season = G.seasonInfo(), wx = G.weatherAt(G.state.location), fat = G.fatigueInfo();
    // 사이드바는 가장 자주 보는 것만: 금화·레벨, 경험치·마나 막대, 한 줄 요약 칩. 나머지는 "더 보기"에 접어 둔다.
    const chip = (k, v, cls) => '<span class="chip' + (cls ? ' ' + cls : '') + '">' + k + ' <b>' + v + '</b></span>';
    const shortLeft = G.shortLeft();
    $('#stats').innerHTML =
      '<div class="topline">' + stat('금화', won(s.gold) + (s.debt ? ' <span class="down" title="연체된 임대료">-' + s.debt + '</span>' : ''), 'gold') +
      stat('연금술사', 'Lv.' + G.levelInfo().level) + '</div>' +
      '<div class="chiprow">' + chip('계절', season.name) + chip('날씨', wx ? wx.name : '-', wx && wx.bad ? 'bad' : '') +
      chip('창고', G.storageUsed() + '/' + capTxt() + '칸' + (G.pendingCount() ? ' +' + G.pendingCount() : ''), G.pendingCount() ? 'bad' : '') +
      chip('단기', shortLeft + '회 남음') + (fat.stacks ? chip('피로', fat.stacks + '단계', 'bad') : '') +
      (s.points > 0 ? chip('기능치', s.points + '점', 'fx') : '') + '</div>';
    const li = G.levelInfo();
    $('#lvl').innerHTML = '<div class="row1"><span>경험치</span><b>' + (li.max ? '최고 레벨' : li.xp + ' / ' + li.need) + '</b></div>' +
      '<div class="bar" style="margin-bottom:10px"><i style="width:' + (li.max ? 100 : (li.xp / li.need * 100)) + '%"></i></div>' +
      '<div class="row1"><span>마나</span><b id="manaTxt"></b></div>' +
      '<div class="bar mana"><i id="manafill"></i></div>';
    $('#more').innerHTML =
      '<div class="sub">기능치 ' + s.points + '점 · 오늘 장기 ' + s.expeditionsToday + '회 · 단기 ' + s.shortToday + '/' + Alchemy.CFG8.SHORT_DAILY + '회</div>' +
      '<div class="sub" style="margin:4px 0 8px">1등급 물약 성공 확률 ' + G.baseBrewChance() + '% · 2레벨마다 기능치 +1</div>' +
      '<div class="effects" style="margin:0 0 8px">' + G.abilityList().map((a) =>
        '<span class="chip" title="' + a.effect + '">' + a.name + ' Lv.' + a.lv + '</span>').join('') + '</div>';
    drawMana();
    const eff = G.activeEffects();
    $('#effects').innerHTML = eff.length
      ? eff.map((a) => '<span class="chip fx">' + effLabel(a) + '</span>').join('')
      : '<span class="sub">적용 중인 물약 효과가 없습니다.</span>';
    const a = G.currentArea();
    $('#where').innerHTML = '지금 위치 <b>' + a.regionName + ' · ' + a.name + '</b>';
  }

  // 채집 버튼은 메인 탭의 지도 아래(채집 가능한 지역)에 뜬다. 여기는 진행 중인 채집의 포기 버튼만 둔다.
  function gatherButtons() {
    return '<div class="sec">장기 채집 · 레벨과 높은 등급 재료</div>' +
      '<div class="actions">' + DURS.map((d) => '<button class="btn focus" data-act="long" data-m="' + d.m + '">' + d.label + '</button>').join('') + '</div>' +
      '<div class="sec">단기 채집 · 30초마다 재료 1개 · 하루 ' + Alchemy.CFG8.SHORT_DAILY + '회</div>' +
      '<div class="actions"><button class="btn primary" id="shortbtn" data-act="short">단기 채집</button></div>';
  }
  function renderActions() {
    if (G.state.phase === 'travel') {
      $('#actions').innerHTML = '<div class="actions"><button class="btn ghost" data-act="cancel-travel">이동 그만두기</button>' +
        '<span class="sub">출발한 곳으로 돌아간다. 쓴 마나는 돌려받지 못한다.</span></div>';
    } else if (G.state.phase === 'idle') {
      $('#actions').innerHTML = '<p class="note" style="margin:0">채집은 메인 탭의 지도에서 시작한다.</p>';
    } else {
      $('#actions').innerHTML = '<div class="actions"><button class="btn ghost" data-act="abandon">채집 포기</button>' +
        '<span class="sub">끝나기 전에 포기하면 이번 채집의 보상을 받을 수 없습니다.</span></div>';
    }
  }

  // 일지는 탭으로 옮겼다. 열려 있을 때만 맨 아래(가장 최근)로 스크롤한다.
  function renderLog() {
    const el = $('#log');
    if (el) el.scrollTop = 0;          // 최근 기록이 맨 위에 있다
  }
  function logLine(l) {
    const pinned = pins.some((p) => p.id === l.id);
    return '<p class="' + l.c + '"><time>' + l.t + '</time>' + l.m +
      ' <button class="pin" data-act="' + (pinned ? 'unpin' : 'pin') + '" data-id="' + l.id + '" title="' + (pinned ? '고정 해제' : '일지 맨 위에 고정') + '">' + (pinned ? '해제' : '고정') + '</button></p>';
  }
  function viewLog() {
    let h = '<div class="sec">고정한 기록 · ' + pins.length + ' / ' + PIN_MAX + '</div>';
    h += pins.length ? '<div class="log pinned">' + pins.map(logLine).join('') + '</div>'
      : '<div class="empty">남겨 두고 싶은 기록의 "고정"을 누르면 여기 맨 위에 모입니다.</div>';
    return h + '<div class="sec">일지</div><div class="log" id="log" role="log" aria-live="polite">' + logs.slice().reverse().map(logLine).join('') + '</div>';
  }

  // 예리 Lv.5부터 재료별 채집 확률이 보이고, Lv.15(천리안) 전에는 아직 손에 넣어 본 적 없는 재료가 ??? 로 가려진다
  function areaChips(areaId) {
    const peek = G.canPreview(), odds = G.showOdds() ? G.herbOdds(areaId) : null;
    const pct = (id) => (odds && odds[id] !== undefined ? ' · ' + odds[id] + '%' : '');
    return '<div class="effects" style="margin:0">' + G.areaHerbs(areaId).map((h) => {
      if (!peek && !G.state.seen[h.id]) return '<span class="chip dim-chip" title="예리 Lv.15가 되면 미리 알 수 있다">???<span class="sub">' + pct(h.id) + '</span></span>';
      return '<span class="chip c-' + h.rarity + '" title="' + RAR[h.rarity] + '">' + h.name +
        '<span class="sub"> ' + CATN[h.cat] + (h.signature ? ' · 대표' : '') + pct(h.id) + (G.herbCount(h.id) ? ' · ×' + G.herbCount(h.id) : '') + '</span></span>';
    }).join('') + '</div>';
  }

  function oddsTable(areaId) {
    const kinds = ['short', 30, 60, 120, 180];
    const heads = ['단기', '30분', '1시간', '2시간', '3시간'];
    const rolls = [1, 3, 7, 15, 24];
    const odds = kinds.map((k) => G.gatherOdds(k, areaId));
    const rars = ['common', 'uncommon', 'rare', 'epic', 'legendary'].filter((r) => odds[0][r] !== undefined);
    let h = '<div class="tblwrap"><table class="tbl"><thead><tr><th>등급</th>' + heads.map((x) => '<th>' + x + '</th>').join('') + '</tr></thead><tbody>';
    h += '<tr><td>수확 재료 수</td>' + rolls.map((n) => '<td>' + n + '개</td>').join('') + '</tr>';
    rars.forEach((r) => {
      h += '<tr><td>' + rarSpan(r) + '</td>' + odds.map((o) => {
        const v = o[r]; return '<td class="' + (v === 0 ? 'zero' : '') + '">' + v + '%</td>';
      }).join('') + '</tr>';
    });
    return h + '</tbody></table></div>';
  }

  function toolChips() {
    const have = G.toolList().filter((t) => t.lv > 0);
    return have.length ? '<div class="effects" style="margin:0 0 4px">' + have.map((t) => '<span class="chip fx" title="' + t.label + '">' + t.name + ' Lv.' + t.lv + '</span>').join('') + '</div>' : '';
  }

  function viewGather() {
    const a = G.currentArea();
    if (a.noGather) {
      return '<p class="note">' + a.description + '</p><p class="note">이곳에서는 재료를 채집할 수 없다. 지도에서 다른 곳으로 이동하자.</p>';
    }
    let h = '<p class="note">재료는 지금 서 있는 곳에서 자랍니다. 단기 채집은 재료 1개를 바로 얻고 잠시 기다립니다. 장기 채집은 끝날 때 한꺼번에 얻고, 길수록 높은 등급이 많이 나옵니다.</p>';
    h += toolChips();
    const w = G.weatherAt(a.id), wn = G.weatherAt(a.id, 1);
    if (w) {
      h += '<div class="notice' + (w.bad ? ' bad' : '') + '" style="margin:8px 0">지금 날씨 <b>' + w.name + '</b> · ' + wxEffect(w) +
        (w.bad && protectionNote() ? ' · <b>' + protectionNote() + '</b>' : '') + ' <span class="sub">(' + fmtIn(w.startsInMs) + ' 뒤 ' + wn.name + ')</span></div>';
    }
    const known =a.herbs.filter((id) => G.state.seen[id]).length;
    h += '<div class="sec">' + a.name + '에서 얻는 재료 · ' + (G.canPreview() ? a.herbs.length + '종' : '발견 ' + known + ' / ' + a.herbs.length + '종') + '</div>' + areaChips(a.id);
    h += G.showOdds() ? '<div class="sec">이곳의 등급별 출현 확률</div>' + oddsTable(a.id)
      : '<p class="note" style="margin-top:10px">예리 Lv.5가 되면 이곳 재료의 채집 확률이 보인다.</p>';
    if (G.toolLv('pickaxe') === 0 && G.areaHerbs(a.id).some((x) => x.cat === '광' || x.cat === '보')) {
      h += '<p class="note" style="margin-top:10px">곡괭이가 없어서 광물과 보석은 거의 캘 수 없습니다. 도구 거리에서 장만하세요.</p>';
    }
    const own = G.areaHerbs(a.id).find((x) => x.rarity === 'legendary');
    h += '<p class="note" style="margin-top:10px">전설 재료는 위 확률표에 나오지 않습니다. 장기 채집을 마칠 때마다 1% 확률로 한 포기를 보너스로 얻고, ' +
      (own ? (G.canPreview() || G.state.seen[own.id] ? '이곳에서는 <b style="font-weight:400;color:var(--r4)">' + own.name + '</b>이(가) 나옵니다.' : '이곳에는 아직 본 적 없는 전설 재료가 자란다고 한다.') : '이곳에는 전설 재료가 자라지 않아 다른 지역의 전설 재료가 나옵니다.') +
      ' 이곳에 없는 등급은 표에서 빠지고, 남은 등급끼리 비율을 다시 나눕니다.</p>';
    return h;
  }

  // ------------------------------------------------------------ 그림 지도
  // 대지역마다 무리를 지어 두고 무리 사이에 땅이 겹치지 않을 간격을 둔다 (겹침은 개발자 도구에서 __mapOverlaps() 로 검사)
  const POS = {
    // 은빛 초원 (서쪽)
    moon_hill: [95, 230], golden_field: [225, 200], violet_orchard: [115, 350], shade_rest: [245, 335],
    // 구름 산맥 (북쪽)
    wind_cliff: [360, 130], snow_ridge: [480, 70], first_peak: [610, 70], storm_hill: [700, 150],
    // 푸른 물가 (남쪽)
    mist_lake: [480, 610], star_valley: [640, 590], sea_cave: [580, 700], dawn_marsh: [790, 600],
    // 잿불 화산 (북동쪽)
    ash_ruins: [850, 130], lava_shrine: [960, 80], burnt_forest: [980, 220], volcano_foot: [860, 270],
    // 속삭이는 동굴 (남서쪽)
    moss_cave: [100, 560], rock_cave: [240, 600], quartz_cave: [130, 690], ice_cave: [270, 720],
    // 중앙 마을 별나루
    camp: [500, 370], market: [620, 340], tool_street: [560, 450], town_hall: [440, 285],
    // 고요한 숲 (동쪽)
    dew_path: [1010, 400], whisper_oak: [1130, 330], mushroom_grove: [1140, 470], firefly_glade: [1030, 560], heart_root: [1130, 630],
  };
  const MAP_S = 1.25, MAP_W = 1250, MAP_H = 780;    // MAP_S: 지점 그림(원판·글리프)을 키우는 배율
  const TERRAIN = { node: 50, hubNode: 44, mid: 42, hubMid: 38, join: 160, coast: 7 };   // 땅(섬) 모양의 크기
  const MAP_ZOOMS = [1, 1.35, 1.75, 2.25];       // 지도 확대 단계 (100% 는 칸에 꽉 차게)
  const GLYPH = {
    moon_hill: 'hill', golden_field: 'field', violet_orchard: 'orchard', shade_rest: 'shade',
    wind_cliff: 'cliff', snow_ridge: 'ridge', storm_hill: 'storm', first_peak: 'peak',
    mist_lake: 'lake', sea_cave: 'sea', dawn_marsh: 'marsh', star_valley: 'valley',
    volcano_foot: 'volcano', burnt_forest: 'burnt', ash_ruins: 'ruins', lava_shrine: 'shrine',
    moss_cave: 'mosscave', rock_cave: 'rockcave', quartz_cave: 'quartz', ice_cave: 'ice',
    camp: 'camp', market: 'market', tool_street: 'anvil', town_hall: 'hall',
    dew_path: 'trail', whisper_oak: 'oak', mushroom_grove: 'grove', firefly_glade: 'glade', heart_root: 'roots',
  };
  const GLYPH_SVG = {
    hill: '<path d="M2 19q6-14 12 0M9 19q6-10 13 0"/>',
    field: '<path d="M6 21V9M12 21V6M18 21V9M6 9L4 7M6 9l2-2M12 6l-2-2M12 6l2-2M18 9l-2-2M18 9l2-2"/>',
    orchard: '<path d="M12 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM12 14.5V21M9 21h6"/><circle cx="10" cy="8.5" r=".6"/><circle cx="14" cy="10.5" r=".6"/>',
    shade: '<path d="M3 13c0-5 4-8 9-8s9 3 9 8zM12 13v8M8 21h8"/>',
    cliff: '<path d="M3 20l6-12 3 6 3-8 6 14z"/>',
    ridge: '<path d="M2 20L12 4l10 16zM7.5 12.5l4.5 3 4.5-3"/>',
    storm: '<path d="M7 15a4 4 0 0 1 .5-8 5 5 0 0 1 9.5 1.5A3.5 3.5 0 0 1 17 15zM12 15l-2 3h3l-2 4"/>',
    peak: '<path d="M2 21l7-10 4 5 3-4 6 9zM17 3.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>',
    lake: '<path d="M3 9q3-3 6 0t6 0t6 0M3 15q3-3 6 0t6 0t6 0"/>',
    sea: '<path d="M2 18q3-3 6 0t6 0t6 0M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>',
    marsh: '<path d="M7 21V9M12 21V5M17 21V9M4 21h16"/><circle cx="7" cy="7.5" r="1.3"/><circle cx="12" cy="3.5" r="1.3"/><circle cx="17" cy="7.5" r="1.3"/>',
    valley: '<path d="M3 8l9 13 9-13M12 1.5v5M9.5 4h5"/>',
    volcano: '<path d="M3 21l5-11h8l5 11zM12 9c-2-2 0-4 0-7 2 2 2 5 0 7"/>',
    burnt: '<path d="M12 21V9M12 15l-4-4M12 12l4-4"/><circle cx="8" cy="6" r=".8"/><circle cx="17" cy="14" r=".8"/><circle cx="15" cy="4" r=".8"/>',
    ruins: '<path d="M4 21h16M7 21V9M12 21V6M17 21V9M4.5 9h5M9.5 6h5M14.5 9h5"/>',
    shrine: '<path d="M5 21V11a7 7 0 0 1 14 0v10M9 21v-8a3 3 0 0 1 6 0v8"/>',
    mosscave: '<path d="M3 20c0-9 4-14 9-14s9 5 9 14z"/><circle cx="9" cy="16" r=".9"/><circle cx="13" cy="13" r=".9"/><circle cx="15.5" cy="17" r=".9"/>',
    rockcave: '<path d="M3 20c0-9 4-14 9-14s9 5 9 14zM9 7v4M13 6.5v5"/>',
    quartz: '<path d="M12 2l5 7-5 13-5-13zM7 9h10M12 2v20"/>',
    ice: '<path d="M12 2v20M3.5 7l17 10M20.5 7l-17 10"/>',
    camp: '<path d="M3 20L12 5l9 15zM12 20v-6M9 20h6"/>',
    market: '<path d="M3 9l2-5h14l2 5M3 9c0 2 4 2 4 0 0 2 4 2 5 0 0 2 4 2 5 0 0 2 4 2 4 0M5 12v8h14v-8"/>',
    anvil: '<path d="M4 8h13c0 3-2 4-5 4v3h4v4H8v-4h4v-3C8 12 5 11 4 8zM17 8h3"/>',
    hall: '<path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6M12 5V2l3 1.2-3 1.2"/>',
    trail: '<path d="M5 21c2-5 0-8 4-10s1-6 6-8M9 21c4 0 6-2 6-5M16 12l2-1M13 8l2-1"/><circle cx="18" cy="17" r="1"/>',
    oak: '<path d="M12 21v-7M9 21h6M12 14c-5 0-7-4-4.5-7C8 4 11 3 12 3s4 1 4.5 4c2.5 3 .5 7-4.5 7zM10 10l2 2 2-3"/>',
    grove: '<path d="M3 13c0-4 3-6 5-6s5 2 5 6zM6 13v5M10 13v5M15 15c0-3 2-4.5 3.5-4.5S22 12 22 15zM18.5 15v5"/>',
    glade: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    roots: '<path d="M12 3v6M12 9c-3 1-5 3-5 6M12 9c3 1 5 3 5 6M12 9c0 4-1 7-1 12M7 15c-2 1-3 3-3 6M17 15c2 1 3 3 3 6"/>',
  };
  const REGION_FILL = { grassland: '--m-grass', mountain: '--m-mount', waters: '--m-water', volcano: '--m-lava', caves: '--m-cave', forest: '--m-forest', center: '--m-town' };
  const LINKS = Alchemy.LINKS;       // 길 목록은 엔진(ext3.js)이 이동 시간 계산에도 쓴다
  let selArea = G.state.location;

  function mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function decoPath(region, x, y) {
    const f = (n) => n.toFixed(1);
    if (region === 'mountain') return 'M' + f(x - 7) + ' ' + f(y + 5) + 'l7-12 7 12z';
    if (region === 'grassland') return 'M' + f(x) + ' ' + f(y) + 'l-3-6M' + f(x) + ' ' + f(y) + 'v-8M' + f(x) + ' ' + f(y) + 'l3-6';
    if (region === 'waters') return 'M' + f(x - 8) + ' ' + f(y) + 'q4-4 8 0t8 0';
    if (region === 'volcano') return 'M' + f(x - 4) + ' ' + f(y + 4) + 'l4-6-1 5 5-4';
    if (region === 'center') return 'M' + f(x - 5) + ' ' + f(y + 4) + 'h10v-6l-5-4-5 4z';
    if (region === 'forest') return 'M' + f(x) + ' ' + f(y + 6) + 'v-6M' + f(x - 5) + ' ' + f(y) + 'a5 5 0 1 1 10 0z';
    return 'M' + f(x - 2.5) + ' ' + f(y) + 'a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0';
  }
  // 대지역 하나의 땅 모양을 이루는 원들 [x, y, 반지름] — 가까운 지점 사이에는 중간 원을 더해 한 덩어리로 잇는다
  function regionCircles(r) {
    const hub = r.id === 'center', pts = r.areas.map((a) => POS[a.id]);
    const circles = pts.map((p) => [p[0], p[1], hub ? TERRAIN.hubNode : TERRAIN.node]);
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      if (Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) < TERRAIN.join) {
        circles.push([(pts[i][0] + pts[j][0]) / 2, (pts[i][1] + pts[j][1]) / 2, hub ? TERRAIN.hubMid : TERRAIN.mid]);
      }
    }
    return circles;
  }
  // 서로 다른 대지역의 땅(바닷가 테두리 포함)이 닿거나 겹치는 쌍을 찾는다. 간격이 gap 보다 좁으면 보고한다.
  function mapOverlaps(gap) {
    const need = gap === undefined ? 14 : gap, out = [];
    const rs = G.regionList.map((r) => ({ id: r.id, c: regionCircles(r) }));
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      let min = 1e9;
      rs[i].c.forEach((a) => rs[j].c.forEach((b) => { min = Math.min(min, Math.hypot(a[0] - b[0], a[1] - b[1]) - a[2] - b[2] - 2 * TERRAIN.coast); }));
      if (min < need) out.push(rs[i].id + '~' + rs[j].id + ':' + Math.round(min));
    }
    return out;
  }
  window.__mapOverlaps = mapOverlaps;

  function decorPoints(regionId, pts, circles) {
    const rnd = mulberry(regionId.split('').reduce((s, c) => s * 31 + c.charCodeAt(0), 7));
    const out = []; let tries = 0;
    while (out.length < 20 && tries < 700) {
      tries++;
      const c = pts[Math.floor(rnd() * pts.length)];
      const ang = rnd() * 6.283, d = (50 + rnd() * 50) * MAP_S;
      const x = c[0] + Math.cos(ang) * d, y = c[1] + Math.sin(ang) * d;
      if (x < 24 || x > MAP_W - 24 || y < 24 || y > MAP_H - 24) continue;
      if (pts.some((p) => Math.hypot(p[0] - x, p[1] - y) < 62)) continue;     // 지점의 이름표 자리를 비워 둔다
      if (!circles.some((cc) => Math.hypot(cc[0] - x, cc[1] - y) < cc[2] - 8)) continue;   // 자기 땅 안에만 그린다
      if (out.some((o) => Math.hypot(o[0] - x, o[1] - y) < 30)) continue;
      out.push([x, y]);
    }
    return out;
  }

  // 이름이 길면 두 줄로 나눈다 ("나무 그늘 쉼터" → "나무 그늘 / 쉼터")
  function labelLines(name) {
    const w = name.split(' ');
    if (w.length < 2 || name.length <= 6) return [name];
    let best = 1, diff = 1e9;
    for (let i = 1; i < w.length; i++) {
      const d = Math.abs(w.slice(0, i).join(' ').length - w.slice(i).join(' ').length);
      if (d < diff) { diff = d; best = i; }
    }
    return [w.slice(0, best).join(' '), w.slice(best).join(' ')];
  }

  // 이름표 자리: 아래 → 위 → 오른쪽 → 왼쪽 순으로, 다른 지점과 다른 이름표를 가리지 않는 첫 자리를 고른다
  let labelCache = null;
  function layoutLabels() {
    if (labelCache) return labelCache;
    const R = 48, FS = 21, LH = 23, off = 36 * MAP_S;
    const nodes = [];
    G.regionList.forEach((r) => r.areas.forEach((a) => nodes.push({ id: a.id, p: POS[a.id], lines: labelLines(a.name) })));
    const wOf = (t) => Array.from(t).reduce((s, ch) => s + (ch === ' ' ? 7 : /[ㄱ-힣]/.test(ch) ? FS : 12), 0) + 8;
    const placed = [], out = {};
    nodes.forEach((n) => {
      const w = Math.max.apply(null, n.lines.map(wOf)), h = n.lines.length * LH, extra = (n.lines.length - 1) * LH;
      const mid = -extra / 2 + 7;
      const cands = [
        { anchor: 'middle', x: 0, y: off + 28, bx: -w / 2 },
        { anchor: 'middle', x: 0, y: -(off + 12) - extra, bx: -w / 2 },
        { anchor: 'start', x: off + 10, y: mid, bx: off + 10 },
        { anchor: 'end', x: -(off + 10), y: mid, bx: -(off + 10) - w },
      ];
      let best = null, bestScore = 1e9;
      cands.forEach((c) => {
        const bx = n.p[0] + c.bx, by = n.p[1] + c.y - FS;
        let score = 0;
        if (bx < 4 || bx + w > MAP_W - 4 || by < 4 || by + h > MAP_H - 4) score += 100;
        nodes.forEach((m) => {
          if (m.id === n.id) return;
          const cx = Math.max(bx, Math.min(m.p[0], bx + w)), cy = Math.max(by, Math.min(m.p[1], by + h));
          if (Math.hypot(cx - m.p[0], cy - m.p[1]) < R) score += 10;
        });
        placed.forEach((q) => { if (bx < q.x + q.w && q.x < bx + w && by < q.y + q.h && q.y < by + h) score += 10; });
        if (score < bestScore) { bestScore = score; best = c; }
      });
      out[n.id] = best;
      placed.push({ x: n.p[0] + best.bx, y: n.p[1] + best.y - FS, w: w, h: h });
    });
    return (labelCache = out);
  }

  function buildMapSvg() {
    const loc = G.state.location;
    let s = '<svg viewBox="0 0 ' + MAP_W + ' ' + MAP_H + '" style="width:' + Math.round(UI.mapZoom * 100) + '%" role="group" aria-label="세계 지도. 지점을 눌러 지역을 고르세요.">';
    s += '<defs><filter id="goo" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur in="SourceGraphic" stdDeviation="9" result="b"/>' +
      '<feColorMatrix in="b" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"/></filter>';
    Object.keys(GLYPH_SVG).forEach((k) => {
      s += '<symbol id="gl-' + k + '" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + GLYPH_SVG[k] + '</g></symbol>';
    });
    s += '</defs>';

    // 지형: 지역마다 원들을 합쳐 부드러운 섬 모양을 만든다 (중앙 마을이 맨 위에 그려진다)
    G.regionList.forEach((r) => {
      const pts = r.areas.map((a) => POS[a.id]);
      const circles = regionCircles(r);
      const mk = (grow) => circles.map((c) => '<circle cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="' + (c[2] + grow).toFixed(1) + '"/>').join('');
      s += '<g filter="url(#goo)" style="fill:var(--m-coast)">' + mk(TERRAIN.coast) + '</g>';
      s += '<g filter="url(#goo)" style="fill:var(' + REGION_FILL[r.id] + ')">' + mk(0) + '</g>';
      s += '<g class="deco-layer">' + decorPoints(r.id, pts, circles).map((p) => '<path class="deco" d="' + decoPath(r.id, p[0], p[1]) + '"/>').join('') + '</g>';
    });

    // 길
    s += LINKS.map((l) => '<path class="link" d="M' + POS[l[0]].join(' ') + 'L' + POS[l[1]].join(' ') + '"/>').join('');

    // 나침반 장식
    s += '<g transform="translate(78 84) scale(1.25)" class="deco"><circle r="22"/><path d="M0-30L6 0 0 30-6 0z"/><path d="M-30 0L0 6 30 0 0-6z"/></g>';

    // 클릭 지점
    G.regionList.forEach((r) => r.areas.forEach((a) => {
      const p = POS[a.id];
      const cls = 'node' + (a.id === loc ? ' here' : '') + (a.id === selArea ? ' sel' : '');
      const lines = labelLines(a.name), L = layoutLabels()[a.id];
      s += '<g class="' + cls + '" data-act="select-area" data-id="' + a.id + '" transform="translate(' + p[0] + ' ' + p[1] + ')" tabindex="0" role="button" aria-label="' + r.name + ' ' + a.name + '">' +
        '<title>' + a.name + '</title>' +
        '<g transform="scale(' + MAP_S + ')">' +
        '<circle r="40" fill="transparent"/><circle class="ring" r="36"/><circle class="disc" r="29"/>' +
        '<use class="glyph" href="#gl-' + GLYPH[a.id] + '" x="-16" y="-16" width="32" height="32"/>' +
        (a.id === loc ? '<path class="flag" d="M-1 -34v-18l16 6.5-16 6.5z"/><path d="M-1 -34v-18" stroke="var(--ember)" stroke-width="2.5" stroke-linecap="round"/>' : '') +
        '</g>' +
        '<text class="lbl" text-anchor="' + L.anchor + '" x="' + L.x + '" y="' + L.y + '">' + lines.map((t, i) => '<tspan x="' + L.x + '" dy="' + (i ? 23 : 0) + '">' + t + '</tspan>').join('') + '</text>' +
        '</g>';
    }));
    return s + '</svg>';
  }

  function areaInfoHtml(id) {
    const a = G.areas[id];
    const here = G.state.location === id;
    if (here) return '';       // 지금 있는 곳은 지도 아래 "지금 위치" 영역에 따로 그린다
    // 지도에서 고른 곳을 간단히 보여 주는 카드: 이동 시간과 이동 버튼만. 자세한 정보는 "자세히" 오버레이에서 본다.
    const busy = G.state.phase !== 'idle';
    const plan = G.travelPlan(G.state.location, id, UI.useBroom);
    const wxHere = G.weatherAt(id);
    return '<div class="sc-head"><div><h3 class="mi-name">' + a.name + '</h3><div class="sub">' + a.regionName + ' · ' + a.type + '</div></div>' +
      '<div class="sc-time">' + (plan.instant ? '바로 도착' : plan.minutes + '분') + '</div></div>' +
      '<div class="sc-chips">' + (wxHere ? wxChip(wxHere) : '') + (a.noGather ? '<span class="chip">' + a.service + '</span>' : '<span class="chip">재료 <b>' + a.herbs.length + '종</b></span>') +
      (plan.instant ? '' : '<span class="chip">기본 <b>' + plan.base + '분</b>' + (plan.cut ? ' → -' + Math.round(plan.cut * 100) + '%' : '') + '</span>') + '</div>' +
      '<div class="actions"><button class="btn primary" data-act="travel" data-id="' + id + '"' + (busy ? ' disabled' : '') + '>이동하기</button>' +
      (G.warpReady() ? '<button class="btn" data-act="warp" data-id="' + id + '"' + (busy ? ' disabled' : '') + '>순간 이동 (오늘 1회)</button>' : '') +
      '<button class="btn ghost" data-act="open-ov" data-key="area" data-arg="' + id + '">자세히</button></div>' +
      (plan.broomOwned ? '<label class="sub" style="display:block"><input type="checkbox" data-act="toggle-broom"' + (UI.useBroom !== false ? ' checked' : '') + '> 마법의 빗자루 타기 (이동 -20%, 마나 ' + plan.broomMana + ')' +
        (UI.useBroom !== false && !plan.instant && !plan.broom ? ' — 마나가 모자라 걸어서 간다' : '') + '</label>' : '') +
      (busy ? '<p class="sub" style="margin:0">채집이나 이동 중에는 새로 이동할 수 없다.</p>' : '');
  }
  function capText(id) { const a = G.areas[id]; return a.regionName + ' · ' + a.name; }

  // "자세히" 오버레이: 지역 설명, 날씨, 얻을 수 있는 재료
  function areaDetailHtml(id) {
    const a = G.areas[id], wx = G.weatherAt(id);
    let h = '<p class="note" style="margin-top:0">' + a.regionName + ' · ' + a.type + '. ' + a.description + '</p>';
    if (wx) h += '<div class="notice' + (wx.bad ? ' bad' : '') + '" style="margin-bottom:12px">지금 날씨 ' + wxChip(wx) + ' ' + wxEffect(wx) + '</div>';
    if (a.noGather || a.service) h += '<div class="effects" style="margin:0 0 12px"><span class="chip fx">' + a.service + '</span></div>';
    if (a.herbs.length) h += '<div class="sec">얻을 수 있는 재료 · ' + a.herbs.length + '종</div>' + areaChips(id);
    return h;
  }

  function viewMap() {
    const busy = G.state.phase === 'expedition';
    if (!G.areas[selArea]) selArea = G.state.location;
    const z = UI.mapZoom;
    // 거점 복귀(마을 레벨 2부터, 시간 소모 없음, 재사용 1시간)는 지도 도구줄에 둔다
    let home = '';
    if (G.homeUnlocked()) {
      const left = G.homeLeftMs(), idle = G.state.phase === 'idle', here = G.state.location === 'camp';
      home = '<button class="btn small" data-act="go-home"' + (!idle || here || left > 0 ? ' disabled' : '') + ' title="시간 소모 없음 · 재사용 1시간">거점 복귀' +
        (left > 0 ? ' · ' + fmt(Math.ceil(left / msPerMin() * 60)) : '') + '</button>';
    }
    return '<div class="mapcard"><div class="maptool"><div class="mt-left"><span class="mapcap" id="mapcap">' + capText(selArea) + '</span></div>' +
      '<div class="actions"><button class="btn small" data-act="open-ov" data-key="forecast">날씨 예보</button>' + home +
      '<button class="btn small" data-act="map-zoom" data-d="-1"' + (z <= MAP_ZOOMS[0] ? ' disabled' : '') + ' aria-label="지도 축소">−</button>' +
      '<span class="sub">' + Math.round(z * 100) + '%</span>' +
      '<button class="btn small" data-act="map-zoom" data-d="1"' + (z >= MAP_ZOOMS[MAP_ZOOMS.length - 1] ? ' disabled' : '') + ' aria-label="지도 확대">＋</button></div></div>' +
      '<div class="mapwrap' + (busy ? ' busy' : '') + '">' + buildMapSvg() + '</div>' +
      '<div class="legend"><span><i></i>현재 위치</span><span><i class="sel"></i>고른 지점</span><span>점선은 길입니다</span>' +
      G.regionList.map((r) => '<span><i class="sw" style="background:var(' + REGION_FILL[r.id] + ')"></i>' + r.name + '</span>').join('') + '</div></div>' +
      '<div class="selcard" id="mapinfo">' + areaInfoHtml(selArea) + '</div>';
  }

  // "지금 위치" 카드: 장소의 이름과 설명, 그 장소에서 할 수 있는 일의 버튼만 둔다. 내용은 모두 오버레이로 연다.
  function placeCard() {
    const a = G.currentArea(), s = G.state, wx = G.weatherAt(a.id);
    const hub = HUB_IDS.indexOf(a.id) >= 0;
    const open = (key, label, cls) => '<button class="btn ' + (cls || '') + '" data-act="open-ov" data-key="' + key + '">' + label + '</button>';
    let chips = wx ? wxChip(wx) : '';
    let acts = '', note = '';
    if (s.phase === 'travel') {
      const ct = s.currentTravel;
      return '<section class="placecard" id="here"><div class="pc-kicker">이동 중</div><h2>' + G.areas[ct.from].name + ' → ' + G.areas[ct.to].name + '</h2>' +
        '<p class="pc-desc">길을 가는 중이다. 왼쪽 타이머가 끝나면 도착한다. 이동하는 동안에는 채집·제작·거래를 할 수 없다.</p></section>';
    }
    if (!hub) {
      chips += '<span class="chip">단기 <b>' + G.shortLeft() + '회 남음</b></span>';
      if (s.phase === 'expedition') { note = '<p class="pc-desc">장기 채집 중이다. 끝날 때까지 이동하거나 새로 채집할 수 없다.</p>'; acts = open('scroll', '채집 스크롤 펼치기', 'primary big'); }
      else acts = open('gather', '채집하기', 'primary big');
    } else if (a.id === 'camp') {
      chips += '<span class="chip">창고 <b>' + G.storageUsed() + '/' + capTxt() + '칸</b></span>';
      acts = open('camp', '거점 관리', 'primary big') + '<button class="btn big" data-act="goto-goods">공방 열기</button>' + open('npc', '대화하기', 'ghost');
    } else if (a.id === 'market') {
      acts = open('market', '거래하기', 'primary big') + open('npc', '대화하기', 'ghost');
    } else if (a.id === 'tool_street') {
      acts = open('tools', '도구 구경하기', 'primary big') + open('npc', '대화하기', 'ghost');
    } else {
      const bi = G.boardInfo();
      chips += '<span class="chip">티켓 <b>' + bi.tickets + '장</b></span><span class="chip">마을 <b>Lv.' + G.townInfo().lv + '</b></span>';
      acts = open('board', '의뢰 게시판', 'primary big') + open('upgrade', '마을 업그레이드', 'big') + open('story', '세계수 이야기', 'big') + open('npc', '대화하기', 'ghost');
    }
    return '<section class="placecard" id="here"><div class="pc-head"><div><div class="pc-kicker">지금 위치 · ' + a.regionName + '</div><h2>' + a.name + '</h2></div>' +
      '<div class="pc-chips">' + chips + '</div></div><p class="pc-desc">' + a.description + '</p>' + note +
      (acts ? '<div class="pc-actions">' + acts + '</div>' : '') + '</section>';
  }

  // 채집 오버레이: 채집 버튼과 이 지역의 재료·확률. 방금 한 단기 채집의 결과도 여기에 보인다.
  function gatherOverlayHtml() {
    return (UI.lastGather ? '<div class="notice" style="margin-bottom:12px">' + UI.lastGather + '</div>' : '') + gatherButtons() +
      '<div style="margin-top:16px">' + viewGather() + '</div>';
  }

  // 메인 탭: 지도 + 고른 곳 카드 + 지금 위치 카드
  function goalsHtml() {
    const g = G.nextGoals(), ev = G.state.evt;
    let h = '';
    if (ev) h += '<div class="notice" style="margin-top:10px"><b>길 위의 사건이 기다린다</b> · ' + G.eventInfo().title + ' <button class="btn small" data-act="open-ov" data-key="event">열어 보기</button></div>';
    if (g.length) h += '<div class="notice goals" style="margin-top:10px"><b>다음 목표</b><ul class="skills" style="margin:6px 0 0">' + g.map((t) => '<li>' + t + '</li>').join('') + '</ul></div>';
    return h;
  }
  function viewMain() {
    return viewMap() + placeCard() + goalsHtml();
  }
  function drawMapSel() {
    document.querySelectorAll('.node').forEach((n) => n.classList.toggle('sel', n.dataset.id === selArea));
    const info = $('#mapinfo'), cap = $('#mapcap');
    if (info) info.innerHTML = areaInfoHtml(selArea);
    if (cap) cap.textContent = capText(selArea);
  }

  // ------------------------------------------------------------ 가방
  function viewBag() {
    const busy = G.state.phase === 'expedition';
    const total = G.herbList.reduce((a, h) => a + G.herbCount(h.id), 0);
    const potionTotal = G.ownedPotions().reduce((a, p) => a + G.potionCount(p.id), 0);
    const goods = G.goodList.filter((g) => (G.state.goods[g.id] || 0) > 0);
    const goodTotal = goods.reduce((a, g) => a + G.state.goods[g.id], 0);
    let h = seg('bagMode', [['item', '재료 · ' + total], ['potion', '물약 · ' + potionTotal], ['good', '물건 · ' + goodTotal]]);
    h += '<div style="margin-top:12px">';
    const used = G.storageUsed(), cap = G.storageCap(), pend = G.pendingCount();
    h += '<div class="actions" style="margin-top:10px"><span class="sub">재료 창고 <b class="cnt">' + used + ' / ' + capTxt() + '칸</b>' + (pend ? ' · <span class="down">보류 ' + pend + '개</span>' : '') +
      '</span>' + (pend ? '<button class="btn small" data-act="claim-pending"' + (G.state.location !== 'camp' || used >= cap ? ' disabled' : '') + '>보류 재료 받기</button><span class="sub">(거점에서)</span>' : '') + '</div>';
    if (UI.bagMode === 'potion') {
      h += potionTierBar() +
        '<input type="search" id="potq" class="search" placeholder="이름·효과·등급으로 찾기 (예: 3, 3등급, 희귀)" value="' + UI.potQ.replace(/"/g, '&quot;') + '" aria-label="물약 찾기">' +
        '<div class="rows" id="potlist">' + potionListHtml() + '</div>';
      if (busy) h += '<p class="note" style="margin-top:10px">장기 채집 중에는 물약을 마실 수 없습니다.</p>';
    } else if (UI.bagMode === 'good') {
      h += goods.length ? '<div class="rows">' + goods.map((g) =>
        '<div class="row"><div class="info"><div class="name">' + g.name + ' <span class="cnt">×' + G.state.goods[g.id] + '</span></div><div class="desc">' + g.desc + '</div></div></div>').join('') + '</div>'
        : '<div class="empty">만든 물건이 없습니다. 거점의 공방에서 만들 수 있습니다.</div>';
    } else {
      const items = invItems(UI.bagCat, UI.bagRar);
      h += rarBar('bagRar') + catBar('bagCat');
      h += items.length ? '<div class="rows">' + items.map((x) =>
        itemRow(x, '<span class="cnt">×' + G.herbCount(x.id) + '</span>')).join('') + '</div>'
        : '<div class="empty">' + (total ? '이 분류의 재료가 없습니다.' : '아직 재료가 없습니다. 단기 채집을 눌러 보세요.') + '</div>';
    }
    return h + '</div>';
  }

  // 물약 탭: 등급 버튼(개수 표시)과 검색어로 거른다. 검색어가 숫자뿐이면 그 등급만, 아니면 이름·효과·등급 이름에서 찾는다.
  function potionTierBar() {
    const all = G.ownedPotions();
    const opts = [['*', '전체 · ' + all.length]].concat([1, 2, 3, 4].map((t) => [String(t), t + '등급 · ' + all.filter((p) => p.tier === t).length]));
    return '<div class="pick fbar">' + opts.map((x) =>
      '<button data-act="ui" data-key="potTier" data-val="' + x[0] + '" aria-pressed="' + (UI.potTier === x[0]) + '">' + x[1] + '</button>').join('') + '</div>';
  }
  function potionListHtml() {
    const busy = G.state.phase === 'expedition';
    const q = UI.potQ.trim();
    const all = G.ownedPotions();
    const list = all.filter((p) => {
      if (UI.potTier !== '*' && String(p.tier) !== UI.potTier) return false;
      if (!q) return true;
      if (/^\d+$/.test(q)) return String(p.tier) === q;
      return p.name.indexOf(q) >= 0 || p.description.indexOf(q) >= 0 || RAR[p.rarity].indexOf(q) >= 0 || (p.tier + '등급').indexOf(q) >= 0;
    });
    if (!list.length) return '<div class="empty">' + (all.length ? '조건에 맞는 물약이 없습니다.' : '만든 물약이 없습니다. 연금술 탭에서 재료를 섞어 보세요.') + '</div>';
    return list.map((p) =>
      '<div class="row"><div class="info"><div class="name">' + p.name + ' ' + rarSpan(p.rarity) + ' <span class="sub">' + p.tier + '등급</span> <span class="cnt">×' + G.potionCount(p.id) + '</span></div><div class="desc">' + p.description + '</div></div>' +
      '<button class="btn small" data-act="drink" data-id="' + p.id + '"' + (busy ? ' disabled' : '') + '>마시기</button></div>').join('');
  }

  // ------------------------------------------------------------ 연금술
  function pickListHtml() {
    const busy = G.state.phase === 'expedition';
    const q = UI.pickQ.trim();
    const list = invItems(UI.pickCat, UI.pickRar).filter((h) => !q || h.name.indexOf(q) >= 0 || h.traits.join('').indexOf(q) >= 0);
    return list.length ? list.map((x) =>
      '<button class="c-' + x.rarity + '" data-act="pick" data-id="' + x.id + '" aria-pressed="' + picked.includes(x.id) + '"' + (busy ? ' disabled' : '') +
      ' title="' + x.traits.join('·') + '">' + x.name + ' ×' + G.herbCount(x.id) + '</button>').join('')
      : '<div class="empty">' + (q ? '찾는 재료가 없습니다.' : '재료가 없습니다. 먼저 채집하세요. (테스트 도구에서 재료를 받을 수 있습니다)') + '</div>';
  }

  function viewBrewPotion() {
    const busy = G.state.phase === 'expedition';
    picked = picked.filter((id) => G.herbCount(id) > 0);
    const cb = G.toolLv('cauldron'), maxIng = G.maxIngredients();
    let h = '<p class="note">' + (busy ? '장기 채집 중에는 연금술을 할 수 없습니다.' :
      '재료를 2~' + maxIng + '가지 고르세요. (3가지는 지성 Lv.15, 4가지는 Lv.20부터) 순서는 상관없습니다. 재료가 가진 기운이 가장 짙은 두 가지가 물약의 성격을 정하고, 재료의 등급이 높을수록 높은 등급의 물약이 나옵니다. 조합할 때마다 마나를 쓰고, 실패하면 재료를 잃습니다.') + '</p>';
    h += '<p class="note" style="margin-top:-4px">지성 Lv.' + G.abilLv('int') + ' (물약 ' + G.tierCap() + '등급까지) · 재주 Lv.' + G.abilLv('craft') +
      ' · 약탕기 Lv.' + cb + ' · 1등급 물약 기본 성공 확률 ' + G.baseBrewChance() + '% (등급이 오를 때마다 -8%p)</p>';
    h += '<div class="slots">';
    for (let i = 0; i < 4; i++) {
      if (picked[i]) h += '<span class="slot on">' + herbName(picked[i]) + '</span>';
      else h += '<span class="slot">' + (i < maxIng ? (i < 2 ? '재료 ' + (i + 1) : '(선택)') : (i === 2 ? '지성 Lv.15' : '지성 Lv.20')) + '</span>';
      if (i < 3) h += '<span class="plus">+</span>';
    }
    h += '</div>';
    let canMix = !busy && picked.length >= 2, canBulk = false;
    if (picked.length >= 2) {
      const pv = G.brewPreview(picked);
      canBulk = !!(pv && !pv.blocked && pv.bulk);
      if (pv.blocked) {
        canMix = false;
        h += '<p class="chance">기운 <b>' + pv.traits.join('·') + '</b> · ' + pv.blocked + '</p>';
      } else {
        const mana = Math.floor(G.manaNow());
        if (mana < pv.cost) canMix = false;
        h += '<p class="chance">기운 <b>' + pv.traits.join('·') + '</b> · ' +
          (pv.showRecipe ? '아는 조합 · <b>' + pv.recipe.name + '</b> (' + pv.recipe.tier + '등급) · 성공 확률 <b>' + pv.chance + '%</b>' : '처음 시도하는 조합입니다.') +
          ' · 마나 <b>' + pv.cost + '</b>' + (mana < pv.cost ? ' <span class="down">(모자란다)</span>' : '') + '</p>';
        if (pv.clamped) h += '<p class="note" style="margin-top:-6px">재료는 ' + pv.wanted + '등급감이지만 지성이 모자라 ' + pv.recipe.tier + '등급 물약이 된다.</p>';
      }
    }
    h += '<div class="actions" style="margin:0 0 14px"><button class="btn primary" data-act="mix"' + (canMix ? '' : ' disabled') + '>섞어서 끓이기</button>' +
      (G.has('craft', 5) ? [5, 10, 50].map((n) => '<button class="btn" data-act="mixmany" data-n="' + n + '"' + (canMix && canBulk ? '' : ' disabled') + '>' + (n === 50 ? '최대' : '×' + n) + '</button>').join('') : '') +
      '<button class="btn ghost" data-act="clear-pick"' + (picked.length ? '' : ' disabled') + '>다시 고르기</button></div>';
    h += '<div class="sec">가방 속 재료</div>' + rarBar('pickRar') + catBar('pickCat');
    h += '<input type="search" id="pickq" class="search" placeholder="이름이나 기운으로 찾기 (예: 평온)" value="' + UI.pickQ.replace(/"/g, '&quot;') + '" aria-label="재료 찾기">';
    h += '<div class="pick picklist" id="picklist">' + pickListHtml() + '</div>';
    return h;
  }

  // 물건 목록: 도구 분류 · "만들 수 있는 것만" · 검색어(이름·설명·필요 재료·지금 쓸 재료 이름)로 거른다
  function goodsListHtml() {
    const atCamp = G.state.location === 'camp', busy = G.state.phase === 'expedition';
    const q = UI.goodQ.replace(/\s+/g, '').toLowerCase();
    const rows = [];
    G.goodList.forEach((g) => {
      if (UI.goodsFilter === 'base' && g.tool) return;
      if (UI.goodsFilter === 'alembic' && g.tool !== 'alembic') return;
      if (UI.goodsFilter === 'forge' && g.tool !== 'forge') return;
      const pv = G.goodsPreview(g.id);
      if (UI.goodsFilter === 'can' && !pv.ok) return;
      const toolTxt = g.tool ? (g.tool === 'forge' ? '화로 Lv.' : '증류기 Lv.') + g.lv : '도구 없이';
      if (q) {
        const hay = (g.name + g.desc + reqText(g.req) + toolTxt + (pv.ok ? pickText(pv.pick) : '')).replace(/\s+/g, '').toLowerCase();
        if (hay.indexOf(q) < 0) return;
      }
      rows.push({ g: g, pv: pv, toolTxt: toolTxt });
    });
    if (!rows.length) return '<div class="empty">' + (UI.goodQ || UI.goodsFilter === 'can' ? '조건에 맞는 물건이 없습니다.' : '물건이 없습니다.') + '</div>';
    return rows.map((x) => {
      const g = x.g, pv = x.pv, toolTxt = x.toolTxt;
      const cost = G.manaCost('good', g.price);
      const can = pv.ok && atCamp && !busy && G.manaNow() >= cost;
      return '<div class="row' + (pv.locked ? ' dim' : '') + '"><div class="info"><div class="name">' + g.name +
        ' <span class="sub">' + toolTxt + ' · 마나 ' + cost + ' · 약 ' + G.goodPrice(g.id) + ' G' + (G.state.goods[g.id] ? ' · 보유 ×' + G.state.goods[g.id] : '') + '</span></div>' +
        '<div class="desc">' + reqText(g.req) + ' — ' + g.desc + '</div>' +
        '<div class="desc">' + (pv.ok ? '사용할 재료: ' + pickText(pv.pick) : pv.reason) + '</div></div>' +
        '<div class="actions"><button class="btn small" data-act="craft" data-id="' + g.id + '"' + (can ? '' : ' disabled') + '>만들기</button>' +
        (G.has('craft', 5) ? [5, 50].map((n) => '<button class="btn small" data-act="craftmany" data-id="' + g.id + '" data-n="' + n + '"' + (can ? '' : ' disabled') + '>' + (n === 50 ? '최대' : '×' + n) + '</button>').join('') : '') +
        '</div></div>';
    }).join('');
  }

  function viewBrewGoods() {
    const atCamp = G.state.location === 'camp';
    const filters = [['*', '전체'], ['can', '만들 수 있는 것'], ['base', '기본'], ['alembic', '증류기'], ['forge', '화로']];
    let h = '<p class="note">' + (atCamp ? '거점의 공방이다. 재료가 맞으면 값싼 재료부터 자동으로 골라 물건을 만든다. 물건은 거래소에서 판다.' :
      '물건은 거점의 공방에서만 만들 수 있다. 중앙 마을 탭에서 거점으로 이동하자.') + '</p>';
    h += '<div class="effects" style="margin:0 0 10px"><span class="chip">화로와 모루 Lv.' + G.toolLv('forge') + '</span><span class="chip">증류기 Lv.' + G.toolLv('alembic') + '</span></div>';
    h += seg('goodsFilter', filters);
    h += '<input type="search" id="goodq" class="search" style="margin-top:10px" placeholder="물건 이름·설명·재료로 찾기 (예: 반지, 광물, 향)" value="' + UI.goodQ.replace(/"/g, '&quot;') + '" aria-label="물건 찾기">';
    h += '<div class="rows" id="goodlist">' + goodsListHtml() + '</div>';
    return h;
  }

  function viewBrew() {
    return seg('brewMode', [['potion', '물약 만들기'], ['good', '물건 만들기']]) +
      '<div style="margin-top:12px">' + (UI.brewMode === 'potion' ? viewBrewPotion() : viewBrewGoods()) + '</div>';
  }

  // ------------------------------------------------------------ 중앙 마을
  // 마을 사람과 대화하면 특수 임무를 받는다. 하루에 받을 수 있는 수는 매력이 높을수록 늘어난다.
  function townNpc(loc) {
    const s = G.state, npc = G.npcOf(loc);
    let h = '<div class="sec">마을 사람 · ' + npc.name + '</div>';
    const used = s.talks[loc] || 0, limit = G.talkLimit();
    h += '<div class="desc" style="margin:0 0 8px">호감도 ' + hearts(G.favorHearts(loc)) + ' <span class="sub">' + G.favorHearts(loc) + ' / ' + G.favorMax() + ' · 이 사람의 임무를 마칠 때마다 오르고, 칸마다 임무 보상이 2% 늘어난다</span></div>';
    h += '<div class="actions"><button class="btn small" data-act="talk" data-id="' + loc + '"' + (used >= limit ? ' disabled' : '') + '>대화하기</button>' +
      '<span class="sub">오늘 받은 임무 ' + used + ' / ' + limit + ' (한 사람당 하루 최대 5건 · 매력 Lv.5마다 +1건)</span></div>';
    h += '<p class="sub" style="margin:8px 0 0">받은 임무와 의뢰는 오른쪽 "받은 의뢰" 칸에 모이고, 마을에서 납품한다.</p>';
    return h;
  }

  function hearts(n) { return '<span class="hearts" aria-label="호감도 ' + n + '칸">' + '♥'.repeat(n) + '<i>' + '♥'.repeat(G.favorMax() - n) + '</i></span>'; }

  // 받은 의뢰(마을 사람 임무 + 게시판 의뢰) — 오른쪽 채팅 위 칸. 납품은 중앙 마을에서만 된다.
  function renderQuests() {
    const el = $('#quests');
    if (!el) return;
    const ms = G.state.missions, inTown = HUB_IDS.indexOf(G.state.location) >= 0;
    const cnt = $('#questcount');
    if (cnt) cnt.textContent = ms.length ? '· ' + ms.length + '건' : '';
    el.innerHTML = ms.length ? ms.map((m) => {
      const pg = G.missionProgress(m), ok = pg.have >= pg.need;
      const task = m.type === 'task';
      const tag = m.legend ? '<span class="hot">전설</span> ' : m.demand ? '<span class="hot">수요</span> ' : m.special ? '<span class="hot">특별</span> ' : '';
      return '<div class="quest' + (ok ? ' ready' : '') + '"><div class="qmain"><div class="qt">' + tag + G.missionText(m).replace('[특별] ', '') + '</div>' +
        '<div class="sub">' + G.npcOf(m.npc).name + ' · 보상 <b class="gold">' + won(G.rewardOf(m)) + '</b> · ' + (task ? '진행 ' : '보유 ') + Math.min(pg.have, 999) + '/' + pg.need + '</div></div>' +
        '<button class="btn small" data-act="deliver" data-id="' + m.id + '"' + (ok && inTown ? '' : ' disabled') + ' title="' + (inTown ? '' : (task ? '완료 보고' : '납품') + '는 중앙 마을에서만 할 수 있다') + '">' + (task ? '완료' : '납품') + '</button></div>';
    }).join('') : '<div class="empty">받은 의뢰가 없다. 별나루 회관 게시판에서 받거나 마을 사람과 대화해 보자.</div>';
  }

  // 세계수 이야기: 최종 목표와 단서, NPC 호감도
  function storyHtml() {
    const ci = G.clueInfo();
    let h = '<p class="note" style="margin-top:0">고요한 숲의 뿌리 끝에는 세계수가 있다고 한다. 세계수는 이 대륙이 아닌 <b>대대륙</b>에 있고, 지금은 갈 방법이 없다. 의뢰를 마치다 보면 대대륙으로 가는 길의 단서를 얻을 수 있다.</p>';
    h += '<div class="notice"><b>대대륙</b> ' + (ci.route ? '<span class="up">길을 알아냈다 — 아직 갈 수는 없다</span>' : '<span class="down">가는 길을 모른다</span>') + ' · 단서 <b class="gold">' + ci.have + ' / ' + ci.need + '</b></div>';
    h += '<div class="sec">찾은 단서</div>' + (ci.texts.length ? '<div class="rows">' + ci.texts.map((t, i) =>
      '<div class="row"><div class="info"><div class="name">단서 ' + (i + 1) + '</div><div class="desc">' + t + '</div></div></div>').join('') + '</div>' : '<div class="empty">아직 찾은 단서가 없다.</div>');
    h += '<div class="sec">단서를 얻는 길</div><div class="rows">' +
      '<div class="row"><div class="info"><div class="name">게시판 의뢰</div><div class="desc">게시판 의뢰를 마칠 때 가끔 낡은 쪽지를 찾는다. (마을 레벨과 상관없이)</div></div></div>' +
      '<div class="row' + (ci.npcClues ? '' : ' dim') + '"><div class="info"><div class="name">마을 사람의 이야기</div><div class="desc">' + (ci.npcClues ? '사람마다 호감도 3·6·9칸에서 단서를 하나씩 말해 준다.' : '마을 레벨 4부터, 사람마다 호감도 3·6·9칸에서 단서를 말해 준다.') + '</div></div></div></div>';
    h += '<div class="sec">마을 사람 호감도 · 이야기</div><div class="rows">' + ['camp', 'market', 'tool_street', 'town_hall'].map((id) =>
      '<div class="row" style="display:block"><div class="name">' + G.npcOf(id).name + '</div><div class="desc">' + hearts(G.favorHearts(id)) + ' <span class="sub">' + G.favorHearts(id) + ' / ' + G.favorMax() + ' · 호감도 2·5·8·10칸에서 이야기가 열린다</span></div>' +
      G.sceneList(id).map((sc) => sc.got ? '<div class="desc" style="margin-top:6px">♥' + sc.h + ' · ' + sc.text + '</div>' : '<div class="desc sub" style="margin-top:6px">♥' + sc.h + ' · ???</div>').join('') + '</div>').join('') + '</div>';
    return treeHtml() + h;
  }

  // 세계수 묘목: 재료·물약·물건을 바쳐 키운다. 뿌리가 길을 알아야(단서) 다음 단계로 자란다.
  function treeHtml() {
    const t = G.treeInfo(), here = G.state.location === 'town_hall';
    let h = '<div class="sec">세계수 묘목 · ' + t.name + '</div>';
    h += '<div class="notice"><div>' + t.stages.map((x, i) => '<span class="chip" style="' + (x.reached ? '' : 'opacity:.45') + '">' + x.name + '</span>').join(' ') + '</div>';
    if (t.next) {
      const pct = Math.min(100, t.pts / t.next.need * 100);
      h += '<div class="bar focus" style="margin:10px 0 4px"><i style="width:' + pct + '%"></i></div>' +
        '<div class="sub">다음 \'' + t.next.name + '\'까지 자양분 ' + t.pts.toLocaleString('ko-KR') + ' / ' + t.next.need.toLocaleString('ko-KR') +
        (t.next.clues ? ' · 세계수의 단서 ' + G.state.clues.length + ' / ' + t.next.clues + (t.next.cluesOk ? '' : ' (더 필요)') : '') + '</div>';
    } else h += '<div class="sub" style="margin-top:8px">세계수가 완성되었다. 자양분 ' + t.pts.toLocaleString('ko-KR') + '</div>';
    h += '</div>';
    if (t.next && here) {
      const items = G.herbList.filter((x) => G.herbCount(x.id) > 0).sort((a, b) => a.price - b.price);
      const pots = G.ownedPotions(), goods = G.goodList.filter((x) => (G.state.goods[x.id] || 0) > 0);
      const btn = (kind, id, have) => [1, 10].filter((n) => n < have).map((n) => '<button class="btn small" data-act="nourish" data-kind="' + kind + '" data-id="' + id + '" data-n="' + n + '">' + n + '</button>').join('') +
        '<button class="btn small" data-act="nourish" data-kind="' + kind + '" data-id="' + id + '" data-n="' + have + '">전부</button>';
      const row = (name, have, val, kind, id) => '<div class="row"><div class="info"><div class="name">' + name + ' <span class="cnt">×' + have + '</span></div><div class="desc">하나당 자양분 ' + val + '</div></div><div class="actions">' + btn(kind, id, have) + '</div></div>';
      h += '<details><summary>재료 바치기 · ' + items.length + '종</summary><div class="rows">' + (items.length ? items.map((x) => row(x.name, G.herbCount(x.id), G.nourishValue('item', x.id), 'item', x.id)).join('') : '<div class="empty">바칠 재료가 없다.</div>') + '</div></details>';
      h += '<details><summary>물약 바치기 · ' + pots.length + '종</summary><div class="rows">' + (pots.length ? pots.map((x) => row(x.name, G.potionCount(x.id), G.nourishValue('potion', x.id), 'potion', x.id)).join('') : '<div class="empty">바칠 물약이 없다.</div>') + '</div></details>';
      h += '<details><summary>물건 바치기 · ' + goods.length + '종</summary><div class="rows">' + (goods.length ? goods.map((x) => row(x.name, G.state.goods[x.id], G.nourishValue('good', x.id), 'good', x.id)).join('') : '<div class="empty">바칠 물건이 없다.</div>') + '</div></details>';
    } else if (t.next) h += '<p class="sub">묘목은 별나루 회관에서 돌볼 수 있다.</p>';
    return h;
  }

  // ------------------------------------------------------------ 챕터 · 채집 사건 · 자리를 비운 사이
  function chapterOvHtml() {
    const c = G.chapter(G.nextChapterQueued());
    if (!c) return '';
    return '<div class="letter"><div class="lt-seal" aria-hidden="true">✦</div><p class="lt-to">이야기가 이어진다</p>' +
      c.text.split('\n\n').map((p) => '<p>' + p + '</p>').join('') + '</div>' +
      '<div class="notice" style="margin-top:12px">이야기 보상 <b class="gold">' + won(c.gold) + '</b></div>' +
      '<div class="actions" style="margin-top:12px"><button class="btn primary" data-act="close-chapter">계속하기</button></div>';
  }
  function eventHtml() {
    const e = G.eventInfo();
    if (!e) return UI.evtResult ? '<div class="notice"><b>' + UI.evtResult.title + '</b><div class="desc" style="margin-top:6px">' + UI.evtResult.text +
      (UI.evtResult.gains.length ? '<br><b class="gold">' + UI.evtResult.gains.join(' · ') + '</b>' : '') + '</div></div><div class="actions" style="margin-top:12px"><button class="btn primary" data-act="close-ov">닫기</button></div>' : '';
    return '<div class="notice"><b>' + e.title + '</b> <span class="sub">' + e.area + '</span><div class="desc" style="margin-top:6px">' + e.text + '</div></div>' +
      '<div class="rows" style="margin-top:10px">' + e.choices.map((c) => '<div class="row"><div class="info"><div class="name">' + c.label + '</div>' +
        (c.lock ? '<div class="desc sub">' + c.lock + '</div>' : c.need ? '<div class="desc sub">' + c.need + ' 달성 시 가능</div>' : '') + '</div>' +
        '<button class="btn small" data-act="event-choice" data-i="' + c.i + '"' + (c.lock ? ' disabled' : '') + '>선택</button></div>').join('') + '</div>' +
      '<p class="sub" style="margin:10px 0 0">지금 고르지 않아도 사건은 사라지지 않는다. 메인 탭에서 다시 열 수 있다.</p>';
  }
  function awayHtml() {
    const a = UI.away;
    if (!a) return '';
    return '<p class="note" style="margin-top:0">' + a.span + ' 만에 돌아왔다. 그동안 마을에서는 이런 일이 있었다.</p><div class="rows">' +
      a.rows.map((r) => '<div class="row"><div class="info"><div class="name">' + r[0] + '</div><div class="desc">' + r[1] + '</div></div></div>').join('') + '</div>' +
      '<div class="actions" style="margin-top:12px"><button class="btn primary" data-act="close-ov">좋아, 이어서 하자</button></div>';
  }
  // 저장해 둔 스냅샷과 지금을 비교해 자리를 비운 사이의 변화를 알려 준다 (5분 이상 비웠을 때만)
  function awaySnap() {
    const s = G.state;
    return { at: Date.now(), gold: s.gold, level: s.level, herbs: G.storageUsed(), clues: s.clues.length, rent: s.rentPaid, chaps: s.chaps.length, delivered: s.delivered || 0 };
  }
  function makeAway(prev) {
    if (!prev || !prev.at) return null;
    const ms = Date.now() - prev.at, min = ms / 60000;
    if (min < 5) return null;
    const cur = awaySnap(), rows = [], d = (a, b) => b - a;
    const span = min >= 1440 ? Math.floor(min / 1440) + '일 ' + Math.floor(min % 1440 / 60) + '시간' : min >= 60 ? Math.floor(min / 60) + '시간 ' + Math.floor(min % 60) + '분' : Math.floor(min) + '분';
    if (d(prev.herbs, cur.herbs)) rows.push(['재료', (d(prev.herbs, cur.herbs) > 0 ? '+' : '') + d(prev.herbs, cur.herbs) + '개 (창고 ' + cur.herbs + '칸)']);
    if (d(prev.gold, cur.gold)) rows.push(['금화', (d(prev.gold, cur.gold) > 0 ? '+' : '') + won(d(prev.gold, cur.gold))]);
    if (d(prev.level, cur.level)) rows.push(['연금술사 레벨', 'Lv.' + prev.level + ' → Lv.' + cur.level]);
    if (d(prev.rent, cur.rent) > 0) rows.push(['임대료', won(d(prev.rent, cur.rent)) + ' 납부']);
    if (G.state.debt) rows.push(['연체', won(G.state.debt) + '이 남아 있다. 돈이 생기는 대로 갚는다.']);
    if (G.pendingCount()) rows.push(['보류된 재료', G.pendingCount() + '개 — 거점에서 받을 수 있다']);
    if (G.state.evt) rows.push(['길 위의 사건', G.eventInfo().title + ' — 메인 탭에서 확인']);
    if (!rows.length) rows.push(['조용한 시간', '특별한 변화는 없었다.']);
    return { span: span, rows: rows };
  }

  function boardHtml() {
    const bi = G.boardInfo(), here = G.state.location === 'town_hall';
    let h = '<p class="note" style="margin-top:0">게시판의 의뢰는 날마다 새로 붙는다. 받은 의뢰는 오른쪽 "받은 의뢰" 칸에 모이고, 마을에서 납품하면 보상을 받는다. 게시판 의뢰를 마칠 때마다 마을 실적이 쌓인다.</p>';
    h += '<div class="notice"><b>특수 티켓 ' + bi.tickets + '장</b> <span class="sub">— 쓰면 오늘 의뢰가 ' + 5 + '건 더 붙는다 (환영 패키지 1장 · 게시판 의뢰 10건마다 1장, 다음 장까지 ' + bi.untilTicket + '건)</span> ' +
      '<button class="btn small" data-act="use-ticket"' + (bi.tickets < 1 ? ' disabled' : '') + '>티켓 쓰기</button></div>';
    h += '<div class="sec">오늘의 의뢰 · ' + bi.slots.length + '건 <span class="sub">(받은 의뢰 ' + bi.held + ' / ' + bi.cap + ')</span></div><div class="rows">' + bi.slots.map((q) => {
      const tag = q.legend ? '<span class="hot">전설</span> ' : q.demand ? '<span class="hot">수요</span> ' : '';
      const pg = G.missionProgress(q), task = q.type === 'task';
      return '<div class="row' + (q.taken ? ' dim' : '') + '"><div class="info"><div class="name">' + tag + G.missionText(q) + '</div>' +
        '<div class="desc">보상 <b class="gold">' + won(G.rewardOf(q)) + '</b>' + (q.demand ? ' · 오늘 거래소 호황 품목이라 보상이 높다' : '') + (q.legend ? ' · 마을 Lv.5 전설 의뢰' : '') +
        (task ? ' · 받은 뒤부터 센다 (하루 안에 끝낼 수 있는 양)' : ' · 지금 보유 ' + pg.have + '/' + pg.need) + '</div></div>' +
        '<button class="btn small" data-act="accept-quest" data-id="' + q.id + '"' + (q.taken || bi.held >= bi.cap || !here ? ' disabled' : '') + '>' + (q.taken ? '받음' : '받기') + '</button></div>';
    }).join('') + '</div>';
    return h;
  }

  function upgradeHtml() {
    const ti = G.townInfo(), s = G.state, lv = G.townLevels();
    let h = '<p class="note" style="margin-top:0">마을은 금화와 납품 임무 실적으로 키운다. 단계가 오를수록 더 많은 기능이 열린다. 지금까지 납품한 임무 <b class="gold">' + ti.delivered + '건</b>.</p>';
    h += '<div class="rows">' + lv.map((x) =>
      '<div class="row' + (x.reached ? '' : ' dim') + '"><div class="info"><div class="name">Lv.' + x.lv + ' <span class="sub">' + (x.reached ? (x.lv === ti.lv ? '현재' : '완료') : x.next ? '다음 단계' : '') + '</span></div>' +
      '<div class="desc">' + x.label + '</div>' + (x.lv > 1 ? '<div class="desc">비용 <b class="gold">' + won(x.gold) + '</b> · 납품 임무 ' + x.delivered + '건</div>' : '') +
      '<div class="desc sub">재료 창고 ' + x.storage + '칸 · 주간 임대료 ' + won(x.rent) + '</div></div>' +
      (x.next ? '<button class="btn small" data-act="town-up"' + (ti.canUp ? '' : ' disabled') + '>확장</button>' : x.reached ? '<span class="sub">✓</span>' : '') + '</div>').join('') + '</div>';
    h += '<p class="sub" style="margin:10px 0 0">보유 <b class="gold">' + won(s.gold) + '</b>' + (ti.next && !ti.canUp ? ' · 조건을 채우면 "확장"이 켜진다' : '') + '</p>';
    return h;
  }

  // ------------------------------------------------------------ 능력
  function viewSkills() {
    const pts = G.state.points;
    let h = '<p class="note">능력 5가지는 해당 행동을 할 때마다 조금씩 오르고, 연금술사 레벨이 오를 때마다 얻는 기능치로도 올릴 수 있다. 각 능력은 최대 20레벨이고, 5레벨마다 특수 스킬을 얻는다.</p>' +
      '<div class="notice" style="margin-bottom:10px">연금술사 Lv.' + G.levelInfo().level + ' · 쓸 수 있는 기능치 <b class="gold">' + pts + '점</b></div><div class="rows">';
    G.abilityList().forEach((a) => {
      h += '<div class="row" style="display:block"><div class="name"><b style="font-weight:400;font-family:var(--font-display);font-size:16px">' + a.name + '</b> ' +
        '<span class="cnt">Lv.' + a.lv + (a.max ? ' (최고)' : '') + '</span> <span class="sub">' + a.train + ' 오른다</span> ' +
        '<button class="btn small" style="float:right" data-act="spend" data-key="' + a.key + '"' + (pts < 1 || a.max ? ' disabled' : '') + '>기능치 1점으로 올리기</button></div>' +
        '<div class="bar" style="margin:6px 0"><i style="width:' + (a.max ? 100 : a.xp / a.need * 100) + '%"></i></div>' +
        '<div class="desc">' + (a.max ? '' : '다음 레벨까지 ' + Math.floor(a.xp) + ' / ' + a.need + ' · ') + a.effect + '</div>' +
        '<ul class="skills">' + a.skills.map((sk) =>
          '<li class="' + (a.lv >= sk.lv ? 'on' : '') + '"><b>Lv.' + sk.lv + '</b> ' + (a.lv >= sk.lv ? sk.name : sk.name === '(미정)' ? sk.name : '???') +
          ' <span class="sub">' + (a.lv >= sk.lv || sk.name === '(미정)' ? sk.desc : '레벨 ' + sk.lv + '에 열린다') + '</span></li>').join('') + '</ul></div>';
    });
    return h + '</div>';
  }

  function townCamp() {
    const s = G.state, t = G.config.today();
    let h = '<p class="note">' + G.areas.camp.description + '</p>';
    h += '<div class="sec">거점에서 할 수 있는 일</div><div class="rows">';
    h += '<div class="row"><div class="info"><div class="name">쉬기</div><div class="desc">하루에 한 번, 따뜻한 차를 마시며 마나를 가득 채운다.</div></div>' +
      '<button class="btn small" data-act="rest"' + (s.restDate === t || s.phase !== 'idle' ? ' disabled' : '') + '>' + (s.restDate === t ? '오늘은 쉬었다' : '쉬기') + '</button></div>';
    h += '<div class="row"><div class="info"><div class="name">공방</div><div class="desc">재료로 향초·비누·반지·향수 같은 물건을 만든다. 연금술 탭의 "물건 만들기"를 열자.</div></div>' +
      '<button class="btn small" data-act="goto-goods">공방 열기</button></div>';
    h += '</div>';
    h += '<div class="sec">창고 · 임대료</div><div class="rows">';
    const used = G.storageUsed(), cap = G.storageCap(), pend = G.pendingCount(), ri = G.rentInfo(), fat = G.fatigueInfo();
    h += '<div class="row"><div class="info"><div class="name">재료 창고 <span class="cnt">' + used + ' / ' + capTxt() + '칸</span></div>' +
      '<div class="bar" style="margin:6px 0"><i style="width:' + Math.min(100, used / cap * 100) + '%"></i></div>' +
      '<div class="desc">' + (pend ? '창고가 가득 차서 보류된 재료 ' + pend + '개가 있다.' : '마을 레벨이 오르면 창고가 넓어진다.') + '</div></div>' +
      (pend ? '<button class="btn small" data-act="claim-pending"' + (used >= cap ? ' disabled' : '') + '>보류 재료 받기</button>' : '') + '</div>';
    h += '<div class="row"><div class="info"><div class="name">거점 임대료 <span class="cnt">' + won(ri.amount) + ' / 주</span></div>' +
      '<div class="desc">매주 월요일 오전 6시에 자동으로 낸다. 다음은 ' + (ri.nextAt.getMonth() + 1) + '월 ' + ri.nextAt.getDate() + '일 오전 6시.' +
      (ri.debt ? ' <b class="down">연체 ' + won(ri.debt) + '</b> — 돈이 생기는 대로 갚는다.' : '') + '</div></div></div>';
    h += '<div class="row' + (fat.stacks ? '' : ' dim') + '"><div class="info"><div class="name">피로 <span class="cnt">' + (fat.stacks ? fat.stacks + '단계' : '없음') + '</span></div>' +
      '<div class="desc">쉬지 않고 장기 채집을 이어 ' + fat.threshold + '분을 넘기면 피로가 쌓이고, 이후 1시간마다 한 단계씩 늘어난다. 단계마다 장기 채집 보상 -10%. 이어 하기 시간 ' + fat.chain + '분. 쉬기로 풀린다.</div></div></div>';
    h += '</div>';
    h += '<div class="sec">내 도구</div>' + (toolChips() || '<div class="empty">아직 장만한 도구가 없다. 도구 거리에 가 보자.</div>');
    h += '<div class="sec">기록</div><div class="effects" style="margin:0"><span class="chip">발견한 재료 ' + Object.keys(s.seen).length + ' / ' + G.herbList.length + '</span>' +
      '<span class="chip">만든 물건 ' + Object.keys(s.made).reduce((a, k) => a + s.made[k], 0) + '개</span></div>';
    return h;
  }

  function sellRowRight(kind, id, have) {
    return '<div class="actions"><button class="btn small" data-act="sell" data-kind="' + kind + '" data-id="' + id + '" data-n="1">1개</button>' +
      (have > 1 ? '<button class="btn small" data-act="sell" data-kind="' + kind + '" data-id="' + id + '" data-n="all">전부 (' + have + ')</button>' : '') + '</div>';
  }
  function priceLine(kind, id) {
    const p = G.priceInfo(kind, id);
    const tag = p.hot ? ' <span class="hot">호황</span>' : p.ratio >= 1.15 ? ' <span class="up">▲</span>' : p.ratio <= 0.9 ? ' <span class="down">▼</span>' : '';
    return '<div class="desc">개당 <b class="gold">' + won(p.price) + '</b>' + tag + ' <span class="sub">(기준 ' + p.base + ' G)</span></div>';
  }

  // "거래하기" 오버레이의 내용: 팔기 · 사기
  function marketTradeHtml() {
    const s = G.state;
    const hot = G.hotList();
    let h = '<div class="notice"><b>오늘의 호황</b> ' + hot.map((x) => x.name).join(' · ') + ' <span class="sub">(1.5배)</span></div>';
    h += '<ul class="news">' + G.marketNews().map((n) => '<li>' + n + '</li>').join('') + '</ul>';
    h += '<div class="actions" style="margin:10px 0">' + seg('marketMode', [['sell', '팔기'], ['buy', '사기']]) +
      '<span class="sub">같은 물건을 많이 팔수록 값이 내려가고, 내일 회복된다</span></div>';
    if (UI.marketMode === 'buy') {
      const stock = G.shopStock(), full = G.storageUsed() >= G.storageCap();
      const ti = G.townInfo();
      h += '<div class="sec">오늘의 재료 · 날마다 바뀐다 <span class="sub">(마을 Lv.' + ti.lv + ': ' + ['', '일반', '일반·고급', '일반·고급·희귀', '일반·고급·희귀', '일반·고급·희귀'][ti.lv] + ' 재료 판매 · 창고 ' + G.storageUsed() + '/' + capTxt() + '칸)</span></div>';
      if (G.isWeekend()) h += '<p class="note" style="margin:0 0 8px">주말이라 평소보다 두 단계 높은 재료가 섞여 들어온다.</p>';
      h += rarBar('buyRar');
      const shown = stock.filter((x) => UI.buyRar === '*' || G.herbs[x.id].rarity === UI.buyRar);
      if (!shown.length) h += '<div class="empty">오늘 이 등급의 재료는 팔지 않는다.</div>';
      h += '<div class="rows">' + shown.map((x) => {
        const it = G.herbs[x.id];
        return itemRow(it, '<div class="actions"><span class="cnt">' + won(x.price) + '</span><button class="btn small" data-act="buy" data-id="' + x.id + '" data-n="1"' +
          (x.left < 1 || s.gold < x.price || full ? ' disabled' : '') + '>사기</button></div>',
          '<div class="desc">' + (x.weekend ? '<span class="hot">주말 특별</span> ' : '') + (x.left ? '오늘 남은 물량 ' + x.left : '품절') + ' · 보유 ×' + G.herbCount(x.id) + '</div>');
      }).join('') + '</div>';
      return h;
    }
    const potions = G.ownedPotions();
    const goods = G.goodList.filter((g) => (s.goods[g.id] || 0) > 0);
    h += '<div class="sec">물약</div>' + (potions.length ? '<div class="rows">' + potions.map((p) =>
      '<div class="row"><div class="info"><div class="name">' + p.name + ' ' + rarSpan(p.rarity) + ' <span class="cnt">×' + G.potionCount(p.id) + '</span></div>' + priceLine('potion', p.id) + '</div>' +
      sellRowRight('potion', p.id, G.potionCount(p.id)) + '</div>').join('') + '</div>' : '<div class="empty">팔 물약이 없다.</div>');
    h += '<div class="sec">물건</div>' + (goods.length ? '<div class="rows">' + goods.map((g) =>
      '<div class="row"><div class="info"><div class="name">' + g.name + ' <span class="cnt">×' + s.goods[g.id] + '</span></div>' + priceLine('good', g.id) + '</div>' +
      sellRowRight('good', g.id, s.goods[g.id]) + '</div>').join('') + '</div>' : '<div class="empty">팔 물건이 없다.</div>');
    const items = invItems(UI.sellCat, UI.sellRar);
    h += '<div class="sec">재료</div>' + rarBar('sellRar') + catBar('sellCat');
    h += items.length ? '<div class="rows">' + items.map((x) =>
      itemRow(x, sellRowRight('item', x.id, G.herbCount(x.id)), priceLine('item', x.id).replace('개당', '보유 ×' + G.herbCount(x.id) + ' · 개당'))).join('') + '</div>'
      : '<div class="empty">팔 재료가 없다.</div>';
    return h;
  }

  // "도구 구경하기" 오버레이의 내용
  function toolsOverlayHtml() {
    const s = G.state;
    let h = '<p class="sub" style="margin:0 0 10px">쓸수록 손에 익는 도구를 장만하고 강화한다. 보유 <b class="gold">' + won(s.gold) + '</b></p>';
    ['채집', '이동', '연금술', '공방'].forEach((kind) => {
      h += '<div class="sec">' + kind + ' 도구</div><div class="rows">' + G.toolList().filter((t) => t.kind === kind).map((t) =>
        '<div class="row"><div class="info"><div class="name">' + t.name + ' <span class="sub">Lv.' + t.lv + ' / ' + t.capLv + '</span></div>' +
        '<div class="desc">지금: ' + t.label + '</div>' +
        (t.nextLabel ? '<div class="desc">다음: ' + t.nextLabel + '</div>' : '') + '</div>' +
        (t.nextLabel ? '<button class="btn small" data-act="buy-tool" data-id="' + t.id + '"' + (s.gold < t.cost ? ' disabled' : '') + '>' + won(t.cost) + '</button>'
          : '<span class="sub">' + (t.pending ? '이 단계 이후 강화는 준비 중' : t.locked ? t.locked : '최고 단계') + '</span>') + '</div>').join('') + '</div>';
    });
    return h;
  }

  // ------------------------------------------------------------ 도감
  function achHtml() {
    const l = G.achList(), n = l.filter((a) => a.done).length;
    return '<p class="note">달성한 업적 ' + n + ' / ' + l.length + '. 달성하면 금화를 받는다.</p><div class="rows">' + l.map((a) =>
      '<div class="row' + (a.done ? '' : ' dim') + '"><div class="info"><div class="name">' + (a.done ? '✓ ' : '') + a.name + ' <span class="sub">보상 ' + won(a.gold) + '</span></div><div class="desc">' + a.desc + '</div></div></div>').join('') + '</div>';
  }
  function chaptersHtml() {
    const l = G.chapterList(), n = l.filter((c) => c.reached).length;
    return '<p class="note">이야기 ' + n + ' / ' + l.length + '장. 조건을 채우면 새 장이 열린다.</p><div class="rows">' + l.map((c) => c.reached
      ? '<div class="row"><div class="info"><div class="name">' + c.title + '</div><div class="desc" style="white-space:pre-line">' + c.text + '</div></div></div>'
      : '<div class="row dim"><div class="info"><div class="name">???</div><div class="desc">열리는 조건 — ' + c.hint + '</div></div></div>').join('') + '</div>';
  }
  function viewBook() {
    let h = seg('bookMode', [['recipe', '조합'], ['item', '재료'], ['good', '물건'], ['ach', '업적'], ['chap', '이야기']]) + '<div style="margin-top:12px">';
    if (UI.bookMode === 'ach') h += achHtml();
    else if (UI.bookMode === 'chap') h += chaptersHtml();
    else if (UI.bookMode === 'item') h += bookItems();
    else if (UI.bookMode === 'good') h += bookGoods();
    else h += bookRecipes();
    return h + '</div>';
  }

  // 한 번 만든 물약의 재료 조합. 누르면 조합 탭의 재료 칸이 그 조합으로 채워진다.
  function comboHtml(recipeKey) {
    return G.comboFor(recipeKey).map((ids) =>
      '<div class="desc">' + ids.map(herbName).join(' + ') + ' <button class="btn small ghost" data-act="fill-recipe" data-ids="' + ids.join(',') + '">이 조합으로 채우기</button></div>').join('');
  }
  function bookRecipes() {
    const book = G.recipeBook();
    const found = book.filter((b) => b.discovered).length;
    let h = '<p class="note">이름 있는 비약 ' + found + ' / ' + book.length + '. 정해진 재료 조합으로만 만들어지는 특별한 물약이다. 그 밖의 조합은 재료의 기운에 따라 "자유 조합" 물약이 된다.</p>';
    [1, 2, 3, 4].forEach((t) => {
      const list = book.filter((b) => b.tier === t);
      const n = list.filter((b) => b.discovered).length;
      h += '<details><summary>' + TIER[t] + ' · ' + n + '/' + list.length + '</summary><div class="rows">' +
        list.map((b) => b.discovered
          ? '<div class="row"><div class="info"><div class="name">' + b.name + ' <span class="sub">성공 확률 ' + b.chance + '%</span></div>' + comboHtml(G.potions[b.id].recipeKey) + '<div class="desc">' + b.description + '</div></div></div>'
          : '<div class="row dim"><div class="info"><div class="name">???</div><div class="desc">' + b.hint + '</div></div></div>').join('') +
        '</div></details>';
    });
    const fb = G.freeBook();
    h += '<details><summary>자유 조합 · ' + fb.found.length + '/' + fb.total + '</summary><div class="rows">' +
      (fb.found.length ? fb.found.map((p) =>
        '<div class="row"><div class="info"><div class="name">' + p.name + ' <span class="sub">' + TIER[p.tier] + ' · 성공 확률 ' + G._chanceFor(p) + '%</span></div>' +
        '<div class="desc">기운 ' + [p.primary, p.secondary, p.tertiary].filter(Boolean).join('·') + '</div>' + (comboHtml(p.recipeKey) || '<div class="desc">만든 조합이 기록되기 전에 발견한 물약이다. 다시 만들면 재료가 기록된다.</div>') + '<div class="desc">' + p.description + '</div></div></div>').join('')
        : '<div class="empty">아직 발견한 자유 조합이 없다. 아무 재료나 섞어 보자.</div>') + '</div></details>';
    return h;
  }

  // 재료 분류표: 등급(전설→일반) × 종류. 칸마다 "발견 / 전체"
  function rarityTable() {
    const seen = G.state.seen, cats = CAT_ORDER.filter((c) => G.herbList.some((x) => x.cat === c));
    let h = '<div class="tblwrap"><table class="tbl"><thead><tr><th>등급</th>' + cats.map((c) => '<th>' + CATN[c] + '</th>').join('') + '<th>합계</th><th>값(G)</th></tr></thead><tbody>';
    RORDER.slice().reverse().forEach((r) => {
      const all = G.herbList.filter((x) => x.rarity === r);
      const prices = all.map((x) => x.price);
      h += '<tr><td>' + rarSpan(r).replace('class="rar', 'style="font-size:1em" class="rar') + '</td>' + cats.map((c) => {
        const l = all.filter((x) => x.cat === c), n = l.filter((x) => seen[x.id]).length;
        return '<td' + (l.length ? '' : ' class="zero"') + '>' + (l.length ? n + '/' + l.length : '-') + '</td>';
      }).join('') + '<td>' + all.filter((x) => seen[x.id]).length + '/' + all.length + '</td><td>' + (prices.length ? Math.min.apply(null, prices) + '~' + Math.max.apply(null, prices) : '-') + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }
  function bookItems() {
    const where = {};
    G.areaOrder.forEach((aid) => G.areas[aid].herbs.forEach((id) => { (where[id] = where[id] || []).push(G.areas[aid].name); }));
    const seen = G.state.seen;
    const total = G.herbList.length, got = G.herbList.filter((h) => seen[h.id]).length;
    let h = '<p class="note">발견한 재료 ' + got + ' / ' + total + '. 한 번이라도 손에 넣은 재료가 기록된다.</p>' + rarityTable() +
      seg('bookRar', [['*', '모든 등급']].concat(RORDER.slice().reverse().map((r) => [r, RAR[r]]))) + '<div style="height:8px"></div>' + catBar('bookCat');
    CAT_ORDER.filter((c) => UI.bookCat === '*' || UI.bookCat === c).forEach((c) => {
      const list = G.herbList.filter((x) => x.cat === c && (UI.bookRar === '*' || x.rarity === UI.bookRar)).sort(itemSort);
      if (!list.length) return;
      const n = list.filter((x) => seen[x.id]).length;
      h += '<details><summary>' + CATN[c] + ' · ' + n + '/' + list.length + '</summary><div class="rows">' +
        list.map((x) => seen[x.id]
          ? '<div class="row"><div class="info"><div class="name">' + x.name + ' ' + rarSpan(x.rarity) + ' <span class="sub">' + x.traits.join('·') + ' · 약 ' + x.price + ' G</span></div>' +
            '<div class="desc">' + (where[x.id] || []).join(', ') + '</div></div></div>'
          : '<div class="row dim"><div class="info"><div class="name">???</div><div class="desc">' + CATN[c] + ' · ' + RAR[x.rarity] + '</div></div></div>').join('') +
        '</div></details>';
    });
    return h;
  }

  function bookGoods() {
    const made = G.state.made;
    const n = G.goodList.filter((g) => made[g.id]).length;
    return '<p class="note">만들어 본 물건 ' + n + ' / ' + G.goodList.length + '.</p><div class="rows">' + G.goodList.map((g) =>
      made[g.id]
        ? '<div class="row"><div class="info"><div class="name">' + g.name + ' <span class="sub">만든 수 ' + made[g.id] + ' · 약 ' + G.goodPrice(g.id) + ' G</span></div><div class="desc">' + reqText(g.req) + '</div><div class="desc">' + g.desc + '</div></div></div>'
        : '<div class="row dim"><div class="info"><div class="name">???</div><div class="desc">' +
          (g.tool ? (g.tool === 'forge' ? '화로 Lv.' : '증류기 Lv.') + g.lv + ' 필요' : '도구 없이 만들 수 있다') + '</div></div></div>').join('') + '</div>';
  }

  // ------------------------------------------------------------ 이야기: 초대장 · 채집 스크롤
  // 처음 시작할 때 펼쳐지는 초대장. 같은 글을 설정 메뉴의 "초대장 다시 읽기"로도 볼 수 있다.
  function letterHtml(first) {
    return '<div class="letter">' +
      '<div class="lt-seal" aria-hidden="true">✦</div>' +
      '<p class="lt-to">이름 모를 손님께</p>' +
      '<p>낯선 이여, 먼 길을 어떻게 오셨는지는 묻지 않겠습니다. 이곳 별나루에서는 별이 떨어진 자리에 길이 생기고, 그 길 끝에서 손님이 도착하곤 하니까요.</p>' +
      '<p>당신의 손에는 이미 연금술의 온기가 깃들어 있습니다. 누가, 왜 그 힘을 주었는지는 당신도 모르실 테지요. 다만 그 능력은 이 땅의 풀과 돌, 비와 안개를 만날 때 비로소 깨어납니다.</p>' +
      '<p>별나루는 지금 작은 마을입니다. 거점의 약초 할멈 솔이는 허리가 쑤시고, 두루의 거래소는 재료가 모자라고, 강쇠의 대장간은 일손이 부족합니다. 은빛 초원에서 구름 산맥, 푸른 물가, 잿불 화산, 속삭이는 동굴까지 — 재료는 흩어져 있고, 그것을 물약과 물건으로 바꿔 줄 사람이 필요합니다.</p>' +
      '<p>그리고 오래된 이야기가 하나 있습니다. 고요한 숲의 뿌리 끝, 바다 너머 <b>대대륙</b>에 세계수가 잠들어 있다고요. 그 나무를 다시 키워 낸 사람은 아직 없습니다. 의뢰를 하나씩 마칠 때마다 단서가 모일 것이고, 그 길의 끝에 당신이 서 있기를 바랍니다.</p>' +
      '<p>부디 마을을 도와주세요. 그러면 마을도 당신을 도울 것입니다.</p>' +
      '<p class="lt-sign">별나루 회관지기 보람 올림</p>' +
      '<div class="lt-steps"><b>첫걸음</b><ol>' +
      '<li>지도에서 가고 싶은 곳을 눌러 [이동하기]를 누릅니다. (달빛 언덕이 가깝습니다)</li>' +
      '<li>도착하면 [채집하기]로 재료를 모읍니다. 장기 채집은 시간이 걸리지만 경험치와 좋은 재료를 줍니다.</li>' +
      '<li>거점으로 돌아와 물약을 만들고, 거래소에서 팔아 도구 거리에서 도구를 장만하세요.</li></ol></div>' +
      '<div class="lt-actions"><button class="btn primary big" data-act="' + (first ? 'accept-intro' : 'close-ov') + '">' + (first ? '초대를 받아들인다' : '닫기') + '</button></div></div>';
  }

  // 장기 채집 중에 펼쳐지는 채집 스크롤. 시작할 때 글 줄을 미리 정해 두고(T.script), 시간이 흐름에 따라 한 줄씩 나타난다.
  const SC = {
    open: {
      grassland: ['은빛 초원에 닿자 달빛을 닮은 풀잎이 발목을 간질인다. 바구니를 내려놓고 풀밭에 무릎을 꿇는다.',
        '바람이 풀밭을 쓸고 지나가며 물결무늬를 만든다. 그 물결 사이사이에 쓸 만한 약초가 숨어 있다.',
        '들판 한가운데 서서 숨을 고른다. 풀 내음이 코끝에 가득하다. 오늘도 좋은 하루가 될 것 같다.'],
      mountain: ['구름 산맥의 비탈은 가파르다. 밧줄을 허리에 감고 바위 틈의 풀을 찾아 한 걸음씩 오른다.',
        '산 공기는 얇고 차갑다. 숨을 내쉴 때마다 하얀 김이 피어오른다.',
        '구름이 발아래로 흐른다. 바위 사이로 고개를 내민 풀잎이 눈에 들어온다.'],
      waters: ['푸른 물가에 닿았다. 물결 소리가 귓가를 채우고, 젖은 돌 위로 작은 풀이 자란다.',
        '신발을 벗고 얕은 물에 발을 담근다. 차가운 물이 정강이를 감싼다.',
        '갈대밭 너머로 물새 한 마리가 날아오른다. 이곳의 재료는 대개 물 가까이에 숨어 있다.'],
      volcano: ['잿불 화산 자락의 땅은 아직 따뜻하다. 발밑에서 작은 불씨가 깜빡인다.',
        '매캐한 재 냄새가 코를 찌른다. 천으로 입을 가리고 검은 흙을 헤친다.',
        '멀리서 화산이 낮게 울린다. 서둘러야 하지만, 서두르다 다치면 아무것도 얻지 못한다.'],
      caves: ['속삭이는 동굴 입구에서 등불을 켠다. 안쪽에서 누군가 속삭이는 듯한 메아리가 번진다.',
        '젖은 바위벽에 이끼가 은은히 빛난다. 등불을 낮추고 한 발씩 들어간다.',
        '어둠이 깊어질수록 소리가 또렷해진다. 물방울 떨어지는 소리가 박자를 만든다.'],
      forest: ['고요한 숲은 이름처럼 조용하다. 새소리마저 멀리서 들리고, 낙엽 밟는 소리가 크게 느껴진다.',
        '나무뿌리가 땅 위로 불거져 길을 막는다. 뿌리를 넘으며 세계수의 이야기를 문득 떠올린다.',
        '나뭇잎 사이로 내려온 빛줄기가 이끼 위에 떨어진다. 그 빛 아래에서 재료를 하나씩 모은다.'],
    },
    flow: {
      grassland: ['나비 한 마리가 어깨에 앉았다 떠난다. 소매에 꽃가루가 묻었다.',
        '뿌리째 뽑지 않도록 조심해 줄기만 벤다. 내년에도 이곳에 자랄 풀이다.',
        '바구니 바닥이 어느새 묵직해진다.',
        '멀리서 양치기의 휘파람 소리가 들려온다.'],
      mountain: ['돌이 굴러 떨어지는 소리에 흠칫 멈췄다가, 다시 손을 뻗는다.',
        '절벽 틈에서 하얗게 핀 풀꽃을 발견한다. 손이 닿을 듯 말 듯하다.',
        '바위에 앉아 잠시 물을 마신다. 산 아래 별나루의 지붕이 장난감처럼 작다.',
        '산바람에 외투 자락이 세차게 펄럭인다.'],
      waters: ['물속에서 은빛 물고기가 스친다. 발끝이 간질간질하다.',
        '갈대를 헤치자 물방울이 맺힌 풀잎이 반짝인다.',
        '젖은 소매를 짜며 바구니를 정리한다.',
        '수면에 비친 구름이 천천히 흘러간다.'],
      volcano: ['뜨거운 돌 사이에서 붉게 달아오른 광물이 눈에 띈다.',
        '발밑이 따뜻하다 못해 뜨겁다. 장화 밑창을 확인하고 자리를 옮긴다.',
        '연기 사이로 붉은 불꽃이 번쩍인다.',
        '이마의 땀을 닦으며 옷에 앉은 재를 털어 낸다.'],
      caves: ['어디선가 물이 똑, 똑 떨어진다. 속삭임이 한 겹 더 깊어진다.',
        '수정이 등불을 받아 벽 전체가 별이 뜬 밤처럼 반짝인다.',
        '박쥐 몇 마리가 천장에서 푸드덕 날아간다.',
        '등불 기름을 확인한다. 아직 충분하다.'],
      forest: ['머리 위로 도토리가 떨어진다. 다람쥐가 미안한 듯 이쪽을 쳐다본다.',
        '반딧불이 몇 마리가 낮인데도 숲속을 맴돈다.',
        '이끼 낀 나무 둥치에 버섯이 줄지어 돋았다.',
        '숲 깊은 곳에서 아주 낮은 울림이 느껴진다. 뿌리가 숨을 쉬는 것 같다.'],
    },
    wx: {
      clear: ['맑은 하늘 아래 햇살이 좋다. 풀잎마다 생기가 도는 게 눈에 보인다.', '구름 한 점 없는 날이라 멀리까지 잘 보인다. 재료를 고르기에 안성맞춤이다.'],
      cloudy: ['하늘이 잿빛으로 낮게 내려앉았다. 차분히 일하기 좋은 날이다.', '구름이 해를 가렸다 풀어 주기를 되풀이한다.'],
      rain: ['가는 비가 내리기 시작한다. 젖은 풀에서 진한 향이 피어오른다.', '빗방울이 모자 끝에서 똑똑 떨어진다. 비를 머금은 약초가 오히려 싱싱하다.'],
      fog: ['안개가 자욱하다. 열 걸음 앞도 흐릿하지만, 이런 날에는 환영과 기억의 기운이 도는 재료가 잘 보인다.', '안개 속에서 풀잎의 윤곽이 번졌다 선명해진다. 길을 잃지 않도록 줄을 꼭 잡는다.'],
      storm: ['바람이 많이 분다. 바구니를 꽉 쥐고 몸을 낮춘다. 재료를 놓칠까 조마조마하다.', '폭풍이 몰아친다! 우비가 펄럭이고, 풀잎은 땅에 붙은 채 떨고 있다.'],
      snow: ['눈보라가 몰아친다. 속눈썹에 서리가 앉고 손끝이 얼어 간다.', '하얀 눈 속에 파묻힌 풀을 장갑 낀 손으로 파낸다.'],
      heat: ['폭염이 내리쬔다. 땀이 줄줄 흐르고 바구니마저 뜨겁다.', '발바닥이 달아오른다. 그늘을 찾아 물을 한 모금 마신다.'],
      ash: ['화산재가 눈처럼 내려앉는다. 천으로 입을 가리고 눈을 가늘게 뜬다.', '하늘이 붉게 흐려진다. 재가 쌓인 풀을 털어 내며 조심조심 걷는다.'],
    },
    season: {
      spring: ['봄볕에 새싹이 앞다퉈 올라온다.', '봄바람에 꽃가루가 날린다. 재채기가 한 번 나온다.'],
      summer: ['한여름의 풀냄새가 진하다. 매미 소리가 귀를 울린다.', '여름 해는 길어서 아직 하루가 많이 남은 기분이다.'],
      autumn: ['낙엽이 발밑에서 바스락 소리를 낸다. 열매가 영근 계절이다.', '쌀쌀한 바람이 목덜미를 스친다. 풀들이 겨울 채비를 하고 있다.'],
      winter: ['입김이 하얗게 피어오른다. 겨울 풀은 드물어서 하나하나가 귀하다.', '땅이 얼어 단단하다. 서리 낀 풀잎을 조심스레 딴다.'],
    },
    abil: {
      acu: [[5, '예리한 눈이 풀숲 속 재료마다 옅은 빛의 확률을 읽어 낸다. 어디를 먼저 뒤져야 할지 알 것 같다.'],
        [10, '손이 저절로 한 번 더 뻗어 나간다. 한 줌 더 쥔 것이 기분 탓이 아니다.'],
        [15, '아직 본 적 없는 풀인데도 윤곽이 먼저 떠오른다. 이 땅이 당신에게 숨길 수 있는 것은 많지 않다.'],
        [20, '날씨도 계절도 아랑곳없이, 어딘가에서 바람을 거스르는 약초 한 포기가 고개를 든다.']],
      int: [[5, '머릿속에서 재료들이 저절로 짝을 맞춘다. 이 풀은 저 열매와 잘 어울리겠다.'],
        [10, '채집하는 동안에도 다음 물약의 배합이 머릿속에서 끓는다.'],
        [15, '세 가지 재료가 하나의 노래처럼 이어지는 감각. 연금술이 몸에 스며들었다.'],
        [20, '전설의 조합이 머릿속 깊은 곳에서 희미하게 빛난다. 아직은 닿지 않는 별이다.']],
      craft: [[5, '바구니를 다루는 손놀림이 매끄럽다. 같은 시간에 더 많은 재료가 담긴다.'],
        [10, '도구가 손에 착 감긴다. 오래전부터 쓰던 것처럼.'],
        [15, '손끝이 도구의 한계까지 끌어낸다. 장인의 감각이란 이런 것일까.'],
        [20, '굳이 생각하지 않아도 손이 알아서 움직인다.']],
      charm: [[5, '지나가던 약초꾼이 반갑게 손을 흔든다. 사람들은 이상하게 당신에게 호의를 품는다.'],
        [10, '이 땅에 대해 누군가 들려준 이야기를 곱씹는다. 사람들이 당신에게 의뢰를 맡기는 이유를 알 것 같다.'],
        [15, '당신의 이름이 마을을 넘어 퍼지고 있다는 소문이 바람결에 들린다.'],
        [20, '세계수에 닿을 사람이라는 말이 어느새 공공연히 오간다.']],
      swift: [[5, '걸음이 가볍다. 어느새 이곳저곳을 한 바퀴 돌고 있다.'],
        [10, '가 본 길은 발이 먼저 기억한다. 풀숲 사이의 지름길이 저절로 보인다.'],
        [15, '바람을 타는 듯한 발걸음. 지친 줄도 모르고 한참을 걸었다.'],
        [20, '당신이 지나간 자리에는 발자국보다 바람이 먼저 남는다.']],
    },
    tool: {
      sickle: [[1, '낫날이 풀줄기를 사각 하고 가른다. 깔끔하게 한 포기를 더 거둔다.'], [4, '낫이 바람처럼 지나간다. 한 번에 두 포기가 가지런히 쓰러진다.']],
      boots: [[1, '여행 장화 덕분에 젖은 땅에서도 미끄러지지 않는다.'], [4, '장화가 땅을 읽는 것처럼 발을 받쳐 준다. 먼 길도 힘들지 않다.']],
      basket: [[1, '약초 바구니가 넉넉해서 담는 손이 바쁘다.'], [4, '바구니가 도무지 가득 차지 않는다. 담고 또 담는다.']],
      pickaxe: [[1, '곡괭이로 바위를 두드리자 광물 조각이 튕겨 나온다.']],
    },
    tree: ['문득 별나루 회관에서 들은 세계수 이야기가 떠오른다. 이 풀 한 포기가 그 나무로 이어지는 길일지도 모른다.',
      '대대륙은 어떤 곳일까. 지평선 너머를 바라보며 잠시 상상한다.'],
    tired: '어깨가 무겁다. 쉬지 않고 오래 일해서인지 손이 둔해졌다. 거점에서 푹 쉬어야겠다.',
    close: ['바구니를 묶고 일어선다. 오늘 거둔 것은 거점에서 정리하자.',
      '해가 기울기 전에 채집을 마친다. 한결 가벼운 마음이다.',
      '마지막 한 포기를 담고 허리를 편다. 이만하면 충분하다.'],
  };
  const SCRIPT_LINES = { 30: 4, 60: 5, 120: 7, 180: 9 };     // 채집 시간별 글 줄 수
  function seededRng(seed) {
    let s = seed >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  // 날씨·계절·지역·능력·도구·피로에 따라 줄을 고른다. 매번 다른 순서로 나온다.
  function buildScript(ex, seed) {
    const R = seededRng(seed || 1), pick = (a) => a[Math.floor(R() * a.length)];
    const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
    const area = G.areas[ex.area], reg = SC.open[area.regionId] ? area.regionId : 'grassland';
    const w = G.weatherAt(ex.area), n = SCRIPT_LINES[ex.minutes] || 5;
    const wid = w ? (w.name === '화산재' ? 'ash' : w.id) : 'cloudy';
    const out = [pick(SC.open[reg]), pick(SC.wx[wid])];
    const spec = [pick(SC.season[G.seasonId()])];
    Alchemy.ABILITY_KEYS.forEach((k) => {
      const ok = SC.abil[k].filter((e) => G.abilLv(k) >= e[0]);
      if (ok.length) spec.push(pick(ok)[1]);
    });
    Object.keys(SC.tool).forEach((id) => {
      const lv = G.toolLv(id), ok = SC.tool[id].filter((e) => lv >= e[0]);
      if (!ok.length) return;
      if (id === 'pickaxe' && ['volcano', 'caves', 'mountain'].indexOf(area.regionId) < 0) return;
      spec.push(ok[ok.length - 1][1]);
    });
    if (G.state.clues && G.state.clues.length) spec.push(pick(SC.tree));
    const body = shuffle(spec).concat(shuffle(SC.flow[reg]));
    const need = n - 3 - (ex.fat > 0 ? 1 : 0);
    const mid = body.slice(0, Math.max(0, need));
    out.push.apply(out, mid);
    if (ex.fat > 0) out.push(SC.tired);
    out.push(pick(SC.close));
    return out;
  }
  // 줄 i 는 진행도 i/n × 0.92 에 나타난다 (첫 줄은 시작하자마자)
  function scriptShown(T0) {
    const total = T0.script.length, frac = Math.min(1, Math.max(0, 1 - (T0.endAt - Date.now()) / T0.total));
    let k = 0;
    for (let i = 0; i < total; i++) if (frac >= i / total * 0.92 - 1e-9) k = i + 1;
    return k;
  }
  function ensureScript() {
    if (T && !T.script) T.script = buildScript(G.state.currentExpedition, T.endAt);
  }
  function scrollHtml() {
    const done = !T && UI.scrollDone, src = done ? UI.scrollDone : T;
    if (!src) return '';
    if (!done) ensureScript();
    const lines = done ? src.script : src.script.slice(0, scriptShown(src));
    const fresh = lines.length > (UI.scrollShown || 0);
    UI.scrollShown = lines.length;
    const a = G.areas[done ? src.area : G.state.currentExpedition.area], wx = G.weatherAt(a.id);
    let h = '<div class="sc-top"><span class="chip">' + a.regionName + ' · ' + a.name + '</span>' + (wx ? wxChip(wx) : '') +
      '<span class="chip">' + DLABEL[src.minutes] + ' 채집</span></div>';
    if (!done) {
      const left = Math.max(0, T.endAt - Date.now());
      h += '<div class="bar focus" style="margin:10px 0 4px"><i id="scr-fill" style="width:' + ((1 - left / T.total) * 100) + '%"></i></div>' +
        '<div class="sub" id="scr-time" style="margin-bottom:10px">남은 시간 ' + fmt(Math.ceil(left / msPerMin() * 60)) + '</div>';
    }
    h += '<div class="scroll-paper">' + lines.map((t, i) => '<p class="sl' + (fresh && i === lines.length - 1 ? ' new' : '') + '">' + t + '</p>').join('') +
      (done ? '' : '<p class="sl wait" aria-hidden="true">…</p>') + '</div>';
    if (done) {
      h += '<div class="notice" style="margin-top:12px"><b>채집을 마쳤다</b> · 경험치 +' + src.xp + '<div class="desc" style="margin-top:4px">수확: ' + src.herbs + '</div></div>';
      if (G.state.evt || UI.evtResult) h += '<div style="margin-top:12px">' + eventHtml() + '</div>';
      else h += '<div class="actions" style="margin-top:12px"><button class="btn primary" data-act="close-ov">닫기</button></div>';
    } else {
      h += '<p class="sub" style="margin:12px 0 0">창을 닫아도 채집은 계속된다. 메인 탭의 "지금 위치" 카드에서 다시 펼칠 수 있다.</p>';
    }
    return h;
  }
  // 한 줄이 늘었을 때만 다시 그리고, 아니면 진행 막대와 남은 시간만 고친다
  function updateScroll() {
    if (!T || UI.ov !== 'scroll') return;
    ensureScript();
    if (scriptShown(T) !== UI.scrollShown) {
      renderOverlay();
      const b = ovRoot.querySelector('.ov-body');
      if (b) b.scrollTop = b.scrollHeight;
      return;
    }
    const left = Math.max(0, T.endAt - Date.now()), f = $('#scr-fill'), t = $('#scr-time');
    if (f) f.style.width = ((1 - left / T.total) * 100) + '%';
    if (t) t.textContent = '남은 시간 ' + fmt(Math.ceil(left / msPerMin() * 60));
  }

  // 오버레이(거래소·도구 거리·의뢰 게시판·마을 업그레이드): #view 밖(body 끝)에 따로 그려서 화면이 다시 그려져도 스크롤 위치를 지킨다.
  // 해당 건물에 있을 때만 열려 있을 수 있고, 다른 곳으로 이동하면 닫힌다.
  // ok(): 열려 있어도 되는 상태인지. 건물 오버레이는 그 건물에 있을 때만, 채집은 채집 가능한 곳에 서 있을 때만 열린다.
  const inHub = () => HUB_IDS.indexOf(G.state.location) >= 0 && G.state.phase !== 'travel';
  const OVERLAYS = {
    intro: { ok: () => !G.state.introSeen, title: '별나루의 초대장', html: () => letterHtml(true), locked: true },
    letter: { ok: () => true, title: '별나루의 초대장', html: () => letterHtml(false) },
    scroll: { ok: () => !!T || !!UI.scrollDone, title: () => '채집 스크롤 · ' + G.areas[T ? G.state.currentExpedition.area : UI.scrollDone.area].name, html: scrollHtml },
    gather: { ok: () => !G.currentArea().noGather && G.state.phase !== 'travel', title: () => G.currentArea().name + ' 채집', html: gatherOverlayHtml },
    chapter: { ok: () => !!G.chapter(G.nextChapterQueued()), title: () => G.chapter(G.nextChapterQueued()).title, html: chapterOvHtml, locked: true },
    event: { ok: () => !!G.state.evt || !!UI.evtResult, title: () => (G.eventInfo() ? G.eventInfo().title : UI.evtResult.title), html: eventHtml },
    away: { ok: () => !!UI.away, title: '자리를 비운 사이', html: awayHtml },
    forecast: { ok: () => true, title: () => '날씨 예보', html: forecastHtml },
    area: { ok: () => !!G.areas[UI.ovArg], title: () => G.areas[UI.ovArg].name, html: () => areaDetailHtml(UI.ovArg) },
    camp: { loc: 'camp', title: '거점', html: townCamp },
    npc: { ok: inHub, title: () => '마을 사람 · ' + G.npcOf(G.state.location).name, html: () => townNpc(G.state.location) },
    market: { loc: 'market', title: '중앙 거래소', html: marketTradeHtml, gold: true },
    tools: { loc: 'tool_street', title: '도구 거리', html: toolsOverlayHtml, gold: true },
    board: { loc: 'town_hall', title: '의뢰 게시판', html: boardHtml, gold: false },
    upgrade: { loc: 'town_hall', title: '마을 업그레이드', html: upgradeHtml, gold: true },
    story: { loc: 'town_hall', title: '세계수 이야기', html: storyHtml, gold: false },
  };
  const ovRoot = document.createElement('div');
  ovRoot.id = 'overlay-root';
  document.body.appendChild(ovRoot);
  function closeOverlay() { if (UI.ov === 'intro' || UI.ov === 'chapter') return; UI.ov = null; renderOverlay(); }       // 초대장과 챕터는 버튼으로만 닫힌다
  function renderOverlay() {
    if (UI.ov !== 'scroll') { UI.scrollDone = null; UI.scrollShown = 0; }
    if (UI.ov !== 'event' && UI.ov !== 'scroll') UI.evtResult = null;
    if (UI.ov !== 'away') UI.away = null;
    // 읽지 않은 챕터가 있으면 그것을 먼저, 그다음 겪지 않은 사건을 연다 (초대장·장기 채집 스크롤을 보는 중에는 기다린다)
    if (!UI.ov && G.state.introSeen) {
      if (G.nextChapterQueued() !== null) UI.ov = 'chapter';
      else if (G.state.evt && !T) UI.ov = 'event';
    }
    const def = UI.ov ? OVERLAYS[UI.ov] : null;
    const open = def && (def.ok ? def.ok() : G.state.location === def.loc && G.state.phase !== 'travel');
    if (!open) {
      UI.ov = null;
      if (ovRoot.firstChild) ovRoot.innerHTML = '';
      document.body.classList.remove('ov-open');
      return;
    }
    const card = ovRoot.querySelector('.ov-card'), same = card && card.dataset.key === UI.ov;
    const prev = ovRoot.querySelector('.ov-body'), top = same && prev ? prev.scrollTop : 0;
    const title = typeof def.title === 'function' ? def.title() : def.title;
    ovRoot.innerHTML = '<div class="overlay" data-ov="backdrop"><div class="ov-card" data-key="' + UI.ov + '" role="dialog" aria-modal="true" aria-label="' + title + '" tabindex="-1">' +
      '<div class="ov-head"><h2>' + title + '</h2>' + (def.gold ? '<span class="sub">보유 <b class="gold">' + won(G.state.gold) + '</b></span>' : '') +
      (def.locked ? '' : '<button class="btn small" data-act="close-ov" aria-label="' + title + ' 닫기">닫기</button>') + '</div>' +
      '<div class="ov-body">' + def.html() + '</div></div></div>';
    document.body.classList.add('ov-open');
    ovRoot.querySelector('.ov-body').scrollTop = top;
    if (!same) ovRoot.querySelector('.ov-card').focus();
    if (!same && UI.ov === 'scroll') { const b = ovRoot.querySelector('.ov-body'); b.scrollTop = b.scrollHeight; }
  }

  function renderView() {
    document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === UI.tab)));
    const v = { main: viewMain, bag: viewBag, brew: viewBrew, skill: viewSkills, book: viewBook, log: viewLog }[UI.tab];
    $('#view').innerHTML = v();
  }

  function render() {
    G.markSeen();
    flushEvents();
    renderStatus(); renderActions(); renderView(); renderLog(); drawTimer(); renderQuests(); renderOverlay();
    $('#fast').checked = fast;
    $('#fast').disabled = !!T || G.state.phase === 'travel';
  }

  // ------------------------------------------------------------ 행동
  const ACT = {
    short() {
      const say = (m, c) => { UI.lastGather = m; log(m, c); };
      const r = G.shortGather();
      if (!r.ok) return say(r.message, 'bad');
      const h = G.herbs[r.herbId];
      if (r.lost) return say(h.name + '을(를) 찾았지만 ' + r.weather.name + ' 때문에 건지지 못했다. (날씨 방지 물약이나 보호막이 있으면 막을 수 있다)', 'bad');
      const by = r.weather && r.weather.by ? ' (' + r.weather.name + '이었지만 ' + (r.weather.by === 'ward' ? '방지 물약' : '보호막') + ' 덕에 무사했다)' : '';
      say(h.name + ' ×' + r.amount + ' 채집.' + (r.sickle ? ' (한 포기를 더 얻었다)' : '') + by + ' (경험치 +' + r.xp + ')' + ' ' + h.lore, h.rarity !== 'common' ? 'good' : '');
    },
    long(el) {
      const m = Number(el.dataset.m);
      const r = G.startExpedition(m);
      if (!r.ok) return log(r.message, 'bad');
      const total = m * msPerMin();
      T = { minutes: m, total: total, endAt: Date.now() + total };
      T.script = buildScript(G.state.currentExpedition, Date.now() & 0x7fffffff);
      UI.ov = 'scroll'; UI.scrollShown = 0; UI.scrollDone = null;
      log(r.area + '에서 ' + DLABEL[m] + ' 채집을 시작했다. ' + startWeatherNote(r.weather), 'sys');
    },
    pin(el) {
      const id = Number(el.dataset.id), l = logs.find((x) => x.id === id);
      if (!l || pins.some((p) => p.id === id)) return false;
      if (pins.length >= PIN_MAX) { log('고정은 최대 ' + PIN_MAX + '개까지 할 수 있다. 하나를 해제해 주세요.', 'bad'); return; }
      pins.unshift({ id: l.id, t: l.t, c: l.c, m: l.m });
    },
    unpin(el) { pins = pins.filter((p) => p.id !== Number(el.dataset.id)); },
    'next-weather'() { G.debugNextWeather(); log('테스트용으로 날씨를 한 칸 넘겼다.', 'sys'); },
    'next-season'() { G.debugNextSeason(); log('테스트용으로 계절을 넘겼다. 지금은 ' + G.seasonInfo().name + '.', 'sys'); },
    abandon() {
      const r = G.abandonExpedition(); T = null;
      log(r.message, 'bad');
    },
    'skip-timer'() { if (!T) return log('돌고 있는 장기 채집이 없다.', 'sys'); T.endAt = Date.now(); },
    'select-area'(el) {
      selArea = el.dataset.id;
      drawMapSel();
      return false;          // 지도 전체를 다시 그리지 않는다 (키보드 초점 유지)
    },
    travel(el) {
      const r = G.travel(el.dataset.id, { broom: UI.useBroom });
      if (!r.ok) return log(r.message, 'bad');
      selArea = r.timed ? G.state.currentTravel.to : el.dataset.id;
      log(r.message, 'sys');
    },
    warp(el) {
      const r = G.travel(el.dataset.id, { warp: true });
      if (!r.ok) return log(r.message, 'bad');
      selArea = el.dataset.id;
      log(r.message, 'sys');
    },
    'toggle-notify'() {
      notifyOn = !notifyOn;
      store.set(NOTIFY_KEY, notifyOn ? '1' : '0');
      renderSettings();
      if (notifyOn) { toast('알림을 켰다. 장기 채집이나 이동이 끝나면 알려 준다.'); beep(); }
      return false;
    },
    'ask-notify'() {
      if (!('Notification' in window)) return false;
      Notification.requestPermission().then(renderSettings, renderSettings);
      return false;
    },
    'test-notify'() { toast('알림 시험 — 이렇게 알려 준다.'); beep(); return false; },
    'export-save'() {
      const name = exportSave();
      toast('저장 파일을 내보냈다: ' + name);
      return false;
    },
    'import-save'() { $('#importfile').click(); return false; },
    'open-ov'(el) { UI.ov = el.dataset.key; UI.ovArg = el.dataset.arg || null; UI.lastGather = ''; },
    'claim-pending'() {
      const r = G.claimPending();
      log(r.message, r.ok ? 'good' : 'bad');
    },
    'close-ov'() { UI.ov = null; },
    'close-chapter'() { G.ackChapter(); UI.ov = null; },
    'event-choice'(el) {
      const r = G.resolveEvent(Number(el.dataset.i));
      if (!r.ok) return log(r.message, 'bad');
      UI.evtResult = r;
      log(r.message, 'good');
      if (r.gains.length) chime('ach');
    },
    nourish(el) {
      const r = G.nourish(el.dataset.kind, el.dataset.id, Number(el.dataset.n));
      log(r.message, r.ok ? (r.grew ? 'legend' : 'good') : 'bad');
    },
    'toggle-bgm'() { setBgm(!bgmOn); return false; },
    'accept-intro'() {
      G.state.introSeen = true; UI.ov = null;
      log('별나루 회관의 초대를 받아들였다. 연금술사로서의 첫걸음이다. 지도에서 가고 싶은 곳을 눌러 보자.', 'good');
    },
    'read-letter'() { UI.ov = 'letter'; const m = $('#menu'); if (m) m.open = false; },
    'accept-quest'(el) {
      const r = G.acceptQuest(el.dataset.id);
      log(r.message, r.ok ? 'good' : 'bad');
    },
    'use-ticket'() {
      const r = G.useTicket();
      log(r.message, r.ok ? 'legend' : 'bad');
    },
    'map-zoom'(el) {
      const i = Math.max(0, Math.min(MAP_ZOOMS.length - 1, MAP_ZOOMS.indexOf(UI.mapZoom) + Number(el.dataset.d)));
      UI.mapZoom = MAP_ZOOMS[i];
    },
    'cancel-travel'() {
      const r = G.cancelTravel();
      selArea = G.state.location;
      log(r.message, r.ok ? 'sys' : 'bad');
    },
    'toggle-broom'(el) { UI.useBroom = el.checked; },
    'go-home'() {
      const r = G.returnHome();
      if (r.ok) selArea = G.state.location;
      log(r.message, r.ok ? 'good' : 'bad');
    },
    'town-up'() {
      const r = G.townUpgrade();
      log(r.message, r.ok ? 'legend' : 'bad');
    },
    drink(el) {
      const r = G.usePotion(el.dataset.id);
      if (!r.ok) return log(r.message, 'bad');
      const parts = r.applied.map((a) => {
        if (a.type === 'session_credit') return '재료 ' + a.herbs.map((h) => h.name + ' ×' + h.amount).join(', ');
        return (EFF[a.type] || a.type) + ' 적용';
      });
      log(r.name + '을(를) 마셨다. ' + parts.join(' · '), 'brew');
      r.applied.forEach((a) => levelMsg(a.levelsGained));
    },
    pick(el) {
      const id = el.dataset.id, i = picked.indexOf(id);
      if (i >= 0) picked.splice(i, 1); else if (picked.length < G.maxIngredients()) picked.push(id);
    },
    'clear-pick'() { picked = []; },
    'fill-recipe'(el) {
      picked = el.dataset.ids.split(',').filter((id) => G.herbs[id]).slice(0, G.maxIngredients());
      UI.tab = 'brew'; UI.brewMode = 'potion';
      const lack = picked.filter((id) => G.herbCount(id) < 1).map(herbName);
      log('재료 칸을 채웠다.' + (lack.length ? ' 부족한 재료: ' + lack.join(', ') : ''), lack.length ? 'bad' : '');
    },
    mix() {
      const ids = picked.slice();
      const r = G.brew(ids);
      const back = r.refunded ? ' 재료 ' + herbName(r.refunded) + ' 하나는 건졌다.' : '';
      const cost = r.cost !== undefined ? ' · 마나 ' + r.cost + (r.free ? ' (무상 시전)' : '') : '';
      if (r.code === 'fizzle') { picked = []; log(r.message + ' (성공 확률 ' + r.chance + '%' + cost + ')' + back, 'bad'); resultBanner(false, '제작 실패', r.message); return; }
      if (!r.ok) return log(r.message, 'bad');
      picked = [];
      log(r.message + ' (성공 확률 ' + r.chance + '%' + cost + ')' + back, 'brew');
      resultBanner(true, '제작 성공', r.message);
    },
    mixmany(el) {
      const r = G.brewMany(picked.slice(), Number(el.dataset.n));
      if (!r.ok) return log(r.message, 'bad');
      const made = Object.keys(r.potions).map((k) => k + ' ×' + r.potions[k]).join(', ');
      resultBanner(r.wins > 0, r.wins > 0 ? '제작 성공' : '제작 실패', r.attempts + '번 중 성공 ' + r.wins + ' · 실패 ' + r.fails + (made ? ' — ' + made : ''));
      log(r.attempts + '번 끓였다. 성공 ' + r.wins + ' · 실패 ' + r.fails + (made ? ' — ' + made : '') + ' (마나 ' + r.cost + ')' + (r.stop ? ' 중단: ' + r.stop : ''), r.wins ? 'brew' : 'bad');
      picked = picked.filter((id) => G.herbCount(id) > 0);
    },
    craftmany(el) {
      const r = G.craftMany(el.dataset.id, Number(el.dataset.n));
      if (!r.ok) return log(r.message, 'bad');
      log(r.name + ' ×' + r.made + '을(를) 만들었다. 재료: ' + pickText(r.used) + ' (마나 ' + r.cost + ')' + (r.stop ? ' 중단: ' + r.stop : ''), 'brew');
      resultBanner(true, '제작 성공', r.name + ' ×' + r.made);
    },
    talk(el) {
      const r = G.talk(el.dataset.id);
      log(r.message, r.ok ? 'good' : 'bad');
    },
    deliver(el) {
      const r = G.deliver(el.dataset.id);
      log(r.message, r.ok ? 'good' : 'bad');
    },
    ui(el) {
      UI[el.dataset.key] = el.dataset.val;
    },
    'goto-goods'() { UI.tab = 'brew'; UI.brewMode = 'good'; UI.ov = null; },
    craft(el) {
      const r = G.craftGood(el.dataset.id);
      if (!r.ok) return log(r.message, 'bad');
      log(r.message + (Object.keys(r.used).length ? ' 재료: ' + pickText(r.used) : '') + ' (마나 ' + r.cost + ')', 'brew');
      resultBanner(true, '제작 성공', r.message);
    },
    rest() {
      const r = G.rest();
      log(r.message, r.ok ? 'good' : 'bad');
    },
    sell(el) {
      const have = el.dataset.kind === 'item' ? G.herbCount(el.dataset.id) : el.dataset.kind === 'potion' ? G.potionCount(el.dataset.id) : (G.state.goods[el.dataset.id] || 0);
      const r = G.sell(el.dataset.kind, el.dataset.id, el.dataset.n === 'all' ? have : Number(el.dataset.n));
      log(r.message, r.ok ? 'good' : 'bad');
    },
    buy(el) {
      const r = G.buy(el.dataset.id, Number(el.dataset.n));
      log(r.message, r.ok ? 'good' : 'bad');
    },
    'buy-tool'(el) {
      const r = G.buyTool(el.dataset.id);
      log(r.message, r.ok ? 'good' : 'bad');
    },
    'give-herbs'() { G.herbList.forEach((h) => G.addHerb(h.id, 3)); log('테스트용으로 모든 재료를 3개씩 받았다.', 'sys'); },
    spend(el) {
      const r = G.spendPoint(el.dataset.key);
      log(r.message, r.ok ? 'good' : 'bad');
    },
    'give-xp'() { G.addXp(100); Alchemy.ABILITY_KEYS.forEach((k) => G.gainAbility(k, 100)); G.state.mana = G.manaMax(); log('테스트용으로 경험치 100과 모든 능력 경험치 100을 받고 마나를 채웠다.', 'sys'); },
    'give-gold'() { G.state.gold += 1000; log('테스트용으로 1,000 G를 받았다.', 'sys'); },
    reset() {
      store.del(KEY);
      G.reset();
      selArea = G.state.location;
      T = null; picked = []; logs = []; pins = [];
      log('처음부터 다시 시작한다.', 'sys');
      UI.ov = 'intro';
    },
  };

  document.addEventListener('click', (e) => {
    if (e.target.dataset && e.target.dataset.ov === 'backdrop') { closeOverlay(); return; }   // 창 밖을 누르면 닫는다
    const t = e.target.closest('[data-act],[data-tab]');
    if (!t) return;
    if (t.dataset.tab) { UI.tab = t.dataset.tab; renderView(); renderOverlay(); return; }
    const fn = ACT[t.dataset.act];
    if (!fn) return;
    const res = fn(t);
    if (res === false) return;
    persist(); render();
    if (T && Date.now() >= T.endAt) finish();
  });
  // 재료 찾기 입력은 목록만 다시 그려 입력 초점을 지킨다
  document.addEventListener('input', (e) => {
    if (e.target.id === 'goodq') {
      UI.goodQ = e.target.value;
      const gl = $('#goodlist');
      if (gl) gl.innerHTML = goodsListHtml();
      return;
    }
    if (e.target.id === 'potq') {
      UI.potQ = e.target.value;
      const pl = $('#potlist');
      if (pl) pl.innerHTML = potionListHtml();
      return;
    }
    if (e.target.id !== 'pickq') return;
    UI.pickQ = e.target.value;
    const el = $('#picklist');
    if (el) el.innerHTML = pickListHtml();
  });
  // 지도 지점은 <g> 라서 키보드(Enter·Space)로도 누를 수 있게 한다
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const menu = $('#menu');
      if (menu && menu.open) { menu.open = false; return; }
    }
    if (e.key === 'Escape' && UI.ov) { closeOverlay(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('g[data-act]')) {
      e.preventDefault();
      e.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });
  // 지점에 올려 두면 이름이 아래에 뜬다
  function hoverCap(e) {
    const cap = $('#mapcap');
    if (!cap) return;
    const n = e.target.closest ? e.target.closest('.node') : null;
    cap.textContent = capText(n ? n.dataset.id : selArea);
  }
  document.addEventListener('mouseover', hoverCap);
  document.addEventListener('focusin', hoverCap);
  $('#fast').addEventListener('change', (e) => {
    if (T) { e.target.checked = fast; return; }
    fast = e.target.checked; applySpeed(); persist(); render();
  });

  // 설정 메뉴: 바깥을 누르면 닫는다 / 저장 파일 고르기
  document.addEventListener('click', (e) => {
    const menu = $('#menu');
    if (menu && menu.open && !menu.contains(e.target)) menu.open = false;
  });
  $('#importfile').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (!window.confirm('저장 파일을 불러오면 지금 진행 중인 기록이 파일의 내용으로 바뀝니다. 계속할까요?')) return;
    const rd = new FileReader();
    rd.onload = () => {
      const r = importSaveText(String(rd.result));
      toast(r.ok ? '저장 파일을 불러왔다.' : r.message);
    };
    rd.onerror = () => toast('파일을 읽지 못했다.');
    rd.readAsText(f);
  });

  window.__game = G;      // 개발자 도구에서 확인용
  window.__saveTools = { exportSave: exportSave, importSaveText: importSaveText };
  renderSettings();
  render();
  if (T && Date.now() >= T.endAt) finish();   // 창을 닫은 사이에 끝난 장기 채집
  booting = false;
  // 오래 비웠다 돌아오면 그사이의 변화를 요약해 보여 준다 (초대장이나 챕터가 먼저 열려 있으면 건너뛴다)
  setTimeout(() => {
    const a = makeAway(prevAway);
    if (a && !UI.ov && G.state.introSeen) { UI.away = a; UI.ov = 'away'; renderOverlay(); }
  }, 700);
  if (bgmOn) document.addEventListener('pointerdown', function once() { document.removeEventListener('pointerdown', once); setBgm(true); });   // 브라우저는 첫 클릭 뒤에야 소리를 허락한다
})();
