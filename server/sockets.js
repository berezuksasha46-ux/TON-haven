import { Server } from 'socket.io';
import { pool } from './db.js';
import { resolveAttack, shieldBlocks, canEat, applyWear } from './game/combat.js';
import { ITEMS, ZONES, isSafeZone, spawnPointForZone } from './game/world.js';
import { onPlayerKill, isRed } from './game/pk.js';
import { stationRecipes, canCraft } from './game/crafting.js';
import { listOnMarket, buyFromMarket, p2pTrade, scavengerPrice } from './game/economy.js';
import { createClan, inviteToClan } from './game/clans.js';

// --- СОЗДАЕМ МОБОВ (Тестовые) ---
export const mobs = [
  { id: 'mob_1', x: 45, y: 40, hp: 100, maxHp: 100, alive: true, type: 'slime' },
  { id: 'mob_2', x: 50, y: 50, hp: 100, maxHp: 100, alive: true, type: 'slime' },
  { id: 'mob_3', x: 35, y: 30, hp: 100, maxHp: 100, alive: true, type: 'slime' },
  { id: 'mob_4', x: 60, y: 40, hp: 100, maxHp: 100, alive: true, type: 'slime' },
  { id: 'mob_5', x: 40, y: 60, hp: 100, maxHp: 100, alive: true, type: 'slime' },
];

export function initSockets(httpServer) {
  const io = new Server(httpServer, { cors: { origin: '*' } });
  const zones = new Map();
  const islands = new Map();

  io.use((socket, next) => {
    const { playerId } = socket.handshake.auth || {};
    if (!playerId) return next(new Error('no-auth'));
    socket.playerId = Number(playerId);
    next();
  });

  io.on('connection', async (socket) => {
    const playerId = socket.playerId;
    const dbp = (await pool.query(`SELECT * FROM players WHERE id=$1`, [playerId])).rows[0];
    if (!dbp) return socket.disconnect(true);

    const state = {
      id: playerId, zone: 'hub', x: 40, y: 40, angle: 0,
      hp: dbp.hp, maxHp: dbp.max_hp, weapon: 'sword_wood', shield: null,
      isBlocking: false, lastFoodAt: dbp.last_food_at, buffs: {}, isRed: isRed(dbp)
    };
    
    const spawn = spawnPointForZone('hub', playerId);
    state.x = spawn.x; state.y = spawn.y;
    joinZone('hub', state);
    socket.emit('welcome', { state, zones: Object.keys(ZONES), items: ITEMS });
    broadcastZone();

    /* ---------- MOVEMENT ---------- */
    socket.on('move', ({ x, y, angle }) => {
      state.x = clamp(x, -1000, 1000);
      state.y = clamp(y, -1000, 1000);
      state.angle = angle;
      broadcastZone();
    });

    /* ---------- ATTACK (По отпусканию джойстика) ---------- */
    socket.on('attack', ({ angle }) => {
      const weapon = ITEMS[state.weapon] || ITEMS['sword_wood'];
      const range = 2.0; // Радиус удара (в клетках)
      const arc = 0.6;   // Ширина конуса (в радианах)

      let hitSomething = false;

      mobs.forEach(mob => {
        if (!mob.alive) return;
        const dist = Math.hypot(mob.x - state.x, mob.y - state.y);
        
        if (dist <= range) {
          // Проверка попадания в конус
          const a = Math.atan2(mob.y - state.y, mob.x - state.x);
          let delta = Math.abs(a - angle);
          while (delta > Math.PI) delta = Math.abs(delta - Math.PI * 2);
          
          if (delta <= arc) {
            mob.hp -= weapon.dmg || 20;
            hitSomething = true;
            if (mob.hp <= 0) {
              mob.alive = false;
              socket.emit('loot', { item: 'wood', qty: 2 });
              // Респавн моба через 5 секунд
              setTimeout(() => { mob.hp = mob.maxHp; mob.alive = true; broadcastZone(); }, 5000);
            }
          }
        }
      });

      if (hitSomething) broadcastZone();
    });

    /* ---------- EAT ---------- */
    socket.on('eat', async ({ itemId }) => {
      const item = ITEMS[itemId];
      if (!item || item.kind !== 'food') return;
      if (!canEat(state.lastFoodAt)) return socket.emit('eatResult', { ok:false, reason:'cooldown' });

      const r = await pool.query(
        `UPDATE inventory SET qty=qty-1 WHERE id=(SELECT id FROM inventory WHERE player_id=$1 AND item_id=$2 AND qty>0 LIMIT 1) RETURNING id`,
        [playerId, itemId]
      );
      if (!r.rowCount) return socket.emit('eatResult', { ok:false, reason:'no-item' });

      state.hp = Math.min(state.maxHp, state.hp + (item.hp || 0));
      state.lastFoodAt = new Date();
      await pool.query(`UPDATE players SET hp=$1,last_food_at=$2 WHERE id=$3`, [state.hp, state.lastFoodAt, playerId]);
      socket.emit('eatResult', { ok:true, hp: state.hp });
    });

    /* ---------- LEAVE ---------- */
    socket.on('disconnect', () => { leaveZone(); });

    /* ---------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---------- */
    function joinZone(zone, st) {
      if (!zones.has(zone)) zones.set(zone, new Map());
      zones.get(zone).set(st.id, st);
      socket.join('zone:' + zone);
    }
    function leaveZone() {
      const map = zones.get(state.zone);
      if (map) map.delete(state.id);
      socket.leave('zone:' + state.zone);
      broadcastZone();
    }
    function broadcastZone() {
      const map = zones.get(state.zone);
      if (map) {
        io.to('zone:' + state.zone).emit('zoneState', [...map.values()], mobs);
      }
    }
    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  });
}