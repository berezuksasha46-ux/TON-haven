import { tx } from '../db.js';

const PK_THRESHOLD = 10;
const RED_DURATION_MS = 3 * 60 * 1000;

/**
 * Вызывается при убийстве игрока игроком в PvP-зоне.
 */
export async function onPlayerKill(killerId, victimId) {
  return tx(async c => {
    const k = await c.query(`SELECT pk_kills, red_until FROM players WHERE id=$1 FOR UPDATE`, [killerId]);
    let kills = k.rows[0].pk_kills + 1;
    let redUntil = k.rows[0].red_until;
    if (kills >= PK_THRESHOLD) {
      redUntil = new Date(Date.now() + RED_DURATION_MS);
      kills = 0;
    }
    await c.query(`UPDATE players SET pk_kills=$1, red_until=$2 WHERE id=$3`, [kills, redUntil, killerId]);
    // потерпевший теряет только лут с мобов (передаётся клиентом на проверку), надетое остаётся
    return { killedPlayer: victimId, redNicknameUntil: redUntil };
  });
}

export function isRed(player, now = new Date()) {
  return player.red_until && new Date(player.red_until) > now;
}

/**
 * Красный ник: защитные зоны на него не действуют.
 */
export function canBeAttacked(attacker, victim) {
  if (isRed(victim) || isRed(attacker)) return true;
  return false; // обычные правила зон проверяются выше
}