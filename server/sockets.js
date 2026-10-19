import { Server } from 'socket.io';
import { pool } from './db.js';
import { ITEMS, RECIPES } from './items.js';

const TICK_RATE = 1000 / 20;

// --- МИР (Ресурсы на карте) ---
const worldResources = [
  { id: 'tree_1', type: 'tree', x: 42, y: 38, hp: 100, maxHp: 100, radius: 1.2 },
  { id: 'tree_2', type: 'tree', x: 38, y: 45, hp: 100, maxHp: 100, radius: 1.2 },
  { id: 'stone_1', type: 'stone', x: 45, y: 48, hp: 150, maxHp: 150, radius: 1.0 },
  { id: 'iron_1', type: 'iron', x: 50, y: 35, hp: 200, maxHp: 200, radius: 1.0 },
  { id: 'cobalt_1', type: 'cobalt', x: 55, y: 40, hp: 300, maxHp: 300, radius: 1.0 },
  { id: 'adamantite_1', type: 'adamantite', x: 60, y: 45, hp: 400, maxHp: 400, radius: 1.0 },
  { id: 'holy_1', type: 'holy', x: 65, y: 50, hp: 500, maxHp: 500, radius: 1.0 },
];

const mobs = [
  { id: 'mob_1', x: 45, y: 40, hp: 100, maxHp: 100, alive: true, speed: 0.05, radius: 0.8, type: 'slime' },
  { id: 'mob_2', x: 50, y: 42, hp: 150, maxHp: 150, alive: true, speed: 0.04, radius: 0.9, type: 'goblin' },
  { id: 'mob_3', x: 55, y: 38, hp: 300, maxHp: 300, alive: true, speed: 0.03, radius: 1.2, type: 'golem' },
];

let droppedItems = [];
let projectiles = [];
let placedStations = [];

// --- БАЗА ДАННЫХ (Сохранение) ---
async function saveInventory(playerId, itemId, qtyDelta) {
  if (qtyDelta === 0) return;
  await pool.query(`
    INSERT INTO inventory (player_id, item_id, qty) VALUES ($1, $2, $3)
    ON CONFLICT (player_id, item_id) DO UPDATE SET qty = inventory.qty + EXCLUDED.qty
  `, [playerId, itemId, qtyDelta]);
}

// --- ГЕОМЕТРИЯ АТАКИ ---
function isHit(player, targetX, targetY, itemData) {
  const dx = targetX - player.x, dy = targetY - player.y;
  const dist = Math.hypot(dx, dy);
  const angleToTarget = Math.atan2(dy, dx);
  let diff = Math.abs(player.angle - angleToTarget);
  if (diff > Math.PI) diff = Math.PI * 2 - diff;

  if (itemData.shape === 'arc') return dist <= itemData.range && diff <= (itemData.arc || 0.8);
  if (itemData.shape === 'line') return dist <= itemData.range && diff <= (itemData.arc || 0.3);
  if (itemData.shape === 'ray') return dist <= itemData.range && diff <= 0.05;
  if (itemData.shape === 'boomerang') return dist <= itemData.range;
  if (itemData.shape === 'cone') return dist <= itemData.range && diff <= (itemData.arc || 0.5);
  return false;
}

export function initSockets(httpServer) {
  const io = new Server(httpServer, { cors: { origin: '*' }, pingInterval: 25000, pingTimeout: 20000, reconnectionAttempts: Infinity });
  const players = new Map();

  setInterval(() => { fetch(`http://localhost:${process.env.PORT || 3000}/health`).catch(() => {}); }, 10 * 60 * 1000);

  io.on('connection', async (socket) => {
    const playerId = Number(socket.handshake.query.playerId);
    if (!playerId) return socket.disconnect();

    try {
      const dbRes = await pool.query('SELECT * FROM players WHERE id = $1', [playerId]);
      if (dbRes.rows.length === 0) return socket.disconnect();
      
      const invData = (await pool.query('SELECT item_id, qty FROM inventory WHERE player_id = $1', [playerId])).rows;
      const inv = {};
      invData.forEach(i => inv[i.item_id] = i.qty);
      
      // Стартовый инвентарь
      if (!inv['apple']) { inv['apple'] = 5; await saveInventory(playerId, 'apple', 5); }
      if (!inv['wood']) { inv['wood'] = 10; await saveInventory(playerId, 'wood', 10); }
      if (!inv['stone']) { inv['stone'] = 10; await saveInventory(playerId, 'stone', 10); }
      if (!inv['sword_wood']) { inv['sword_wood'] = 1; await saveInventory(playerId, 'sword_wood', 1); }

      const state = {
        id: playerId, socket: socket, x: 40, y: 40, angle: 0,
        hp: dbRes.rows[0].hp || 100, maxHp: 100,
        inv, hotbar: ['sword_wood', 'apple', null, null],
        equip: { helmet: null, chest: null, legs: null, boots: null, shield: null, ring: null },
        activeSlot: 0, isBlocking: false, lastFoodAt: 0, lastAttackAt: 0,
        statuses: {}, lastMoveTime: Date.now(), lastX: 40, lastY: 40
      };
      
      players.set(playerId, state);
      socket.join(`player:${playerId}`);
      socket.emit('init', { state, stations: placedStations });

      // --- ДВИЖЕНИЕ ---
      socket.on('move', (data) => {
        const p = players.get(playerId);
        if (!p) return;
        const now = Date.now(), dt = (now - p.lastMoveTime) / 1000;
        if (dt > 0 && Math.hypot(data.x - p.lastX, data.y - p.lastY) / dt > 0.6) return; // Античит
        
        let blocked = false;
        worldResources.forEach(res => { if (res.hp > 0 && Math.hypot(data.x - res.x, data.y - res.y) < res.radius) blocked = true; });
        placedStations.forEach(st => { if (Math.hypot(data.x - st.x, data.y - st.y) < 0.8) blocked = true; });
        if (blocked) return;

        p.x = data.x; p.y = data.y; p.angle = data.angle;
        p.lastMoveTime = now; p.lastX = data.x; p.lastY = data.y;
      });

      // --- ИНВЕНТАРЬ ---
      socket.on('selectSlot', (index) => { const p = players.get(playerId); if (p) p.activeSlot = index; });

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

        if (recipe.station && stationId !== recipe.station) {
          return socket.emit('error', `Нужен станок: ${ITEMS[recipe.station]?.name || recipe.station}`);
        }

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

        p.inv[itemId] -= 1;
        saveInventory(p.id, itemId, -1);
        
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

        // Кулдаун атаки (зависит от оружия)
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

        // Лечение (Книга исцеления)
        if (itemData.shape === 'heal') {
          p.hp = Math.min(p.maxHp, p.hp + (itemData.heal || 0));
          socket.emit('hp', p.hp);
          return;
        }

        // Оружие и инструменты
        if (itemData.type === 'weapon' || itemData.type === 'tool') {
          // Ближний бой
          mobs.forEach(mob => {
            if (!mob.alive) return;
            if (isHit(p, mob.x, mob.y, itemData)) {
              let dmg = itemData.dmg || 5;
              // Учет защиты моба (если есть)
              mob.hp -= dmg;
              
              if (itemData.poison) mob.statuses = { ...mob.statuses, poison: Date.now() + 5000 };
              if (itemData.slow) mob.statuses = { ...mob.statuses, slow: Date.now() + 3000 };
              
              if (mob.hp <= 0) {
                mob.alive = false;
                droppedItems.push({ x: mob.x, y: mob.y, item: 'wood', qty: 2 });
                setTimeout(() => { mob.hp = mob.maxHp; mob.alive = true; }, 5000);
              }
            }
          });

          // Добыча ресурсов
          worldResources.forEach(res => {
            if (res.hp <= 0) return;
            if (isHit(p, res.x, res.y, itemData)) {
              let dmg = 5;
              // Проверка уровня инструмента
              if (res.type === 'tree' && itemId.includes('axe')) dmg = 25;
              if (res.type === 'stone' && itemId.includes('pickaxe')) dmg = 25;
              if (res.type === 'iron' && itemId.includes('pickaxe') && itemData.tier >= 2) dmg = 20;
              if (res.type === 'cobalt' && itemId.includes('pickaxe') && itemData.tier >= 3) dmg = 20;
              if (res.type === 'adamantite' && itemId.includes('pickaxe') && itemData.tier >= 4) dmg = 20;
              if (res.type === 'holy' && itemId.includes('pickaxe') && itemData.tier >= 5) dmg = 20;
              
              res.hp -= dmg;
              if (res.hp <= 0) {
                let dropItem = res.type === 'tree' ? 'wood' : res.type;
                if (res.type === 'iron') dropItem = 'iron_ore';
                if (res.type === 'cobalt') dropItem = 'cobalt_ore';
                if (res.type === 'adamantite') dropItem = 'adamantite_ore';
                if (res.type === 'holy') dropItem = 'holy_ore';
                
                droppedItems.push({ x: res.x, y: res.y, item: dropItem, qty: 3 });
                setTimeout(() => { res.hp = res.maxHp; }, 10000);
              }
            }
          });

          // Дальний бой (снаряды)
          if (itemData.shape === 'projectile' || itemData.shape === 'aoe_proj') {
            projectiles.push({
              id: Date.now() + Math.random(), x: p.x, y: p.y, angle: p.angle,
              speed: itemData.projSpeed || 0.4, dmg: itemData.dmg,
              aoe: itemData.aoeRadius || 0, type: itemData.shape, owner: p.id,
              poison: itemData.poison, slow: itemData.slow
            });
          }
        }
      });

      socket.on('disconnect', () => players.delete(playerId));
    } catch (err) { console.error('Socket error:', err); }
  });

  // --- ИГРОВОЙ ЦИКЛ ---
  setInterval(() => {
    // 1. Снаряды
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.x += Math.cos(p.angle) * p.speed;
      p.y += Math.sin(p.angle) * p.speed;
      
      let hit = false;
      mobs.forEach(mob => {
        if (mob.alive && Math.hypot(mob.x - p.x, mob.y - p.y) < (p.aoe || 1)) {
          mob.hp -= p.dmg;
          if (p.poison) mob.statuses = { ...mob.statuses, poison: Date.now() + 5000 };
          if (p.slow) mob.statuses = { ...mob.statuses, slow: Date.now() + 3000 };
          
          if (mob.hp <= 0) { 
            mob.alive = false; 
            droppedItems.push({ x: mob.x, y: mob.y, item: 'wood', qty: 2 }); 
            setTimeout(() => { mob.hp = mob.maxHp; mob.alive = true; }, 5000); 
          }
          hit = true;
        }
      });
      if (hit || p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100) projectiles.splice(i, 1);
    }

    // 2. Мобы
    mobs.forEach(mob => {
      if (!mob.alive) return;
      if (mob.statuses?.poison && Date.now() < mob.statuses.poison) { mob.hp -= 0.1; }
      
      let nearest = null; let minDist = 999;
      players.forEach(p => {
        const d = Math.hypot(p.x - mob.x, p.y - mob.y);
        if (d < minDist) { minDist = d; nearest = p; }
      });
      
      if (nearest && minDist < 10 && minDist > 1.5) {
        const speed = mob.statuses?.slow && Date.now() < mob.statuses.slow ? mob.speed * 0.5 : mob.speed;
        let newX = mob.x + ((nearest.x - mob.x) / minDist) * speed;
        let newY = mob.y + ((nearest.y - mob.y) / minDist) * speed;
        
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