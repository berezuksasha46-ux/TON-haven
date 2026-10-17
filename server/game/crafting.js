import { ITEMS } from './world.js';

const RECIPES = {
  // Крафт на верстаках
  bench_wood: {
    gives: 'bench_wood', cost: { wood: 10 }
  },
  sword_wood: {
    station: 'bench_wood', gives: 'sword_wood', cost: { wood: 5 }
  },
  pickaxe_wood: {
    station: 'bench_wood', gives: 'pickaxe_wood', cost: { wood: 4 }
  },
  axe_wood: {
    station: 'bench_wood', gives: 'axe_wood', cost: { wood: 4 }
  },
  shield_wood: {
    station: 'bench_wood', gives: 'shield_wood', cost: { wood: 8 }
  },
  furnace: {
    station: 'bench_wood', gives: 'furnace', cost: { stone: 20 }
  },
  iron_ingot: {
    station: 'furnace', gives: 'iron_ingot', cost: { iron_ore: 2 }
  },
  sword_iron: {
    station: 'bench_iron', gives: 'sword_iron', cost: { iron_ingot: 3, wood: 2 }
  },
  shield_iron: {
    station: 'bench_iron', gives: 'shield_iron', cost: { iron_ingot: 4 }
  },
  drill_iron: {
    station: 'bench_iron', gives: 'drill_iron', cost: { iron_ingot: 5, stone: 10 }
  }
};

export function canCraft(playerInv, recipeId, stationItemId) {
  const r = RECIPES[recipeId];
  if (!r) return { ok: false, reason: 'no-recipe' };
  if (r.station && r.station !== stationItemId) {
    return { ok: false, reason: 'wrong-station' };
  }
  for (const [item, qty] of Object.entries(r.cost)) {
    const total = playerInv.filter(i => i.item_id === item).reduce((s,i)=>s+i.qty,0);
    if (total < qty) return { ok: false, reason: 'missing:' + item };
  }
  return { ok: true, recipe: r };
}

export function stationRecipes(stationItemId) {
  return Object.entries(RECIPES)
    .filter(([, r]) => r.station === stationItemId)
    .map(([id, r]) => ({ id, gives: r.gives, cost: r.cost }));
}

/**
 * Ремонт обычных предметов: 1 ресурс = +10 прочности. God-предметы не чинятся.
 */
export function repairCost(item) {
  const it = ITEMS[item.item_id];
  if (!it || it.god) return null;
  const missing = (it.dur || 100) - (item.durability ?? 0);
  return Math.ceil(missing / 10);
}