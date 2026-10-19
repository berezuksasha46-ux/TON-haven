// ==================================================
// ============ БОЕВАЯ СИСТЕМА (COMBAT) =============
// ==================================================
// Здесь вся математика: попадание, урон, блок, PvP.
// Этот модуль не работает с сетью или БД — только логика.

// ==================================================
// 1. ПРОВЕРКА ГЕОМЕТРИИ ПОПАДАНИЯ
// ==================================================
/**
 * Проверяет, попадает ли цель в зону атаки игрока.
 * @param {Object} attacker - Игрок (x, y, angle)
 * @param {number} targetX - X координата цели
 * @param {number} targetY - Y координата цели
 * @param {Object} weaponData - Данные оружия (shape, range, arc, aoeRadius)
 * @returns {boolean} - true, если попадание
 */
export function isHit(attacker, targetX, targetY, weaponData) {
  const dx = targetX - attacker.x;
  const dy = targetY - attacker.y;
  const dist = Math.hypot(dx, dy);
  
  // Угол до цели
  const angleToTarget = Math.atan2(dy, dx);
  // Разница между углом игрока и углом до цели
  let diff = Math.abs(attacker.angle - angleToTarget);
  // Нормализация (чтобы diff не превышал PI)
  if (diff > Math.PI) diff = Math.PI * 2 - diff;

  // --- Меч, бита, топор (Дуга/Сектор) ---
  if (weaponData.shape === 'arc') {
    return dist <= weaponData.range && diff <= (weaponData.arc || 0.8);
  }
  
  // --- Копьё (Линия/Конус) ---
  if (weaponData.shape === 'line') {
    return dist <= weaponData.range && diff <= (weaponData.arc || 0.3);
  }
  
  // --- Лук, пистолет (Луч) ---
  if (weaponData.shape === 'ray') {
    return dist <= weaponData.range && diff <= 0.1;
  }
  
  // --- Бур, AoE (Круг) ---
  if (weaponData.shape === 'aoe' || weaponData.shape === 'boomerang') {
    return dist <= (weaponData.range || weaponData.aoeRadius || 2.0);
  }

  // --- Снежная пушка (Веер) ---
  if (weaponData.shape === 'cone') {
    return dist <= weaponData.range && diff <= (weaponData.arc || 0.5);
  }

  return false;
}

// ==================================================
// 2. РАСЧЁТ УРОНА (С УЧЁТОМ БРОНИ)
// ==================================================
/**
 * Считает итоговый урон с учётом защиты цели.
 * @param {number} baseDamage - Базовый урон оружия
 * @param {Object} target - Цель (игрок или моб)
 * @param {Object} targetEquip - Экипировка цели (для игроков)
 * @returns {number} - Итоговый урон
 */
export function calculateDamage(baseDamage, target, targetEquip = null) {
  let totalDefense = 0;

  // Если цель — игрок, считаем защиту с его брони
  if (targetEquip) {
    const armorPieces = ['helmet', 'chest', 'legs', 'boots', 'shield', 'ring'];
    for (const slot of armorPieces) {
      if (targetEquip[slot]) {
        // Данные о защите берем из items.js (мы импортируем ITEMS на уровне сервера)
        // Но здесь передаем через параметры, чтобы не было циклической зависимости
        totalDefense += targetEquip[slot].def || 0;
      }
    }
  }

  // Формула: Базовый урон - (Защита * 0.5)
  // Пример: 50 урона - (20 защиты * 0.5) = 40 итогового урона
  let finalDamage = Math.max(1, baseDamage - Math.floor(totalDefense * 0.5));
  
  return finalDamage;
}

// ==================================================
// 3. БЛОК ЩИТОМ (200°)
// ==================================================
/**
 * Проверяет, блокирует ли щит игрока удар.
 * @param {Object} shieldData - Данные щита (если надет)
 * @param {number} playerAngle - Куда смотрит игрок (радианы)
 * @param {number} attackAngle - Откуда идет атака (радианы)
 * @returns {boolean} - true, если удар заблокирован
 */
export function isBlockedByShield(shieldData, playerAngle, attackAngle) {
  if (!shieldData) return false; // Нет щита — нет блока
  
  // Щит блокирует 200° (по ТЗ)
  // 200° = 200 * (Math.PI / 180) ≈ 3.49 радиан
  // Значит, зона блока: от -1.74 до +1.74 от направления игрока
  const blockAngle = (200 * Math.PI / 180) / 2; // Половина угла блока
  
  let diff = Math.abs(playerAngle - attackAngle);
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  
  return diff <= blockAngle;
}

// ==================================================
// 4. PvP (УРОН ПО ДРУГОМУ ИГРОКУ)
// ==================================================
/**
 * Проверяет, может ли игрок А атаковать игрока Б (PvP-правила).
 * @param {Object} attacker - Атакующий
 * @param {Object} target - Цель
 * @param {Object} zones - Настройки зон (передается из sockets.js)
 * @returns {boolean}
 */
export function canAttackPlayer(attacker, target, zones) {
  // В безопасной зоне (Hub) PvP запрещено
  if (zones.isSafe(attacker.zone)) return false;
  
  // Если цель в безопасной зоне, атакующий не может её бить
  if (zones.isSafe(target.zone)) return false;
  
  // Если у цели "красный ник" (PK) — можно бить везде
  if (target.isRed) return true;
  
  // Если атакующий "красный ник" — он может бить везде
  if (attacker.isRed) return true;
  
  // В остальных случаях PvP разрешено только в Wild зоне
  return zones.isPvP(attacker.zone) && zones.isPvP(target.zone);
}

// ==================================================
// 5. КУЛДАУН ЕДЫ (15 СЕКУНД ПО ТЗ)
// ==================================================
/**
 * Проверяет, можно ли поесть (кулдаун 15 сек).
 * @param {number} lastFoodAt - Время последнего приема пищи (timestamp)
 * @returns {boolean}
 */
export function canEat(lastFoodAt) {
  if (!lastFoodAt) return true;
  const cooldown = 15000; // 15 секунд
  return Date.now() - lastFoodAt >= cooldown;
}

// ==================================================
// 6. ПРИМЕНЕНИЕ УРОНА К МОБУ
// ==================================================
/**
 * Наносит урон мобу и возвращает, умер ли он.
 * @param {Object} mob - Моб (hp, maxHp)
 * @param {number} damage - Урон
 * @returns {boolean} - true, если моб умер
 */
export function applyDamageToMob(mob, damage) {
  mob.hp -= damage;
  if (mob.hp <= 0) {
    mob.hp = 0;
    return true; // Моб умер
  }
  return false; // Моб еще жив
}