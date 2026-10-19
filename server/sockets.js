import { Server } from 'socket.io';
import { pool } from './db.js';

// Конфигурация мира
const TICK_RATE = 1000 / 20; // 20 тиков в секунду (плавно и не грузит сеть)

const worldResources = [
  { id: 'tree_1', type: 'tree', x: 42, y: 38, hp: 100, maxHp: 100 },
  { id: 'stone_1', type: 'stone', x: 45, y: 48, hp: 150, maxHp: 150 },
];

const mobs = [
  { id: 'mob_1', x: 45, y: 40, hp: 100, maxHp: 100, alive: true, speed: 0.05, target: null },
];

let droppedItems = [];

export function initSockets(httpServer) {
  const io = new Server(httpServer, { cors: { origin: '*' } });
  const players = new Map(); // Храним игроков в памяти для быстрого доступа

  io.on('connection', async (socket) => {
    const playerId = Number(socket.handshake.query.playerId);
    if (!playerId) return socket.disconnect();

    // Загружаем данные
    const dbRes = await pool.query('SELECT * FROM players WHERE id = $1', [playerId]);
    if (dbRes.rows.length === 0) return socket.disconnect();
    
    // Инициализация состояния игрока
    const state = {
      id: playerId,
      x: 40, y: 40, angle: 0,
      hp: dbRes.rows[0].hp || 100, maxHp: 100,
      hotbar: ['apple', 'sword', 'pickaxe', 'axe'],
      activeSlot: 0,
      equip: { helmet: null, chest: null, shield: null },
      isBlocking: false,
      lastFoodAt: 0
    };
    
    players.set(playerId, state);
    socket.emit('init', state);

    // Обработка движения
    socket.on('move', (data) => {
      const p = players.get(playerId);
      if (p) {
        p.x = data.x; p.y = data.y; p.angle = data.angle;
      }
    });

    // Обработка атаки
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

      // Проверка попадания по мобам
      mobs.forEach(mob => {
        if (!mob.alive) return;
        const dist = Math.hypot(mob.x - p.x, mob.y - p.y);
        if (dist < 2.5) { // Если близко
          const angleToMob = Math.atan2(mob.y - p.y, mob.x - p.x);
          let diff = Math.abs(p.angle - angleToMob);
          if (diff > Math.PI) diff = Math.PI * 2 - diff;
          
          if (diff < 0.8) { // Если смотрит в сторону моба
            mob.hp -= 25;
            if (mob.hp <= 0) {
              mob.alive = false;
              droppedItems.push({ x: mob.x, y: mob.y, item: 'wood', qty: 2 });
              setTimeout(() => { mob.hp = mob.maxHp; mob.alive = true; }, 5000);
            }
          }
        }
      });
    });

    socket.on('disconnect', () => {
      players.delete(playerId);
    });
  });

  // ИГРОВОЙ ЦИКЛ СЕРВЕРА (Тики)
  setInterval(() => {
    // Логика мобов (движение к ближайшему игроку)
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

    // Отправка состояния мира всем игрокам
    const worldState = {
      players: Array.from(players.values()),
      mobs: mobs,
      resources: worldResources,
      drops: droppedItems
    };
    
    io.emit('worldUpdate', worldState);
  }, TICK_RATE);
}