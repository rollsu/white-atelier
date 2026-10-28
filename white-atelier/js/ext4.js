/*!
 * alchemy-ext4.js v7 — 날씨 · 계절 (흐트러짐·연속 기록 대체)
 * Game5 를 상속한다. 날씨는 지역(대지역)마다 짧은 주기로, 계절은 현실의 달에 따라 바뀐다.
 * 같은 시각이면 언제나 같은 날씨가 나오므로(시드 기반) 예보를 보여 줄 수 있다.
 */
(function () {
  'use strict';
  const A = Alchemy;

  const WEATHER_MIN = 360;         // 날씨 한 번이 이어지는 시간(게임 분) = 6시간. 빠른 시간 모드에서는 그만큼 짧아진다(6분)
  const BAD_YIELD = 0.7;           // 나쁜 날씨에서 보호받지 못한 장기 채집의 보상 배율
  const BAD_LOSS = 0.35;           // 나쁜 날씨에서 보호받지 못한 단기 채집이 허탕일 확률
  const WEATHER_AFFINITY = 1.5;    // 날씨가 좋아하는 기운의 재료 출현 가중치
  const SEASON_AFFINITY = 1.3;     // 계절이 좋아하는 기운의 재료 출현 가중치
  const SEASON_DEMAND = 1.15;      // 계절 수요 기운 재료의 거래소 판매가 배율

  const SEASONS = [
    { id: 'spring', name: '봄', traits: ['회복', '활력'] },
    { id: 'summer', name: '여름', traits: ['활력', '집중'] },
    { id: 'autumn', name: '가을', traits: ['기억', '결속'] },
    { id: 'winter', name: '겨울', traits: ['정화', '평온'] },
  ];
  // yld: 장기 채집 보상 배율(좋은 날씨는 1 이상), bad: 나쁜 날씨, traits: 잘 나오는 재료의 기운
  const WEATHERS = {
    clear: { name: '맑음', yld: 1.1, bad: false, traits: ['활력'] },
    cloudy: { name: '흐림', yld: 1, bad: false, traits: [] },
    rain: { name: '비', yld: 1, bad: false, traits: ['정화', '회복'] },
    fog: { name: '안개', yld: 0.95, bad: false, traits: ['환영', '기억'] },
    storm: { name: '폭풍', yld: BAD_YIELD, bad: true, traits: ['활력', '집중'] },
    snow: { name: '눈보라', yld: BAD_YIELD, bad: true, traits: ['정화', '집중'] },
    heat: { name: '폭염', yld: BAD_YIELD, bad: true, traits: ['활력', '결속'] },
  };
  // 계절별 날씨 가중치 (순서: clear cloudy rain fog storm snow heat)
  const WIDS = ['clear', 'cloudy', 'rain', 'fog', 'storm', 'snow', 'heat'];
  const SEASON_W = [
    [3, 2, 3, 2, 1, 0, 0],   // 봄
    [4, 2, 2, 1, 2, 0, 2],   // 여름
    [3, 3, 2, 3, 1, 0, 0],   // 가을
    [2, 3, 0, 2, 0, 3, 0],   // 겨울
  ];
  // 지역별 보정 (없는 날씨는 1배)
  const REGION_MULT = {
    grassland: {},
    mountain: { storm: 1.5, snow: 2, heat: 0 },
    waters: { rain: 1.5, fog: 2, heat: 0 },
    volcano: { heat: 3, rain: 0.3, snow: 0 },
    caves: { clear: 0.3, cloudy: 2, fog: 1.5, rain: 0, storm: 0, snow: 0, heat: 0 },
    forest: { fog: 1.5, rain: 1.3, storm: 0.5, snow: 0.6, heat: 0 },
  };

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    // 마지막 숫자만 다른 입력(연속된 시간대)이 비슷한 값이 되지 않도록 비트를 한 번 더 섞는다
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function F(code, message) { return { ok: false, code: code, message: message }; }
  function intersects(a, b) { return a.some(function (x) { return b.indexOf(x) >= 0; }); }

  class Game6 extends A.Game5 {
    migrate() {
      super.migrate();
      const s = this.state;
      if (s.wxShift === undefined) s.wxShift = 0;            // 테스트용: 날씨를 한 칸씩 넘긴다
      if (s.seasonShift === undefined) s.seasonShift = 0;    // 테스트용: 계절을 한 칸씩 넘긴다
      s.streak = 0; s.distracted = 0; s.cleanProgress = 0;   // 흐트러짐·연속 기록은 더 이상 쓰지 않는다
      s.active.forEach(function (a) { if (a.type === 'streak_shield') a.type = 'weather_shield'; });
      s.active = s.active.filter(function (a) { return a.type !== 'cleanse'; });
      this._convertPotions();
      return this;
    }

    // 정화(흐트러짐 제거) → 날씨 피해 방지, 보호막(연속 기록 보호) → 날씨 보호막
    _convertPotions() {
      this.potionList.forEach(function (p) {
        let changed = false;
        p.effects = p.effects.map(function (e) {
          if (e.type === 'cleanse') {
            changed = true;
            const n = e.value >= 99 ? 10 : e.value * 2;
            return { type: 'weather_ward', value: e.value, duration: { unit: 'gather', amount: n }, description: '다음 채집 ' + n + '회 동안 나쁜 날씨의 피해를 받지 않는다.' };
          }
          if (e.type === 'streak_shield') {
            changed = true;
            return { type: 'weather_shield', value: e.value, duration: { unit: 'charge', amount: e.value }, description: '날씨 보호막 ' + e.value + '회. 나쁜 날씨의 피해를 ' + e.value + '번 막아 준다.' };
          }
          return e;
        });
        if (changed) p.description = p.effects.map(function (e) { return e.description; }).join(' ');
      });
    }

    // ------------------------------------------------------------ 계절
    seasonIndex() {
      const m = new Date(this.config.now()).getMonth();
      const base = m >= 2 && m <= 4 ? 0 : m >= 5 && m <= 7 ? 1 : m >= 8 && m <= 10 ? 2 : 3;
      return (base + (this.state.seasonShift || 0)) % 4;
    }

    seasonInfo() {
      const idx = this.seasonIndex(), sn = SEASONS[idx];
      let daysLeft = null;
      if (!this.state.seasonShift) {
        const d = new Date(this.config.now()), m = d.getMonth();
        const nextM = m < 2 ? 2 : m < 5 ? 5 : m < 8 ? 8 : m < 11 ? 11 : 2;
        const next = new Date(d.getFullYear() + (m >= 11 ? 1 : 0), nextM, 1);
        daysLeft = Math.max(1, Math.ceil((next - d) / 86400000));
      }
      return { id: sn.id, name: sn.name, traits: sn.traits, daysLeft: daysLeft };
    }

    // ------------------------------------------------------------ 날씨
    _slotMs() { return WEATHER_MIN * this.config.minuteMs; }

    _regionWeather(regionId, offset) {
      if (!REGION_MULT[regionId]) return null;
      const now = this.config.now(), ms = this._slotMs();
      const base = Math.floor(now / ms);
      const slot = base + (this.state.wxShift || 0) + (offset || 0);
      const season = this.seasonIndex();
      const mult = REGION_MULT[regionId];
      const weights = WIDS.map(function (id, i) {
        const k = mult[id] === undefined ? 1 : mult[id];
        return SEASON_W[season][i] * k;
      });
      const sum = weights.reduce(function (a, b) { return a + b; }, 0);
      let x = hash(regionId + '|' + slot) * sum, id = WIDS[0];
      for (let i = 0; i < WIDS.length; i++) { x -= weights[i]; if (x < 0) { id = WIDS[i]; break; } }
      const def = WEATHERS[id];
      return { id: id, name: id === 'heat' && regionId === 'volcano' ? '화산재' : def.name, bad: def.bad, yld: def.yld, traits: def.traits,
        regionId: regionId, startsInMs: Math.max(0, (base + 1 + (offset || 0)) * ms - now), offset: offset || 0 };
    }

    weatherAt(areaId, offset) {
      const a = this.areas[areaId];
      return a ? this._regionWeather(a.regionId, offset) : null;
    }

    // 지역별 지금 날씨와 다음 날씨
    forecast() {
      return this.regionList.filter(function (r) { return REGION_MULT[r.id]; }).map(function (r) {
        return { id: r.id, name: r.name, now: this._regionWeather(r.id, 0), next: this._regionWeather(r.id, 1) };
      }, this);
    }

    seasonTraits() { return SEASONS[this.seasonIndex()].traits; }

    _herbMult(id, areaId) {
      const w = this._forcedWx || this.weatherAt(areaId);
      const traits = this.herbs[id].traits;
      let m = 1;
      if (w && w.traits.length && intersects(w.traits, traits)) m *= WEATHER_AFFINITY;
      if (intersects(this.seasonTraits(), traits)) m *= SEASON_AFFINITY;
      return m;
    }

    // 좋은 날씨는 단기 채집에서 재료를 하나 더 얻을 확률을 조금 올린다
    _extraChance() {
      const a = this.currentArea(), w = a && !a.noGather ? this.weatherAt(a.id) : null;
      return super._extraChance() + (w && w.yld > 1 ? w.yld - 1 : 0);
    }

    // ------------------------------------------------------------ 보호
    _consumeShield() {
      const sh = this._active('weather_shield');
      if (!sh) return false;
      sh.remaining -= 1;
      if (sh.remaining <= 0) this.state.active = this.state.active.filter(function (a) { return a !== sh; });
      return true;
    }

    // ------------------------------------------------------------ 단기 채집
    shortGather() {
      const a = this.currentArea(), w = a && !a.noGather ? this.weatherAt(a.id) : null;
      const hadWard = !!this._active('weather_ward');
      const r = super.shortGather();
      if (!r.ok || !w) return r;
      r.weather = { name: w.name, bad: w.bad };
      if (!w.bad) return r;
      if (hadWard) { r.weather.by = 'ward'; return r; }
      if (this._consumeShield()) { r.weather.by = 'shield'; return r; }
      if (!this.ignoresWeather() && this.rng() < BAD_LOSS) {
        this.state.herbs[r.herbId] -= r.amount;
        if (this.state.herbs[r.herbId] <= 0) delete this.state.herbs[r.herbId];
        r.lost = true;
      }
      return r;
    }

    // ------------------------------------------------------------ 장기 채집
    startExpedition(m) {
      const r = super.startExpedition(m);
      if (!r.ok) return r;
      const ex = this.state.currentExpedition, w = this.weatherAt(ex.area);
      let by = null;
      if (w && w.bad) {
        if (this._active('weather_ward')) by = 'ward';
        else if (this._consumeShield()) by = 'shield';
      }
      ex.wx = w ? { id: w.id, name: w.name, bad: w.bad, yld: w.yld, traits: w.traits, by: by } : null;
      r.weather = ex.wx;
      return r;
    }

    _penaltyPct() {
      const w = this._wxEx;
      if (!w) return 100;
      let pct = w.bad ? (w.by ? 100 : Math.round(BAD_YIELD * 100)) : Math.round(w.yld * 100);
      if (this.has('acu', 20) && pct < 100) pct += Math.round((100 - pct) * 0.1);
      return pct;
    }

    completeExpedition() {
      const ex = this.state.currentExpedition;
      this._wxEx = ex && ex.wx ? ex.wx : null;
      this._forcedWx = this._wxEx;
      let r;
      try { r = super.completeExpedition(); } finally { this._forcedWx = null; this._wxEx = null; }
      if (r.ok) {
        const s = this.state;
        s.streak = 0; s.distracted = 0; s.cleanProgress = 0;
        r.weather = ex && ex.wx ? ex.wx : null;
      }
      return r;
    }

    // 포기하면 그 채집의 보상만 받지 못한다. 벌점은 없다
    abandonExpedition() {
      const s = this.state;
      if (s.phase !== 'expedition') return F('not_expedition', '진행 중인 장기 채집이 없습니다.');
      s.phase = 'idle'; s.currentExpedition = null;
      return { ok: true, abandoned: true, message: '채집을 포기했다. 이번 채집의 보상은 받을 수 없다.' };
    }

    rest() {
      this._rollDay(); this._regen();
      const s = this.state, t = this.config.today();
      if (s.location !== 'camp') return F('not_here', '거점에서만 쉴 수 있다.');
      if (s.phase !== 'idle') return F('busy', '채집이나 이동 중에는 쉴 수 없다.');
      if (s.restDate === t) return F('rested', '오늘은 이미 푹 쉬었다. 내일 다시 쉬자.');
      s.restDate = t;
      s.mana = this.manaMax();
      return { ok: true, message: '따뜻한 차를 마시며 푹 쉬었다. 마나가 가득 찼다.' };
    }

    // 계절 수요: 그 계절이 좋아하는 기운의 재료는 거래소에서 조금 더 비싸다
    _unitPrice(kind, id, soldN) {
      const p = super._unitPrice(kind, id, soldN);
      return kind === 'item' && intersects(this.seasonTraits(), this.herbs[id].traits) ? Math.round(p * SEASON_DEMAND) : p;
    }

    debugNextWeather() { this.state.wxShift += 1; }
    debugNextSeason() { this.state.seasonShift = ((this.state.seasonShift || 0) + 1) % 4; }
  }

  A.GameClass = Game6;
  A.Game6 = Game6;
  A.WEATHERS = WEATHERS;
  A.SEASONS = SEASONS;
  A.WEATHER_CFG = { WEATHER_MIN: WEATHER_MIN, BAD_YIELD: BAD_YIELD, BAD_LOSS: BAD_LOSS };
})();
