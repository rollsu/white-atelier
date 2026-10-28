/*!
 * alchemy-ext3.js v6 — 지역 이동 시간 · 마법의 빗자루 · 신속 · 거점 복귀 · 마을 레벨(최소판)
 * Game4 를 상속한다. 이동 시간은 config.minuteMs(게임 1분이 실제 몇 ms인지)를 따른다.
 */
(function () {
  'use strict';
  const A = Alchemy;

  // 지도의 길 — 지역(대지역) 사이의 거리를 구하는 데 쓴다
  const LINKS = [
    ['moon_hill', 'golden_field'], ['golden_field', 'violet_orchard'], ['violet_orchard', 'shade_rest'], ['golden_field', 'wind_cliff'],
    ['wind_cliff', 'snow_ridge'], ['snow_ridge', 'first_peak'], ['first_peak', 'storm_hill'], ['storm_hill', 'ash_ruins'],
    ['ash_ruins', 'lava_shrine'], ['lava_shrine', 'burnt_forest'], ['burnt_forest', 'volcano_foot'], ['storm_hill', 'star_valley'],
    ['shade_rest', 'mist_lake'], ['mist_lake', 'star_valley'], ['star_valley', 'dawn_marsh'], ['dawn_marsh', 'sea_cave'],
    ['mist_lake', 'sea_cave'], ['volcano_foot', 'dawn_marsh'], ['violet_orchard', 'moss_cave'], ['moss_cave', 'rock_cave'],
    ['rock_cave', 'quartz_cave'], ['quartz_cave', 'ice_cave'], ['rock_cave', 'ice_cave'],
    ['camp', 'market'], ['camp', 'tool_street'], ['market', 'tool_street'], ['camp', 'golden_field'], ['camp', 'shade_rest'],
    ['market', 'storm_hill'], ['tool_street', 'star_valley'],
    ['town_hall', 'camp'], ['town_hall', 'market'],
    // 고요한 숲 (화산·물가와 이어진다)
    ['volcano_foot', 'dew_path'], ['dawn_marsh', 'firefly_glade'], ['dew_path', 'whisper_oak'], ['dew_path', 'mushroom_grove'],
    ['dew_path', 'firefly_glade'], ['mushroom_grove', 'firefly_glade'], ['mushroom_grove', 'heart_root'], ['firefly_glade', 'heart_root'],
  ];
  A.LINKS = LINKS;

  const SAME_REGION_MIN = 10;      // 같은 지역(거점 제외) 안의 이동
  const REGION_MIN = 30;           // 지역 경계를 하나 넘을 때마다
  const MIN_TRAVEL = 3;            // 이동 시간의 하한(분) — 어떤 보정으로도 더 줄일 수 없다
  const MAX_CUT = 0.75;            // 이동 시간 감소 합계의 상한
  const BROOM_CUT = 0.2;           // 마법의 빗자루: 이동 시간 -20%
  const BROOM_MANA = 12;           // 마법의 빗자루: 이동할 때마다 마나
  const HOME_CD_MIN = 60;          // 거점 복귀 재사용 시간(분)
  const HOME_MIN_TOWN_LV = 2;      // 거점 복귀가 열리는 마을 레벨
  const SWIFT_PER_LV = 0.015;      // 신속 레벨당 이동 시간 감소
  // 마을 레벨업 비용 (현재 레벨 → 다음 레벨). 금화와 납품 임무 수
  const TOWN_UP = [null, { gold: 2000, delivered: 5 }, { gold: 6000, delivered: 15 }, { gold: 15000, delivered: 30 }, { gold: 40000, delivered: 60 }];
  const TOWN_LABEL = ['', '', '거점으로 복귀(시간 소모 없음, 재사용 1시간)', '(준비 중)', '(준비 중)', '(준비 중)'];

  function F(code, message) { return { ok: false, code: code, message: message }; }

  class Game5 extends A.Game4 {
    migrate() {
      super.migrate();
      const s = this.state;
      if (this.config.minuteMs === undefined) this.config.minuteMs = 60000;
      if (s.townLv === undefined) s.townLv = 1;
      if (s.delivered === undefined) s.delivered = 0;
      if (!s.visited) { s.visited = { camp: true }; if (s.location) s.visited[s.location] = true; }
      if (s.currentTravel === undefined) s.currentTravel = null;
      if (s.homeReadyAt === undefined) s.homeReadyAt = 0;
      if (s.warpDate === undefined) s.warpDate = '';
      return this;
    }

    // ------------------------------------------------------------ 이동 시간
    _regionHops(a, b) {
      if (!this._radj) {
        const adj = {};
        LINKS.forEach(function (l) {
          const x = this.areas[l[0]].regionId, y = this.areas[l[1]].regionId;
          if (x === y) return;
          (adj[x] = adj[x] || {})[y] = true; (adj[y] = adj[y] || {})[x] = true;
        }, this);
        this._radj = adj;
      }
      const dist = {}; dist[a] = 0;
      const queue = [a];
      while (queue.length) {
        const cur = queue.shift();
        if (cur === b) return dist[cur];
        Object.keys(this._radj[cur] || {}).forEach(function (n) {
          if (dist[n] === undefined) { dist[n] = dist[cur] + 1; queue.push(n); }
        });
      }
      return 1;
    }

    // 보정 전 이동 시간(분): 거점 안 0, 같은 지역 10, 지역을 넘을 때마다 30
    travelBase(from, to) {
      const fa = this.areas[from], ta = this.areas[to];
      if (fa.regionId === 'center' && ta.regionId === 'center') return 0;
      if (fa.regionId === ta.regionId) return SAME_REGION_MIN;
      return REGION_MIN * this._regionHops(fa.regionId, ta.regionId);
    }

    swiftCut(visited) {
      return SWIFT_PER_LV * (this.abilLv('swift') - 1) + (this.has('swift', 5) ? 0.05 : 0) + (visited && this.has('swift', 10) ? 0.10 : 0);
    }

    travelPlan(from, to, wantBroom) {
      const base = this.travelBase(from, to);
      const owned = this.toolLv('broom') > 0;
      if (base === 0) return { base: 0, minutes: 0, instant: true, broomOwned: owned, broomMana: BROOM_MANA };
      const visited = !!this.state.visited[to];
      const broom = owned && wantBroom !== false && this.manaNow() >= BROOM_MANA;
      const cut = Math.min(MAX_CUT, this.swiftCut(visited) + (broom ? BROOM_CUT : 0));
      return { base: base, minutes: Math.max(MIN_TRAVEL, Math.round(base * (1 - cut))), cut: cut, broom: broom,
        broomOwned: owned, broomMana: BROOM_MANA, visited: visited, instant: false };
    }

    warpReady() { return this.has('swift', 20) && this.state.warpDate !== this.config.today(); }

    abilityEffect(k) {
      if (k !== 'swift') return super.abilityEffect(k);
      return '이동 시간 -' + Math.round(this.swiftCut(false) * 1000) / 10 + '% (최소 ' + MIN_TRAVEL + '분)';
    }

    // opts: { broom: false → 빗자루를 쓰지 않는다, warp: true → 순간 이동 }
    travel(id, opts) {
      opts = opts || {};
      this._rollDay(); this._regen();
      const s = this.state, to = this.areas[id];
      if (!to) return F('unknown_area', '알 수 없는 지역입니다.');
      if (s.phase === 'expedition') return F('busy', '장기 채집 중에는 이동할 수 없습니다.');
      if (s.phase === 'travel') return F('traveling', '이미 이동 중이다.');
      if (id === s.location) return F('same', '이미 이곳에 있다.');
      const arrive = function (self) {
        const r = A.Game.prototype.travel.call(self, id);
        s.visited[id] = true;
        return r;
      };
      if (opts.warp) {
        if (!this.warpReady()) return F('no_warp', '순간 이동은 하루에 한 번만 쓸 수 있다.');
        s.warpDate = this.config.today();
        const r = arrive(this);
        r.message = '발걸음이 바람처럼 가벼워졌다. ' + r.message;
        return r;
      }
      const plan = this.travelPlan(s.location, id, opts.broom);
      if (plan.instant) return arrive(this);
      if (plan.broom) s.mana -= BROOM_MANA;
      const now = this.config.now();
      s.phase = 'travel';
      s.currentTravel = { from: s.location, to: id, minutes: plan.minutes, broom: plan.broom, startedAt: now, endAt: now + plan.minutes * this.config.minuteMs };
      return { ok: true, timed: true, minutes: plan.minutes, broom: plan.broom, area: to.name,
        message: to.regionName + '의 ' + to.name + '으로 출발했다. 도착까지 ' + plan.minutes + '분' + (plan.broom ? ' (마법의 빗자루, 마나 ' + BROOM_MANA + ')' : '') + '.' };
    }

    travelLeftMs() {
      const ct = this.state.currentTravel;
      if (this.state.phase !== 'travel' || !ct) return 0;
      const left = ct.endAt - this.config.now();
      return Math.max(0, Math.min(left, ct.minutes * this.config.minuteMs));   // 시계를 되감아도 더 길어지지 않는다
    }

    completeTravel() {
      const s = this.state, ct = s.currentTravel;
      if (s.phase !== 'travel' || !ct) return F('not_traveling', '이동 중이 아니다.');
      if (this.travelLeftMs() > 0) return F('not_yet', '아직 도착하지 않았다.');
      s.phase = 'idle'; s.currentTravel = null;
      const r = A.Game.prototype.travel.call(this, ct.to);
      s.visited[ct.to] = true;
      this.gainAbility('swift', 1 + ct.minutes / 15);
      let loot = null;
      if (this.has('swift', 15)) {
        const src = this.areas[ct.to].herbs.length ? ct.to : (this.areas[ct.from].herbs.length ? ct.from : null);
        if (src) {
          const got = this._loot('short', src, Math.max(1, Math.floor(ct.minutes / 20)), this._rareMult());
          Object.keys(got).forEach(function (id) { s.herbs[id] = (s.herbs[id] || 0) + got[id]; });
          loot = this._summarize(got);
          this.markSeen();
        }
      }
      return { ok: true, area: ct.to, minutes: ct.minutes, loot: loot,
        message: r.message + (loot ? ' 길에서 ' + loot.map(function (h) { return h.name + ' ×' + h.amount; }).join(', ') + '을(를) 주웠다.' : '') };
    }

    cancelTravel() {
      const s = this.state;
      if (s.phase !== 'travel') return F('not_traveling', '이동 중이 아니다.');
      s.phase = 'idle'; s.currentTravel = null;
      return { ok: true, message: '이동을 그만두고 출발한 곳으로 돌아왔다. (마나는 돌려받지 못한다)' };
    }

    // ------------------------------------------------------------ 거점 복귀 · 마을 레벨
    homeLeftMs() { return Math.max(0, this.state.homeReadyAt - this.config.now()); }
    homeUnlocked() { return this.state.townLv >= HOME_MIN_TOWN_LV; }

    returnHome() {
      const s = this.state;
      if (!this.homeUnlocked()) return F('locked', '거점 복귀는 마을 레벨 ' + HOME_MIN_TOWN_LV + '부터 쓸 수 있다.');
      if (s.phase !== 'idle') return F('busy', '채집이나 이동 중에는 쓸 수 없다.');
      if (s.location === 'camp') return F('same', '이미 거점에 있다.');
      const left = this.homeLeftMs();
      if (left > 0) return F('cooldown', '아직 복귀할 수 없다. (' + Math.ceil(left / this.config.minuteMs) + '분 뒤)');
      const r = A.Game.prototype.travel.call(this, 'camp');
      s.visited.camp = true;
      s.homeReadyAt = this.config.now() + HOME_CD_MIN * this.config.minuteMs;
      return { ok: true, message: '거점으로 단숨에 돌아왔다. ' + r.message };
    }

    townInfo() {
      const s = this.state, lv = s.townLv, next = lv < 5 ? TOWN_UP[lv] : null;
      return { lv: lv, max: 5, next: next, nextLabel: lv < 5 ? TOWN_LABEL[lv + 1] : null, delivered: s.delivered,
        canUp: !!next && s.gold >= next.gold && s.delivered >= next.delivered };
    }

    townUpgrade() {
      const s = this.state, info = this.townInfo();
      if (s.location !== 'camp') return F('not_here', '거점에서만 마을을 키울 수 있다.');
      if (!info.next) return F('max', '마을은 이미 최고 단계다.');
      if (s.delivered < info.next.delivered) return F('lack', '납품 임무가 모자란다. (' + info.next.delivered + '건 필요, 지금 ' + s.delivered + '건)');
      if (s.gold < info.next.gold) return F('gold', '금화가 모자란다. (' + info.next.gold + ' G 필요)');
      s.gold -= info.next.gold;
      s.townLv += 1;
      return { ok: true, lv: s.townLv, message: '마을이 ' + s.townLv + '단계로 자랐다. ' + TOWN_LABEL[s.townLv] };
    }

    deliver(id) {
      const r = super.deliver(id);
      if (r.ok) this.state.delivered += 1;
      return r;
    }
  }

  // 이동 중에는 채집·제작·거래 같은 행동을 할 수 없다
  ['shortGather', 'startExpedition', 'brew', 'brewMany', 'craftGood', 'craftMany', 'usePotion', 'rest', 'sell', 'buy', 'buyTool',
    'talk', 'deliver', 'townUpgrade', 'returnHome'].forEach(function (name) {
    const orig = Game5.prototype[name];
    Game5.prototype[name] = function () {
      if (this.state.phase === 'travel') {
        return F('traveling', '이동 중에는 할 수 없다. (도착까지 ' + Math.ceil(this.travelLeftMs() / this.config.minuteMs) + '분)');
      }
      return orig.apply(this, arguments);
    };
  });

  A.GameClass = Game5;
  A.Game5 = Game5;
  A.TOWN = { UP: TOWN_UP, LABEL: TOWN_LABEL };
  A.TRAVEL = { SAME_REGION_MIN: SAME_REGION_MIN, REGION_MIN: REGION_MIN, MIN_TRAVEL: MIN_TRAVEL, BROOM_CUT: BROOM_CUT, BROOM_MANA: BROOM_MANA, HOME_CD_MIN: HOME_CD_MIN };
})();
