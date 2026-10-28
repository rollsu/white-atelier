/*!
 * chat.js — 로그인(Google · 이메일 · 게스트) · 이름 정하기 · 전체 채팅
 * Firebase(Authentication + Realtime Database)를 쓴다. 게임 엔진과는 따로 동작한다.
 * 설정값은 firebase-config.js, 보안 규칙은 database.rules.json.
 */
(function () {
  'use strict';
  const panel = document.querySelector('.chat');
  if (!panel) return;

  const CFG = window.FIREBASE_CONFIG;
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const NAME_RE = /^[가-힣A-Za-z0-9_]{2,12}$/;
  const MAX_LEN = 200, KEEP = 60, GAP_MS = 1000;

  const S = { phase: CFG ? 'loading' : 'off', user: null, name: null, mode: 'in', renaming: false, msg: '', busy: false };
  let auth = null, db = null, listening = null, lastSent = 0;

  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  function hm(t) { const d = new Date(t || Date.now()); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  panel.innerHTML =
    '<h2>채팅 <span class="sub" id="chat-state"></span></h2>' +
    '<div id="chat-top"></div>' +
    '<div class="chatbox" id="chat-box" aria-live="polite"></div>' +
    '<form class="chatform" id="chat-form" autocomplete="off">' +
    '<input type="text" class="search" id="chat-in" maxlength="' + MAX_LEN + '" aria-label="채팅 입력">' +
    '<button class="btn" type="submit">보내기</button></form>';
  const top = panel.querySelector('#chat-top'), box = panel.querySelector('#chat-box'),
    form = panel.querySelector('#chat-form'), input = panel.querySelector('#chat-in'), stateEl = panel.querySelector('#chat-state');

  const ERR = {
    'auth/invalid-email': '이메일 모양이 올바르지 않습니다.',
    'auth/missing-password': '비밀번호를 입력하세요.',
    'auth/weak-password': '비밀번호는 6자 이상이어야 합니다.',
    'auth/email-already-in-use': '이미 가입된 이메일입니다. 로그인을 눌러 보세요.',
    'auth/user-not-found': '이메일이나 비밀번호가 맞지 않습니다.',
    'auth/wrong-password': '이메일이나 비밀번호가 맞지 않습니다.',
    'auth/invalid-credential': '이메일이나 비밀번호가 맞지 않습니다.',
    'auth/too-many-requests': '시도가 너무 많습니다. 잠시 뒤에 다시 해 보세요.',
    'auth/popup-closed-by-user': '로그인 창이 닫혔습니다.',
    'auth/cancelled-popup-request': '로그인 창이 닫혔습니다.',
    'auth/popup-blocked': '팝업이 막혀 있습니다. 허용한 뒤 다시 눌러 주세요.',
    'auth/operation-not-allowed': '이 로그인 방식이 아직 켜져 있지 않습니다. (Firebase 콘솔 설정 필요)',
    'auth/unauthorized-domain': '이 주소가 Firebase 허용 도메인에 없습니다. (Firebase 콘솔 설정 필요)',
    'auth/network-request-failed': '네트워크에 연결할 수 없습니다.',
  };
  const errText = (e) => ERR[e && e.code] || ('문제가 생겼습니다. (' + ((e && (e.code || e.message)) || '알 수 없음') + ')');

  // ---------------------------------------------------------------- 화면
  function render() {
    stateEl.textContent = S.phase === 'ready' && S.name ? '· ' + S.name : '';
    const chatting = S.phase === 'ready' && !!S.user && !!S.name;
    form.hidden = !chatting; box.hidden = !chatting;      // 로그인·이름 정하기 중에는 대화창 대신 위쪽 안내만 보인다
    input.disabled = !chatting;
    input.placeholder = chatting ? '메시지 (최대 ' + MAX_LEN + '자)' : '';
    let h = '';
    if (S.phase === 'off') {
      h = '<p class="sub">채팅 서버가 아직 연결되지 않았습니다. <b>js/firebase-config.js</b>에 Firebase 설정값을 넣으면 로그인과 채팅이 켜집니다. (README.md 참고)</p>';
    } else if (S.phase === 'loading') {
      h = '<p class="sub">채팅 서버에 연결하는 중…</p>';
    } else if (S.phase === 'error') {
      h = '<p class="sub">채팅 서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 새로고침해 주세요.</p>';
    } else if (!S.user) {
      h = '<p class="sub">로그인하면 모두와 이야기할 수 있습니다.</p>' + loginHtml();
    } else if (!S.name || S.renaming) {
      h = nameHtml();
    } else {
      h = '<div class="chat-me"><span>' + esc(S.name) + '</span><span class="chat-links">' +
        '<button type="button" class="linkbtn" data-chat="rename">이름 바꾸기</button>' +
        '<button type="button" class="linkbtn" data-chat="logout">로그아웃</button></span></div>';
    }
    top.innerHTML = h;
  }
  function msgHtml() { return S.msg ? '<p class="chat-msg-err" role="alert">' + esc(S.msg) + '</p>' : ''; }

  function loginHtml() {
    const up = S.mode === 'up';
    return '<div class="chat-auth">' +
      '<button type="button" class="btn" data-chat="google">Google로 시작하기</button>' +
      '<button type="button" class="btn ghost" data-chat="guest">게스트로 입장</button>' +
      '<form id="chat-mail" autocomplete="on">' +
      '<input class="search" type="email" name="email" placeholder="이메일" autocomplete="email" required aria-label="이메일">' +
      '<input class="search" type="password" name="pw" placeholder="비밀번호 (6자 이상)" autocomplete="' + (up ? 'new-password' : 'current-password') + '" required aria-label="비밀번호">' +
      '<button class="btn" type="submit"' + (S.busy ? ' disabled' : '') + '>' + (up ? '이메일로 가입' : '이메일로 로그인') + '</button></form>' +
      '<button type="button" class="linkbtn" data-chat="mode">' + (up ? '이미 계정이 있어요 · 로그인' : '처음이에요 · 가입하기') + '</button>' +
      msgHtml() + '</div>';
  }
  function nameHtml() {
    return '<form id="chat-name" class="chat-auth" autocomplete="off">' +
      '<label class="sub" for="chat-name-in">' + (S.name ? '새 이름' : '채팅에서 쓸 이름을 정해 주세요') + '</label>' +
      '<input class="search" id="chat-name-in" name="n" maxlength="12" value="' + esc(S.name || '') + '" placeholder="한글·영문·숫자·_ 2~12자" required>' +
      '<div class="actions"><button class="btn" type="submit"' + (S.busy ? ' disabled' : '') + '>' + (S.name ? '바꾸기' : '정하기') + '</button>' +
      (S.name ? '<button type="button" class="btn ghost" data-chat="cancel">취소</button>' : '<button type="button" class="btn ghost" data-chat="logout">로그아웃</button>') + '</div>' +
      msgHtml() + '</form>';
  }

  function addMessage(m) {
    if (!m || typeof m.text !== 'string') return;
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    if (box.querySelector('.sub')) box.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'chat-line' + (S.user && m.uid === S.user.uid ? ' mine' : '');
    const t = document.createElement('time'); t.textContent = hm(m.t);
    const b = document.createElement('b'); b.textContent = String(m.name || '이름 없음');
    const s = document.createElement('span'); s.textContent = m.text;
    p.append(t, ' ', b, ' ', s);
    box.appendChild(p);
    while (box.children.length > KEEP) box.removeChild(box.firstChild);
    if (near) box.scrollTop = box.scrollHeight;
  }

  // ---------------------------------------------------------------- Firebase
  function listen() {
    stopListen();
    box.innerHTML = '<p class="sub">아직 대화가 없습니다. 첫 인사를 건네 보세요.</p>';
    const ref = db.ref('chat/global').limitToLast(KEEP);
    ref.on('child_added', (snap) => addMessage(snap.val()), (e) => { S.msg = errText(e); render(); });
    listening = ref;
  }
  function stopListen() { if (listening) { listening.off(); listening = null; } box.innerHTML = ''; }

  async function loadName(user) {
    try { const snap = await db.ref('users/' + user.uid + '/name').once('value'); return snap.val() || null; }
    catch (e) { S.msg = errText(e); return null; }
  }

  async function setName(raw) {
    const n = String(raw || '').trim();
    if (!NAME_RE.test(n)) { S.msg = '이름은 한글·영문·숫자·_ 만 쓸 수 있고 2~12자여야 합니다.'; return render(); }
    const key = n.toLowerCase(), uid = S.user.uid, old = S.name, upd = {};
    if (old && old.toLowerCase() === key && old === n) { S.renaming = false; S.msg = ''; return render(); }
    upd['names/' + key] = uid;
    upd['users/' + uid + '/name'] = n;
    if (old && old.toLowerCase() !== key) upd['names/' + old.toLowerCase()] = null;
    S.busy = true; S.msg = ''; render();
    try {
      await db.ref().update(upd);
      S.name = n; S.renaming = false;
      listen();
    } catch (e) {
      S.msg = e && e.code === 'PERMISSION_DENIED' ? '이미 누군가 쓰고 있는 이름이거나 쓸 수 없는 이름입니다.' : errText(e);
    }
    S.busy = false; render();
  }

  async function run(fn) {
    S.busy = true; S.msg = ''; render();
    try { await fn(); } catch (e) { S.msg = errText(e); }
    S.busy = false; render();
  }

  function send(text) {
    const t = String(text || '').trim();
    if (!t || !S.user || !S.name) return;
    const now = Date.now();
    if (now - lastSent < GAP_MS) return;
    lastSent = now;
    input.value = '';
    db.ref('chat/global').push({ uid: S.user.uid, name: S.name, text: t.slice(0, MAX_LEN), t: firebase.database.ServerValue.TIMESTAMP })
      .catch((e) => { S.msg = '보내지 못했습니다. (' + errText(e) + ')'; render(); });
  }

  // ---------------------------------------------------------------- 이벤트
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-chat]');
    if (!b || !auth) return;
    const act = b.dataset.chat;
    if (act === 'google') run(() => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()));
    else if (act === 'guest') run(() => auth.signInAnonymously());
    else if (act === 'mode') { S.mode = S.mode === 'up' ? 'in' : 'up'; S.msg = ''; render(); }
    else if (act === 'logout') { S.msg = ''; auth.signOut(); }
    else if (act === 'rename') { S.renaming = true; S.msg = ''; render(); const i = panel.querySelector('#chat-name-in'); if (i) { i.focus(); i.select(); } }
    else if (act === 'cancel') { S.renaming = false; S.msg = ''; render(); }
  });
  panel.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    if (!auth) return;
    if (f.id === 'chat-mail') {
      const em = f.elements.email.value.trim(), pw = f.elements.pw.value;
      run(() => S.mode === 'up' ? auth.createUserWithEmailAndPassword(em, pw) : auth.signInWithEmailAndPassword(em, pw));
    } else if (f.id === 'chat-name') setName(f.elements.n.value);
    else if (f.id === 'chat-form') send(input.value);
  });

  // ---------------------------------------------------------------- 시작
  function loadScript(src) {
    return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  }
  async function start() {
    try {
      if (!window.firebase) {
        await loadScript(SDK + 'firebase-app-compat.js');
        await Promise.all([loadScript(SDK + 'firebase-auth-compat.js'), loadScript(SDK + 'firebase-database-compat.js')]);
      }
      firebase.initializeApp(CFG);
      auth = firebase.auth(); db = firebase.database();
    } catch (e) { S.phase = 'error'; return render(); }
    auth.onAuthStateChanged(async (u) => {
      S.user = u; S.renaming = false; S.name = null; S.msg = '';
      stopListen();
      if (u) { S.name = await loadName(u); if (S.name) listen(); }
      S.phase = 'ready'; render();
    });
  }

  render();
  if (CFG) start();
})();
