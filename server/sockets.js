import { Server } from 'socket.io';
import { pool } from './db.js';
import { ITEMS, RECIPES } from './items.js';
import { 
  isHit, 
  calculateDamage, 
  isBlockedByShield, 
  canEat, 
  applyDamageToMob 
} from './combat.js';
import { 
  ZONES, 
  isSafe, 
  isPvP, 
  getSpawnPoint, 
  isRed, 
  updatePKKills, 
  canAttack 
} from './zones.js';

// ==================================================
// ============ КОНФИГУРАЦИЯ МИРА ===================
// ==================================================
const TICK_RATE = 1000 / 20; // 20 тиков в секунду
const worldResources = [
  { id: 'tree_1', type: 'tree', x: 42, y: 38, hp: 100, maxHp: 100, radius: 1.2 },
  { id: 'tree_2', type: 'tree', x: 38, y: 45, hp: 100, maxHp: 100, radius: 1.2 },
  { id: 'stone_1', type: 'stone', x: 45, y: 48, hp: 150, maxHp: 150, radius: 1.0 },
  { id: 'iron_1', type: 'iron', x: 50, y: 35, hp: 200, maxHp: 200, radius: 1.0 },
];
const mobs = [
  { id: 'mob_1', x: 43, y: 42, hp: 80, maxHp: 80, alive: true, speed: 0.03, radius: 0.8, type: 'slime' },
  { id: 'mob_2', x: 48, y: 40, hp: 120, maxHp: 120, alive: true, speed: 0.02, radius: 0.9, type: 'goblin' },
];
let droppedItems = [];
let projectiles = [];
let placedStations = [];
let projIdCounter = 0;

// ==================================================
// ============ СОХРАНЕНИЕ В БД =====================
// ==================================================
async function saveInventory(playerId, itemId, qtyDelta) {
  if (qtyDelta === 0) return;
  await pool.query(`
    INSERT INTO inventory (player_id, item_id, qty) VALUES ($1, $2, $3)
    ON CONFLICT (player_id, item_id) DO UPDATE SET qty = inventory.qty + EXCLUDED.qty
  `, [playerId, itemId, qtyDelta]);
}

// ==================================================
// ============ СТАРТОВЫЙ НАБОР =====================
// ==================================================
async function giveStarterKit(playerId, inv) {
  const starterItems = {
    pickaxe_wood: 1,  // Чтобы добывать камень
    axe_wood: 1,      // Чтобы рубить деревья
    sword_wood: 1,    // Чтобы защищаться
    apple: 5,         // Еда
    wood: 10,         // Стартовые ресурсы
    stone: 10,        // Стартовые ресурсы
  };

  for (const [itemId, qty] of Object.entries(starterItems)) {
    if (!inv[itemId] || inv[itemId] < 1) {
      inv[itemId] = qty;
      await saveInventory(playerId, itemId, qty);
    }
  }
}

// ==================================================
// ============ ПРОВЕРКА БЛИЗОСТИ СТАНКА ============
// ==================================================
function isNearStation(player, stationType) {
  return placedStations.some(st => 
    st.itemId === `station_${stationType}` && 
    Math.hypot(st.x - player.x, st.y - player.y) < 2.5
  );
}

// ==================================================
// ================= ОСНОВНАЯ ЛОГИКА ================
// ==================================================
export function initSockets(httpServer) {
  const io = new Server(httpServer, { 
    cors: { origin: '*' }, 
    pingInterval: 25000, 
    pingTimeout: 20000 
  });
  const players = new Map();

  // Self-ping для Render (чтобы сервер не засыпал)
  setInterval(() => {
    fetch(`http://localhost:${process.env.PORT || 3000}/health`).catch(() => {});
  }, 10 * 60 * 1000);

  io.on('connection', async (socket) => {
    const playerId = Number(socket.handshake.query.playerId);
    if (!playerId) return socket.disconnect();

    try {
      // 1. Загрузка игрока из БД
      const dbRes = await pool.query('SELECT * FROM players WHERE id = $1', [playerId]);
      if (dbRes.rows.length === 0) return socket.disconnect();
      
      // 2. Загрузка инвентаря
      const invData = (await pool.query('SELECT item_id, qty FROM inventory WHERE player_id = $1', [playerId])).rows;
      const inv = {};
      invData.forEach(i => inv[i.item_id] = i.qty);
      
      // 3. Выдача стартового набора (если пусто)
      await giveStarterKit(playerId, inv);

      // 4. Создание состояния игрока
      const state = {
        id: playerId, 
        socket: socket, 
        x: 40, y: 40, angle: 0, zone: 'hub',
        hp: dbRes.rows[0].hp || 100, 
        maxHp: 100,
        inv, 
        hotbar: ['sword_wood', 'pickaxe_wood', 'apple', null], // Стартовый хотбар
        equip: { helmet: null, chest: null, legs: null, boots: null, shield: null, ring: null },
        activeSlot: 0, 
        isBlocking: false, 
        lastFoodAt: 0, 
        lastAttackAt: 0,
        lastMoveTime: Date.now(), 
        lastX: 40, lastY: 40,
        pkKills: 0, 
        redUntil: null
      };
      
      players.set(playerId, state);
      socket.join(`player:${playerId}`);
      socket.emit('init', { state, stations: placedStations });
      
      // Отправляем обновление всем, что игрок зашел
      io.emit('worldUpdate', {
        players: Array.from(players.values()).map(({socket, ...rest}) => rest),
        mobs, resources: worldResources, drops: droppedItems, projectiles, stations: placedStations
      });

      // ==========================================
      // ============ ДВИЖЕНИЕ ====================
      // ==========================================
      socket.on('move', (data) => {
        const p = players.get(playerId);
        if (!p) return;
        
        // Античит: проверка скорости
        const now = Date.now();
        const dt = (now - p.lastMoveTime) / 1000;
        if (dt > 0) {
          const dist = Math.hypot(data.x - p.lastX, data.y - p.lastY);
          if (dist / dt > 0.8) return; // Слишком быстро
        }
        
        // Коллизия с ресурсами и станками
        let blocked = false;
        worldResources.forEach(res => { 
          if (res.hp > 0 && Math.hypot(data.x - res.x, data.y - res.y) < res.radius) blocked = true; 
        });
        placedStations.forEach(st => { 
          if (Math.hypot(data.x - st.x, data.y - st.y) < 1.0) blocked = true; 
        });
        if (blocked) return;

        p.x = data.x; 
        p.y = data.y; 
        p.angle = data.angle;
        p.lastMoveTime = now; 
        p.lastX = data.x; 
        p.lastY = data.y;
      });

      // ==========================================
      // ============ СМЕНА СЛОТА =================
      // ==========================================
      socket.on('selectSlot', (index) => { 
        const p = players.get(playerId); 
        if (p) p.activeSlot = index; 
      });

      // ==========================================
      // ============ ИНВЕНТАРЬ ===================
      // ==========================================
      socket.on('moveItem', ({ from, to, itemId }) => {
        const p = players.get(playerId);
        if (!p) return;
        
        const itemData = ITEMS[itemId];
        // Валидация: нельзя надеть меч в слот шлема
        if (to.type === 'equip' && itemData && itemData.slot !== to.slot) return;
        
        let swapped = null;
        if (to.type === 'equip') { swapped = p.equip[to.slot]; p.equip[to.slot] = itemId; }
        if (to.type === 'hotbar') { swapped = p.hotbar[to.index]; p.hotbar[to.index] = itemId; }
        if (from.type === 'equip') p.equip[from.slot] = swapped;
        if (from.type === 'hotbar') p.hotbar[from.index] = swapped;

        socket.emit('updateEquip', p.equip);
        socket.emit('updateHotbar', p.hotbar);
      });

      // ==========================================
      // ============ КРАФТ =======================
      // ==========================================
      socket.on('craft', ({ recipeId, stationId }) => {
        const p = players.get(playerId);
        const recipe = RECIPES[recipeId];
        if (!p || !recipe) return;

        // 1. Проверка станка
        if (recipe.station && !isNearStation(p, recipe.station)) {
          return socket.emit('error', `Нужен станок: ${ITEMS[recipe.station]?.name || recipe.station}. Подойдите ближе.`);
        }

        // 2. Проверка ресурсов
        for (const [res, qty] of Object.entries(recipe.cost)) {
          if (!p.inv[res] || p.inv[res] < qty) {
            return socket.emit('error', 'Недостаточно ресурсов!');
          }
        }
        
        // 3. Списание и выдача
        for (const [res, qty] of Object.entries(recipe.cost)) {
          p.inv[res] -= qty; 
          saveInventory(p.id, res, -qty);
        }
        p.inv[recipeId] = (p.inv[recipeId] || 0) + 1;
        saveInventory(p.id, recipeId, 1);
        
        socket.emit('updateInv', p.inv);
        socket.emit('craftSuccess', recipeId);
      });

      // ==========================================
      // ============ УСТАНОВКА СТАНКОВ ===========
      // ==========================================
      socket.on('placeStation', ({ itemId }) => {
        const p = players.get(playerId);
        if (!p || !p.inv[itemId] || p.inv[itemId] <= 0) return;
        if (ITEMS[itemId].type !== 'station') return;

        p.inv[itemId] -= 1; 
        saveInventory(p.id, itemId, -1);
        
        const newStation = { 
          id: Date.now().toString(), 
          itemId, 
          x: p.x + 1, 
          y: p.y, 
          ownerId: p.id 
        };
        placedStations.push(newStation);
        
        socket.emit('updateInv', p.inv);
        io.emit('stationPlaced', newStation);
      });

      // ==========================================
      // ============ АТАКА =======================
      // ==========================================
      socket.on('attack', () => {
        const p = players.get(playerId);
        if (!p || p.isBlocking) return;
        
        const itemId = p.hotbar[p.activeSlot];
        const itemData = ITEMS[itemId];
        if (!itemData) return;

        // Кулдаун атаки (зависит от оружия)
        if (Date.now() - p.lastAttackAt < (itemData.atkSpeed || 500)) return;
        p.lastAttackAt = Date.now();

        // 1. Еда
        if (itemData.type === 'food') {
          if (!canEat(p.lastFoodAt)) return socket.emit('error', 'Кулдаун 15 сек!');
          p.hp = Math.min(p.maxHp, p.hp + (itemData.heal || 0));
          p.lastFoodAt = Date.now();
          socket.emit('hp', p.hp);
          return;
        }

        // 2. Лечение (Книга исцеления)
        if (itemData.shape === 'heal') {
          p.hp = Math.min(p.maxHp, p.hp + (itemData.heal || 0));
          socket.emit('hp', p.hp);
          return;
        }

        // 3. Оружие и инструменты
        if (itemData.type === 'weapon' || itemData.type === 'tool') {
          let hitSomething = false;

          // 3.1. Ближний бой (мобы)
          mobs.forEach(mob => {
            if (!mob.alive) return;
            if (isHit(p, mob.x, mob.y, itemData)) {
              hitSomething = true;
              const isDead = applyDamageToMob(mob, itemData.dmg || 10);
              if (isDead) {
                mob.alive = false;
                droppedItems.push({ x: mob.x, y: mob.y, item: 'wood', qty: 2 });
                setTimeout(() => { mob.hp = mob.maxHp; mob.alive = true; }, 5000);
              }
            }
          });

          // 3.2. Ближний бой (другие игроки — PvP)
          players.forEach(target => {
            if (target.id === p.id || target.hp <= 0) return;
            if (isHit(p, target.x, target.y, itemData)) {
              // Проверка PvP-правил
              if (!canAttack(p, target, false)) return;
              
              // Проверка блока щитом
              if (target.isBlocking && target.equip.shield) {
                const shieldData = ITEMS[target.equip.shield];
                const attackAngle = Math.atan2(p.y - target.y, p.x - target.x);
                if (isBlockedByShield(shieldData, target.angle, attackAngle)) {
                  return; // Удар заблокирован
                }
              }

              // Урон с учетом брони
              const targetEquipData = {};
              for (const [slot, itemId] of Object.entries(target.equip)) {
                if (itemId && ITEMS[itemId]) targetEquipData[slot] = ITEMS[itemId];
              }
              const finalDmg = calculateDamage(itemData.dmg || 10, target, targetEquipData);
              
              target.hp -= finalDmg;
              hitSomething = true;

              // Смерть игрока
              if (target.hp <= 0) {
                target.hp = 0;
                // Дропаем ресурсы (но не экипировку)
                for (const [res, qty] of Object.entries(target.inv)) {
                  if (qty > 0 && ['wood', 'stone', 'iron_ore', 'cobalt_ore', 'adamantite_ore', 'holy_ore', 'leather', 'string'].includes(res)) {
                    droppedItems.push({ x: target.x, y: target.y, item: res, qty });
                    target.inv[res] = 0;
                    saveInventory(target.id, res, -qty);
                  }
                }
                target.socket.emit('updateInv', target.inv);
                
                // Респавн в хабе
                const spawn = getSpawnPoint('hub', target.id);
                target.x = spawn.x; target.y = spawn.y; target.zone = 'hub';
                target.hp = target.maxHp;
                target.socket.emit('hp', target.hp);
                target.socket.emit('error', 'Вы погибли! Потерян лут, но броня и оружие сохранены.');

                // Обновляем PK у убийцы
                const pkResult = updatePKKills(p);
                if (pkResult.redUntil) {
                  p.socket.emit('error', 'Вы стали Красным Ником на 3 минуты!');
                }
              }
            }
          });

          // 3.3. Добыча ресурсов
          worldResources.forEach(res => {
            if (res.hp <= 0) return;
            if (isHit(p, res.x, res.y, itemData)) {
              hitSomething = true;
              let dmg = 5;
              // Урон зависит от типа инструмента
              if (res.type === 'tree' && itemId.includes('axe')) dmg = 25;
              if (res.type === 'stone' && itemId.includes('pickaxe')) dmg = 25;
              if (res.type === 'iron' && itemId.includes('pickaxe') && (itemData.tier || 1) >= 2) dmg = 20;
              if (res.type === 'cobalt' && itemId.includes('pickaxe') && (itemData.tier || 1) >= 3) dmg = 20;
              
              res.hp -= dmg;
              if (res.hp <= 0) {
                let dropItem = res.type === 'tree' ? 'wood' : res.type;
                if (res.type === 'iron') dropItem = 'iron_ore';
                droppedItems.push({ x: res.x, y: res.y, item: dropItem, qty: 5 });
                setTimeout(() => { res.hp = res.maxHp; }, 10000);
              }
            }
          });

          // 3.4. Снаряды (лук, посох)
          if (itemData.shape === 'projectile' || itemData.shape === 'aoe_proj') {
            projectiles.push({
              id: ++projIdCounter, 
              x: p.x, y: p.y, angle: p.angle,
              speed: itemData.projSpeed || 0.4, 
              dmg: itemData.dmg,
              aoe: itemData.aoeRadius || 0, 
              type: itemData.shape, 
              owner: p.id,
              poison: itemData.poison,
              slow: itemData.slow
            });
            hitSomething = true;
          }

          if (hitSomething) {
            io.emit('worldUpdate', {
              players: Array.from(players.values()).map(({socket, ...rest}) => rest),
              mobs, resources: worldResources, drops: droppedItems, projectiles, stations: placedStations
            });
          }
        }
      });

      // ==========================================
      // ============ ОТКЛЮЧЕНИЕ ==================
      // ==========================================
      socket.on('disconnect', () => {
        players.delete(playerId);
        io.emit('worldUpdate', {
          players: Array.from(players.values()).map(({socket, ...rest}) => rest),
          mobs, resources: worldResources, drops: droppedItems, projectiles, stations: placedStations
        });
      });

    } catch (err) { 
      console.error('Ошибка подключения:', err); 
    }
  });

  // ==================================================
  // ============ ИГРОВОЙ ЦИКЛ (ТИКИ) =================
  // ==================================================
  setInterval(() => {
    // 1. Обновление снарядов
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const pr = projectiles[i];
      pr.x += Math.cos(pr.angle) * pr.speed;
      pr.y += Math.sin(pr.angle) * pr.speed;
      
      let hit = false;

      // Попадание в мобов
      mobs.forEach(mob => {
        if (mob.alive && Math.hypot(mob.x - pr.x, mob.y - pr.y) < (pr.aoe || 1)) {
          if (applyDamageToMob(mob, pr.dmg)) {
            mob.alive = false;
            droppedItems.push({ x: mob.x, y: mob.y, item: 'wood', qty: 2 });
            setTimeout(() => { mob.hp = mob.maxHp; mob.alive = true; }, 5000);
          }
          hit = true;
        }
      });

      // Попадание в игроков (PvP)
      if (!hit) {
        players.forEach(target => {
          if (target.id === pr.owner || target.hp <= 0) return;
          if (Math.hypot(target.x - pr.x, target.y - pr.y) < (pr.aoe || 1)) {
            const attacker = players.get(pr.owner);
            if (attacker && canAttack(attacker, target, false)) {
              const targetEquipData = {};
              for (const [slot, itemId] of Object.entries(target.equip)) {
                if (itemId && ITEMS[itemId]) targetEquipData[slot] = ITEMS[itemId];
              }
              const finalDmg = calculateDamage(pr.dmg, target, targetEquipData);
              target.hp -= finalDmg;
              target.socket.emit('hp', target.hp);
              if (target.hp <= 0) {
                target.hp = 0;
                const spawn = getSpawnPoint('hub', target.id);
                target.x = spawn.x; target.y = spawn.y; target.zone = 'hub';
                target.hp = target.maxHp;
                target.socket.emit('hp', target.hp);
                target.socket.emit('error', 'Вы погибли от снаряда!');
              }
              hit = true;
            }
          }
        });
      }

      if (hit || pr.x < 0 || pr.x > 100 || pr.y < 0 || pr.y > 100) {
        projectiles.splice(i, 1);
      }
    }

    // 2. Логика мобов (движение к ближайшему игроку)
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
        
        // Коллизия с ресурсами
        let blocked = false;
        worldResources.forEach(res => { 
          if (res.hp > 0 && Math.hypot(newX - res.x, newY - res.y) < res.radius) blocked = true; 
        });
        
        if (!blocked) { mob.x = newX; mob.y = newY; }
      }
    });

    // 3. Подбор лута
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

    // 4. Рассылка обновления мира
    io.emit('worldUpdate', {
      players: Array.from(players.values()).map(({socket, ...rest}) => rest),
      mobs, resources: worldResources, drops: droppedItems, projectiles, stations: placedStations
    });

  }, TICK_RATE);
}