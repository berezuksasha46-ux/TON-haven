// ==================================================
// ============ СИСТЕМА ЗОН (ZONES) =================
// ==================================================
// Этот модуль определяет, где можно драться, а где нет.
// Соответствует ТЗ: "Центральный Хаб (Спавн): Единственная безопасная зона."
// "Открытый мир: Зоны с мобами, ресурсами и боссами. PvP разрешено."

// ==================================================
// 1. КОНСТАНТЫ ЗОН
// ==================================================
export const ZONES = {
  HUB: {
    id: 'hub',
    name: 'Центральный Хаб',
    isSafe: true,       // Урон отключен
    isPvP: false,       // PvP запрещено
    spawnX: 40,
    spawnY: 40
  },
  WILD: {
    id: 'wild',
    name: 'Дикие Земли',
    isSafe: false,      // Урон включен
    isPvP: true,        // PvP разрешено
    spawnX: 100,
    spawnY: 100
  },
  ISLAND: {
    id: 'island',
    name: 'Личный Остров',
    isSafe: true,       // Остров владельца безопасен
    isPvP: false,       // PvP отключено (только по дуэли)
    spawnX: 0,
    spawnY: 0
  }
};

// ==================================================
// 2. ПРОВЕРКИ ЗОН
// ==================================================

/**
 * Проверяет, является ли зона безопасной (без урона).
 * @param {string} zoneId - ID зоны ('hub', 'wild', 'island')
 * @returns {boolean}
 */
export function isSafe(zoneId) {
  const zone = Object.values(ZONES).find(z => z.id === zoneId);
  return zone ? zone.isSafe : true; // По умолчанию — безопасно
}

/**
 * Проверяет, разрешено ли PvP в зоне.
 * @param {string} zoneId - ID зоны
 * @returns {boolean}
 */
export function isPvP(zoneId) {
  const zone = Object.values(ZONES).find(z => z.id === zoneId);
  return zone ? zone.isPvP : false;
}

/**
 * Возвращает точку спавна для зоны.
 * @param {string} zoneId - ID зоны
 * @param {number} playerId - ID игрока (для случайного разброса)
 * @returns {Object} { x, y }
 */
export function getSpawnPoint(zoneId, playerId) {
  const zone = Object.values(ZONES).find(z => z.id === zoneId) || ZONES.HUB;
  
  // Небольшой разброс, чтобы игроки не спавнились друг на друге
  const offsetX = (playerId % 5) * 2;
  const offsetY = Math.floor(playerId / 5) % 5 * 2;
  
  return { 
    x: zone.spawnX + offsetX, 
    y: zone.spawnY + offsetY 
  };
}

// ==================================================
// 3. ПРОВЕРКА НА "КРАСНЫЙ НИК" (PK)
// ==================================================
/**
 * В ТЗ: "Игрок, убивший 10 людей подряд... получает красный ник на 3 минуты.
 * В этот период для него отключаются защитные зоны".
 * @param {Object} player - Объект игрока (с полем redUntil)
 * @returns {boolean}
 */
export function isRed(player) {
  if (!player.redUntil) return false;
  return new Date(player.redUntil) > new Date();
}

/**
 * Обновляет счетчик убийств (PK).
 * @param {Object} player - Игрок-убийца
 * @returns {Object} - { pkKills, redUntil }
 */
export function updatePKKills(player) {
  player.pkKills = (player.pkKills || 0) + 1;
  
  // Если убил 10 человек — красный ник на 3 минуты
  if (player.pkKills >= 10) {
    player.pkKills = 0;
    player.redUntil = new Date(Date.now() + 3 * 60 * 1000); // 3 минуты
  }
  
  return { pkKills: player.pkKills, redUntil: player.redUntil };
}

// ==================================================
// 4. МОЖНО ЛИ АТАКОВАТЬ (ОБЩАЯ ПРОВЕРКА)
// ==================================================
/**
 * Комплексная проверка: может ли игрок атаковать цель.
 * Учитывает: зону, PvP-флаги, красные ники.
 * @param {Object} attacker - Атакующий
 * @param {Object} target - Цель (игрок или моб)
 * @param {boolean} targetIsMob - true, если цель — моб
 * @returns {boolean}
 */
export function canAttack(attacker, target, targetIsMob = false) {
  // Мобов можно бить в любых зонах (даже в Hub, если они туда забрели)
  if (targetIsMob) {
    return !isSafe(attacker.zone); // В Hub — нельзя, в Wild — можно
  }
  
  // Если цель — игрок:
  // 1. Если зона безопасна и у обоих нет красного ника — нельзя
  if (isSafe(attacker.zone) && !isRed(attacker) && !isRed(target)) {
    return false;
  }
  
  // 2. Если цель в безопасной зоне и не "красная" — нельзя
  if (isSafe(target.zone) && !isRed(target)) {
    return false;
  }
  
  // 3. В остальных случаях PvP разрешено
  return true;
}