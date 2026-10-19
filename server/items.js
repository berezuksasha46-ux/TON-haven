// server/items.js

export const ITEMS = {
  // ==========================================
  // ================= РЕСУРСЫ =================
  // ==========================================
  wood: { name: 'Дерево', icon: '🪵', type: 'res', desc: 'Базовый материал для крафта.' },
  stone: { name: 'Камень', icon: '🪨', type: 'res', desc: 'Прочный материал для инструментов.' },
  iron_ore: { name: 'Железная руда', icon: '⛏️', type: 'res', desc: 'Переплавляется в слитки.' },
  iron_ingot: { name: 'Железный слиток', icon: '⛓️', type: 'res', desc: 'Основа для прочного оружия и брони.' },
  cobalt_ore: { name: 'Кобальтовая руда', icon: '💠', type: 'res', desc: 'Редкий металл, добывается киркой 3+ уровня.' },
  cobalt_ingot: { name: 'Кобальтовый слиток', icon: '🔷', type: 'res', desc: 'Очень прочный сплав.' },
  adamantite_ore: { name: 'Адамантитовая руда', icon: '🟢', type: 'res', desc: 'Легендарный металл, добывается киркой 4+ уровня.' },
  adamantite_ingot: { name: 'Адамантитовый слиток', icon: '🟩', type: 'res', desc: 'Почти несокрушимый.' },
  holy_ore: { name: 'Святая руда', icon: '✨', type: 'res', desc: 'Божественный материал.' },
  holy_ingot: { name: 'Святой слиток', icon: '🌟', type: 'res', desc: 'Обладает магической силой.' },
  leather: { name: 'Кожа', icon: '🟫', type: 'res', desc: 'Для легкой брони.' },
  string: { name: 'Нить', icon: '🧵', type: 'res', desc: 'Для луков и йойо.' },
  bone: { name: 'Кость', icon: '🦴', type: 'res', desc: 'Для посохов и стрел.' },
  diamond: { name: 'Алмаз', icon: '💎', type: 'res', desc: 'Драгоценный камень.' },
  magic_crystal: { name: 'Магический кристалл', icon: '🔮', type: 'res', desc: 'Источник магии.' },
  star_fragment: { name: 'Звёздный осколок', icon: '🌟', type: 'res', desc: 'Для звёздного оружия.' },

  // ==========================================
  // ================= ЕДА ====================
  // ==========================================
  apple: { name: 'Яблоко', icon: '🍎', type: 'food', heal: 15, desc: 'Восстанавливает 15 HP.' },
  bread: { name: 'Хлеб', icon: '🍞', type: 'food', heal: 25, desc: 'Восстанавливает 25 HP.' },
  meat_cooked: { name: 'Жареное мясо', icon: '🍖', type: 'food', heal: 40, desc: 'Восстанавливает 40 HP.' },
  fish_cooked: { name: 'Жареная рыба', icon: '🐟', type: 'food', heal: 30, desc: 'Восстанавливает 30 HP.' },
  golden_apple: { name: 'Золотое яблоко', icon: '🍏', type: 'food', heal: 100, desc: 'Полное исцеление.' },

  // ==========================================
  // ============ ОРУЖИЕ (БЛИЖНИЙ) ============
  // ==========================================
  sword_wood: { name: 'Деревянный меч', icon: '⚔️', type: 'weapon', dmg: 15, range: 2.2, atkSpeed: 500, shape: 'arc', arc: 0.8, desc: 'Урон: 15 | Скорость: 0.5с' },
  sword_stone: { name: 'Каменный меч', icon: '🗡️', type: 'weapon', dmg: 28, range: 2.3, atkSpeed: 450, shape: 'arc', arc: 0.8, desc: 'Урон: 28 | Скорость: 0.45с' },
  sword_iron: { name: 'Железный меч', icon: '⚔️', type: 'weapon', dmg: 45, range: 2.5, atkSpeed: 400, shape: 'arc', arc: 0.85, desc: 'Урон: 45 | Скорость: 0.4с' },
  sword_cobalt: { name: 'Кобальтовый меч', icon: '💠', type: 'weapon', dmg: 65, range: 2.6, atkSpeed: 350, shape: 'arc', arc: 0.85, desc: 'Урон: 65 | Скорость: 0.35с' },
  sword_adamantite: { name: 'Адамантитовый меч', icon: '🟢', type: 'weapon', dmg: 90, range: 2.8, atkSpeed: 300, shape: 'arc', arc: 0.9, desc: 'Урон: 90 | Скорость: 0.3с' },
  sword_holy: { name: 'Святой меч', icon: '✨', type: 'weapon', dmg: 150, range: 3.0, atkSpeed: 250, shape: 'arc', arc: 0.95, desc: 'Урон: 150 | Скорость: 0.25с' },

  spear_stone: { name: 'Каменное копьё', icon: '🔱', type: 'weapon', dmg: 20, range: 3.5, atkSpeed: 600, shape: 'line', arc: 0.25, desc: 'Урон: 20 | Дальность: 3.5' },
  spear_iron: { name: 'Железное копьё', icon: '🔱', type: 'weapon', dmg: 35, range: 4.0, atkSpeed: 550, shape: 'line', arc: 0.25, desc: 'Урон: 35 | Дальность: 4.0' },
  spear_cobalt: { name: 'Кобальтовое копьё', icon: '🔱', type: 'weapon', dmg: 55, range: 4.5, atkSpeed: 500, shape: 'line', arc: 0.25, desc: 'Урон: 55 | Дальность: 4.5' },

  bat_wood: { name: 'Деревянная бита', icon: '🏏', type: 'weapon', dmg: 12, range: 2.0, atkSpeed: 600, shape: 'arc', arc: 1.0, knockback: true, desc: 'Урон: 12 | Откидывает' },
  bat_iron: { name: 'Железная бита', icon: '🏏', type: 'weapon', dmg: 25, range: 2.2, atkSpeed: 550, shape: 'arc', arc: 1.0, knockback: true, desc: 'Урон: 25 | Откидывает' },

  yoyo_wood: { name: 'Деревянный йойо', icon: '🪀', type: 'weapon', dmg: 8, range: 4.0, atkSpeed: 400, shape: 'boomerang', desc: 'Урон: 8 | Дальность: 4.0' },
  yoyo_iron: { name: 'Железный йойо', icon: '🪀', type: 'weapon', dmg: 18, range: 5.0, atkSpeed: 350, shape: 'boomerang', desc: 'Урон: 18 | Дальность: 5.0' },

  // ==========================================
  // ============ ОРУЖИЕ (ДАЛЬНИЙ) ============
  // ==========================================
  bow_wood: { name: 'Короткий лук', icon: '🏹', type: 'weapon', dmg: 12, range: 7.0, atkSpeed: 700, shape: 'projectile', projSpeed: 0.5, desc: 'Урон: 12 | Дальность: 7' },
  bow_iron: { name: 'Длинный лук', icon: '🏹', type: 'weapon', dmg: 25, range: 10.0, atkSpeed: 600, shape: 'projectile', projSpeed: 0.6, desc: 'Урон: 25 | Дальность: 10' },
  bow_cobalt: { name: 'Кобальтовый лук', icon: '🏹', type: 'weapon', dmg: 40, range: 12.0, atkSpeed: 500, shape: 'projectile', projSpeed: 0.7, desc: 'Урон: 40 | Дальность: 12' },

  shuriken_iron: { name: 'Железный сюрикен', icon: '🌀', type: 'weapon', dmg: 10, range: 6.0, atkSpeed: 300, shape: 'projectile', projSpeed: 0.7, desc: 'Урон: 10 | Скорость: 0.3с' },
  shuriken_poison: { name: 'Отравленный сюрикен', icon: '🌀', type: 'weapon', dmg: 8, range: 6.0, atkSpeed: 300, shape: 'projectile', projSpeed: 0.7, poison: true, desc: 'Урон: 8 | Яд' },

  snowball: { name: 'Снежная пушка', icon: '❄️', type: 'weapon', dmg: 6, range: 5.0, atkSpeed: 800, shape: 'cone', arc: 0.5, slow: true, desc: 'Урон: 6 | Замедление' },

  star_pistol: { name: 'Звёздный пистолет', icon: '🔫', type: 'weapon', dmg: 35, range: 12.0, atkSpeed: 400, shape: 'ray', desc: 'Урон: 35 | Дальность: 12' },
  star_rifle: { name: 'Звёздная винтовка', icon: '🔫', type: 'weapon', dmg: 60, range: 15.0, atkSpeed: 700, shape: 'ray', desc: 'Урон: 60 | Дальность: 15' },

  // ==========================================
  // ================ МАГИЯ ===================
  // ==========================================
  staff_fire: { name: 'Посох огня', icon: '🪄', type: 'weapon', dmg: 30, range: 6.0, atkSpeed: 800, shape: 'aoe_proj', aoeRadius: 2.0, desc: 'Урон: 30 | AoE' },
  staff_ice: { name: 'Посох льда', icon: '🪄', type: 'weapon', dmg: 20, range: 6.0, atkSpeed: 700, shape: 'aoe_proj', aoeRadius: 2.0, slow: true, desc: 'Урон: 20 | Замедление' },
  book_lightning: { name: 'Книга молний', icon: '📖', type: 'weapon', dmg: 50, range: 5.0, atkSpeed: 1000, shape: 'chain', desc: 'Урон: 50 | Цепная молния' },
  book_heal: { name: 'Книга исцеления', icon: '📖', type: 'weapon', dmg: 0, range: 3.0, atkSpeed: 2000, shape: 'heal', heal: 50, desc: 'Лечит 50 HP' },
  staff_summon: { name: 'Посох призыва', icon: '🌿', type: 'weapon', dmg: 0, range: 3.0, atkSpeed: 1500, shape: 'summon', desc: 'Призывает питомца' },

  // ==========================================
  // ============== ИНСТРУМЕНТЫ ===============
  // ==========================================
  pickaxe_wood: { name: 'Деревянная кирка', icon: '⛏️', type: 'tool', tier: 1, atkSpeed: 500, desc: 'Уровень добычи: 1' },
  pickaxe_stone: { name: 'Каменная кирка', icon: '⛏️', type: 'tool', tier: 2, atkSpeed: 450, desc: 'Уровень добычи: 2' },
  pickaxe_iron: { name: 'Железная кирка', icon: '⛏️', type: 'tool', tier: 3, atkSpeed: 400, desc: 'Уровень добычи: 3' },
  pickaxe_cobalt: { name: 'Кобальтовая кирка', icon: '💠', type: 'tool', tier: 4, atkSpeed: 350, desc: 'Уровень добычи: 4' },
  pickaxe_adamantite: { name: 'Адамантитовая кирка', icon: '🟢', type: 'tool', tier: 5, atkSpeed: 300, desc: 'Уровень добычи: 5' },
  pickaxe_holy: { name: 'Святая кирка', icon: '✨', type: 'tool', tier: 6, atkSpeed: 250, desc: 'Уровень добычи: 6' },
  
  axe_wood: { name: 'Деревянный топор', icon: '🪓', type: 'tool', tier: 1, atkSpeed: 500, desc: 'Уровень добычи: 1' },
  axe_stone: { name: 'Каменный топор', icon: '🪓', type: 'tool', tier: 2, atkSpeed: 450, desc: 'Уровень добычи: 2' },
  axe_iron: { name: 'Железный топор', icon: '🪓', type: 'tool', tier: 3, atkSpeed: 400, desc: 'Уровень добычи: 3' },
  axe_cobalt: { name: 'Кобальтовый топор', icon: '💠', type: 'tool', tier: 4, atkSpeed: 350, desc: 'Уровень добычи: 4' },
  
  fishing_rod: { name: 'Удочка', icon: '🎣', type: 'tool', tier: 1, desc: 'Для рыбалки.' },

  // ==========================================
  // ================= БРОНЯ ==================
  // ==========================================
  helmet_leather: { name: 'Кожаный шлем', icon: '🪖', type: 'armor', slot: 'helmet', def: 3, desc: 'Защита: 3' },
  helmet_iron: { name: 'Железный шлем', icon: '🪖', type: 'armor', slot: 'helmet', def: 8, desc: 'Защита: 8' },
  helmet_cobalt: { name: 'Кобальтовый шлем', icon: '💠', type: 'armor', slot: 'helmet', def: 15, desc: 'Защита: 15' },
  helmet_adamantite: { name: 'Адамантитовый шлем', icon: '🟢', type: 'armor', slot: 'helmet', def: 25, desc: 'Защита: 25' },
  helmet_holy: { name: 'Святой шлем', icon: '✨', type: 'armor', slot: 'helmet', def: 40, desc: 'Защита: 40' },
  
  chest_leather: { name: 'Кожаная броня', icon: '🥋', type: 'armor', slot: 'chest', def: 5, desc: 'Защита: 5' },
  chest_iron: { name: 'Железная броня', icon: '🥋', type: 'armor', slot: 'chest', def: 15, desc: 'Защита: 15' },
  chest_cobalt: { name: 'Кобальтовая броня', icon: '💠', type: 'armor', slot: 'chest', def: 25, desc: 'Защита: 25' },
  chest_adamantite: { name: 'Адамантитовая броня', icon: '🟢', type: 'armor', slot: 'chest', def: 40, desc: 'Защита: 40' },
  chest_holy: { name: 'Святая броня', icon: '✨', type: 'armor', slot: 'chest', def: 60, desc: 'Защита: 60' },
  
  legs_leather: { name: 'Кожаные штаны', icon: '👖', type: 'armor', slot: 'legs', def: 4, desc: 'Защита: 4' },
  legs_iron: { name: 'Железные штаны', icon: '👖', type: 'armor', slot: 'legs', def: 12, desc: 'Защита: 12' },
  legs_cobalt: { name: 'Кобальтовые штаны', icon: '💠', type: 'armor', slot: 'legs', def: 20, desc: 'Защита: 20' },
  
  boots_leather: { name: 'Кожаные ботинки', icon: '👢', type: 'armor', slot: 'boots', def: 2, desc: 'Защита: 2' },
  boots_iron: { name: 'Железные ботинки', icon: '👢', type: 'armor', slot: 'boots', def: 6, desc: 'Защита: 6' },
  boots_cobalt: { name: 'Кобальтовые ботинки', icon: '💠', type: 'armor', slot: 'boots', def: 10, desc: 'Защита: 10' },
  
  shield_wood: { name: 'Деревянный щит', icon: '🛡️', type: 'armor', slot: 'shield', def: 8, desc: 'Защита: 8 | Блок 200°' },
  shield_iron: { name: 'Железный щит', icon: '🛡️', type: 'armor', slot: 'shield', def: 20, desc: 'Защита: 20 | Блок 200°' },
  shield_cobalt: { name: 'Кобальтовый щит', icon: '💠', type: 'armor', slot: 'shield', def: 35, desc: 'Защита: 35 | Блок 200°' },
  
  ring_gold: { name: 'Золотое кольцо', icon: '💍', type: 'armor', slot: 'ring', def: 0, desc: 'Аксессуар.' },

  // ==========================================
  // ================= СТАНКИ =================
  // ==========================================
  station_workbench: { name: 'Верстак', icon: '🔨', type: 'station', desc: 'Базовые инструменты и оружие.' },
  station_furnace: { name: 'Печь', icon: '🔥', type: 'station', desc: 'Переплавка руды и готовка.' },
  station_forge: { name: 'Кузница', icon: '⚒️', type: 'station', desc: 'Продвинутое оружие и броня.' },
  station_anvil: { name: 'Наковальня', icon: '🛠️', type: 'station', desc: 'Кобальт, Адамантит, Святая руда.' },
  station_spinning: { name: 'Прялка', icon: '🧵', type: 'station', desc: 'Создание нитей.' },
};

// ==========================================
// ============== РЕЦЕПТЫ КРАФТА ============
// ==========================================
export const RECIPES = {
  // --- Уровень 1: Верстак (Базовый) ---
  sword_wood: { station: 'workbench', cost: { wood: 5 } },
  pickaxe_wood: { station: 'workbench', cost: { wood: 5 } },
  axe_wood: { station: 'workbench', cost: { wood: 5 } },
  bat_wood: { station: 'workbench', cost: { wood: 8 } },
  bow_wood: { station: 'workbench', cost: { wood: 10, string: 2 } },
  yoyo_wood: { station: 'workbench', cost: { wood: 5, string: 2 } },
  shield_wood: { station: 'workbench', cost: { wood: 8 } },
  helmet_leather: { station: 'workbench', cost: { leather: 3 } },
  chest_leather: { station: 'workbench', cost: { leather: 5 } },
  legs_leather: { station: 'workbench', cost: { leather: 4 } },
  boots_leather: { station: 'workbench', cost: { leather: 2 } },
  station_furnace: { station: 'workbench', cost: { stone: 20 } },
  station_spinning: { station: 'workbench', cost: { wood: 10, stone: 5 } },
  station_anvil: { station: 'workbench', cost: { stone: 20, iron_ingot: 5 } },

  // --- Уровень 2: Печь (Переплавка) ---
  iron_ingot: { station: 'furnace', cost: { iron_ore: 2 } },
  cobalt_ingot: { station: 'furnace', cost: { cobalt_ore: 2 } },
  adamantite_ingot: { station: 'furnace', cost: { adamantite_ore: 2 } },
  holy_ingot: { station: 'furnace', cost: { holy_ore: 2 } },
  bread: { station: 'furnace', cost: { wood: 2 } },
  meat_cooked: { station: 'furnace', cost: { wood: 1, bone: 1 } },
  fish_cooked: { station: 'furnace', cost: { wood: 1 } },

  // --- Уровень 3: Кузница (Железо) ---
  sword_stone: { station: 'workbench', cost: { wood: 2, stone: 5 } },
  spear_stone: { station: 'workbench', cost: { wood: 3, stone: 5 } },
  sword_iron: { station: 'forge', cost: { wood: 2, iron_ingot: 5 } },
  spear_iron: { station: 'forge', cost: { wood: 3, iron_ingot: 5 } },
  bat_iron: { station: 'forge', cost: { wood: 5, iron_ingot: 5 } },
  bow_iron: { station: 'forge', cost: { wood: 5, iron_ingot: 5, string: 2 } },
  yoyo_iron: { station: 'forge', cost: { wood: 2, iron_ingot: 5, string: 2 } },
  pickaxe_iron: { station: 'forge', cost: { wood: 2, iron_ingot: 5 } },
  axe_iron: { station: 'forge', cost: { wood: 2, iron_ingot: 5 } },
  shield_iron: { station: 'forge', cost: { wood: 5, iron_ingot: 8 } },
  helmet_iron: { station: 'forge', cost: { iron_ingot: 5 } },
  chest_iron: { station: 'forge', cost: { iron_ingot: 8 } },
  legs_iron: { station: 'forge', cost: { iron_ingot: 7 } },
  boots_iron: { station: 'forge', cost: { iron_ingot: 4 } },
  shuriken_iron: { station: 'forge', cost: { iron_ingot: 3 } },
  snowball: { station: 'forge', cost: { iron_ingot: 5, stone: 5 } },
  star_pistol: { station: 'forge', cost: { iron_ingot: 10, diamond: 3 } },
  staff_fire: { station: 'forge', cost: { wood: 10, stone: 5 } },
  book_heal: { station: 'forge', cost: { leather: 3, magic_crystal: 1 } },

  // --- Уровень 4: Наковальня (Кобальт) ---
  sword_cobalt: { station: 'anvil', cost: { cobalt_ingot: 5 } },
  spear_cobalt: { station: 'anvil', cost: { cobalt_ingot: 5, wood: 3 } },
  bow_cobalt: { station: 'anvil', cost: { cobalt_ingot: 5, string: 2 } },
  pickaxe_cobalt: { station: 'anvil', cost: { cobalt_ingot: 5, wood: 2 } },
  axe_cobalt: { station: 'anvil', cost: { cobalt_ingot: 5, wood: 2 } },
  helmet_cobalt: { station: 'anvil', cost: { cobalt_ingot: 5 } },
  chest_cobalt: { station: 'anvil', cost: { cobalt_ingot: 8 } },
  legs_cobalt: { station: 'anvil', cost: { cobalt_ingot: 7 } },
  boots_cobalt: { station: 'anvil', cost: { cobalt_ingot: 4 } },
  shield_cobalt: { station: 'anvil', cost: { cobalt_ingot: 8, wood: 5 } },

  // --- Уровень 5: Наковальня (Адамантит) ---
  sword_adamantite: { station: 'anvil', cost: { adamantite_ingot: 5 } },
  pickaxe_adamantite: { station: 'anvil', cost: { adamantite_ingot: 5, wood: 2 } },
  helmet_adamantite: { station: 'anvil', cost: { adamantite_ingot: 5 } },
  chest_adamantite: { station: 'anvil', cost: { adamantite_ingot: 8 } },
  star_rifle: { station: 'anvil', cost: { adamantite_ingot: 10, diamond: 5 } },
  book_lightning: { station: 'anvil', cost: { adamantite_ingot: 5, magic_crystal: 5 } },

  // --- Уровень 6: Наковальня (Святая руда) ---
  sword_holy: { station: 'anvil', cost: { holy_ingot: 10 } },
  pickaxe_holy: { station: 'anvil', cost: { holy_ingot: 8, wood: 2 } },
  helmet_holy: { station: 'anvil', cost: { holy_ingot: 8 } },
  chest_holy: { station: 'anvil', cost: { holy_ingot: 12 } },
  ring_gold: { station: 'anvil', cost: { gold_ore: 3 } },
  staff_summon: { station: 'anvil', cost: { holy_ingot: 5, bone: 10, magic_crystal: 3 } },
};