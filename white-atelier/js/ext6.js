/*!
 * alchemy-ext6.js v9 — 세계수 단서 · 마을 레벨별 해금 · 창고 · 단기 일일 한도 · 장기 피로 · 임대료
 *                    · 계절 효과와 한정 재료 · 의뢰 확대와 호감도 · 날씨·계절 시세 · 도구 7단계
 * Game7 을 상속한다. 수치는 이 파일 위쪽 상수에 모아 두었다.
 */
(function () {
  'use strict';
  const A = Alchemy;
  const RARS = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

  // ---- 단기 · 장기 채집
  const SHORT_DAILY = 30;                     // 하루 단기 채집 횟수
  const FATIGUE = { chain: 180, step: 60, restGap: 30, decay: 90, cut: 0.1, max: 5 };
  //   chain: 쉬지 않고 이어 장기 채집한 시간이 이만큼(게임 분)이 되면 피로 1단계, 이후 step 분마다 1단계씩 쌓인다.
  //   restGap: 이만큼 쉬면 이어 하기가 끊긴다. decay: 끊긴 뒤 이 시간마다 피로 1단계가 풀린다. cut: 피로 1단계당 장기 보상 감소.

  // ---- 마을 레벨별 값 (인덱스 = 마을 레벨)
  const STORAGE = [0, 100, 175, 250, 325, 400];     // 재료 창고 용량(칸): 처음 100칸, 마을 레벨 5에서 최대 400칸
  const RENT = [0, 150, 250, 400, 650, 1000];       // 매주 월요일 오전 6시 임대료(G)
  const SHOP_SIZE = [0, 8, 10, 12, 14, 16];         // 거래소가 파는 재료 수
  const SHOP_MAX_RARITY = [0, 0, 1, 2, 2, 2];       // 거래소가 파는 가장 높은 등급(0 일반, 1 고급, 2 희귀)

  // ---- 계절
  const SEASON_TRAVEL_ADD = { spring: 0.10, summer: 0.15, autumn: 0.05, winter: 0.30 };
  const SEASON_DEBUFF = {
    spring: '꽃가루 — 마나 회복 -25%', summer: '무더위 — 장기 채집 보상 -5%',
    autumn: '쌀쌀한 바람 — 단기 채집 대기시간 +15%', winter: '한파 — 조합 성공 확률 -4%p',
  };

  // ---- 세계수 단서 (이야기 순서대로 하나씩 열린다)
  const CLUES = [
    '세계수는 이 대륙이 아니라 바다 너머 "대대륙"에 뿌리를 내리고 있다고 한다.',
    '대대륙으로 가는 옛 항로는 "별이 지는 곳"을 향해 이어져 있었다.',
    '고요한 숲의 뿌리들은 모두 한 방향, 대대륙 쪽으로 뻗어 있다.',
    '세계수의 잎은 어떤 병도 낫게 한다는 전설이 있다. 하지만 가져온 사람은 없다.',
    '항로를 연 마지막 연금술사는 "안개가 걷히는 맑은 새벽"에 출발했다.',
    '대대륙의 해안에는 사람 키보다 큰 달무리 월계수가 자란다고 한다.',
    '세계수의 문은 "여섯 땅의 전설 재료"를 바쳐야 열린다는 이야기가 있다.',
    '옛 지도에는 별나루 북쪽 바다에 가려진 항구 표시가 있다.',
    '배를 움직이려면 "시간을 붙잡는 약"과 "무구한 영약"이 필요하다고 적혀 있었다.',
    '세계수의 뿌리는 "뿌리의 심장"에서 대대륙까지 맥이 되어 이어진다.',
    '대대륙에서는 계절이 거꾸로 흐른다는 소문이다.',
    '마지막 단서: 세계수의 이름은 "별나루"라는 이 마을 이름과 같은 뜻이다.',
  ];
  const CLUE_BOARD_CHANCE = 0.08;                    // 게시판 의뢰를 마칠 때 단서를 찾을 확률
  const CLUE_FAVOR_STEPS = [3, 6, 9];                // NPC 호감도가 이 칸에 닿으면 단서를 말해 준다(마을 레벨 4부터)
  const FAVOR_MAX = 10, FAVOR_REWARD = 0.02;         // 호감도 칸 수, 칸당 의뢰 보상 증가

  const WEEK_MS = 7 * 24 * 3600 * 1000;

  function F(code, message) { return { ok: false, code: code, message: message }; }
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // 마을 업그레이드 설명을 새 규칙에 맞게 바꾼다 (ext3 의 배열을 그대로 고친다)
  A.TOWN.LABEL[2] = '거점 복귀 · 창고 175칸 · 고급 재료 판매';
  A.TOWN.LABEL[3] = '도구 7단계까지 · 창고 250칸 · 희귀 재료 판매';
  A.TOWN.LABEL[4] = 'NPC가 세계수의 단서를 말해 준다 · 창고 325칸';
  A.TOWN.LABEL[5] = '전설 의뢰 · 특수 티켓 2장 · 창고 400칸(최대)';

  class Game8 extends A.Game7 {
    migrate() {
      super.migrate();
      const s = this.state;
      s.pending = s.pending || {};
      s.fatigue = s.fatigue || { stacks: 0, chain: 0, lastEnd: 0 };
      if (s.rentKey === undefined) s.rentKey = null;
      s.debt = s.debt || 0;
      s.rentPaid = s.rentPaid || 0;
      s.favor = s.favor || {};
      s.clues = s.clues || [];
      s.counters = s.counters || { gathered: 0, crafted: 0, brewed: 0, longDone: 0, sold: 0 };
      if (s.lv5Gift === undefined) s.lv5Gift = s.townLv >= 5;
      s.introSeen = !!s.introSeen;                     // 처음 시작할 때의 초대장을 읽었는지
      this._installSeasonGate();
      return this;
    }

    // 계절 한정 재료는 그 계절에만 지역 재료 목록에 보이게 한다 (area.herbs 를 계산 속성으로 바꾼다)
    _installSeasonGate() {
      const g = this;
      Object.keys(this.areas).forEach(function (id) {
        const a = this.areas[id];
        if (a._all) return;
        const all = a.herbs;
        Object.defineProperty(a, '_all', { value: all, enumerable: false });
        Object.defineProperty(a, 'herbs', {
          enumerable: true, configurable: true,
          get: function () {
            const si = g.seasonId();
            return all.filter(function (hid) { const sn = g.herbs[hid].season; return !sn || sn === si; });
          },
        });
      }, this);
    }

    seasonId() { return A.SEASONS[this.seasonIndex()].id; }

    // ------------------------------------------------------------ 임대료 (매주 월요일 오전 6시)
    _rentKey() {
      const d = new Date(this.config.now());
      const dow = (d.getDay() + 6) % 7;                         // 월요일 = 0
      const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow, 6, 0, 0, 0);
      if (d < m) m.setDate(m.getDate() - 7);
      return m.getTime();
    }
    rentAmount() { return RENT[this.state.townLv]; }

    rentInfo() {
      return { amount: this.rentAmount(), nextAt: new Date(this._rentKey() + WEEK_MS), debt: this.state.debt, paid: this.state.rentPaid };
    }

    _settleDebt() {
      const s = this.state;
      if (s.debt > 0 && s.gold > 0) {
        const p = Math.min(s.debt, s.gold);
        s.gold -= p; s.debt -= p; s.rentPaid += p;
        this.events.push({ type: 'debt', paid: p, debt: s.debt });
      }
    }

    // 월요일 06:00 이 지났으면 임대료를 낸다. 돈이 모자라면 연체로 남고, 돈이 생기는 대로 갚는다. (창을 닫아 둔 몇 주는 한꺼번에, 최대 4주)
    checkRent() {
      const s = this.state, key = this._rentKey();
      if (s.rentKey === null) { s.rentKey = key; return; }
      if (key <= s.rentKey) { this._settleDebt(); return; }
      const weeks = Math.max(1, Math.min(4, Math.round((key - s.rentKey) / WEEK_MS)));
      s.rentKey = key;
      const due = weeks * this.rentAmount(), pay = Math.min(s.gold, due);
      s.gold -= pay; s.debt += due - pay; s.rentPaid += pay;
      this.events.push({ type: 'rent', due: due, paid: pay, debt: s.debt, weeks: weeks });
    }

    _rollDay() {
      super._rollDay();
      this.checkRent();
    }

    // ------------------------------------------------------------ 창고
    storageCap() { return this.config.infiniteStorage ? 1e9 : STORAGE[this.state.townLv]; }   // 테스트(빠른 시간) 중에는 창고 무제한
    storageUsed() {
      const h = this.state.herbs;
      return Object.keys(h).reduce(function (a, k) { return a + (h[k] > 0 ? h[k] : 0); }, 0);
    }
    pendingCount() {
      const p = this.state.pending;
      return Object.keys(p).reduce(function (a, k) { return a + p[k]; }, 0);
    }

    // 얻은 재료가 창고 용량을 넘으면, 넘은 만큼(낮은 등급부터)을 "보류"로 돌린다. 사라지지 않고 거점에서 받을 수 있다.
    _applyCap(before) {
      const s = this.state, cap = this.storageCap();
      let over = this.storageUsed() - cap;
      if (over <= 0) return 0;
      const gains = Object.keys(s.herbs).filter(function (id) { return s.herbs[id] > (before[id] || 0); })
        .map(function (id) { return { id: id, g: s.herbs[id] - (before[id] || 0) }; })
        .sort(function (a, b) {
          return RARS.indexOf(this.herbs[a.id].rarity) - RARS.indexOf(this.herbs[b.id].rarity) || this.herbs[a.id].price - this.herbs[b.id].price;
        }.bind(this));
      let moved = 0;
      gains.forEach(function (x) {
        if (over <= 0) return;
        const t = Math.min(over, x.g);
        s.herbs[x.id] -= t;
        if (s.herbs[x.id] <= 0) delete s.herbs[x.id];
        s.pending[x.id] = (s.pending[x.id] || 0) + t;
        over -= t; moved += t;
      });
      if (moved) this.events.push({ type: 'overflow', n: moved });
      return moved;
    }

    claimPending() {
      const s = this.state;
      if (s.location !== 'camp') return F('not_here', '보류된 재료는 거점의 창고에서만 받을 수 있다.');
      let room = this.storageCap() - this.storageUsed();
      if (!this.pendingCount()) return F('none', '보류된 재료가 없다.');
      if (room <= 0) return F('full', '창고가 가득 차 있다. 재료를 팔거나 써서 자리를 만들자.');
      let moved = 0;
      Object.keys(s.pending).sort(function (a, b) {
        return RARS.indexOf(this.herbs[b].rarity) - RARS.indexOf(this.herbs[a].rarity);
      }.bind(this)).forEach(function (id) {
        if (room <= 0) return;
        const t = Math.min(room, s.pending[id]);
        s.herbs[id] = (s.herbs[id] || 0) + t;
        s.pending[id] -= t;
        if (s.pending[id] <= 0) delete s.pending[id];
        room -= t; moved += t;
      });
      this.markSeen();
      return { ok: true, moved: moved, left: this.pendingCount(), message: '보류된 재료 ' + moved + '개를 창고로 옮겼다.' + (this.pendingCount() ? ' (아직 ' + this.pendingCount() + '개가 남았다)' : '') };
    }

    usePotion(id) {
      const before = Object.assign({}, this.state.herbs);
      const r = super.usePotion(id);
      if (r.ok) this._applyCap(before);
      return r;
    }

    completeTravel() {
      const before = Object.assign({}, this.state.herbs);
      const r = super.completeTravel();
      if (r.ok) this._applyCap(before);
      return r;
    }

    buy(id, n) {
      const room = this.storageCap() - this.storageUsed();
      if (room <= 0) return F('full', '창고가 가득 찼다. (' + this.storageUsed() + '/' + this.storageCap() + ')');
      return super.buy(id, Math.min(n || 1, room));
    }

    // ------------------------------------------------------------ 카운터 (활동 의뢰용)
    _counter(metric) {
      return metric === 'visited' ? Object.keys(this.state.visited).length : (this.state.counters[metric] || 0);
    }
    _counterSnap() {
      const c = this.state.counters;
      return { gathered: c.gathered || 0, crafted: c.crafted || 0, brewed: c.brewed || 0, longDone: c.longDone || 0, sold: c.sold || 0, visited: Object.keys(this.state.visited).length };
    }

    // ------------------------------------------------------------ 단기 채집: 하루 30회
    shortLeft() { return Math.max(0, SHORT_DAILY - this.state.shortToday); }

    shortGather() {
      this._rollDay();
      const s = this.state;
      if (s.phase === 'idle') {
        const ng = this._noGather();
        if (ng) return ng;
        if (s.shortToday >= SHORT_DAILY) return F('daily_cap', '오늘의 단기 채집(하루 ' + SHORT_DAILY + '회)을 모두 했다. 장기 채집을 하거나 내일 다시 하자.');
        if (this.storageUsed() >= this.storageCap()) return F('full', '창고가 가득 찼다. (' + this.storageUsed() + '/' + this.storageCap() + ') 재료를 팔거나 써서 자리를 만들자.');
      }
      const r = super.shortGather();
      if (!r.ok) return r;
      if (!r.lost) s.counters.gathered += r.amount;
      if (!r.lost) {
        // 단기 채집도 연금술사 경험치를 준다: 기본 1, 높은 등급일수록 더 (하루 30회)
        const rar = this.herbs[r.herbId].rarity;
        r.xp = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 }[rar] || 1;
        r.levelsGained = this.addXp(r.xp);
      }
      if (this.seasonId() === 'autumn') {                       // 가을: 쌀쌀한 바람 — 대기시간 +15%
        const cd = r.cooldownSec * 1.15;
        s.shortReadyAt = this.config.now() + Math.round(cd * 1000);
        r.cooldownSec = Math.round(cd * 10) / 10;
      }
      return r;
    }

    // ------------------------------------------------------------ 장기 채집: 피로
    fatigueStacks() {
      const f = this.state.fatigue;
      if (!f.lastEnd) return f.stacks;
      const gap = (this.config.now() - f.lastEnd) / this.config.minuteMs;
      if (gap <= FATIGUE.restGap) return f.stacks;
      return Math.max(0, f.stacks - Math.floor((gap - FATIGUE.restGap) / FATIGUE.decay));
    }

    fatigueInfo() {
      const f = this.state.fatigue, st = this.fatigueStacks();
      const gap = f.lastEnd ? (this.config.now() - f.lastEnd) / this.config.minuteMs : 1e9;
      const chain = gap > FATIGUE.restGap ? 0 : f.chain;
      return { stacks: st, chain: chain, cut: Math.min(0.9, st * FATIGUE.cut), threshold: FATIGUE.chain, max: FATIGUE.max };
    }

    startExpedition(m) {
      const s = this.state, f = s.fatigue;
      if (s.phase === 'idle' && f.lastEnd) {
        const gap = (this.config.now() - f.lastEnd) / this.config.minuteMs;
        if (gap > FATIGUE.restGap) { f.stacks = this.fatigueStacks(); f.chain = 0; f.lastEnd = 0; }   // 쉬었으니 이어 하기가 끊긴다
      }
      const r = super.startExpedition(m);
      if (r.ok) { s.currentExpedition.fat = f.stacks; r.fatigue = f.stacks; }
      return r;
    }

    _penaltyPct() {
      const ex = this.state.currentExpedition, fat = (ex && ex.fat) || 0;
      let p = super._penaltyPct() * (1 - Math.min(0.9, fat * FATIGUE.cut));
      if (this.seasonId() === 'summer') p *= 0.95;               // 여름: 무더위
      return Math.round(p);
    }

    completeExpedition() {
      const s = this.state, ex = s.currentExpedition;
      const before = Object.assign({}, s.herbs);
      const r = super.completeExpedition();
      if (!r.ok) return r;
      r.overflow = this._applyCap(before);
      s.counters.longDone += 1;
      s.counters.gathered += r.herbs.reduce(function (a, h) { return a + h.amount; }, 0);
      const f = s.fatigue;
      f.chain += ex ? ex.minutes : r.minutes;
      f.lastEnd = this.config.now();
      if (f.chain >= FATIGUE.chain) {
        const st = Math.min(FATIGUE.max, 1 + Math.floor((f.chain - FATIGUE.chain) / FATIGUE.step));
        if (st > f.stacks) { f.stacks = st; this.events.push({ type: 'fatigue', stacks: st }); }
      }
      r.fatigueNow = f.stacks;
      return r;
    }

    // 거점에서 쉬면 피로가 모두 풀린다
    rest() {
      const r = super.rest();
      if (r.ok) {
        const had = this.fatigueStacks();
        this.state.fatigue = { stacks: 0, chain: 0, lastEnd: 0 };
        if (had) r.message += ' 쌓인 피로도 풀렸다.';
      }
      return r;
    }

    // ------------------------------------------------------------ 계절 효과
    seasonEffects() {
      const id = this.seasonId();
      return { id: id, travelAdd: SEASON_TRAVEL_ADD[id], debuff: SEASON_DEBUFF[id] };
    }

    travelBase(from, to) {
      const b = super.travelBase(from, to);
      return b ? Math.round(b * (1 + SEASON_TRAVEL_ADD[this.seasonId()])) : 0;
    }

    _regen() {
      if (this.seasonId() !== 'spring') return super._regen();
      const saved = this.config.manaRegenSec;
      this.config.manaRegenSec = saved / 0.75;                   // 봄: 꽃가루 — 마나 회복 -25%
      try { super._regen(); } finally { this.config.manaRegenSec = saved; }
    }

    _chanceFor(recipe) {
      const c = super._chanceFor(recipe) - (this.seasonId() === 'winter' ? 4 : 0);   // 겨울: 한파
      return Math.max(this.config.minBrewChance, Math.round(c * 10) / 10);
    }

    // ------------------------------------------------------------ 능력 포인트: 연금술사 2레벨마다 1점
    addXp(n) {
      const before = this.state.level;
      const gained = super.addXp(n);
      if (gained > 0) {
        const should = Math.floor(this.state.level / 2) - Math.floor(before / 2);
        this.state.points -= gained - should;
        for (let i = this.events.length - 1; i >= 0; i--) {
          if (this.events[i].type === 'alch') { this.events[i].n = should; break; }
        }
      }
      return gained;
    }

    // ------------------------------------------------------------ 도구: 마을 레벨 3에서 7단계까지
    toolCap() {
      const townCap = this.state.townLv >= 3 ? 7 : 3;
      const craftCap = this.has('craft', 15) ? 10 : 3;
      return Math.max(townCap, craftCap);
    }

    toolList() {
      const cap = this.toolCap();
      return A.TOOLS.map(function (t) {
        const lv = this.toolLv(t.id), single = t.max === 1;
        const limit = single ? 1 : Math.min(cap, t.max);
        const canBuy = lv < limit;
        const pending = !single && lv >= t.max && cap > t.max;
        const locked = !single && !canBuy && !pending && lv < t.max
          ? (this.state.townLv < 3 ? '마을 레벨 3이 되면 ' + (lv + 1) + '단계를 살 수 있다' : '이 단계는 아직 열리지 않았다') : null;
        return { id: t.id, name: t.name, kind: t.kind, lv: lv, max: t.max, capLv: single ? 1 : cap, label: t.label[lv],
          nextLabel: canBuy ? t.label[lv + 1] : null, cost: canBuy ? t.costs[lv] : null, pending: pending, locked: locked };
      }, this);
    }

    buyTool(id) {
      const s = this.state;
      if (s.phase === 'travel') return F('traveling', '이동 중에는 할 수 없다.');
      const t = A.TOOLS.find(function (x) { return x.id === id; });
      if (!t) return F('unknown_tool', '알 수 없는 도구입니다.');
      if (s.location !== 'tool_street') return F('not_here', '도구 거리에서만 살 수 있다.');
      const info = this.toolList().find(function (x) { return x.id === id; });
      if (!info.nextLabel) {
        return F('locked', info.locked || (info.pending ? '이 단계 이후의 강화는 아직 준비 중이다.' : t.name + '은(는) 이미 최고 단계다.'));
      }
      if (s.gold < info.cost) return F('gold', '금화가 모자란다. (' + info.cost + ' G 필요)');
      s.gold -= info.cost;
      s.tools[id] = info.lv + 1;
      return { ok: true, name: t.name, lv: info.lv + 1, cost: info.cost, label: t.label[info.lv + 1],
        message: t.name + ' Lv.' + (info.lv + 1) + '을(를) 장만했다. ' + t.label[info.lv + 1] };
    }

    // ------------------------------------------------------------ 거래소 재고: 마을 레벨과 주말
    isWeekend() { const d = new Date(this.config.now()).getDay(); return d === 0 || d === 6; }

    shopStock() {
      const t = this.config.today(), lv = this.state.townLv, si = this.seasonId();
      const maxR = SHOP_MAX_RARITY[lv], size = SHOP_SIZE[lv];
      const ok = function (h) { return !(h.season && h.season !== si); };
      const byHash = function (tag) { return function (a, b) { return hash(t + tag + a.id) - hash(t + tag + b.id); }; };
      const pool = this.herbList.filter(function (h) { return ok(h) && RARS.indexOf(h.rarity) <= maxR; }).sort(byHash('$'));
      let items = pool.slice(0, size).map(function (h) { return { h: h, weekend: false }; });
      if (this.isWeekend()) {
        // 주말: 지금 살 수 있는 것보다 2단계 높은 등급의 재료가 확률적으로 섞인다 (전설까지)
        const tier = Math.min(4, maxR + 2);
        const high = this.herbList.filter(function (h) { return ok(h) && RARS.indexOf(h.rarity) === tier; }).sort(byHash('W'));
        for (let i = 0; i < 2 && high.length; i++) {
          if (hash(t + 'WK' + i) < 0.6) {
            const pick = high[Math.floor(hash(t + 'WP' + i) * high.length)];
            if (!items.some(function (x) { return x.h.id === pick.id; })) items[items.length - 1 - i] = { h: pick, weekend: true };
          }
        }
      }
      const disc = this.has('charm', 20) ? 0.9 : 1;
      items.sort(function (a, b) {
        return RARS.indexOf(a.h.rarity) - RARS.indexOf(b.h.rarity) || A.CAT_ORDER.indexOf(a.h.cat) - A.CAT_ORDER.indexOf(b.h.cat);
      });
      return items.map(function (x) {
        return { id: x.h.id, price: Math.ceil(x.h.price * 2.6 * disc), left: Math.max(0, 5 - (this.state.bought[x.h.id] || 0)), weekend: x.weekend };
      }, this);
    }

    // ------------------------------------------------------------ 날씨·계절이 시세에 주는 영향
    _badWeatherCount() {
      const key = Math.floor(this.config.now() / 5000) + '|' + (this.state.wxShift || 0) + '|' + (this.state.seasonShift || 0);
      if (this._badCache && this._badCache.k === key) return this._badCache.v;
      const v = this.forecast().filter(function (f) { return f.now.bad; }).length;
      this._badCache = { k: key, v: v };
      return v;
    }

    _unitPrice(kind, id, soldN) {
      let p = super._unitPrice(kind, id, soldN);
      if (kind === 'potion') {
        const pot = this.ensurePotion(id);
        if (pot && pot.effects.some(function (e) { return e.type === 'weather_ward' || e.type === 'weather_shield'; })) {
          p *= 1 + 0.2 * Math.min(3, this._badWeatherCount());           // 나쁜 날씨가 많을수록 날씨 대비 물약이 비싸진다
        }
      } else if (kind === 'item') {
        const h = this.herbs[id];
        if (h.season) p *= h.season === this.seasonId() ? 0.9 : 1.6;     // 제철 재료는 흔해서 싸고, 철이 지나면 귀하다
      }
      return Math.max(1, Math.round(p));
    }

    // 거래소 소식: 지금 시세에 영향을 주는 날씨와 계절
    marketNews() {
      const out = [], se = this.seasonInfo(), bad = this._badWeatherCount();
      out.push(se.name + ': ' + se.traits.join('·') + ' 기운의 재료 시세 +15%');
      if (bad) out.push('나쁜 날씨 지역 ' + bad + '곳: 날씨 방지·보호막 물약 시세 +' + 20 * Math.min(3, bad) + '%');
      out.push('계절 한정 재료: 제철에는 시세 -10%, 철이 지나면 +60%');
      if (this.isWeekend()) out.push('주말 특별 재고: 평소보다 두 단계 높은 재료가 들어올 수 있다');
      return out;
    }

    // ------------------------------------------------------------ 호감도 · 세계수 단서
    favorHearts(npc) { return Math.min(FAVOR_MAX, this.state.favor[npc] || 0); }
    favorMax() { return FAVOR_MAX; }

    _rewardMult(m) {
      return super._rewardMult(m) * (m.npc && m.npc !== 'board' ? 1 + FAVOR_REWARD * this.favorHearts(m.npc) : 1);
    }

    grantClue() {
      const s = this.state;
      if (s.clues.length >= CLUES.length) return null;
      const idx = s.clues.length;
      s.clues.push(idx);
      this.events.push({ type: 'clue', n: s.clues.length, text: CLUES[idx] });
      if (s.clues.length >= CLUES.length) this.events.push({ type: 'route' });
      return CLUES[idx];
    }

    clueInfo() {
      const s = this.state;
      return { have: s.clues.length, need: CLUES.length, texts: s.clues.map(function (i) { return CLUES[i]; }), route: s.clues.length >= CLUES.length,
        npcClues: s.townLv >= 4 };
    }

    // ------------------------------------------------------------ 의뢰 종류 확대 (모두 하루 안에 끝낼 수 있는 규모)
    _taskMission(npc) {
      const rng = this.rng;
      const id = 'm' + this.config.now().toString(36) + Math.floor(rng() * 1e6).toString(36);
      const pick = Math.floor(rng() * 6), r = function (a, b) { return a + Math.floor(rng() * (b - a + 1)); };
      let metric, n, name, reward;
      if (pick === 0) { metric = 'gathered'; n = r(12, 24); name = '재료 ' + n + '개 채집하기'; reward = n * 14; }
      else if (pick === 1) { metric = 'crafted'; n = r(2, 4); name = '물건 ' + n + '개 만들기'; reward = n * 90; }
      else if (pick === 2) { metric = 'brewed'; n = r(2, 4); name = '물약 조합 ' + n + '번 성공하기'; reward = n * 100; }
      else if (pick === 3) { metric = 'longDone'; n = r(1, 2); name = '장기 채집 ' + n + '회 마치기'; reward = n * 170; }
      else if (pick === 4) { metric = 'sold'; n = 200 + 100 * r(0, 3); name = '거래소에서 ' + n + ' G 어치 팔기'; reward = Math.round(n * 0.45); }
      else { metric = 'visited'; n = r(1, 2); name = '가 보지 않은 지역 ' + n + '곳 방문하기'; reward = n * 150; }
      return { id: id, npc: npc, type: 'task', metric: metric, n: n, name: name, reward: reward };
    }

    _makeMission(npc, special) {
      if (!special && this.rng() < 0.45) return this._taskMission(npc);
      return super._makeMission(npc, special);
    }

    missionText(m) {
      if (m.type === 'task') return (m.special ? '[특별] ' : '') + m.name;
      return super.missionText(m);
    }

    missionProgress(m) {
      if (m.type !== 'task') return super.missionProgress(m);
      const have = m.base ? Math.max(0, this._counter(m.metric) - (m.base[m.metric] || 0)) : 0;
      return { have: have, need: m.n };
    }

    _consumeOther(m) {
      if (m.type !== 'task') return null;
      const pg = this.missionProgress(m);
      return pg.have >= pg.need ? null : F('lack', '아직 조건을 채우지 못했다. (' + pg.have + '/' + pg.need + ')');
    }

    // 활동 의뢰는 받는 순간의 기록을 기준으로 진행도를 센다
    talk(npcId) {
      const r = super.talk(npcId);
      if (r.ok && r.mission && r.mission.type === 'task') r.mission.base = this._counterSnap();
      return r;
    }
    acceptQuest(slotId) {
      const r = super.acceptQuest(slotId);
      if (r.ok && r.mission && r.mission.type === 'task') r.mission.base = this._counterSnap();
      return r;
    }

    craftGood(id) {
      const r = super.craftGood(id);
      if (r.ok) this.state.counters.crafted += 1;
      return r;
    }
    brew(ids) {
      const r = super.brew(ids);
      if (r.ok) this.state.counters.brewed += 1;
      return r;
    }
    sell(kind, id, n) {
      const r = super.sell(kind, id, n);
      if (r.ok) this.state.counters.sold += r.total;
      return r;
    }

    deliver(id) {
      const s = this.state;
      const m = s.missions.find(function (x) { return x.id === id; });
      const r = super.deliver(id);
      if (!r.ok || !m) return r;
      if (m.npc && m.npc !== 'board') {
        const before = this.favorHearts(m.npc);
        s.favor[m.npc] = Math.min(FAVOR_MAX, (s.favor[m.npc] || 0) + 1);
        const after = this.favorHearts(m.npc);
        r.favor = { npc: m.npc, hearts: after };
        if (s.townLv >= 4 && after > before && CLUE_FAVOR_STEPS.indexOf(after) >= 0) {
          const t = this.grantClue();
          if (t) r.message += ' ' + this.npcOf(m.npc).name + '이(가) 목소리를 낮춰 단서를 알려 줬다: "' + t + '"';
        }
      } else if (m.board && this.rng() < CLUE_BOARD_CHANCE) {
        const t = this.grantClue();
        if (t) r.message += ' 게시판 뒤에서 낡은 쪽지를 찾았다: "' + t + '"';
      }
      return r;
    }

    // 마을 레벨 5: 전설 의뢰가 게시판에 붙는다
    boardEnsure() {
      const b = super.boardEnsure();
      if (this.state.townLv >= 5 && !b.slots.some(function (q) { return q.legend; })) {
        b.slots.push({ id: 'b' + b.date + '-L', npc: 'board', type: 'potion', minTier: 4, n: 1, name: '4등급 물약', legend: true, board: true, taken: false, reward: 2600 });
      }
      return b;
    }

    townUpgrade() {
      const r = super.townUpgrade();
      if (r.ok && this.state.townLv >= 5 && !this.state.lv5Gift) {
        this.state.lv5Gift = true;
        this.state.tickets += 2;
        r.message += ' 회관이 감사의 표시로 특수 티켓 2장을 건넸다.';
      }
      return r;
    }

    townLevels() {
      const lv = super.townLevels();
      lv[0].label = '기본 마을 · 창고 100칸 · 일반 재료 판매';
      return lv.map(function (x) { return Object.assign({}, x, { rent: RENT[x.lv], storage: STORAGE[x.lv] }); });
    }
  }

  A.GameClass = Game8;
  A.Game8 = Game8;
  A.CFG8 = { SHORT_DAILY: SHORT_DAILY, FATIGUE: FATIGUE, STORAGE: STORAGE, RENT: RENT, CLUES: CLUES.length };
})();
