import { ITEMS, PLAYER_RADIUS, FOOD_CD_MS } from './world.js';

/**
 * Skill-based hit resolution.
 * Вызывается клиентом через сокет при атаке: {angle, isBlocking}
 * Сервер проверяет дистанцию, угол, щит, кулдаун.
 */
export function resolveAttack({ attacker, target, weaponId, angle, isBlocking }) {
  if (isBlocking) return { hit: false, reason: 'blocking' };
  const w = ITEMS[weaponId];
  if (!w || w.kind !== 'weapon') return { hit: false, reason: 'no-weapon' };

  const dx = target.x - attacker.x;
  const dy = target.y - attacker.y;
  const dist = Math.hypot(dx, dy);
  if (dist > w.range) return { hit: false, reason: 'out-of-range' };

  if (w.proj) {
    // Луч: проверяем попадание в конус
    const a = Math.atan2(dy, dx);
    const delta = Math.abs(normAngle(a - angle));
    if (delta > 0.2) return { hit: false, reason: 'miss' };
    return { hit: true, dmg: w.dmg };
  }

  if (w.aoe) {
    if (dist <= w.aoe) return { hit: true, dmg: w.dmg, aoe: true };
    return { hit: false, reason: 'too-far' };
  }

  // Точечное оружие: конус по arc
  const a = Math.atan2(dy, dx);
  const delta = Math.abs(normAngle(a - angle));
  if (delta > (w.arc || 0.4)) return { hit: false, reason: 'miss-arc' };
  return { hit: true, dmg: w.dmg };
}

/**
 * Щит блокирует 200° спереди.
 */
export function shieldBlocks(shieldId, facingAngle, incomingAngle) {
  const s = ITEMS[shieldId];
  if (!s || s.kind !== 'shield') return false;
  const half = (s.block * Math.PI / 180) / 2;
  const delta = Math.abs(normAngle(incomingAngle - facingAngle));
  return delta <= half;
}

export function canEat(lastFoodAt) {
  if (!lastFoodAt) return true;
  return Date.now() - new Date(lastFoodAt).getTime() >= FOOD_CD_MS;
}

function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Durability: если item.limit<=0 и не god → удалить; иначе уменьшить.
 */
export function applyWear(item, amount = 1) {
  if (!item || item.god) return item;
  if (item.durability == null) return item;
  item.durability -= amount;
  if (item.durability <= 0) return null;
  return item;
}