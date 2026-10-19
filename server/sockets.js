import { Server } from 'socket.io';
import { pool } from './db.js';
import { ITEMS, RECIPES } from './items.js';

// ================= КОНФИГУРАЦИЯ МИРА =================
const TICK_RATE = 1000 / 20; // 20 тиков в секунду
const worldResources = [
  { id: 'tree_1', type: 'tree', x: 42, y: 38, hp: 100, maxHp: 100, radius: 1.2 },
  { id: 'stone_1', type: 'stone', x: 45, y: 48, hp: 150, maxHp: 150, radius: 1.0 },
];
const mobs = [
  { id: 'mob_1', x: 43, y: 42, hp: 80, maxHp: 80, alive: true, speed: 0.03, radius: 0.8 },
];
let droppedItems = [];
let projectiles = [];
let placedStations = [];

// ================= СОХРАНЕНИЕ В БД =================
async function saveInventory(playerId, itemId, qtyDelta) {
  if (qtyDelta === 0) return;
  await pool.query(`
    INSERT INTO inventory (player_id, item_id, qty) VALUES ($1, $2, $3)
    ON CONFLICT (player_id, item_id) DO UPDATE SET qty = inventory.qty + EXCLUDED.qty
  `, [playerId, itemId, qtyDelta]);
}

// ================= ПРОВЕРКА ГЕОМЕТРИИ =================
function isHit(player, targetX, targetY, itemData) {
  const dx = targetX - player.x, dy = targetY - player.y;
  const dist = Math.hypot(dx, dy);
  const angleToTarget = Math.atan2(dy, dx);
  let diff = Math.abs(player.angle - angleToTarget);
  if (diff > Math.PI) diff = Math.PI * 2 - diff;

  if (itemData.shape === 'arc') return dist <= itemData.range && diff <= (itemData.arc || 0.8);
  if (itemData.shape === 'line') return dist <= itemData.range && diff <= (itemData.arc || 0.3);
  if (itemData.shape === 'ray') return dist <= itemData.range && diff <= 0.1;
  return false;
}

// ================= ОСНОВНАЯ ФУНКЦИЯ =================
export function initSockets(httpServer) {
  const io = new Server(httpServer, { cors: { origin: '*' }, pingInterval: 25000, pingTimeout: 20000 });
  const players = new Map();

  // Защита Render от засыпания
  setInterval(() => {
    fetch(`http://localhost:${process.env.PORT || 3000}/health`).catch(() => {});
  }, 10 * 60 * 1000);

  io.on('connection', async (socket) => {
    const playerId = Number(socket.handshake.query.playerId);
    if (!playerId) return socket.disconnect();

    try {
      // Загрузка игрока из БД
      const dbRes = await pool.query('SELECT * FROM players WHERE id = $1', [playerId]);
      if (dbRes.rows.length === 0) return socket.disconnect();
      
      // Загрузка инвентаря
      const invData = (await pool.query('SELECT item_id, qty FROM inventory WHERE player_id = $1', [playerId])).rows;
      const inv = {};
      invData.forEach(i => inv[i.item_id] = i.qty);
      
      // Стартовый набор
      if (Object.keys(inv).length === 0) {
        inv['sword_wood'] = 1; inv['apple'] = 5; inv['wood'] = 10; inv['stone'] = 10;
        await saveInventory(playerId, 'sword_wood', 1);
        await saveInventory(playerId, 'apple', 5);
        await saveInventory(playerId, 'wood', 10);
        await saveInventory(playerId, 'stone', 10);
      }

      const state = {
        id: playerId, socket: socket, x: 40, y: 40, angle: 0,
        hp: dbRes.rows[0].hp || 100, maxHp: 100,
        inv, hotbar: ['sword_wood', 'apple', null, null],
        equip: { helmet: null, chest: null, legs: null, boots: null, shield: null, ring: null },
        activeSlot: 0, isBlocking: false, lastFoodAt: 0, lastAttackAt: 0,
        lastMoveTime: Date.now(), lastX: 40, lastY: 40
      };
      
      players.set(playerId, state);
      socket.join(`player:${playerId}`);
      socket.emit('init', { state, stations: placedStations });

      // --- ДВИЖЕНИЕ С АНТИЧИТОМ ---
      socket.on('move', (data) => {
        const p = players.get(playerId);
        if (!p) return;
        const now = Date.now(), dt = (now - p.lastMoveTime) / 1000;
        if (dt > 0 && Math.hypot(data.x - p.lastX, data.y - p.lastY) / dt > 0.8) return;
        
        let blocked = false;
        worldResources.forEach(res => { if (res.hp > 0 && Math.hypot(data.x - res.x, data.y - res.y) < res.radius) blocked = true; });
        placedStations.forEach(st => { if (Math.hypot(data.x - st.x, data.y - st.y) < 1.0) blocked = true; });
        if (blocked) return;

        p.x = data.x; p.y = data.y; p.angle = data.angle;
        p.lastMoveTime = now; p.lastX = data.x; p.lastY = data.y;
      });

      // --- ВЫБОР СЛОТА ---
      socket.on('selectSlot', (index) => { const p = players.get(playerId); if (p) p.activeSlot = index; });

      // --- ПЕРЕМЕЩЕНИЕ ПРЕДМЕТОВ ---
      socket.on('moveItem', ({ from, to, itemId }) => {
        const p = players.get(playerId);
        if (!p) return;
        const itemData = ITEMS[itemId];
        if (to.type === 'equip' && itemData && itemData.slot !== to.slot) return;
        
        let swapped = null;
        if (to.type === 'equip') { swapped = p.equip[to.slot]; p.equip[to.slot] = itemId; }
        if (to.type === 'hotbar') { swapped = p.hotbar[to.index]; p.hotbar[to.index] = itemId; }
        if (from.type === 'equip') p.equip[from.slot] = swapped;
        if (from.type === 'hotbar') p.hotbar[from.index] = swapped;

        socket.emit('updateEquip', p.equip);
        socket.emit('updateHotbar', p.hotbar);
      });

      // --- КРАФТ ---
      socket.on('craft', ({ recipeId, stationId }) => {
        const p = players.get(playerId);
        const recipe = RECIPES[recipeId];
        if (!p || !recipe) return;

        if (recipe.station && stationId !== recipe.station) return socket.emit('error', 'Нужен правильный станок!');
        for (const [res, qty] of Object.entries(recipe.cost)) {
          if (!p.inv[res] || p.inv[res] < qty) return socket.emit('error', 'Недостаточно ресурсов!');
        }
        
        for (const [res, qty] of Object.entries(recipe.cost)) {
          p.inv[res] -= qty; saveInventory(p.id, res, -qty);
        }
        p.inv[recipeId] = (p.inv[recipeId] || 0) + 1;
        saveInventory(p.id, recipeId, 1);
        
        socket.emit('updateInv', p.inv);
        socket.emit('craftSuccess', recipeId);
      });

      // --- УСТАНОВКА СТАНКОВ ---
      socket.on('placeStation', ({ itemId }) => {
        const p = players.get(playerId);
        if (!p || !p.inv[itemId] || p.inv[itemId] <= 0) return;
        if (ITEMS[itemId].type !== 'station') return;

        p.inv[itemId] -= 1; saveInventory(p.id, itemId, -1);
        const newStation = { id: Date.now().toString(), itemId, x: p.x + 1, y: p.y, ownerId: p.id };
        placedStations.push(newStation);
        socket.emit('updateInv', p.inv);
        io.emit('stationPlaced', newStation);
      });

      // --- АТАКА ---
      socket.on('attack', () => {
        const p = players.get(playerId);
        if (!p || p.isBlocking) return;
        const itemId = p.hotbar[p.activeSlot];
        const itemData = ITEMS[itemId];
        if (!itemData) return;
        if (Date.now() - p.lastAttackAt < (itemData.atkSpeed || 500)) return;
        p.lastAttackAt = Date.now();

        // Еда
        if (itemData.type === 'food') {
          if (Date.now() - p.lastFoodAt < 15000) return socket.emit('error', 'Кулдаун 15 сек!');
          p.hp = Math.min(p.maxHp, p.hp + (itemData.heal || 0));
          p.lastFoodAt = Date.now();
          socket.emit('hp', p.hp);
          return;
        }

        // Оружие и инструменты
        if (itemData.type === 'weapon' || itemData.type === 'tool') {
          // Ближний бой
          mobs.forEach(mob => {
            if (!mob.alive) return;
            if (isHit(p, mob.x, mob.y, itemData)) {
              mob.hp -= (itemData.dmg || 10);
              if (mob.hp <= 0) {
                mob.alive = false;
                droppedItems.push({ x: mob.x, y: mob.y, item: 'wood', qty: 2 });
                setTimeout(() => { mob.hp = mob.maxHp; mob.alive = true; }, 5000);
              }
            }
          });

          // Добыча
          worldResources.forEach(res => {
            if (res.hp <= 0) return;
            if (isHit(p, res.x, res.y, itemData)) {
              let dmg = 5;
              if (res.type === 'tree' && itemId.includes('axe')) dmg = 25;
              if (res.type === 'stone' && itemId.includes('pickaxe')) dmg = 25;
              res.hp -= dmg;
              if (res.hp <= 0) {
                droppedItems.push({ x: res.x, y: res.y, item: res.type === 'tree' ? 'wood' : 'stone', qty: 5 });
                setTimeout(() => { res.hp = res.maxHp; }, 10000);
              }
            }
          });

          // Снаряды
          if (itemData.shape === 'projectile' || itemData.shape === 'aoe_proj') {
            projectiles.push({
              id: Date.now() + Math.random(), x: p.x, y: p.y, angle: p.angle,
              speed: itemData.projSpeed || 0.4, dmg: itemData.dmg,
              aoe: itemData.aoeRadius || 0, type: itemData.shape, owner: p.id
            });
          }
        }
      });

      socket.on('disconnect', () => players.delete(playerId));
    } catch (err) { console.error('Socket error:', err); }
  });

  // ================= ИГРОВОЙ ЦИКЛ =================
  setInterval(() => {
    // 1. Снаряды
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.x += Math.cos(p.angle) * p.speed; p.y += Math.sin(p.angle) * p.speed;
      let hit = false;
      mobs.forEach(mob => {
        if (mob.alive && Math.hypot(mob.x - p.x, mob.y - p.y) < (p.aoe || 1)) {
          mob.hp -= p.dmg;
          if (mob.hp <= 0) { mob.alive = false; droppedItems.push({ x: mob.x, y: mob.y, item: 'wood', qty: 2 }); setTimeout(() => { mob.hp = mob.maxHp; mob.alive = true; }, 5000); }
          hit = true;
        }
      });
      if (hit || p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100) projectiles.splice(i, 1);
    }

    // 2. Мобы
    mobs.forEach(mob => {
      if (!mob.alive) return;
      let nearest = null; let minDist = 999;
      players.forEach(p => {
        const d = Math.hypot(p.x - mob.x, p.y - mob.y);
        if (d < minDist) { minDist = d; nearest = p; }
      });
      if (nearest && minDist < 10 && minDist > 1.5) {
        let newX = mob.x + ((nearest.x - mob.x) / minDist) * mob.speed;
        let newY = mob.y + ((nearest.y - mob.y) / minDist) * mob.speed;
        let blocked = false;
        worldResources.forEach(res => { if (res.hp > 0 && Math.hypot(newX - res.x, newY - res.y) < res.radius) blocked = true; });
        if (!blocked) { mob.x = newX; mob.y = newY; }
      }
    });

    // 3. Лут
    players.forEach(p => {
      for (let i = droppedItems.length - 1; i >= 0; i--) {
        const drop = droppedItems[i];
        if (Math.hypot(drop.x - p.x, drop.y - p.y) < 1.5) {
          p.inv[drop.item] = (p.inv[drop.item] || 0) + drop.qty;
          saveInventory(p.id, drop.item, drop.qty);
          p.socket.emit('updateInv', p.inv);
          droppedItems.splice(i, 1);
        }
      }
    });

    io.emit('worldUpdate', {
      players: Array.from(players.values()).map(({socket, ...rest}) => rest),
      mobs, resources: worldResources, drops: droppedItems, projectiles, stations: placedStations
    });
  }, TICK_RATE);
}