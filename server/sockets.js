import { Server } from 'socket.io';
import { pool } from './db.js';
import { ITEMS, ZONES } from './game/world.js';

export const worldResources = [
  { id: 'tree_1', type: 'tree', x: 42, y: 38, hp: 100 },
  { id: 'stone_1', type: 'stone', x: 45, y: 48, hp: 150 },
];

export const mobs = [
  { id: 'mob_1', x: 45, y: 40, hp: 100, maxHp: 100, alive: true, speed: 0.02 },
];

let droppedItems = [];
let projectiles = [];
let projIdCounter = 0;

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

    const invData = (await pool.query(`SELECT item_id, qty FROM inventory WHERE player_id=$1`, [playerId])).rows;
    const inventory = {};
    invData.forEach(i => inventory[i.item_id] = i.qty);

    const state = {
      id: playerId, zone: 'hub', x: 40, y: 40, angle: 0,
      hp: dbp.hp, maxHp: dbp.max_hp,
      hotbar: ['apple', 'sword', 'pickaxe', 'shield_wood'], // В слотах быстрого доступа
      activeSlot: 0,
      equipment: { helmet: null, chest: null, legs: null, boots: null, shield: null, ring: null },
      isBlocking: false,
      inv: inventory, lastFoodAt: dbp.last_food_at
    };
    
    // Автоматически надеваем щит, если он есть в инвентаре (для теста)
    if (state.inv['shield_wood'] > 0) {
      state.equipment.shield = 'shield_wood';
    }

    joinZone('hub', state);
    socket.emit('welcome', { state });
    broadcastZone();

    socket.on('move', ({ x, y, angle }) => {
      state.x = x; state.y = y; state.angle = angle;
      broadcastZone();
      // Автоподбор лута
      for (let i = droppedItems.length - 1; i >= 0; i--) {
        const item = droppedItems[i];
        if (Math.hypot(item.x - x, item.y - y) < 1.5) {
          state.inv[item.itemId] = (state.inv[item.itemId] || 0) + item.qty;
          pool.query(`INSERT INTO inventory(player_id, item_id, qty) VALUES($1, $2, $3) ON CONFLICT(player_id, item_id) DO UPDATE SET qty = inventory.qty + EXCLUDED.qty`, [playerId, item.itemId, item.qty]);
          socket.emit('updateInv', state.inv);
          droppedItems.splice(i, 1);
          broadcastZone();
        }
      }
    });

    // Выбор активного слота (1-4)
    socket.on('selectSlot', ({ slot }) => {
      state.activeSlot = slot;
      broadcastZone();
    });

    // Экипировка (перетаскивание в слот брони)
    socket.on('equipItem', ({ slot, itemId }) => {
      state.equipment[slot] = itemId;
      broadcastZone();
    });

    socket.on('shield', ({ active }) => {
      if (!state.equipment.shield) return; // Нельзя блокировать без щита
      state.isBlocking = active;
      broadcastZone();
    });

    socket.on('attack', ({ angle }) => {
      if (state.isBlocking) return; // Нельзя бить в блоке
      
      const activeItem = state.hotbar[state.activeSlot];
      if (!activeItem) return;

      let range = 2.0;
      if (activeItem === 'sword') range = 2.5;
      if (activeItem === 'bow') range = 6.0;
      if (activeItem === 'pickaxe') range = 1.5;

      // Атака оружием
      if (activeItem === 'bow') {
        projectiles.push({ id: ++projIdCounter, type: 'arrow', x: state.x, y: state.y, dx: Math.cos(angle)*0.4, dy: Math.sin(angle)*0.4, ownerId: playerId, life: 60 });
        return broadcastZone();
      }

      // Ближний бой / Добыча
      let hit = false;
      worldResources.forEach(res => {
        if (res.hp <= 0) return;
        const dist = Math.hypot(res.x - state.x, res.y - state.y);
        if (dist <= range) {
          const a = Math.atan2(res.y - state.y, res.x - state.x);
          let delta = Math.abs(a - angle); while (delta > Math.PI) delta = Math.abs(delta - Math.PI * 2);
          if (delta <= 0.6) {
            hit = true; res.hp -= (activeItem === 'pickaxe' ? 25 : 5);
            if (res.hp <= 0) {
              droppedItems.push({ x: res.x, y: res.y, itemId: res.type === 'tree' ? 'wood' : 'stone', qty: 5 });
              setTimeout(() => { res.hp = res.type === 'tree' ? 100 : 150; broadcastZone(); }, 10000);
            }
          }
        }
      });

      mobs.forEach(mob => {
        if (!mob.alive) return;
        const dist = Math.hypot(mob.x - state.x, mob.y - state.y);
        if (dist <= range) {
          const a = Math.atan2(mob.y - state.y, mob.x - state.x);
          let delta = Math.abs(a - angle); while (delta > Math.PI) delta = Math.abs(delta - Math.PI * 2);
          if (delta <= 0.6) {
            hit = true; mob.hp -= (activeItem === 'sword' ? 30 : 10);
            if (mob.hp <= 0) { mob.alive = false; droppedItems.push({ x: mob.x, y: mob.y, itemId: 'wood', qty: 2 }); setTimeout(() => { mob.hp = mob.maxHp; mob.alive = true; broadcastZone(); }, 5000); }
          }
        }
      });
      if (hit) broadcastZone();
    });

    socket.on('disconnect', () => { const map = zones.get(state.zone); if (map) map.delete(state.id); broadcastZone(); });
    function joinZone(zone, st) { if (!zones.has(zone)) zones.set(zone, new Map()); zones.get(zone).set(st.id, st); socket.join('zone:' + zone); }
    function broadcastZone() { const map = zones.get(state.zone); if (map) io.to('zone:' + state.zone).emit('zoneState', [...map.values()], worldResources, mobs, droppedItems, projectiles); }
  });

  setInterval(() => {
    let changed = false;
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i]; p.x += p.dx; p.y += p.dy; p.life--;
      if (p.life <= 0) { projectiles.splice(i, 1); changed = true; continue; }
    }
    if (changed) zones.forEach((map, zone) => io.to('zone:' + zone).emit('zoneState', [...map.values()], worldResources, mobs, droppedItems, projectiles));
  }, 50);
}