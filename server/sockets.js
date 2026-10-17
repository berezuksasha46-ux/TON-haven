import { Server } from 'socket.io';
import { pool } from './db.js';
import { resolveAttack, shieldBlocks, canEat, applyWear } from './game/combat.js';
import { ITEMS, ZONES, isSafeZone, spawnPointForZone } from './game/world.js';
import { onPlayerKill, isRed } from './game/pk.js';
import { stationRecipes, canCraft } from './game/crafting.js';
import { listOnMarket, buyFromMarket, p2pTrade, scavengerPrice } from './game/economy.js';
import { createClan, inviteToClan } from './game/clans.js';

export function initSockets(httpServer) {
  const io = new Server(httpServer, { cors: { origin: '*' } });

  // Пространственные комнаты (in-memory): zone -> Map<playerId, state>
  const zones = new Map();
  // island rooms: islandId -> Map<playerId, state>
  const islands = new Map();
  // trade sessions
  const tradeSessions = new Map();

  io.use((socket, next) => {
    // авторизация JWT уже проверена HTTP-роутом; здесь берём playerId из handshake
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
      id: playerId,
      zone: 'hub',
      x: 0, y: 0,
      angle: 0,
      hp: dbp.hp,
      maxHp: dbp.max_hp,
      weapon: null,
      shield: null,
      isBlocking: false,
      lastFoodAt: dbp.last_food_at,
      buffs: {},
      isRed: isRed(dbp)
    };
    const spawn = spawnPointForZone('hub', playerId);
    state.x = spawn.x; state.y = spawn.y;
    joinZone('hub', state);
    socket.emit('welcome', { state, zones: Object.keys(ZONES), items: ITEMS });

    /* ---------- MOVEMENT ---------- */
    socket.on('move', ({ x, y, angle }) => {
      state.x = clamp(x, 0, 1000);
      state.y = clamp(y, 0, 1000);
      state.angle = angle;
      broadcastZone();
    });

    /* ---------- ZONE SWITCH ---------- */
    socket.on('setZone', ({ zone }) => {
      if (!ZONES[zone]) return;
      leaveZone();
      state.zone = zone;
      const sp = spawnPointForZone(zone, playerId);
      state.x = sp.x; state.y = sp.y;
      joinZone(zone, state);
      socket.emit('zoneChanged', { zone, x: state.x, y: state.y });
      broadcastZone();
    });

    /* ---------- ATTACK ---------- */
    socket.on('attack', async ({ targetId, angle, isBlocking }) => {
      state.isBlocking = !!isBlocking;
      if (state.isBlocking) return; // нельзя бить со щитом
      if (isSafeZone(state.zone) && !state.isRed) return;

      const map = zones.get(state.zone);
      const target = map?.get(targetId);
      if (!target) return;

      // Проверка: PvP разрешено только в wild или если кто-то red
      if (state.zone !== 'wild' && !state.isRed && !target.isRed) return;

      // Щит жертвы
      if (target.isBlocking && shieldBlocks(target.shield, target.angle, angle)) {
        socket.emit('attackResult', { hit: false, reason: 'blocked' });
        return;
      }

      const res = resolveAttack({
        attacker: state, target, weaponId: state.weapon, angle, isBlocking: state.isBlocking
      });
      socket.emit('attackResult', res);
      if (!res.hit) return;

      // Щит атакующего не даёт бить — проверено выше. Наносим урон.
      target.hp -= res.dmg;
      if (target.hp <= 0) {
        await handleDeath(target, state);
      } else {
        io.to(String(target.id)).emit('damaged', { hp: target.hp, from: state.id });
      }
      broadcastZone();
    });

    /* ---------- SHIELD ---------- */
    socket.on('shield', ({ on }) => { state.isBlocking = !!on; broadcastZone(); });

    /* ---------- EAT ---------- */
    socket.on('eat', async ({ itemId }) => {
      const item = ITEMS[itemId];
      if (!item || item.kind !== 'food') return;
      if (!canEat(state.lastFoodAt)) return socket.emit('eatResult', { ok:false, reason:'cooldown' });

      // списание
      const r = await pool.query(
        `UPDATE inventory SET qty=qty-1
         WHERE id=(SELECT id FROM inventory WHERE player_id=$1 AND item_id=$2 AND qty>0 LIMIT 1)
         RETURNING id`, [playerId, itemId]
      );
      if (!r.rowCount) return socket.emit('eatResult', { ok:false, reason:'no-item' });

      state.hp = Math.min(state.maxHp, state.hp + (item.hp || 0));
      state.lastFoodAt = new Date();
      await pool.query(`UPDATE players SET hp=$1,last_food_at=$2 WHERE id=$3`, [state.hp, state.lastFoodAt, playerId]);

      // баффы
      if (item.buffs && Object.keys(item.buffs).length) {
        const { dur = 30, ...rest } = item.buffs;
        state.buffs = { ...rest, until: Date.now() + dur * 1000 };
      }
      socket.emit('eatResult', { ok:true, hp: state.hp, buffs: state.buffs });
    });

    /* ---------- TELEPORT HOME (10s, отмена при получении урона) ---------- */
    let tpTimer = null;
    socket.on('goHome', () => {
      if (state.zone === 'island') {
        enterIsland(playerId);
        return;
      }
      socket.emit('tpStart', { seconds: 10 });
      tpTimer = setTimeout(() => {
        enterIsland(playerId);
      }, 10_000);
    });
    socket.on('cancelTp', () => { clearTimeout(tpTimer); socket.emit('tpCancel'); });

    /* ---------- ISLANDS ---------- */
    function enterIsland(ownerPlayerId) {
      leaveZone();
      state.zone = 'island';
      const room = String(ownerPlayerId);
      if (!islands.has(room)) islands.set(room, new Map());
      islands.get(room).set(playerId, state);
      socket.join(room);
      socket.emit('islandEntered', { ownerId: ownerPlayerId });
      broadcastIsland(room);
    }

    socket.on('visitIsland', ({ ownerId }) => {
      enterIsland(ownerId);
    });

    socket.on('leaveIsland', () => {
      leaveZone();
      state.zone = 'hub';
      const sp = spawnPointForZone('hub', playerId);
      state.x = sp.x; state.y = sp.y;
      joinZone('hub', state);
      socket.emit('zoneChanged', { zone:'hub', x:state.x, y:state.y });
      broadcastZone();
    });

    socket.on('placeOnIsland', async ({ islandOwnerId, gridX, gridY, itemId }) => {
      // Разрешение: только владелец, размер острова, тип объекта
      if (islandOwnerId !== playerId) return;
      const it = ITEMS[itemId];
      if (!it || it.kind !== 'station') return;
      const r = await pool.query(
        `UPDATE inventory SET qty=qty-1
         WHERE id=(SELECT id FROM inventory WHERE player_id=$1 AND item_id=$2 AND qty>0 LIMIT 1) RETURNING id`,
        [playerId, itemId]
      );
      if (!r.rowCount) return;
      const isl = await pool.query(`SELECT * FROM islands WHERE owner_id=$1 LIMIT 1`, [playerId]);
      if (!isl.rowCount) return socket.emit('placeResult', { ok:false, reason:'no-island' });
      const data = isl.rows[0].data || {};
      data[`${gridX},${gridY}`] = { item: itemId };
      await pool.query(`UPDATE islands SET data=$1 WHERE id=$2`, [data, isl.rows[0].id]);
      socket.emit('placeResult', { ok:true });
      io.to(String(playerId)).emit('islandUpdated', { data });
    });

        /* ---------- STATION / CRAFT ---------- */
    socket.on('craft', async ({ recipeId, stationItemId }) => {
      const inv = (await pool.query(`SELECT item_id, qty FROM inventory WHERE player_id=$1`, [playerId])).rows;
      const res = canCraft(inv, recipeId, stationItemId);
      if (!res.ok) return socket.emit('craftResult', res);

      // Списываем ресурсы
      for (const [id, qty] of Object.entries(res.recipe.cost)) {
        await pool.query(
          `UPDATE inventory SET qty=qty-$1 
           WHERE id=(SELECT id FROM inventory WHERE player_id=$2 AND item_id=$3 AND qty>=$1 LIMIT 1)`,
          [qty, playerId, id]
        );
      }
      
      // Выдаем скрафченный предмет
      await pool.query(`INSERT INTO inventory(player_id,item_id,qty) VALUES($1,$2,1)`, [playerId, res.recipe.gives]);
      socket.emit('craftResult', { ok: true, gives: res.recipe.gives });
    });

    /* ---------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---------- */
    // (Они должны быть внутри io.on('connection'), поэтому пишем их здесь)

    function joinZone(zone, st) {
      if (!zones.has(zone)) zones.set(zone, new Map());
      zones.get(zone).set(st.id, st);
      socket.join('zone:' + zone);
    }

    function leaveZone() {
      const map = zones.get(state.zone);
      if (map) map.delete(state.id);
      socket.leave('zone:' + state.zone);
      if (state.zone === 'island') {
        for (const [room, m] of islands) {
          if (m.delete(state.id)) { 
            if (islands.has(room)) io.to(room).emit('islandState', [...m.values()]); 
            break; 
          }
        }
      }
    }

    function broadcastZone() {
      const map = zones.get(state.zone);
      if (map) io.to('zone:' + state.zone).emit('zoneState', [...map.values()]);
    }

    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

    async function handleDeath(victim, killer) {
      victim.hp = victim.maxHp;
      const sp = spawnPointForZone('hub', victim.id);
      victim.x = sp.x; victim.y = sp.y; victim.zone = 'hub';
      
      await pool.query(`UPDATE players SET hp=$1 WHERE id=$2`, [victim.hp, victim.id]);
      if (killer) await onPlayerKill(killer.id, victim.id);
      
      io.to(String(victim.id)).emit('died', { respawn: 'hub' });
      broadcastZone();
    }

  }); // <-- Эта скобка закрывает io.on('connection', async (socket) => {
} // <-- Эта скобка закрывает export function initSockets(httpServer) {