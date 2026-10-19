import { Server } from 'socket.io';
import { pool } from './db.js';

// Конфигурация мира
const TICK_RATE = 1000 / 20;
const MAX_SPEED = 0.3; // Максимальная скорость для античита
const worldResources = [
  { id: 'tree_1', type: 'tree', x: 42, y: 38, hp: 100, maxHp: 100 },
  { id: 'tree_2', type: 'tree', x: 48, y: 35, hp: 100, maxHp: 100 },
  { id: 'stone_1', type: 'stone', x: 45, y: 48, hp: 150, maxHp: 150 },
];
const mobs = [
  { id: 'mob_1', x: 45, y: 40, hp: 100, maxHp: 100, alive: true, speed: 0.05 },
  { id: 'mob_2', x: 50, y: 42, hp: 100, maxHp: 100, alive: true, speed: 0.05 },
];
let droppedItems = [];

// Хелпер для безопасного обновления инвентаря в БД
async function saveInventory(playerId, itemId, qtyDelta) {
  if (qtyDelta === 0) return;
  await pool.query(`
    INSERT INTO inventory (player_id, item_id, qty) 
    VALUES ($1, $2, $3) 
    ON CONFLICT (player_id, item_id) 
    DO UPDATE SET qty = inventory.qty + EXCLUDED.qty
  `, [playerId, itemId, qtyDelta]);
}

export function initSockets(httpServer) {
  const io = new Server(httpServer, { cors: { origin: '*' } });
  const players = new Map();

  io.on('connection', async (socket) => {
    const playerId = Number(socket.handshake.query.playerId);
    if (!playerId) return socket.disconnect();

    try {
      const dbRes = await pool.query('SELECT * FROM players WHERE id = $1', [playerId]);
      if (dbRes.rows.length === 0) return socket.disconnect();
      
      const invData = (await pool.query('SELECT item_id, qty FROM inventory WHERE player_id = $1', [playerId])).rows;
      const inv = {};
      invData.forEach(i => inv[i.item_id] = i.qty);
      
      // Дефолтные предметы для первого входа
      if (!inv['apple']) { inv['apple'] = 3; await saveInventory(playerId, 'apple', 3); }
      if (!inv['wood']) { inv['wood'] = 5; await saveInventory(playerId, 'wood', 5); }
      if (!inv['shield_wood']) { inv['shield_wood'] = 1; await saveInventory(playerId, 'shield_wood', 1); }

      const state = {
        id: playerId, x: 40, y: 40, angle: 0,
        hp: dbRes.rows[0].hp || 100, maxHp: 100,
        inv: inv,
        hotbar: ['apple', 'sword', 'pickaxe', 'axe'],
        equip: { helmet: null, chest: null, shield: null },
        activeSlot: 0,
        isBlocking: false, lastFoodAt: 0, lastMoveTime: Date.now(), lastX: 40, lastY: 40
      };
      
      players.set(playerId, state);
      socket.emit('init', state);

      socket.on('move', (data) => {
        const p = players.get(playerId);
        if (!p) return;
        
        // Античит (проверка скорости)
        const now = Date.now();
        const dt = (now - p.lastMoveTime) / 1000;
        if (dt > 0) {
          const dist = Math.hypot(data.x - p.lastX, data.y - p.lastY);
          if (dist / dt > MAX_SPEED * 2) return; // Телепортация заблокирована
        }

        p.x = data.x; p.y = data.y; p.angle = data.angle;
        p.lastMoveTime = now; p.lastX = data.x; p.lastY = data.y;
      });

      socket.on('selectSlot', (index) => {
        const p = players.get(playerId);
        if (p) p.activeSlot = index;
      });

      socket.on('moveItem', ({ from, to, itemId }) => {
        const p = players.get(playerId);
        if (!p) return;

        // Валидация (нельзя надеть меч в слот шлема)
        if (to.type === 'equip') {
           if (to.slot === 'shield' && itemId !== 'shield_wood') return;
           if (to.slot === 'helmet' && !itemId.includes('helmet')) return;
        }

        // Свап предметов (если в новом слоте уже что-то есть)
        let swappedItem = null;
        if (to.type === 'equip') { swappedItem = p.equip[to.slot]; p.equip[to.slot] = itemId; }
        if (to.type === 'hotbar') { swappedItem = p.hotbar[to.index]; p.hotbar[to.index] = itemId; }

        // Возвращаем свапнутый предмет в старый слот
        if (from.type === 'equip') p.equip[from.slot] = swappedItem;
        if (from.type === 'hotbar') p.hotbar[from.index] = swappedItem;

        socket.emit('updateEquip', p.equip);
        socket.emit('updateHotbar', p.hotbar);
      });

      socket.on('attack', () => {
        const p = players.get(playerId);
        if (!p || p.isBlocking) return;
        
        const item = p.hotbar[p.activeSlot];
        if (item === 'apple') {
          if (Date.now() - p.lastFoodAt < 15000) return socket.emit('error', 'Кулдаун 15 сек!');
          p.hp = Math.min(p.maxHp, p.hp + 20);
          p.lastFoodAt = Date.now();
          socket.emit('hp', p.hp);
          return;
        }

        // Бой
        mobs.forEach(mob => {
          if (!mob.alive) return;
          const dist = Math.hypot(mob.x - p.x, mob.y - p.y);
          if (dist < 2.5) {
            const angleToMob = Math.atan2(mob.y - p.y, mob.x - p.x);
            let diff = Math.abs(p.angle - angleToMob);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            
            if (diff < 0.8) {
              mob.hp -= (item === 'sword') ? 30 : 10;
              if (mob.hp <= 0) {
                mob.alive = false;
                droppedItems.push({ x: mob.x, y: mob.y, item: 'wood', qty: 2 });
                setTimeout(() => { mob.hp = mob.maxHp; mob.alive = true; }, 5000);
              }
            }
          }
        });

        // Добыча
        worldResources.forEach(res => {
          if (res.hp <= 0) return;
          const dist = Math.hypot(res.x - p.x, res.y - p.y);
          if (dist < 2.5) {
            const angleToRes = Math.atan2(res.y - p.y, res.x - p.x);
            let diff = Math.abs(p.angle - angleToRes);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            
            if (diff < 0.8) {
              let dmg = 5;
              if (res.type === 'tree' && item === 'axe') dmg = 25;
              if (res.type === 'stone' && item === 'pickaxe') dmg = 25;
              res.hp -= dmg;
              
              if (res.hp <= 0) {
                droppedItems.push({ x: res.x, y: res.y, item: res.type === 'tree' ? 'wood' : 'stone', qty: 5 });
                setTimeout(() => { res.hp = res.maxHp; }, 10000);
              }
            }
          }
        });
      });

      socket.on('disconnect', () => players.delete(playerId));
    } catch (err) {
      console.error('Критическая ошибка подключения:', err);
    }
  });

  // Главный цикл сервера
  setInterval(() => {
    mobs.forEach(mob => {
      if (!mob.alive) return;
      let nearest = null; let minDist = 999;
      players.forEach(p => {
        const d = Math.hypot(p.x - mob.x, p.y - mob.y);
        if (d < minDist) { minDist = d; nearest = p; }
      });
      if (nearest && minDist < 10 && minDist > 1.5) {
        mob.x += ((nearest.x - mob.x) / minDist) * mob.speed;
        mob.y += ((nearest.y - mob.y) / minDist) * mob.speed;
      }
    });

    // Сбор лута
    players.forEach(p => {
      for (let i = droppedItems.length - 1; i >= 0; i--) {
        const drop = droppedItems[i];
        if (Math.hypot(drop.x - p.x, drop.y - p.y) < 1.5) {
          p.inv[drop.item] = (p.inv[drop.item] || 0) + drop.qty;
          saveInventory(p.id, drop.item, drop.qty);
          p.socket?.emit('updateInv', p.inv);
          droppedItems.splice(i, 1);
        }
      }
    });

    io.emit('worldUpdate', {
      players: Array.from(players.values()),
      mobs: mobs, resources: worldResources, drops: droppedItems
    });
  }, TICK_RATE);
}