/*!
 * alchemy-ext2.js v5 — 마나 · 능력 5종(지성·예리·재주·매력·신속) · 특수 스킬 · 마을 사람 임무
 * Game3 를 상속한다. 수치는 모두 이 파일 위쪽 상수에 모아 두었다.
 */
(function () {
  'use strict';
  const A = Alchemy;

  const KEYS = ['int', 'acu', 'craft', 'charm', 'swift'];
  const MAX_LV = 20;                                   // 능력 레벨 상한
  const MAX_ALCHEMIST_LV = 100;                        // 연금술사 레벨 상한 (레벨당 기능치 1점)
  const MANA_BASE = 100, MANA_AT_MAX = 300;           // 지성 1레벨 100 → 20레벨 300
  const TIER_CAP_LV = { 1: 1, 2: 5, 3: 10, 4: 10 };   // 물약 등급별 필요 지성
  const PT_PRICE = [0, 40, 125, 350, 1000];
  const LEGEND4_PRICE = 1800;                          // 재료 4가지로 만드는 전설 조합 물약
  const MISSION_CAP = 8;
  const BATCH_MAX = 50;                                // 다량 제작 1회 상한
  const UPGRADE_CHANCE = 0.12;                         // 재주 10: 한 단계 높은 등급이 나올 확률
  const BONUS_LEGEND_CHANCE = 0.05;                    // 재주 20: 전설 물약 2~3병 확률
  const SPECIAL_MISSION_CHANCE = 0.2;                  // 매력 15: 특별 임무 확률
  const FREE_RECIPES = 8 * 7 * 4 + 8 * 7 * 6;          // 자유 조합 수 (등급 4단계 + 전설 4재료)

  // 능력 정의 — 특수 스킬은 5레벨마다 하나씩
  const ABILITIES = {
    int: { name: '지성', train: '조합할 때', skills: [
      { lv: 5, name: '이차 비약', desc: '2등급(고급) 물약을 만들 수 있다.' },
      { lv: 10, name: '고등 비약', desc: '3~4등급(희귀·전설) 물약을 만들 수 있다.' },
      { lv: 15, name: '삼중 배합', desc: '재료를 3가지까지 섞을 수 있다.' },
      { lv: 20, name: '전설의 조합법', desc: '재료 4가지를 섞어 전설 등급 물약을 만들 수 있다.' }] },
    acu: { name: '예리', train: '채집할 때', skills: [
      { lv: 5, name: '확률의 눈', desc: '지역에서 나오는 재료의 채집 확률이 보인다.' },
      { lv: 10, name: '풍성한 손길', desc: '채집할 때 확률적으로 수확량이 늘어난다.' },
      { lv: 15, name: '천리안', desc: '채집 지역에서 얻을 수 있는 재료를 미리 알 수 있다.' },
      { lv: 20, name: '날씨를 거스르는 눈', desc: '채집할 때 10% 확률로 날씨의 영향을 받지 않는다. (나쁜 날씨의 피해를 일부 피한다)' }] },
    craft: { name: '재주', train: '조합·물건 제작할 때', skills: [
      { lv: 5, name: '다량 제작', desc: '같은 조합·물건을 한 번에 여러 번 만든다. (전설 등급 물약은 제외)' },
      { lv: 10, name: '상위 제작', desc: '자유 조합 물약을 만들 때 12% 확률로 한 단계 높은 등급이 나온다. (전설은 그대로)' },
      { lv: 15, name: '도구 한계 돌파', desc: '도구 레벨 상한이 10까지 열린다. (4단계 이후 강화는 추후 추가)' },
      { lv: 20, name: '전설의 풍작', desc: '전설 물약은 다량 제작할 수 없지만, 5% 확률로 2~3병이 나온다.' }] },
    charm: { name: '매력', train: '거래·임무할 때', skills: [
      { lv: 5, name: '흥정', desc: '같은 물건을 많이 팔아도 값이 절반만 내려간다.' },
      { lv: 10, name: '단골 손님', desc: '마을 사람 임무 보상 +25%.' },
      { lv: 15, name: '특별 의뢰', desc: '마을 사람과 대화할 때 20% 확률로 보상이 3배인 특별 임무를 받는다.' },
      { lv: 20, name: '전설의 연금술사', desc: '물약·물건 판매가 +20%, 거래소 재료 구매가 -10%.' }] },
    swift: { name: '신속', train: '이동할 때', skills: [
      { lv: 5, name: '가벼운 발걸음', desc: '이동 시간이 5% 더 줄어든다.' },
      { lv: 10, name: '지름길', desc: '가 본 적 있는 지역으로 갈 때 이동 시간이 10% 더 줄어든다.' },
      { lv: 15, name: '길 위의 수확', desc: '이동하는 동안 재료를 주워 온다. (이동 20분마다 1개)' },
      { lv: 20, name: '순간 이동', desc: '하루 한 번, 시간 소모 없이 원하는 곳으로 이동한다.' }] },
  };

  const NPCS = {
    camp: { name: '약초 할멈 솔이', lines: ['요즘 허리가 쑤셔서 말이야. 부탁 하나만 들어주렴.', '네 솜씨라면 믿고 맡길 수 있지.'] },
    market: { name: '상인 두루', lines: ['손님이 찾는 물건이 있는데, 자네 아니면 구할 데가 없어.', '이번 건은 값을 후하게 쳐 드리지요.'] },
    town_hall: { name: '회관지기 보람', lines: ['게시판에 못 붙인 부탁이 하나 남았는데, 들어 주겠나?', '요즘 마을이 활기가 넘쳐서 일손이 모자라네.'] },
    tool_street: { name: '대장장이 강쇠', lines: ['내 일손이 모자라서 그러는데, 좀 도와주겠나?', '솜씨 좋은 연금술사를 찾던 참이었어.'] },
  };

  function F(code, message) { return { ok: false, code: code, message: message }; }

  class Game4 extends A.Game3 {
    // ------------------------------------------------------------ 저장 · 이전 판 호환
    migrate() {
      super.migrate();
      const s = this.state;
      this.config.maxLevel = MAX_ALCHEMIST_LV;       // 연금술사 레벨은 기능치를 주는 용도로 100까지
      if (this.config.manaRegenSec === undefined) this.config.manaRegenSec = 6;
      s.abil = s.abil || {};
      KEYS.forEach(function (k) { if (!s.abil[k]) s.abil[k] = { lv: 1, xp: 0 }; });
      if (s.points === undefined) s.points = Math.max(0, (s.level || 1) - 1);   // 연금술사 레벨업마다 기능치 1점
      s.missions = s.missions || [];
      s.talks = s.talks || {};
      if (s.talkDate === undefined) s.talkDate = this.config.today();
      this.events = this.events || [];
      if (s.mana === undefined) s.mana = this.manaMax();
      if (s.manaAt === undefined) s.manaAt = this.config.now();
      return this;
    }

    _rollDay() {
      super._rollDay();
      const s = this.state, t = this.config.today();
      if (s.talkDate !== undefined && s.talkDate !== t) { s.talkDate = t; s.talks = {}; }
    }

    // 연금술사 레벨(경험치)은 그대로 두고, 레벨이 오를 때마다 기능치를 1점 준다. 기능치는 능력 레벨을 올리는 데 쓴다.
    addXp(n) {
      const gained = super.addXp(n);
      if (gained > 0) {
        this.state.points += gained;
        this.events.push({ type: 'alch', lv: this.state.level, n: gained });
      }
      return gained;
    }

    // 기능치 1점으로 능력 하나를 1레벨 올린다
    spendPoint(k) {
      const s = this.state, a = s.abil[k];
      if (!a) return F('unknown', '알 수 없는 능력입니다.');
      if (s.points < 1) return F('no_points', '기능치가 없다. 연금술사 레벨이 오르면 1점씩 얻는다.');
      if (a.lv >= MAX_LV) return F('max', ABILITIES[k].name + '은(는) 이미 최고 레벨이다.');
      s.points -= 1;
      this._bumpLevel(k);
      a.xp = 0;
      return { ok: true, key: k, lv: a.lv, message: ABILITIES[k].name + ' 능력이 Lv.' + a.lv + '이(가) 되었다. (남은 기능치 ' + s.points + ')' };
    }

    // ------------------------------------------------------------ 능력
    abilLv(k) { return this.state.abil[k].lv; }
    has(k, lv) { return this.abilLv(k) >= lv; }
    abilNeed(lv) { return 6 + 4 * lv; }

    abilityList() {
      return KEYS.map(function (k) {
        const a = this.state.abil[k];
        return { key: k, name: ABILITIES[k].name, lv: a.lv, xp: a.xp, need: a.lv >= MAX_LV ? 0 : this.abilNeed(a.lv),
          max: a.lv >= MAX_LV, train: ABILITIES[k].train, effect: this.abilityEffect(k), skills: ABILITIES[k].skills };
      }, this);
    }

    abilityEffect(k) {
      const lv = this.abilLv(k), r = function (n) { return Math.round(n * 10) / 10; };
      if (k === 'int') return '마나 최대 ' + this.manaMax() + ' · 물약 ' + this.tierCap() + '등급까지 · 재료 ' + this.maxIngredients() + '가지';
      if (k === 'acu') return lv >= 10 ? '추가 수확 확률 단기 +' + r(this._extraChance() * 100) + '% · 장기 +' + r(this._extraRolls() * 100) + '%'
        : lv >= 5 ? '채집 확률이 보인다 (Lv.10에 수확량 증가)' : 'Lv.5에 채집 확률이 보인다';
      if (k === 'craft') return '1등급 물약 성공 확률 ' + this.baseBrewChance() + '% · 도구 효율 +' + r(2.5 * (lv - 1)) + '% · 도구 상한 ' + this.toolCap() + '단계';
      if (k === 'charm') return '물약·물건 판매가 +' + r((this._charmMult() - 1) * 100) + '% · 마을 사람 하루 임무 ' + this.talkLimit() + '건';
      return '이동 속도 (이동 시스템과 함께 적용 예정)';
    }

    gainAbility(k, amount) {
      const a = this.state.abil[k];
      if (!a || a.lv >= MAX_LV || !(amount > 0)) return 0;
      a.xp += amount;
      let ups = 0;
      while (a.lv < MAX_LV && a.xp >= this.abilNeed(a.lv)) {
        a.xp -= this.abilNeed(a.lv);
        this._bumpLevel(k); ups += 1;
      }
      if (a.lv >= MAX_LV) a.xp = 0;
      return ups;
    }

    // 능력 레벨을 1 올리고 알림·마나 증가를 처리한다 (행동으로 오를 때와 기능치로 올릴 때 공통)
    _bumpLevel(k) {
      const a = this.state.abil[k], before = this.manaMax();
      a.lv += 1;
      this.events.push({ type: 'level', key: k, lv: a.lv });
      ABILITIES[k].skills.forEach(function (sk) {
        if (sk.lv === a.lv) this.events.push({ type: 'skill', key: k, lv: a.lv, name: sk.name });
      }, this);
      if (k === 'int') this.state.mana += this.manaMax() - before;
    }

    drainEvents() { const e = this.events; this.events = []; return e; }

    // 도구·채집 보정 (Game3 가 부르는 훅)
    _toolEff() { return 1 + 0.025 * (this.abilLv('craft') - 1); }
    _extraChance() { const lv = this.abilLv('acu'); return lv >= 10 ? 0.25 + 0.015 * (lv - 10) : 0; }
    _extraRolls() { const lv = this.abilLv('acu'); return lv >= 10 ? 0.10 + 0.01 * (lv - 10) : 0; }
    showOdds() { return this.has('acu', 5); }
    canPreview() { return this.has('acu', 15); }
    ignoresWeather() { return this.has('acu', 20) && this.rng() < 0.1; }   // 날씨 시스템이 생기면 채집에서 부른다

    // 재료별 채집 확률(%) — 단기 채집 기준, 현재 물약 효과 포함
    herbOdds(areaId) {
      const area = this.areas[areaId], out = {};
      if (!area || !area.herbs.length) return out;
      const r = this._rarityWeights('short', areaId, this._rareMult());
      Object.keys(r.w).forEach(function (rar) {
        const pool = area.herbs.filter(function (id) { return this.herbs[id].rarity === rar; }, this);
        const w = pool.map(function (id) {
          return (id === area.signature ? this.config.signatureBonus : 1) * this._catMult(this.herbs[id].cat);
        }, this);
        const sum = w.reduce(function (a, b) { return a + b; }, 0);
        pool.forEach(function (id, i) { out[id] = Math.round(r.w[rar] / r.total * w[i] / sum * 1000) / 10; });
      }, this);
      return out;
    }

    // ------------------------------------------------------------ 마나
    manaMax() { return Math.round(MANA_BASE + (this.abilLv('int') - 1) * (MANA_AT_MAX - MANA_BASE) / (MAX_LV - 1)); }

    _regen() {
      const s = this.state, now = this.config.now(), max = this.manaMax();
      if (s.manaAt === undefined || now < s.manaAt) s.manaAt = now;           // 시계가 거꾸로 가면 회복하지 않는다
      if (s.mana < max) s.mana = Math.min(max, s.mana + (now - s.manaAt) / (this.config.manaRegenSec * 1000));
      else s.mana = Math.min(s.mana, max);
      s.manaAt = now;
    }
    manaNow() { this._regen(); return this.state.mana; }

    // potion: value = 등급(5 는 재료 4가지 전설 조합), good: value = 물건 가격
    manaCost(kind, value) {
      return Math.max(1, kind === 'potion' ? 10 + 6 * (value - 1) : 8 + Math.floor(value / 60));
    }
    tierCap() { const lv = this.abilLv('int'); return lv >= 10 ? 4 : lv >= 5 ? 2 : 1; }
    maxIngredients() { const lv = this.abilLv('int'); return lv >= 20 ? 4 : lv >= 15 ? 3 : 2; }
    lockMsg(n) {
      return n === 3 ? '재료 3가지 조합은 지성 Lv.15부터 가능하다.' : n === 4 ? '재료 4가지 조합은 지성 Lv.20부터 가능하다.' : null;
    }

    // ------------------------------------------------------------ 채집
    shortGather() {
      const r = super.shortGather();
      if (r.ok) this.gainAbility('acu', 1);
      return r;
    }

    completeExpedition() {
      const r = super.completeExpedition();
      if (r.ok) {
        r.abilityXp = Math.max(1, Math.round(r.xp * 0.1));
        this.gainAbility('acu', r.abilityXp);
      }
      return r;
    }

    travel(id) {
      const r = super.travel(id);
      if (r.ok) this.gainAbility('swift', 0.5);
      return r;
    }

    // ------------------------------------------------------------ 도구 상한
    toolCap() { return this.has('craft', 15) ? 10 : 3; }
    toolList() {
      const cap = this.toolCap();
      return super.toolList().map(function (t) {
        const tiered = t.max === 3;       // 3단계짜리 도구만 재주 15레벨에 상한이 열린다
        return Object.assign({}, t, { capLv: tiered ? cap : t.max, pending: tiered && t.lv >= 3 && cap > 3 });
      });
    }
    buyTool(id) {
      if (id !== 'broom' && this.toolLv(id) >= 3 && this.toolCap() > 3) return F('pending', '4단계 이후 강화는 아직 준비 중이다.');
      return super.buyTool(id);
    }

    // ------------------------------------------------------------ 물약 정의 (4재료 전설 조합)
    ensurePotion(id) {
      if (this.potions[id]) return this.potions[id];
      const m = /^pl:([^:]+):([^:]+):([^:]+)$/.exec(id);
      if (!m) return super.ensurePotion(id);
      const effects = [A.ptEffect(m[1], 4), A.ptEffect(m[2], 3), A.ptEffect(m[3], 2)];
      const p = {
        id: id, name: '전설의 ' + A.SEC_ADJ[m[2]] + '·' + A.SEC_ADJ[m[3]] + ' ' + A.PRI_NOUN[m[1]] + ' 영약', tier: 4, rarity: 'legendary',
        ingredients: null, recipeKey: id, effects: effects, primary: m[1], secondary: m[2], tertiary: m[3], proc: true, legend4: true,
        description: effects.map(function (e) { return e.description; }).join(' '), hint: '', price: LEGEND4_PRICE,
      };
      this.potions[id] = p;
      return p;
    }

    _traitTriple(ids) {
      const counts = {};
      ids.forEach(function (id) {
        this.herbs[id].traits.forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
      }, this);
      const sorted = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || A.TRAITS.indexOf(a) - A.TRAITS.indexOf(b); });
      for (let i = 0; sorted.length < 3 && i < A.TRAITS.length; i++) if (sorted.indexOf(A.TRAITS[i]) < 0) sorted.push(A.TRAITS[i]);
      return sorted.slice(0, 3);
    }

    freeBook() {
      const out = [];
      Object.keys(this.state.discovered).forEach(function (k) {
        if (k.indexOf('pt:') === 0 || k.indexOf('pl:') === 0) out.push(this.ensurePotion(k));
      }, this);
      out.sort(function (a, b) { return a.tier - b.tier || (a.name < b.name ? -1 : 1); });
      return { found: out, total: FREE_RECIPES };
    }

    // ------------------------------------------------------------ 조합
    _levelChance() { return this.config.baseBrewChance + this.config.brewChancePerLevel * (this.abilLv('craft') - 1); }

    baseBrewChance() { return this._chanceFor({ tier: 1 }); }

    _resolve(ids) {
      if (ids.length === 4) {
        return { recipe: this.ensurePotion('pl:' + this._traitTriple(ids).join(':')), legend4: true };
      }
      const cap = this.tierCap();
      const fixed = this.recipes[A.recipeKey(ids)];
      if (fixed) {
        if (fixed.tier > cap) return { blocked: '아직 이해하지 못한 조합이다. (' + fixed.tier + '등급 물약은 지성 Lv.' + TIER_CAP_LV[fixed.tier] + ' 필요)' };
        return { recipe: fixed };
      }
      const pair = this._traitPair(ids);
      const avg = ids.reduce(function (a, id) { return a + Math.min(3, A.RARITIES.indexOf(this.herbs[id].rarity)); }.bind(this), 0) / ids.length;
      let tier = Math.max(1, Math.min(4, 1 + Math.floor(avg + 0.4)));
      const wanted = tier;
      if (tier > cap) tier = cap;
      return { recipe: this.ensurePotion('pt:' + pair[0] + ':' + pair[1] + ':' + tier), clamped: wanted > cap, wanted: wanted };
    }

    brewPreview(ids) {
      if (!Array.isArray(ids) || ids.length < 2) return null;
      const traits = ids.length === 4 ? this._traitTriple(ids) : this._traitPair(ids);
      if (ids.length > this.maxIngredients()) return { blocked: this.lockMsg(ids.length), traits: traits };
      const r = this._resolve(ids);
      if (r.blocked) return { blocked: r.blocked, traits: traits };
      const known = !!this.state.discovered[r.recipe.recipeKey];
      return { recipe: r.recipe, clamped: r.clamped, wanted: r.wanted, known: known, traits: traits, showRecipe: known,
        chance: known ? this._chanceFor(r.recipe) : null, cost: this.manaCost('potion', r.legend4 ? 5 : r.recipe.tier),
        bulk: this.has('craft', 5) && r.recipe.tier < 4 };
    }

    brewChance(ids) {
      const p = this.brewPreview(ids);
      return p && p.chance !== undefined ? p.chance : null;
    }

    brew(ids) {
      this._rollDay(); this._regen();
      const s = this.state;
      if (s.phase !== 'idle') return F('busy', '장기 채집 중에는 연금술을 할 수 없습니다.');
      if (!Array.isArray(ids) || ids.length < 2 || ids.length > 4) return F('bad_count', '재료는 2~4가지를 섞어야 합니다.');
      if (ids.length > this.maxIngredients()) return F('low_int', this.lockMsg(ids.length));
      if (new Set(ids).size !== ids.length) return F('duplicate', '같은 재료는 한 번만 넣을 수 있습니다.');
      for (let i = 0; i < ids.length; i++) {
        if (!this.herbs[ids[i]]) return F('unknown_herb', '알 수 없는 재료입니다.');
        if (this.herbCount(ids[i]) < 1) return F('missing_herb', this.herbs[ids[i]].name + '이(가) 부족합니다.');
      }
      const rs = this._resolve(ids);
      if (rs.blocked) return F('low_int', rs.blocked);
      let recipe = rs.recipe;

      const cost = this.manaCost('potion', rs.legend4 ? 5 : recipe.tier);
      if (s.mana < cost) return F('no_mana', '마나가 모자란다. (' + cost + ' 필요, 지금 ' + Math.floor(s.mana) + ')');
      s.mana -= cost;

      const chance = this._chanceFor(recipe);
      ids.forEach(function (id) { s.herbs[id] -= 1; });
      let refunded = null;
      const rf = this._active('brew_refund');
      const pct = (rf ? rf.value : 0) + this._fx('mortar') * this._toolEff();
      if (pct > 0 && this.rng() * 100 < pct) {
        refunded = ids[Math.floor(this.rng() * ids.length)];
        s.herbs[refunded] += 1;
      }
      this._tick('brew');

      if (this.rng() * 100 >= chance) {
        this.gainAbility('int', 1); this.gainAbility('craft', 1);
        this.addXp(this.config.brewXpFail);
        return { ok: false, code: 'fizzle', chance: chance, refunded: refunded, cost: cost,
          message: '솥이 끓어 넘쳐 재료를 잃었다. 기운은 분명 어우러지고 있었는데…' };
      }

      // 재주 10: 자유 조합 물약은 가끔 한 단계 높게 만들어진다 (전설은 그대로)
      let upgraded = false;
      if (this.has('craft', 10) && recipe.proc && !recipe.legend4 && recipe.tier < 4 && this.rng() < UPGRADE_CHANCE) {
        recipe = this.ensurePotion('pt:' + recipe.primary + ':' + recipe.secondary + ':' + (recipe.tier + 1));
        upgraded = true;
      }
      // 재주 20: 전설 물약은 가끔 2~3병
      let count = 1;
      if (this.has('craft', 20) && recipe.tier >= 4 && this.rng() < BONUS_LEGEND_CHANCE) count = 2 + (this.rng() < 0.5 ? 1 : 0);

      s.potions[recipe.id] = (s.potions[recipe.id] || 0) + count;
      const isNew = !s.discovered[recipe.recipeKey];
      s.discovered[recipe.recipeKey] = true;
      this.gainAbility('int', 2 + recipe.tier); this.gainAbility('craft', 2 + recipe.tier);
      this.addXp(this.config.brewXpSuccess * recipe.tier);
      return { ok: true, potionId: recipe.id, name: recipe.name, tier: recipe.tier, chance: chance, newDiscovery: isNew,
        refunded: refunded, cost: cost, count: count, upgraded: upgraded, clamped: !!rs.clamped,
        message: (isNew ? '새로운 조합을 발견했다! ' : '') + recipe.name + (count > 1 ? ' ' + count + '병' : '') + '을(를) 완성했다.' +
          (upgraded ? ' (솜씨가 빛나 한 단계 높은 등급이 나왔다!)' : '') +
          (rs.clamped ? ' (재료는 더 높은 등급이었지만 지성이 모자라 ' + recipe.tier + '등급으로 만들어졌다)' : '') };
    }

    // 재주 5: 다량 제작 — 같은 조합을 여러 번. 전설 등급 물약은 제외
    brewMany(ids, n) {
      if (!this.has('craft', 5)) return F('locked', '다량 제작은 재주 Lv.5부터 가능하다.');
      const pv = this.brewPreview(ids);
      if (!pv) return F('bad_count', '재료를 2가지 이상 고르세요.');
      if (pv.blocked) return F('low_int', pv.blocked);
      if (!pv.bulk) return F('legend', '전설 등급 물약은 다량 제작할 수 없다.');
      n = Math.max(1, Math.min(n || 1, BATCH_MAX));
      const res = { ok: true, attempts: 0, wins: 0, fails: 0, potions: {}, cost: 0, stop: null };
      for (let i = 0; i < n; i++) {
        const r = this.brew(ids);
        if (!r.ok && r.code !== 'fizzle') { res.stop = r.message; break; }
        res.attempts += 1; res.cost += r.cost;
        if (r.ok) { res.wins += 1; res.potions[r.name] = (res.potions[r.name] || 0) + r.count; } else res.fails += 1;
      }
      if (!res.attempts) return F('stopped', res.stop);
      return res;
    }

    // ------------------------------------------------------------ 물건 제작
    craftGood(id) {
      this._rollDay(); this._regen();
      const s = this.state, g = this.goodDefs[id];
      if (!g) return F('unknown_good', '알 수 없는 물건입니다.');
      if (s.phase !== 'idle') return F('busy', '장기 채집 중에는 물건을 만들 수 없다.');
      if (s.location !== 'camp') return F('not_workshop', '거점의 공방에서만 물건을 만들 수 있다.');
      const pv = this.goodsPreview(id);
      if (!pv.ok) return F('cannot', pv.reason);
      const cost = this.manaCost('good', g.price);
      if (s.mana < cost) return F('no_mana', '마나가 모자란다. (' + cost + ' 필요, 지금 ' + Math.floor(s.mana) + ')');
      s.mana -= cost;
      Object.keys(pv.pick).forEach(function (k) {
        s.herbs[k] -= pv.pick[k];
        if (s.herbs[k] <= 0) delete s.herbs[k];
      });
      s.goods[id] = (s.goods[id] || 0) + 1;
      s.made[id] = (s.made[id] || 0) + 1;
      this.gainAbility('craft', 2 + Math.floor(g.price / 150)); this.gainAbility('int', 1);
      this.addXp(2 + Math.floor(g.price / 60));
      return { ok: true, id: id, name: g.name, used: pv.pick, cost: cost, message: g.name + '을(를) 만들었다.' };
    }

    craftMany(id, n) {
      if (!this.has('craft', 5)) return F('locked', '다량 제작은 재주 Lv.5부터 가능하다.');
      n = Math.max(1, Math.min(n || 1, BATCH_MAX));
      const res = { ok: true, name: null, made: 0, cost: 0, used: {}, stop: null };
      for (let i = 0; i < n; i++) {
        const r = this.craftGood(id);
        if (!r.ok) { res.stop = r.message; break; }
        res.name = r.name; res.made += 1; res.cost += r.cost;
        Object.keys(r.used).forEach(function (k) { res.used[k] = (res.used[k] || 0) + r.used[k]; });
      }
      if (!res.made) return F('stopped', res.stop);
      return res;
    }

    rest() {
      const r = super.rest();
      if (r.ok) { this._regen(); this.state.mana = this.manaMax(); r.message += ' 마나도 가득 찼다.'; }
      return r;
    }

    // ------------------------------------------------------------ 거래
    _charmMult() { return 1 + 0.02 * (this.abilLv('charm') - 1) + (this.has('charm', 20) ? 0.2 : 0); }

    _unitPrice(kind, id, soldN) {
      const p = super._unitPrice(kind, id, this.has('charm', 5) ? soldN / 2 : soldN);
      return kind === 'item' ? p : Math.max(1, Math.round(p * this._charmMult()));
    }

    sell(kind, id, n) {
      const r = super.sell(kind, id, n);
      if (r.ok) this.gainAbility('charm', kind === 'item' ? r.n * 0.2 : r.n);
      return r;
    }

    shopStock() {
      const k = this.has('charm', 20) ? 0.9 : 1;
      return super.shopStock().map(function (x) { return Object.assign({}, x, { price: Math.ceil(x.price * k) }); });
    }

    // ------------------------------------------------------------ 마을 사람 임무
    talkLimit() { return 1 + Math.floor(this.abilLv('charm') / 5); }
    npcOf(areaId) { return NPCS[areaId] || null; }

    missionText(m) {
      const pre = m.special ? '[특별] ' : '';
      if (m.type === 'potion') return pre + m.minTier + '등급 이상 물약 ×' + m.n + ' 납품';
      return pre + m.name + ' ×' + m.n + ' 납품';
    }

    _makeMission(npc, special) {
      const rng = this.rng, roll = special ? 0.5 : rng();
      const id = 'm' + this.config.now().toString(36) + Math.floor(rng() * 1e6).toString(36);
      const mult = special ? 3 : 1;
      if (roll < 0.4) {
        const list = this.goodList.filter(function (g) { return !g.tool || this.toolLv(g.tool) >= g.lv; }, this);
        const g = list[Math.floor(rng() * list.length)];
        return { id: id, npc: npc, type: 'good', key: g.id, name: g.name, n: 1, reward: Math.round(this.goodPrice(g.id) * 1.6) };
      }
      if (roll < 0.75) {
        const t = special ? this.tierCap() : 1 + Math.floor(rng() * this.tierCap()), n = 1 + Math.floor(rng() * 2);
        return { id: id, npc: npc, type: 'potion', minTier: t, n: n, name: t + '등급 물약', special: special, reward: Math.round(PT_PRICE[t] * n * 1.5 * mult) };
      }
      const pool = this.herbList.filter(function (h) { return h.rarity !== 'legendary'; });
      const h = pool[Math.floor(rng() * pool.length)];
      const n = h.rarity === 'common' ? 6 : h.rarity === 'uncommon' ? 4 : 2;
      return { id: id, npc: npc, type: 'item', key: h.id, name: h.name, n: n, reward: Math.round(h.price * n * 1.8) };
    }

    talk(npcId) {
      this._rollDay();
      const s = this.state, npc = NPCS[npcId];
      if (!npc || s.location !== npcId) return F('not_here', '그 사람은 여기에 없다.');
      if ((s.talks[npcId] || 0) >= this.talkLimit()) return F('limit', npc.name + '은(는) 오늘 더 맡길 일이 없다고 한다.');
      if (s.missions.length >= MISSION_CAP) return F('full', '수첩이 가득 찼다. 받은 임무를 먼저 마무리하자.');
      const special = this.has('charm', 15) && this.rng() < SPECIAL_MISSION_CHANCE;
      const m = this._makeMission(npcId, special);
      s.missions.push(m);
      s.talks[npcId] = (s.talks[npcId] || 0) + 1;
      this.gainAbility('charm', 1);
      const line = npc.lines[Math.floor(this.rng() * npc.lines.length)];
      return { ok: true, mission: m, message: npc.name + ': "' + line + '" 임무를 받았다 — ' + this.missionText(m) + ' (보상 ' + m.reward + ' G)' };
    }

    _consumeOther() { return null; }
    _rewardMult() { return this.has('charm', 10) ? 1.25 : 1; }
    rewardOf(m) { return Math.round(m.reward * this._rewardMult(m)); }

    deliver(missionId) {
      const s = this.state;
      const i = s.missions.findIndex(function (m) { return m.id === missionId; });
      if (i < 0) return F('none', '그 임무는 이미 없다.');
      const m = s.missions[i];
      if (m.type === 'good') {
        if ((s.goods[m.key] || 0) < m.n) return F('lack', m.name + '이(가) 모자란다.');
        s.goods[m.key] -= m.n; if (s.goods[m.key] <= 0) delete s.goods[m.key];
      } else if (m.type === 'item') {
        if (this.herbCount(m.key) < m.n) return F('lack', m.name + '이(가) 모자란다.');
        s.herbs[m.key] -= m.n; if (s.herbs[m.key] <= 0) delete s.herbs[m.key];
      } else if (m.type === 'potion') {
        const have = this.ownedPotions().filter(function (p) { return p.tier >= m.minTier; })
          .sort(function (a, b) { return a.tier - b.tier; });
        if (have.reduce(function (a, p) { return a + s.potions[p.id]; }, 0) < m.n) return F('lack', m.minTier + '등급 이상 물약이 모자란다.');
        let need = m.n;
        for (let j = 0; j < have.length && need > 0; j++) {
          const take = Math.min(need, s.potions[have[j].id]);
          s.potions[have[j].id] -= take; need -= take;
          if (s.potions[have[j].id] <= 0) delete s.potions[have[j].id];
        }
      } else {
        const bad = this._consumeOther(m);      // 납품이 아닌 의뢰(활동 의뢰)는 조건만 확인한다
        if (bad) return bad;
      }
      const reward = this.rewardOf(m);
      s.gold += reward;
      s.missions.splice(i, 1);
      this.gainAbility('charm', 6);
      return { ok: true, reward: reward, message: this.missionText(m) + ' 임무를 마쳤다. ' + reward + ' G를 받았다.' };
    }
  }

  A.GameClass = Game4;
  A.Game4 = Game4;
  A.ABILITIES = ABILITIES;
  A.ABILITY_KEYS = KEYS;
  A.NPCS = NPCS;
})();
