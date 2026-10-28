/*!
 * alchemy-ext8.js v11 — 재료 5등급(일반·고급·희귀·영웅·전설) 재조정 · 만든 물약의 조합 기억
 * Game9 를 상속한다.
 */
(function () {
  'use strict';
  const A = Alchemy;

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // 희귀·전설은 그대로 두고, 나머지 재료(일반·고급)를 일반 · 고급 · 영웅으로 다시 나눈다.
  // 예전 등급이 높았던 재료일수록 영웅이 되기 쉽고, 나머지는 재료 이름으로 정해져 늘 같은 결과가 나온다.
  const EPIC_SHARE = 0.17, UNCOMMON_SHARE = 0.38;
  const KEEP_COMBOS = 3;                                // 물약 하나당 기억하는 재료 조합 수

  class Game10 extends A.Game9 {
    constructor(opts) {
      super(opts);
      const pool = this.herbList.filter(function (h) { return h.rarity === 'common' || h.rarity === 'uncommon'; })
        .map(function (h) { return { h: h, score: (h.rarity === 'uncommon' ? 0.35 : 0) + hash('grade:' + h.id) * 0.65 }; })
        .sort(function (a, b) { return b.score - a.score || (a.h.id < b.h.id ? -1 : 1); });
      const nEpic = Math.round(pool.length * EPIC_SHARE), nUnc = Math.round(pool.length * UNCOMMON_SHARE);
      pool.forEach(function (x, i) {
        x.h.rarity = i < nEpic ? 'epic' : i < nEpic + nUnc ? 'uncommon' : 'common';
        x.h.price = A.itemPrice(x.h.rarity, x.h.cat, x.h.id);
      });
    }

    migrate() {
      super.migrate();
      this.state.combos = this.state.combos || {};      // { 물약 recipeKey: [[재료 id…], …] } 최근 것이 앞
      return this;
    }

    brew(ids) {
      const r = super.brew(ids);
      if (r.ok) this._remember(r.potionId, ids);
      return r;
    }

    _remember(potionId, ids) {
      const key = this.ensurePotion(potionId).recipeKey, sorted = ids.slice().sort();
      const sig = sorted.join('+'), list = (this.state.combos[key] || []).filter(function (c) { return c.join('+') !== sig; });
      list.unshift(sorted);
      this.state.combos[key] = list.slice(0, KEEP_COMBOS);
    }

    // 한 번 만든 물약의 재료 조합. 이름 있는 비약은 정해진 조합을, 자유 조합은 직접 만든 조합을 돌려준다.
    comboFor(recipeKey) {
      const fixed = this.potionList.find(function (p) { return p.recipeKey === recipeKey && p.ingredients; });
      if (fixed) return [fixed.ingredients.slice()];
      return (this.state.combos[recipeKey] || []).filter(function (c) { return c.every(function (id) { return this.herbs[id]; }, this); }, this);
    }
  }

  A.GameClass = Game10;
  A.Game10 = Game10;
})();
