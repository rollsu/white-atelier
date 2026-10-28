/*!
 * alchemy-ext5.js v8 — 별나루 회관: 의뢰 게시판 · 특수 티켓 · 마을 업그레이드 목록
 * Game6 를 상속한다.
 *   - 의뢰 게시판: 날마다(날짜 시드) 5건이 붙는다. 첫 번째는 거래소 호황에 맞춘 "시세 수요" 의뢰.
 *   - 특수 티켓: 쓰면 그날 의뢰 5건이 더 붙는다. 환영 패키지로 1장, 게시판 의뢰 10건을 마칠 때마다 1장.
 *   - 받은 의뢰는 state.missions 에 쌓이고(마을 사람 임무와 같은 수첩), 납품은 중앙 마을에서만 한다.
 */
(function () {
  'use strict';
  const A = Alchemy;

  const BOARD_SLOTS = 5;           // 하루 기본 의뢰 수
  const TICKET_EXTRA = 5;          // 티켓 1장으로 늘어나는 의뢰 수
  const TICKET_EVERY = 10;         // 게시판 의뢰 N건을 마칠 때마다 티켓 1장
  const QUEST_CAP = 12;            // 한꺼번에 받아 둘 수 있는 의뢰 수
  const DEMAND_MULT = 2.2;         // 시세 수요 의뢰의 보상 배율
  const HUB_IDS = ['camp', 'market', 'tool_street', 'town_hall'];

  function F(code, message) { return { ok: false, code: code, message: message }; }
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return h >>> 0;
  }
  function seeded(seed) {
    let a = hash(seed);
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class Game7 extends A.Game6 {
    migrate() {
      super.migrate();
      const s = this.state;
      if (s.tickets === undefined) s.tickets = 1;          // 환영 패키지: 특수 티켓 1장
      if (s.boardDone === undefined) s.boardDone = 0;
      if (s.board === undefined) s.board = null;
      return this;
    }

    npcOf(id) { return id === 'board' ? { name: '의뢰 게시판', lines: [] } : super.npcOf(id); }

    // 의뢰마다 지금 얼마나 갖고 있는지
    missionProgress(m) {
      const s = this.state;
      if (m.type === 'good') return { have: s.goods[m.key] || 0, need: m.n };
      if (m.type === 'item') return { have: this.herbCount(m.key), need: m.n };
      const have = this.ownedPotions().filter(function (p) { return p.tier >= m.minTier; })
        .reduce(function (a, p) { return a + s.potions[p.id]; }, 0);
      return { have: have, need: m.n };
    }

    // ------------------------------------------------------------ 게시판
    _demandQuest(date, i) {
      const rng = this.rng;
      const keys = this.hotKeys().filter(function (k) { return k.indexOf('item:') === 0; });
      if (!keys.length) return null;
      const h = this.herbs[keys[Math.floor(rng() * keys.length)].split(':')[1]];
      const n = h.rarity === 'common' ? 6 : h.rarity === 'uncommon' ? 4 : 2;
      return { id: 'b' + date + '-' + i, npc: 'board', type: 'item', key: h.id, name: h.name, n: n, demand: true,
        reward: Math.round(h.price * n * DEMAND_MULT) };
    }

    _boardQuest(date, i) {
      const saved = this.rng;
      this.rng = seeded(date + '|slot' + i);       // 같은 날이면 같은 의뢰가 붙게 한다
      try {
        const m = (i === 0 ? this._demandQuest(date, i) : null) || this._makeMission('board', false);
        m.id = 'b' + date + '-' + i; m.board = true; m.npc = 'board'; m.taken = false;
        return m;
      } finally { this.rng = saved; }
    }

    boardEnsure() {
      const s = this.state, t = this.config.today();
      if (!s.board || s.board.date !== t) {
        s.board = { date: t, slots: [], extra: 0 };
        for (let i = 0; i < BOARD_SLOTS; i++) s.board.slots.push(this._boardQuest(t, i));
      }
      return s.board;
    }

    boardInfo() {
      const b = this.boardEnsure();
      return { slots: b.slots, extra: b.extra, tickets: this.state.tickets, done: this.state.boardDone,
        untilTicket: TICKET_EVERY - (this.state.boardDone % TICKET_EVERY), cap: QUEST_CAP, held: this.state.missions.length };
    }

    acceptQuest(slotId) {
      const s = this.state;
      if (s.location !== 'town_hall') return F('not_here', '별나루 회관의 게시판에서만 의뢰를 받을 수 있다.');
      const b = this.boardEnsure(), q = b.slots.find(function (x) { return x.id === slotId; });
      if (!q) return F('none', '그 의뢰는 이미 내려갔다.');
      if (q.taken) return F('taken', '이미 받은 의뢰다.');
      if (s.missions.length >= QUEST_CAP) return F('full', '받아 둔 의뢰가 너무 많다. (최대 ' + QUEST_CAP + '건) 먼저 마무리하자.');
      const m = Object.assign({}, q); delete m.taken;
      s.missions.push(m);
      q.taken = true;
      return { ok: true, mission: m, message: '의뢰를 받았다 — ' + this.missionText(m) + ' (보상 ' + m.reward + ' G)' };
    }

    useTicket() {
      const s = this.state;
      if (s.location !== 'town_hall') return F('not_here', '특수 티켓은 별나루 회관에서만 쓸 수 있다.');
      if (s.tickets < 1) return F('no_ticket', '특수 티켓이 없다. 게시판 의뢰를 ' + TICKET_EVERY + '건 마칠 때마다 1장을 얻는다.');
      const b = this.boardEnsure(), base = BOARD_SLOTS + b.extra;
      for (let i = 0; i < TICKET_EXTRA; i++) b.slots.push(this._boardQuest(b.date, base + i));
      b.extra += TICKET_EXTRA;
      s.tickets -= 1;
      return { ok: true, message: '특수 티켓을 썼다. 오늘 게시판에 의뢰가 ' + TICKET_EXTRA + '건 더 붙었다. (남은 티켓 ' + s.tickets + '장)' };
    }

    // 납품은 중앙 마을에서만. 게시판 의뢰를 마치면 실적이 쌓여 티켓을 준다
    deliver(id) {
      const s = this.state;
      if (HUB_IDS.indexOf(s.location) < 0) return F('not_town', '납품은 중앙 마을에서만 할 수 있다.');
      const m = s.missions.find(function (x) { return x.id === id; });
      const r = super.deliver(id);
      if (r.ok && m && m.board) {
        s.boardDone += 1;
        if (s.boardDone % TICKET_EVERY === 0) {
          s.tickets += 1;
          r.message += ' 게시판 의뢰 ' + TICKET_EVERY + '건을 마쳐 특수 티켓 1장을 얻었다!';
        }
      }
      return r;
    }

    // ------------------------------------------------------------ 마을 업그레이드
    townLevels() {
      const lv = this.state.townLv;
      return [1, 2, 3, 4, 5].map(function (n) {
        const need = n > 1 ? A.TOWN.UP[n - 1] : null;
        return { lv: n, label: n === 1 ? '기본 마을' : A.TOWN.LABEL[n], gold: need ? need.gold : 0, delivered: need ? need.delivered : 0,
          reached: lv >= n, next: lv + 1 === n };
      });
    }

    townUpgrade() {
      const s = this.state;
      if (s.phase === 'travel') return F('traveling', '이동 중에는 할 수 없다.');
      if (s.location !== 'town_hall') return F('not_here', '별나루 회관에서만 마을을 키울 수 있다.');
      const info = this.townInfo();
      if (!info.next) return F('max', '마을은 이미 최고 단계다.');
      if (s.delivered < info.next.delivered) return F('lack', '납품 임무가 모자란다. (' + info.next.delivered + '건 필요, 지금 ' + s.delivered + '건)');
      if (s.gold < info.next.gold) return F('gold', '금화가 모자란다. (' + info.next.gold + ' G 필요)');
      s.gold -= info.next.gold;
      s.townLv += 1;
      return { ok: true, lv: s.townLv, message: '마을이 ' + s.townLv + '단계로 자랐다. ' + A.TOWN.LABEL[s.townLv] };
    }
  }

  A.GameClass = Game7;
  A.Game7 = Game7;
  A.HUB_IDS = HUB_IDS;
})();
