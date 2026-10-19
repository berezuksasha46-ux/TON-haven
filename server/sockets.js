import { Server } from 'socket.io';
import { pool } from './db.js';

// --- РЕСУРСЫ И МОБЫ ---
export const worldResources = [
  { id: 'tree_1', type: 'tree', x: 42, y: 38, hp: 100 },
  { id: 'tree_2', type: 'tree', x: 38, y: 45, hp: 100 },
  { id: 'stone_1', type: 'stone', x: 45, y: 48, hp: 150 },
  { id: 'stone_2', type: 'stone', x: 35, y: 35, hp: 150 },
];
export const mobs = [
  { id: 'mob_1', x: 45, y: 40, hp: 100, maxHp: 100, alive: true, speed: 0.02 },
  { id: 'mob_2', x: 50, y: 50, hp: 100, maxHp: 100, alive: true, speed: 0.02 },
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
    
    // Тестовые предметы (если пусто)
    if (!inventory['apple']) inventory['apple'] = 3;
    if (!inventory['wood']) inventory['wood'] = 5;
    if (!inventory['shield_wood']) inventory['shield_wood'] = 1;

    const state = {
      id: playerId, zone: 'hub', x: 40, y: 40, angle: 0,
      hp: dbp.hp, maxHp: dbp.max_hp,
      hotbar: ['apple', 'sword', 'pickaxe', 'axe'], // По ТЗ: 4 слота
      activeSlot: 0,
      equipment: { helmet: null, chest: null, legs: null, boots: null, shield: null, ring: null },
      isBlocking: false,
      inv: inventory, lastFoodAt: dbp.last_food_at
    };
    
    joinZone('hub', state);
    socket.emit('welcome', { state });
    broadcastZone();

    socket.on('move', ({ x, y, angle }) => {
      state.x = x; state.y = y; state.angle = angle;
      broadcastZone();
      // Автоподбор
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

    // Выбор слота
    socket.on('selectSlot', ({ index }) => { state.activeSlot = index; broadcastZone(); });

    // Перетаскивание (Drag and Drop)
    socket.on('moveItem', ({ from, to, itemId }) => {
      // Очищаем старый слот
      if (from.type === 'equip') state.equipment[from.slot] = null;
      if (from.type === 'hotbar') state.hotbar[from.index] = null;
      
      // Заполняем новый
      if (to.type === 'equip') state.equipment[to.slot] = itemId;
      if (to.type === 'hotbar') state.hotbar[to.index] = itemId;
      
      socket.emit('updateEquip', state.equipment);
      socket.emit('updateHotbar', state.hotbar);
      broadcastZone();
    });

    socket.on('attack', ({ angle }) => {
      if (state.isBlocking) return;
      const activeItem = state.hotbar[state.activeSlot];
      if (!activeItem) return;

      // Использование еды
      if (activeItem === 'apple') {
        if (Date.now() - new Date(state.lastFoodAt).getTime() < 15000) return socket.emit('errorMsg', 'Кулдаун 15 сек!');
        state.hp = Math.min(state.maxHp, state.hp + 20);
        state.lastFoodAt = new Date();
        socket.emit('updateHp', state.hp);
        return;
      }

      let range = activeItem === 'bow' ? 6.0 : 2.0;
      if (activeItem === 'bow') {
        projectiles.push({ id: ++projIdCounter, type: 'arrow', x: state.x, y: state.y, dx: Math.cos(angle)*0.4, dy: Math.sin(angle)*0.4, ownerId: playerId, life: 60 });
        return broadcastZone();
      }

      let hit = false;
      // Бьем мобов
      mobs.forEach(mob => {
        if (!mob.alive) return;
        if (Math.hypot(mob.x - state.x, mob.y - state.y) <= range) {
          const a = Math.atan2(mob.y - state.y, mob.x - state.x);
          let delta = Math.abs(a - angle); while (delta > Math.PI) delta = Math.abs(delta - Math.PI * 2);
          if (delta <= 0.6) {
            hit = true; mob.hp -= 20;
            if (mob.hp <= 0) { mob.alive = false; droppedItems.push({ x: mob.x, y: mob.y, itemId: 'wood', qty: 2 }); setTimeout(() => { mob.hp = mob.maxHp; mob.alive = true; broadcastZone(); }, 5000); }
          }
        }
      });
      
      // Добыча ресурсов
      worldResources.forEach(res => {
        if (res.hp <= 0) return;
        if (Math.hypot(res.x - state.x, res.y - state.y) <= range) {
          const a = Math.atan2(res.y - state.y, res.x - state.x);
          let delta = Math.abs(a - angle); while (delta > Math.PI) delta = Math.abs(delta - Math.PI * 2);
          if (delta <= 0.6) {
            hit = true;
            let dmg = 5;
            if (res.type === 'tree' && activeItem === 'axe') dmg = 25;
            if (res.type === 'stone' && activeItem === 'pickaxe') dmg = 25;
            res.hp -= dmg;
            if (res.hp <= 0) {
              droppedItems.push({ x: res.x, y: res.y, itemId: res.type === 'tree' ? 'wood' : 'stone', qty: 5 });
              setTimeout(() => { res.hp = res.type === 'tree' ? 100 : 150; broadcastZone(); }, 10000);
            }
          }
        }
      });
      if (hit) broadcastZone();
    });

    socket.on('shield', ({ active }) => { if (!state.equipment.shield) return; state.isBlocking = active; broadcastZone(); });
    socket.on('disconnect', () => { const map = zones.get(state.zone); if (map) map.delete(state.id); broadcastZone(); });
    
    function joinZone(zone, st) { if (!zones.has(zone)) zones.set(zone, new Map()); zones.get(zone).set(st.id, st); socket.join('zone:' + zone); }
    function broadcastZone() { const map = zones.get(state.zone); if (map) io.to('zone:' + state.zone).emit('zoneState', [...map.values()], worldResources, mobs, droppedItems); }
  });
}