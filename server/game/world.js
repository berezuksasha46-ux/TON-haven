export const ZONES = {
  HUB:    { id: 'hub',    safe: true,  pvp: false, xp: 0 },
  WILD:   { id: 'wild',   safe: false, pvp: true,  xp: 1 },
  ISLAND: { id: 'island', safe: true,  pvp: false, xp: 0, visitable: true }
};

export const ITEMS = {
  // Еда
  bread:            { kind: 'food',  hp: 20, cd: 15, buffs: {} },
  stew:             { kind: 'food',  hp: 40, cd: 15, buffs: { dmg: 5, dur: 30 } },
  poseidon_bean:    { kind: 'food',  hp: 60, cd: 15, buffs: { spd: 0.15, dur: 45 }, exotic: true },
  // Оружие
  sword_wood:       { kind: 'weapon', cls: 'sword', dmg: 12, range: 1.6,  arc: 0.5,  dur: 100 },
  bow_wood:         { kind: 'weapon', cls: 'bow',   dmg: 15, range: 6,    proj: true, dur: 100 },
  staff_basic:      { kind: 'weapon', cls: 'staff', dmg: 10, range: 4,    aoe: 1.5, dur: 100 },
  drill_iron:       { kind: 'weapon', cls: 'drill', dmg: 4,  range: 1.2,  aoe: 1.4, dur: 200 },
  // Инструменты
  pickaxe_wood:     { kind: 'tool', tier: 1, dur: 80 },
  axe_wood:         { kind: 'tool', tier: 1, dur: 80 },
  pickaxe_god:      { kind: 'tool', tier: 9, dur: null, god: true }, // вечный
  // Щиты
  shield_wood:      { kind: 'shield', block: 200, slowdown: 0.2, dur: 150 },
  shield_iron:      { kind: 'shield', block: 200, slowdown: 0.35, dur: 250 },
  // Станки (устанавливаемые)
  bench_wood:       { kind: 'station', recipes: ['sword_wood','pickaxe_wood','axe_wood','shield_wood'] },
  bench_iron:       { kind: 'station', recipes: ['sword_iron','shield_iron','drill_iron'] },
  furnace:          { kind: 'station', recipes: ['iron_ingot'] },
  // Ресурсы
  wood:             { kind: 'res', sell: 0 },
  stone:            { kind: 'res', sell: 0.00001 },
  iron_ore:         { kind: 'res', sell: 0.0001 },
  iron_ingot:       { kind: 'res', sell: 0.0005 },
  // NFT/донат
  sword_god:        { kind: 'weapon', cls: 'sword', dmg: 40, range: 2, arc: 0.6, dur: null, god: true }
};

export const PLAYER_RADIUS = 0.4;
export const FOOD_CD_MS = 15_000;

// Простая "локация" — пример мирового пространства
export function spawnPointForZone(zone, playerId) {
  if (zone === 'hub')  return { x: 40, y: 40 };
  if (zone === 'wild') return { x: 100 + (playerId % 20), y: 100 + (playerId % 20) };
  return { x: 0, y: 0 };
}

export function isSafeZone(zone) { return ZONES[zone]?.safe === true; }