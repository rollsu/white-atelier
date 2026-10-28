/*!
 * alchemy.js v2 — 약초 연금술 게임 엔진
 * 브라우저(<script src>)와 Node(require) 양쪽에서 동작한다.
 *
 *   const game = new Alchemy.Game({ herbs, potions, regions });
 *   game.shortGather();                  // 단기 채집 (대기 30초)
 *   game.startExpedition(60);            // 장기 채집 (30·60·120·180분)
 *   game.completeExpedition();           // 타이머가 끝나면 호출
 *   game.brew(['somdallae', 'danjamyeolmae']);
 *
 * 모든 메서드는 { ok, code, message, ... } 형태의 결과를 반환한다.
 * game.state 는 순수 JSON 이므로 localStorage 등에 그대로 저장할 수 있다.
 * 타이머(남은 시간 표시)는 UI 의 몫이고, 엔진은 시작·완료·포기만 처리한다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Alchemy = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];   // 일반 · 고급 · 희귀 · 영웅 · 전설
  const ORDINARY = ['common', 'uncommon', 'rare', 'epic'];   // 일반 뽑기에 나오는 등급

  const DEFAULTS = {
    // ---- 채집 ---------------------------------------------------------------
    // 등급별 출현 가중치. 소지역에 없는 등급은 빠지고 남은 등급끼리 비율로 환산한다.
    // 전설 약초는 이 표에 없다. 장기 채집 완료 시 legendaryChance 로만 얻는다.
    odds: {
      short: { common: 75, uncommon: 20, rare: 5,  epic: 1 },
      30:    { common: 55, uncommon: 35, rare: 10, epic: 2 },
      60:    { common: 30, uncommon: 45, rare: 25, epic: 5 },
      120:   { common: 10, uncommon: 40, rare: 50, epic: 12 },
      180:   { common: 0,  uncommon: 25, rare: 75, epic: 18 },
    },
    expeditionMinutes: [30, 60, 120, 180],
    expeditionRolls: { 30: 3, 60: 7, 120: 15, 180: 24 },      // 완료 시 약초를 뽑는 횟수
    expeditionXpBonus: { 30: 1, 60: 1.1, 120: 1.2, 180: 1.3 }, // 오래 할수록 분당 경험치 보너스
    xpPerMinute: 1,
    legendaryChance: 0.01,       // 장기 채집 1회 완료마다 전설 약초 보너스 확률 (어느 지역에서든 같다)
    shortCooldownSec: 30,
    minCooldownSec: 5,
    signatureBonus: 2,           // 소지역 대표 약초는 같은 등급 안에서 가중치 ×2
    rareChanceScale: 10,         // rare_chance 값 v → 희귀·전설 가중치 ×(1 + v/10)

    // ---- 연금술사 레벨 · 조합 확률 ----------------------------------------------
    maxLevel: 30,
    xpToNext: function (level) { return 40 + 20 * (level - 1); },
    baseBrewChance: 50,          // 1레벨, 1등급 물약의 성공 확률(%)
    brewChancePerLevel: 2.5,     // 레벨당 +%p
    brewTierPenalty: 8,          // 등급이 1 오를 때마다 -%p
    minBrewChance: 5,
    maxBrewChance: 98,
    brewXpSuccess: 3,            // 성공 시 등급 × 이 값
    brewXpFail: 1,

    // ---- 집중 방해 규칙 ---------------------------------------------------------
    maxDistracted: 3,            // '흐트러짐' 최대 층수
    distractedPenalty: 0.1,      // 층당 장기 채집 보상 감소율
    distractedDecayEvery: 3,     // 장기 채집 N회 완료마다 흐트러짐 1층 자연 회복
    dailyCreditCap: 2,           // session_credit 물약의 하루 사용 한도
    creditMinutes: 30,           // session_credit 1회분 = 30분 장기 채집
    now: function () { return Date.now(); },
    today: function () {
      const d = new Date();
      const p = function (n) { return String(n).padStart(2, '0'); };
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    },
  };

  function fail(code, message, extra) {
    return Object.assign({ ok: false, code: code, message: message }, extra || {});
  }

  function unwrap(data, key) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data[key])) return data[key];
    throw new Error(key + ' 데이터가 올바르지 않습니다.');
  }

  function recipeKey(ids) { return ids.slice().sort().join('+'); }

  function createState(today) {
    return {
      v: 2,
      date: today,
      phase: 'idle',               // idle | expedition
      location: null,              // 현재 소지역 id
      herbs: {},                   // { herbId: 개수 }
      potions: {},                 // { potionId: 개수 }
      discovered: {},              // { recipeKey: true }
      active: [],                  // 지속 효과 [{ type, value, unit, remaining }]
      level: 1,
      xp: 0,                       // 현재 레벨 안에서 쌓은 경험치
      totalXp: 0,
      streak: 0,                   // 연속으로 완료한 장기 채집 횟수
      bestStreak: 0,
      distracted: 0,               // '흐트러짐' 층수
      cleanProgress: 0,
      expeditionsToday: 0,
      shortToday: 0,
      creditsToday: 0,
      shortReadyAt: 0,             // 다음 단기 채집이 가능해지는 시각(ms)
      currentExpedition: null,     // { minutes, area, startedAt }
    };
  }

  class Game {
    constructor(opts) {
      opts = opts || {};
      this.config = Object.assign({}, DEFAULTS, opts.config || {});
      this.rng = opts.rng || Math.random;

      this.herbList = unwrap(opts.herbs, 'herbs');
      this.potionList = unwrap(opts.potions, 'potions');
      this.regionList = unwrap(opts.regions, 'regions');
      this.herbs = {};
      this.potions = {};
      this.recipes = {};
      this.herbList.forEach(function (h) { this.herbs[h.id] = h; }, this);
      this.potionList.forEach(function (p) {
        this.potions[p.id] = p;
        this.recipes[p.recipeKey] = p;
      }, this);

      this.areas = {};
      this.areaOrder = [];
      this.regionList.forEach(function (r) {
        r.areas.forEach(function (a) {
          this.areas[a.id] = Object.assign({}, a, { regionId: r.id, regionName: r.name });
          this.areaOrder.push(a.id);
        }, this);
      }, this);
      this.legendaryHerbs = this.herbList.filter(function (h) { return h.rarity === 'legendary'; });

      this.state = opts.state || createState(this.config.today());
      this._ensureLocation();
    }

    // ------------------------------------------------------------ 공통 도우미
    _ensureLocation() {
      if (!this.state.location || !this.areas[this.state.location]) {
        this.state.location = this.areaOrder[0];
      }
    }

    _rollDay() {
      const t = this.config.today();
      if (this.state.date !== t) {
        this.state.date = t;
        this.state.expeditionsToday = 0;
        this.state.shortToday = 0;
        this.state.creditsToday = 0;
      }
    }

    _active(type) {
      return this.state.active.find(function (a) { return a.type === type; }) || null;
    }

    _tick(unit) {
      const expired = [];
      this.state.active.forEach(function (a) {
        if (a.unit === unit) {
          a.remaining -= 1;
          if (a.remaining <= 0) expired.push(a.type);
        }
      });
      this.state.active = this.state.active.filter(function (a) { return a.remaining > 0; });
      return expired;
    }

    _penaltyPct() {
      return 100 - Math.round(this.state.distracted * this.config.distractedPenalty * 100);
    }

    _rareMult() {
      const rc = this._active('rare_chance');
      return rc ? 1 + rc.value / this.config.rareChanceScale : 1;
    }

    // ------------------------------------------------------------ 약초 인벤토리
    addHerb(id, n) {
      if (!this.herbs[id]) return fail('unknown_herb', '알 수 없는 약초입니다.');
      this.state.herbs[id] = (this.state.herbs[id] || 0) + (n === undefined ? 1 : n);
      return { ok: true, herbId: id, count: this.state.herbs[id] };
    }
    herbCount(id) { return this.state.herbs[id] || 0; }
    potionCount(id) { return this.state.potions[id] || 0; }

    // ------------------------------------------------------------ 레벨
    levelInfo() {
      const s = this.state;
      const capped = s.level >= this.config.maxLevel;
      return {
        level: s.level, xp: s.xp, max: capped,
        need: capped ? 0 : this.config.xpToNext(s.level),
        baseChance: this._levelChance(s.level),
      };
    }

    _levelChance(level) {
      return this.config.baseBrewChance + this.config.brewChancePerLevel * (level - 1);
    }

    addXp(n) {
      const s = this.state, c = this.config;
      s.totalXp += n;
      let gained = 0;
      if (s.level >= c.maxLevel) return 0;
      s.xp += n;
      while (s.level < c.maxLevel && s.xp >= c.xpToNext(s.level)) {
        s.xp -= c.xpToNext(s.level);
        s.level += 1;
        gained += 1;
      }
      if (s.level >= c.maxLevel) s.xp = 0;
      return gained;
    }

    // ------------------------------------------------------------ 채집 확률
    // 소지역에 실제로 있는 등급만 남겨 비율을 다시 계산한다. kind: 'short' | 30 | 60 | 120 | 180
    // 전설 약초는 이 표에 들어가지 않는다. 장기 채집 완료 시 1% 보너스로만 얻는다.
    _rarityWeights(kind, areaId, mult) {
      const area = this.areas[areaId];
      const present = {};
      area.herbs.forEach(function (id) { present[this.herbs[id].rarity] = true; }, this);
      const table = this.config.odds[kind];
      const w = {};
      let total = 0;
      ORDINARY.forEach(function (r) {
        if (!present[r]) return;
        let x = table[r] || 0;
        if (r === 'rare' || r === 'epic') x *= mult;
        w[r] = x; total += x;
      });
      if (total <= 0) {   // 이 시간대 표에 해당하는 등급이 지역에 없으면 있는 등급끼리 똑같이 나눈다
        total = 0;
        ORDINARY.forEach(function (r) { if (present[r]) { w[r] = 1; total += 1; } });
      }
      return { w: w, total: total };
    }

    // 화면 표시용 확률(%). 물약 효과는 반영하지 않은 기본값이다.
    gatherOdds(kind, areaId) {
      areaId = areaId || this.state.location;
      const r = this._rarityWeights(kind, areaId, 1);
      const out = {};
      ORDINARY.forEach(function (k) {
        if (r.w[k] !== undefined) out[k] = Math.round(r.w[k] / r.total * 1000) / 10;
      });
      return out;
    }

    _pickHerb(kind, areaId, mult) {
      const area = this.areas[areaId];
      const r = this._rarityWeights(kind, areaId, mult);
      let x = this.rng() * r.total, rarity = null;
      const keys = Object.keys(r.w);
      for (let i = 0; i < keys.length; i++) {
        x -= r.w[keys[i]];
        if (x < 0 || i === keys.length - 1) { rarity = keys[i]; break; }
      }
      const pool = area.herbs.filter(function (id) { return this.herbs[id].rarity === rarity; }, this);
      const weights = pool.map(function (id) {
        return id === area.signature ? this.config.signatureBonus : 1;
      }, this);
      let t = this.rng() * weights.reduce(function (a, b) { return a + b; }, 0);
      for (let i = 0; i < pool.length; i++) {
        t -= weights[i];
        if (t < 0) return pool[i];
      }
      return pool[pool.length - 1];
    }

    // ------------------------------------------------------------ 단기 채집
    shortCooldownLeft() {
      return Math.max(0, this.state.shortReadyAt - this.config.now());
    }

    shortGather() {
      this._rollDay();
      const s = this.state;
      if (s.phase !== 'idle') return fail('busy', '장기 채집 중에는 단기 채집을 할 수 없습니다.');
      const left = this.shortCooldownLeft();
      if (left > 0) {
        return fail('cooldown', '아직 숨을 고르는 중이다. ' + Math.ceil(left / 1000) + '초 뒤에 다시 채집할 수 있다.',
          { leftMs: left });
      }
      const herbId = this._pickHerb('short', s.location, this._rareMult());
      const hb = this._active('herb_bonus');
      const amount = 1 + (hb ? hb.value : 0);
      s.herbs[herbId] = (s.herbs[herbId] || 0) + amount;

      const cut = this._active('cooldown_cut');
      const cd = Math.max(this.config.minCooldownSec, this.config.shortCooldownSec - (cut ? cut.value : 0));
      s.shortReadyAt = this.config.now() + cd * 1000;
      s.shortToday += 1;
      this._tick('short');
      this._tick('gather');
      return { ok: true, herbId: herbId, name: this.herbs[herbId].name, amount: amount, cooldownSec: cd };
    }

    // ------------------------------------------------------------ 장기 채집
    startExpedition(minutes) {
      this._rollDay();
      const s = this.state;
      if (this.config.expeditionMinutes.indexOf(minutes) === -1) {
        return fail('bad_duration', '장기 채집은 ' + this.config.expeditionMinutes.join('·') + '분 중에서 고를 수 있습니다.');
      }
      if (s.phase !== 'idle') return fail('busy', '이미 장기 채집 중입니다.');
      s.phase = 'expedition';
      s.currentExpedition = { minutes: minutes, area: s.location, startedAt: this.config.now() };
      return { ok: true, minutes: minutes, area: this.areas[s.location].name };
    }

    // 장기 채집 보상: 약초 뽑기 + (선택) 전설 보너스. 시간이 길수록 높은 등급 비율이 커진다.
    _loot(minutes, areaId, rolls, mult) {
      const got = {};
      for (let i = 0; i < rolls; i++) {
        const id = this._pickHerb(minutes, areaId, mult);
        got[id] = (got[id] || 0) + 1;
      }
      return got;
    }

    _summarize(got) {
      return Object.keys(got).map(function (id) {
        return { id: id, name: this.herbs[id].name, rarity: this.herbs[id].rarity, amount: got[id] };
      }, this).sort(function (a, b) { return RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity); });
    }

    completeExpedition() {
      this._rollDay();
      const s = this.state, c = this.config;
      if (s.phase !== 'expedition' || !s.currentExpedition) {
        return fail('not_expedition', '진행 중인 장기 채집이 없습니다.');
      }
      const ex = s.currentExpedition;
      const penalty = this._penaltyPct();
      const xpB = this._active('xp_boost');
      const yB = this._active('yield_boost');

      const baseXp = ex.minutes * c.xpPerMinute * c.expeditionXpBonus[ex.minutes];
      const xp = Math.round(baseXp * (100 + (xpB ? xpB.value : 0)) * penalty / 10000);
      const rolls = Math.max(1, Math.round(c.expeditionRolls[ex.minutes] * (100 + (yB ? yB.value : 0)) * penalty / 10000));

      const got = this._loot(ex.minutes, ex.area, rolls, this._rareMult());
      let legendary = null;
      if (this.legendaryHerbs.length && this.rng() < c.legendaryChance) {
        // 그 지역에 전설 약초가 자라면 그것을, 아니면 임의의 전설 약초를 준다
        const own = this.areas[ex.area].herbs.find(function (id) { return this.herbs[id].rarity === 'legendary'; }, this);
        legendary = own || this.legendaryHerbs[Math.floor(this.rng() * this.legendaryHerbs.length)].id;
        got[legendary] = (got[legendary] || 0) + 1;
      }
      Object.keys(got).forEach(function (id) { s.herbs[id] = (s.herbs[id] || 0) + got[id]; });

      const levelsGained = this.addXp(xp);
      s.streak += 1;
      s.bestStreak = Math.max(s.bestStreak, s.streak);
      s.expeditionsToday += 1;
      if (s.distracted > 0) {
        s.cleanProgress += 1;
        if (s.cleanProgress >= c.distractedDecayEvery) { s.distracted -= 1; s.cleanProgress = 0; }
      }
      const expired = this._tick('expedition').concat(this._tick('gather'));
      s.phase = 'idle';
      s.currentExpedition = null;

      const herbs = this._summarize(got);
      return {
        ok: true, minutes: ex.minutes, area: ex.area, xp: xp, rolls: rolls, herbs: herbs,
        legendary: legendary, levelsGained: levelsGained, level: s.level,
        streak: s.streak, distracted: s.distracted, expired: expired,
        message: ex.minutes + '분 채집을 마쳤다. 약초 ' + herbs.reduce(function (a, h) { return a + h.amount; }, 0) +
          '개, 경험치 +' + xp + (legendary ? ' 전설의 기운이 닿았다!' : ''),
      };
    }

    abandonExpedition() {
      const s = this.state;
      if (s.phase !== 'expedition') return fail('not_expedition', '진행 중인 장기 채집이 없습니다.');
      const shield = this._active('streak_shield');
      let shielded = false;
      if (shield) {
        shield.remaining -= 1;
        if (shield.remaining <= 0) s.active = s.active.filter(function (a) { return a !== shield; });
        shielded = true;
      } else {
        s.streak = 0;
        s.distracted = Math.min(this.config.maxDistracted, s.distracted + 1);
        s.cleanProgress = 0;
      }
      s.phase = 'idle';
      s.currentExpedition = null;
      return {
        ok: true, abandoned: true, protectedByShield: shielded, streak: s.streak, distracted: s.distracted,
        message: shielded
          ? '보호막이 깨졌지만 연속 기록은 무사하다.'
          : '채집을 포기했다. 연속 기록이 끊기고 흐트러짐이 쌓였다.',
      };
    }

    // ------------------------------------------------------------ 지도 · 이동
    currentArea() { return this.areas[this.state.location]; }

    areaHerbs(areaId) {
      const area = this.areas[areaId];
      if (!area) return [];
      return area.herbs.map(function (id) {
        const h = this.herbs[id];
        return { id: id, name: h.name, rarity: h.rarity, signature: area.signature === id };
      }, this);
    }

    mapOverview() {
      return this.regionList.map(function (r) {
        return {
          id: r.id, name: r.name, theme: r.theme, description: r.description,
          areas: r.areas.map(function (a) {
            return { id: a.id, name: a.name, type: a.type, here: a.id === this.state.location };
          }, this),
        };
      }, this);
    }

    travel(areaId) {
      const area = this.areas[areaId];
      if (!area) return fail('unknown_area', '알 수 없는 지역입니다.');
      if (this.state.phase === 'expedition') return fail('busy', '장기 채집 중에는 이동할 수 없습니다.');
      this.state.location = areaId;
      return {
        ok: true, area: { id: area.id, name: area.name, type: area.type, region: area.regionName },
        herbs: this.areaHerbs(areaId),
        message: area.regionName + '의 ' + area.name + '에 도착했다. ' + area.description,
      };
    }

    // ------------------------------------------------------------ 조합(제조)
    // 도감에 등록된 조합만 확률을 알려 준다. 처음 시도하는 조합은 null.
    brewChance(ids) {
      const recipe = this.recipes[recipeKey(ids)];
      if (!recipe || !this.state.discovered[recipe.recipeKey]) return null;
      return this._chanceFor(recipe);
    }

    _chanceFor(recipe) {
      const c = this.config;
      const bc = this._active('brew_chance');
      const raw = this._levelChance(this.state.level) - c.brewTierPenalty * (recipe.tier - 1) + (bc ? bc.value : 0);
      return Math.max(c.minBrewChance, Math.min(c.maxBrewChance, Math.round(raw * 10) / 10));
    }

    brew(ids) {
      this._rollDay();
      const s = this.state;
      if (s.phase !== 'idle') return fail('busy', '장기 채집 중에는 연금술을 할 수 없습니다.');
      if (!Array.isArray(ids) || ids.length < 2 || ids.length > 3) {
        return fail('bad_count', '약초는 2~3가지를 섞어야 합니다.');
      }
      if (new Set(ids).size !== ids.length) return fail('duplicate', '같은 약초는 한 번만 넣을 수 있습니다.');
      for (let i = 0; i < ids.length; i++) {
        if (!this.herbs[ids[i]]) return fail('unknown_herb', '알 수 없는 약초입니다.');
        if (this.herbCount(ids[i]) < 1) return fail('missing_herb', this.herbs[ids[i]].name + '이(가) 부족합니다.');
      }

      const recipe = this.recipes[recipeKey(ids)] || null;
      const chance = recipe ? this._chanceFor(recipe) : 0;   // 효과가 소모되기 전에 계산
      ids.forEach(function (id) { s.herbs[id] -= 1; });

      let refunded = null;
      const rf = this._active('brew_refund');
      if (rf && this.rng() * 100 < rf.value) {
        refunded = ids[Math.floor(this.rng() * ids.length)];
        s.herbs[refunded] += 1;
      }
      this._tick('brew');

      if (!recipe) {
        const counts = {};
        ids.forEach(function (id) {
          this.herbs[id].traits.forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
        }, this);
        const top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 2);
        return {
          ok: false, code: 'unstable', hint: top, refunded: refunded,
          message: '기운이 어우러지지 못하고 흩어졌다. 그래도 ' + top.join('·') + '의 기운은 느껴졌다.',
        };
      }

      if (this.rng() * 100 >= chance) {
        const lv = this.addXp(this.config.brewXpFail);
        return {
          ok: false, code: 'fizzle', chance: chance, refunded: refunded, levelsGained: lv,
          message: '거의 될 뻔했다! 기운이 어우러지는 조합이다. 솥이 끓어 넘쳐 재료를 잃었다.',
        };
      }

      s.potions[recipe.id] = (s.potions[recipe.id] || 0) + 1;
      const isNew = !s.discovered[recipe.recipeKey];
      s.discovered[recipe.recipeKey] = true;
      const lv = this.addXp(this.config.brewXpSuccess * recipe.tier);
      return {
        ok: true, potionId: recipe.id, name: recipe.name, tier: recipe.tier, chance: chance,
        newDiscovery: isNew, refunded: refunded, levelsGained: lv,
        message: (isNew ? '새로운 조합을 발견했다! ' : '') + recipe.name + '을(를) 완성했다.',
      };
    }

    recipeBook() {
      return this.potionList.map(function (p) {
        if (this.state.discovered[p.recipeKey]) {
          return {
            id: p.id, discovered: true, name: p.name, tier: p.tier,
            ingredients: p.ingredients.map(function (i) { return this.herbs[i].name; }, this),
            ingredientIds: p.ingredients, description: p.description,
            chance: this._chanceFor(p),
          };
        }
        return { id: p.id, discovered: false, name: '???', tier: p.tier, hint: p.hint };
      }, this);
    }

    // ------------------------------------------------------------ 물약 사용
    usePotion(potionId) {
      this._rollDay();
      const potion = this.potions[potionId];
      if (!potion) return fail('unknown_potion', '알 수 없는 물약입니다.');
      if (this.state.phase === 'expedition') {
        return fail('busy', '장기 채집 중에는 물약을 마실 수 없습니다.');
      }
      if (this.potionCount(potionId) < 1) return fail('no_potion', '그 물약이 없습니다.');

      const credit = potion.effects.find(function (e) { return e.type === 'session_credit'; });
      if (credit && this.state.creditsToday >= this.config.dailyCreditCap) {
        return fail('daily_cap', '시간 조각은 하루에 ' + this.config.dailyCreditCap + '번까지만 쓸 수 있습니다.');
      }

      this.state.potions[potionId] -= 1;
      if (this.state.potions[potionId] === 0) delete this.state.potions[potionId];
      const applied = potion.effects.map(function (e) { return this._applyEffect(e); }, this);
      return { ok: true, potionId: potionId, name: potion.name, applied: applied };
    }

    _applyEffect(e) {
      const s = this.state;
      if (e.type === 'cleanse') {
        const before = s.distracted;
        s.distracted = Math.max(0, s.distracted - e.value);
        return { type: e.type, removed: before - s.distracted };
      }
      if (e.type === 'session_credit') {
        const minutes = this.config.creditMinutes;
        const got = this._loot(minutes, s.location, this.config.expeditionRolls[minutes] * e.value, this._rareMult());
        Object.keys(got).forEach(function (id) { s.herbs[id] = (s.herbs[id] || 0) + got[id]; });
        const xp = Math.round(minutes * this.config.xpPerMinute * e.value);
        const levelsGained = this.addXp(xp);
        s.creditsToday += 1;
        return { type: e.type, xp: xp, herbs: this._summarize(got), levelsGained: levelsGained };
      }
      const amount = e.duration.unit === 'charge' ? e.value : e.duration.amount;
      const cur = this._active(e.type);
      if (cur) {
        cur.value = Math.max(cur.value, e.value);
        cur.remaining += amount;
      } else {
        s.active.push({ type: e.type, value: e.value, unit: e.duration.unit, remaining: amount });
      }
      return { type: e.type, value: e.value, remaining: this._active(e.type).remaining };
    }

    activeEffects() {
      return this.state.active.map(function (a) { return Object.assign({}, a); });
    }

    // ------------------------------------------------------------ 저장 / 불러오기
    save() { return JSON.stringify(this.state); }
    load(json) {
      const st = typeof json === 'string' ? JSON.parse(json) : json;
      if (!st || st.v !== 2) throw new Error('저장 형식이 맞지 않습니다.');
      this.state = st;
      this._ensureLocation();
      return this;
    }
  }

  return { Game: Game, createState: createState, recipeKey: recipeKey, DEFAULTS: DEFAULTS, RARITIES: RARITIES };
});
