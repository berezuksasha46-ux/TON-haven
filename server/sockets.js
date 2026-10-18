import { Server } from 'socket.io';
import { pool } from './db.js';
import { resolveAttack, shieldBlocks, canEat, applyWear } from './game/combat.js';
import { ITEMS, ZONES, isSafeZone, spawnPointForZone } from './game/world.js';
import { onPlayerKill, isRed } from './game/pk.js';
import { stationRecipes, canCraft } from './game/crafting.js';
import { listOnMarket, buyFromMarket, p2pTrade, scavengerPrice } from './game/economy.js';
import { createClan, inviteToClan } from './game/clans.js';

// --- МОБЫ (теперь они умеют двигаться) ---
export const mobs = [
  { id: 'mob_1', x: 45, y: 40, hp: 100, maxHp: 100, alive: true, type: 'slime', speed: 0.02 },
  { id: 'mob_2', x: 50, y: 50, hp: 100, maxHp: 100, alive: true, type: 'slime', speed: 0.02 },
  { id: 'mob_3', x: 35, y: 30, hp: 100, maxHp: 100, alive: true, type: 'slime', speed: 0.02 },
  { id: 'mob_4', x: 60, y: 40, hp: 100, maxHp: 100, alive: true, type: 'slime', speed: 0.02 },
  { id: 'mob_5', x: 40, y: 60, hp: 100, maxHp: 100, alive: true, type: 'slime', speed: 0.02 },
];

export function initSockets(httpServer) {
  const io = new Server(httpServer, { cors: { origin: '*' } });
  const zones = new Map();

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
    
    state.x = 40; state.y = 40; // Спавн ровно в центре
    joinZone('hub', state);
    socket.emit('welcome', { state, zones: Object.keys(ZONES), items: ITEMS });
    broadcastZone();

    /* ---------- ДВИЖЕНИЕ ---------- */
    socket.on('move', ({ x, y, angle }) => {
      state.x = x;
      state.y = y;
      state.angle = angle;
      broadcastZone();
    });

    /* ---------- АТАКА ---------- */
    socket.on('attack', ({ angle }) => {
      const range = 3.0; // Увеличили радиус до 3 клеток
      const arc = 0.8;   // Сделали конус чуть шире

      mobs.forEach(mob => {
        if (!mob.alive) return;
        const dist = Math.hypot(mob.x - state.x, mob.y - state.y);
        
        if (dist <= range) {
          const a = Math.atan2(mob.y - state.y, mob.x - state.x);
          let delta = Math.abs(a - angle);
          while (delta > Math.PI) delta = Math.abs(delta - Math.PI * 2);
          
          if (delta <= arc) {
            mob.hp -= 25; // Урон за удар
            if (mob.hp <= 0) {
              mob.alive = false;
              socket.emit('loot', { item: 'wood', qty: 2 });
              setTimeout(() => { mob.hp = mob.maxHp; mob.alive = true; broadcastZone(); }, 5000);
            }
          }
        }
      });
      broadcastZone();
    });

    socket.on('disconnect', () => { 
      const map = zones.get(state.zone);
      if (map) map.delete(state.id);
      broadcastZone();
    });

    function joinZone(zone, st) {
      if (!zones.has(zone)) zones.set(zone, new Map());
      zones.get(zone).set(st.id, st);
      socket.join('zone:' + zone);
    }

    function broadcastZone() {
      const map = zones.get(state.zone);
      if (map) {
        io.to('zone:' + state.zone).emit('zoneState', [...map.values()], mobs);
      }
    }
  });

  // Движение мобов к игрокам (простой ИИ)
  setInterval(() => {
    let changed = false;
    mobs.forEach(mob => {
      if (!mob.alive) return;
      let nearestPlayer = null;
      let minDist = 999;
      
      zones.forEach(map => {
        map.forEach(p => {
          const d = Math.hypot(p.x - mob.x, p.y - mob.y);
          if (d < minDist) { minDist = d; nearestPlayer = p; }
        });
      });

      if (nearestPlayer && minDist < 10 && minDist > 1.5) {
        const dx = nearestPlayer.x - mob.x;
        const dy = nearestPlayer.y - mob.y;
        const len = Math.hypot(dx, dy);
        mob.x += (dx / len) * mob.speed;
        mob.y += (dy / len) * mob.speed;
        changed = true;
      }
    });
    if (changed) {
      zones.forEach((map, zoneName) => {
        io.to('zone:' + zoneName).emit('zoneState', [...map.values()], mobs);
      });
    }
  }, 100);
}