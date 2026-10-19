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
    
    // Дефолтные предметы для теста
    if (!inventory['wood']) inventory['wood'] = 5;
    if (!inventory['apple']) inventory['apple'] = 3;
    if (!inventory['shield_wood']) inventory['shield_wood'] = 1;

    const state = {
      id: playerId, zone: 'hub', x: 40, y: 40, angle: 0,
      hp: dbp.hp, maxHp: dbp.max_hp,
      hotbar: ['apple', 'sword', 'pickaxe', null], // Хотбар
      activeSlot: 0,
      equipment: { helmet: null, chest: null, legs: null, boots: null, shield: 'shield_wood', ring: null },
      isBlocking: false,
      inv: inventory, lastFoodAt: dbp.last_food_at
    };
    
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

    // Перетаскивание предметов (Drag and Drop)
    socket.on('moveItem', ({ from, to }) => {
      // from / to: { type: 'inv', index: 0 } или { type: 'hotbar', index: 0 } или { type: 'equip', slot: 'shield' }
      
      if (from.type === 'equip') {
        state.equipment[from.slot] = null;
      } else if (from.type === 'hotbar') {
        state.hotbar[from.index] = null;
      }

      if (to.type === 'equip') {
        state.equipment[to.slot] = from.itemId;
      } else if (to.type === 'hotbar') {
        state.hotbar[to.index] = from.itemId;
      }

      broadcastZone();
    });

    // Использование предмета (клик по хотбару)
    socket.on('useItem', ({ itemId }) => {
      if (itemId === 'apple') {
        if (Date.now() - new Date(state.lastFoodAt).getTime() < 15000) return socket.emit('errorMsg', 'Кулдаун 15 сек!');
        state.hp = Math.min(state.maxHp, state.hp + 20);
        state.lastFoodAt = new Date();
        socket.emit('updateHp', state.hp);
      }
    });

    socket.on('attack', ({ angle }) => {
      if (state.isBlocking) return;
      let activeItem = state.hotbar[state.activeSlot];
      if (!activeItem) return;

      let range = activeItem === 'bow' ? 6.0 : 2.0;
      if (activeItem === 'bow') {
        projectiles.push({ id: ++projIdCounter, type: 'arrow', x: state.x, y: state.y, dx: Math.cos(angle)*0.4, dy: Math.sin(angle)*0.4, ownerId: playerId, life: 60 });
        return broadcastZone();
      }
      
      let hit = false;
      mobs.forEach(mob => {
        if (!mob.alive) return;
        if (Math.hypot(mob.x - state.x, mob.y - state.y) <= range) {
          hit = true; mob.hp -= 20;
          if (mob.hp <= 0) { mob.alive = false; droppedItems.push({ x: mob.x, y: mob.y, itemId: 'wood', qty: 2 }); setTimeout(() => { mob.hp = mob.maxHp; mob.alive = true; }, 5000); }
        }
      });
      if (hit) broadcastZone();
    });

    socket.on('selectSlot', ({ index }) => { state.activeSlot = index; broadcastZone(); });
    socket.on('shield', ({ active }) => { if (!state.equipment.shield) return; state.isBlocking = active; broadcastZone(); });
    socket.on('disconnect', () => { const map = zones.get(state.zone); if (map) map.delete(state.id); broadcastZone(); });
    function joinZone(zone, st) { if (!zones.has(zone)) zones.set(zone, new Map()); zones.get(zone).set(st.id, st); socket.join('zone:' + zone); }
    function broadcastZone() { const map = zones.get(state.zone); if (map) io.to('zone:' + state.zone).emit('zoneState', [...map.values()], worldResources, mobs, droppedItems, projectiles); }
  });
}