import { Server } from 'socket.io';
import { pool } from './db.js';
import { ITEMS, ZONES, isSafeZone } from './game/world.js';
import { isRed } from './game/pk.js';

// --- РЕСУРСЫ (Деревья и Камни) ---
export const worldResources = [
  { id: 'tree_1', type: 'tree', x: 42, y: 38, hp: 100 },
  { id: 'tree_2', type: 'tree', x: 38, y: 45, hp: 100 },
  { id: 'stone_1', type: 'stone', x: 45, y: 48, hp: 150 },
  { id: 'stone_2', type: 'stone', x: 35, y: 35, hp: 150 },
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
    
    // Загружаем игрока и его инвентарь из БД
    const dbp = (await pool.query(`SELECT * FROM players WHERE id=$1`, [playerId])).rows[0];
    if (!dbp) return socket.disconnect(true);

    const invData = (await pool.query(`SELECT item_id, qty FROM inventory WHERE player_id=$1`, [playerId])).rows;
    const inventory = {};
    invData.forEach(i => inventory[i.item_id] = i.qty);

    const state = {
      id: playerId, zone: 'hub', x: 40, y: 40, angle: 0,
      hp: dbp.hp, maxHp: dbp.max_hp,
      tool: 'hand', // Текущий инструмент (hand, axe, pickaxe)
      inv: inventory,
      isRed: isRed(dbp)
    };
    
    joinZone('hub', state);
    socket.emit('welcome', { state, items: ITEMS });
    broadcastZone();

    socket.on('move', ({ x, y, angle }) => {
      state.x = x; state.y = y; state.angle = angle;
      broadcastZone();
    });

    // Смена инструмента (выбор в хотбаре)
    socket.on('equip', ({ toolId }) => {
      state.tool = toolId || 'hand';
      socket.emit('equipResult', { tool: state.tool });
      broadcastZone();
    });

    socket.on('attack', async ({ angle }) => {
      const range = 3.0; const arc = 0.8;
      let targetHit = false;

      // 1. Проверяем, не бьем ли мы ресурс (дерево/камень)
      worldResources.forEach(async (res) => {
        if (res.hp <= 0) return;
        const dist = Math.hypot(res.x - state.x, res.y - state.y);
        
        if (dist <= range) {
          const a = Math.atan2(res.y - state.y, res.x - state.x);
          let delta = Math.abs(a - angle);
          while (delta > Math.PI) delta = Math.abs(delta - Math.PI * 2);
          
          if (delta <= arc) {
            targetHit = true;
            // Урон зависит от инструмента
            let dmg = 5; // Кулаком очень медленно
            if (res.type === 'tree' && state.tool === 'axe') dmg = 25;
            if (res.type === 'stone' && state.tool === 'pickaxe') dmg = 25;
            if (res.type === 'tree' && state.tool === 'pickaxe') dmg = 10;
            if (res.type === 'stone' && state.tool === 'axe') dmg = 10;

            res.hp -= dmg;
            
            if (res.hp <= 0) {
              // Выдаем лут и сохраняем в БД
              const dropItem = res.type === 'tree' ? 'wood' : 'stone';
              const qty = 5;
              state.inv[dropItem] = (state.inv[dropItem] || 0) + qty;
              
              await pool.query(
                `INSERT INTO inventory(player_id, item_id, qty) VALUES($1, $2, $3) 
                 ON CONFLICT(player_id, item_id) DO UPDATE SET qty = inventory.qty + EXCLUDED.qty`,
                [playerId, dropItem, qty]
              );

              socket.emit('updateInv', state.inv);
              
              // Респавн ресурса через 10 секунд
              setTimeout(() => { res.hp = res.type === 'tree' ? 100 : 150; broadcastZone(); }, 10000);
            }
          }
        }
      });

      // 2. Если не попали в ресурс, бьем мобов (логика из прошлого шага)
      // ... (тут можно оставить код мобов, я его убрал для краткости, но вы можете оставить свой)

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
        io.to('zone:' + state.zone).emit('zoneState', [...map.values()], worldResources);
      }
    }
  });
}