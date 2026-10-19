// game.js
window.onerror = function(m, u, l) { console.error("ERR:", m, "at", l); return true; };

const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

// Глобальное состояние
window.GameState = {
  me: { id: -1, x: 40, y: 40, angle: 0, hp: 100, maxHp: 100, activeSlot: 0 },
  players: [],
  mobs: [],
  resources: [],
  drops: [],
  targetMe: { x: 40, y: 40, angle: 0 }, // Для интерполяции
  isBlocking: false,
  attackFlash: 0,
  socket: null
};

const GS = window.GameState;
const gridSize = 40;

// 1. АВТОРИЗАЦИЯ И СЕТЬ
fetch('/api/auth', {
  method: 'POST', 
  headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ initData: tg?.initData || '', devTgId: tg ? null : Date.now() % 100000 })
})
.then(r => r.json())
.then(({ playerId }) => {
  if (!playerId) return alert('Ошибка авторизации');
  
  GS.me.id = playerId;
  GS.socket = io({ query: { playerId: playerId } });
  
  // Первичная загрузка
  GS.socket.on('init', // Внутри GS.socket.on('init', (state) => { ... })
window.invData = state.inv;
window.hotbarData = state.hotbar;
window.equipData = state.equip;
if (state.equip.shield) document.getElementById('shield-btn').style.display = 'flex';
if(window.updateUIFromServer) window.updateUIFromServer(state.inv, state.hotbar, state.equip);
 (state) => {
    GS.me.hp = state.hp; 
    GS.me.maxHp = state.maxHp;
    GS.me.x = state.x; GS.me.y = state.y;
    GS.targetMe.x = state.x; GS.targetMe.y = state.y;
    updateHUD();
  });

  // Обновление мира 20 раз в секунду
  GS.socket.on('worldUpdate', (world) => {
    GS.players = world.players.filter(p => p.id !== GS.me.id);
    GS.mobs = world.mobs;
    GS.resources = world.resources;
    GS.drops = world.drops;
  });

  // Обновление своих данных
  GS.socket.on('hp', (hp) => { GS.me.hp = hp; updateHUD(); });
  GS.socket.on('error', (msg) => alert(msg));
});

function updateHUD() {
  const percent = (GS.me.hp / GS.me.maxHp) * 100;
  document.getElementById('hp-fill').style.width = percent + '%';
  document.getElementById('hp-text').innerText = `${Math.round(GS.me.hp)} / ${GS.me.maxHp}`;
}

// 2. УПРАВЛЕНИЕ (ИДЕАЛЬНЫЕ ДЖОЙСТИКИ)
let moveVec = { x: 0, y: 0 };
let aimActive = false;

function setupJoystick(joyId, knobId, onChange, onRelease) {
  const joy = document.getElementById(joyId); 
  const knob = document.getElementById(knobId);
  let pointerId = null; 
  let center = { x: 0, y: 0 };

  joy.addEventListener('pointerdown', (e) => {
    pointerId = e.pointerId; 
    joy.setPointerCapture(e.pointerId);
    const rect = joy.getBoundingClientRect(); 
    center = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
    handleMove(e);
  });

  joy.addEventListener('pointermove', (e) => { 
    if (e.pointerId === pointerId) handleMove(e); 
  });

  const endTouch = (e) => {
    if (e.pointerId === pointerId) { 
      pointerId = null; 
      knob.style.transform = `translate(0px, 0px)`; 
      onChange(0, 0); 
      if (onRelease) onRelease(); 
    }
  };
  joy.addEventListener('pointerup', endTouch);
  joy.addEventListener('pointercancel', endTouch);

  function handleMove(e) {
    let dx = e.clientX - center.x; 
    let dy = e.clientY - center.y;
    const dist = Math.hypot(dx, dy); 
    const maxDist = 40;
    if (dist > maxDist) { dx = (dx/dist)*maxDist; dy = (dy/dist)*maxDist; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    onChange(dx/maxDist, dy/maxDist);
  }
}

// Левый джойстик (Движение)
setupJoystick('joy-left', 'knob-left', (x, y) => { moveVec = { x, y }; });

// Правый джойстик (Атака)
setupJoystick('joy-right', 'knob-right', 
  (x, y) => { 
    if (x !== 0 || y !== 0) {
      GS.targetMe.angle = Math.atan2(y, x); 
      aimActive = true; 
    }
  }, 
  () => {
    if (aimActive && GS.socket) { 
      GS.socket.emit('attack'); 
      GS.attackFlash = 8; 
    }
    aimActive = false;
  }
);

// Щит
const shieldBtn = document.getElementById('shield-btn');
shieldBtn.addEventListener('pointerdown', (e) => { 
  e.preventDefault(); 
  GS.isBlocking = true; 
  shieldBtn.style.background = 'rgba(0,150,255,0.9)';
});
shieldBtn.addEventListener('pointerup', (e) => { 
  e.preventDefault(); 
  GS.isBlocking = false; 
  shieldBtn.style.background = 'rgba(0,150,255,0.6)';
});

// Хотбар
document.querySelectorAll('.h-slot').forEach((slot, i) => {
  slot.addEventListener('click', () => {
    document.querySelectorAll('.h-slot').forEach(s => s.classList.remove('active'));
    slot.classList.add('active');
    GS.me.activeSlot = i;
  });
});

// 3. ИГРОВОЙ ЦИКЛ И ОТРИСОВКА
function loop() {
  // Плавное движение (интерполяция)
  const moveSpeed = 0.12;
  GS.targetMe.x += moveVec.x * moveSpeed;
  GS.targetMe.y += moveVec.y * moveSpeed;
  
  // Сглаживание (Lerp)
  GS.me.x += (GS.targetMe.x - GS.me.x) * 0.3;
  GS.me.y += (GS.targetMe.y - GS.me.y) * 0.3;
  GS.me.angle = GS.targetMe.angle;

  // Отправка на сервер
  if (GS.socket && GS.socket.connected) {
    GS.socket.emit('move', { x: GS.me.x, y: GS.me.y, angle: GS.me.angle });
  }

  // Отрисовка
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 2; 
  const cy = canvas.height / 2;

  // 3.1 Сетка
  ctx.strokeStyle = '#2a2a2a'; 
  ctx.lineWidth = 1; 
  ctx.beginPath();
  const offsetX = (GS.me.x * gridSize) % gridSize; 
  const offsetY = (GS.me.y * gridSize) % gridSize;
  for (let i = -gridSize; i < canvas.width + gridSize; i += gridSize) { ctx.moveTo(i - offsetX, 0); ctx.lineTo(i - offsetX, canvas.height); }
  for (let i = -gridSize; i < canvas.height + gridSize; i += gridSize) { ctx.moveTo(0, i - offsetY); ctx.lineTo(canvas.width, i - offsetY); }
  ctx.stroke();

  // 3.2 Ресурсы
  GS.resources.forEach(res => {
    const px = cx + (res.x - GS.me.x) * gridSize; 
    const py = cy + (res.y - GS.me.y) * gridSize;
    if (px < -50 || px > canvas.width + 50 || py < -50 || py > canvas.height + 50) return; // Оптимизация
    
    if (res.type === 'tree') { 
      ctx.fillStyle = '#5c3a21'; ctx.fillRect(px - 6, py - 10, 12, 20); 
      ctx.fillStyle = '#2d6a2e'; ctx.fillRect(px - 15, py - 25, 30, 20); 
    } else { 
      ctx.fillStyle = '#7f8c8d'; ctx.fillRect(px - 15, py - 10, 30, 20); 
    }
    if (res.hp < res.maxHp) { 
      ctx.fillStyle = 'red'; ctx.fillRect(px - 15, py - 40, 30, 4); 
      ctx.fillStyle = 'yellow'; ctx.fillRect(px - 15, py - 40, 30 * (res.hp / res.maxHp), 4); 
    }
  });

  // 3.3 Мобы (Слизни с анимацией)
  const time = Date.now() / 200;
  GS.mobs.forEach(mob => {
    if (!mob.alive) return;
    const px = cx + (mob.x - GS.me.x) * gridSize; 
    const py = cy + (mob.y - GS.me.y) * gridSize;
    if (px < -50 || px > canvas.width + 50 || py < -50 || py > canvas.height + 50) return;
    
    const bounce = Math.sin(time + mob.x) * 3; // Анимация покачивания
    ctx.fillStyle = '#9b59b6'; 
    ctx.beginPath(); ctx.ellipse(px, py + bounce, 18, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px - 6, py - 4 + bounce, 4, 0, Math.PI * 2); ctx.arc(px + 6, py - 4 + bounce, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(px - 6, py - 4 + bounce, 2, 0, Math.PI * 2); ctx.arc(px + 6, py - 4 + bounce, 2, 0, Math.PI * 2); ctx.fill();
    
    ctx.fillStyle = 'red'; ctx.fillRect(px - 20, py - 30, 40, 6); 
    ctx.fillStyle = 'lime'; ctx.fillRect(px - 20, py - 30, 40 * (mob.hp / mob.maxHp), 6);
  });

  // 3.4 Дроп
  GS.drops.forEach(drop => {
    const px = cx + (drop.x - GS.me.x) * gridSize; 
    const py = cy + (drop.y - GS.me.y) * gridSize;
    if (px < -50 || px > canvas.width + 50 || py < -50 || py > canvas.height + 50) return;
    
    ctx.fillStyle = drop.item === 'wood' ? '#8B4513' : '#7f8c8d'; 
    ctx.fillRect(px - 8, py - 8, 16, 16);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(px - 8, py - 8, 16, 16);
  });

  // 3.5 Другие игроки
  GS.players.forEach(p => {
    const px = cx + (p.x - GS.me.x) * gridSize; 
    const py = cy + (p.y - GS.me.y) * gridSize;
    ctx.fillStyle = '#e74c3c'; 
    ctx.fillRect(px - 10, py - 10, 20, 20);
    ctx.fillStyle = '#f1c40f'; 
    ctx.fillRect(px - 6, py - 20, 12, 12);
  });

  // 3.6 Мой персонаж
  ctx.fillStyle = '#3498db'; ctx.fillRect(cx - 10, cy - 10, 20, 20);
  ctx.fillStyle = '#f1c40f'; ctx.fillRect(cx - 6, cy - 20, 12, 12);
  
  // Прицел
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; 
  ctx.beginPath(); ctx.moveTo(cx, cy); 
  ctx.lineTo(cx + Math.cos(GS.me.angle) * 35, cy + Math.sin(GS.me.angle) * 35); ctx.stroke();

  // 3.7 Вспышка удара
  if (GS.attackFlash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${GS.attackFlash / 10})`;
    ctx.beginPath(); ctx.moveTo(cx, cy); 
    ctx.arc(cx, cy, 2.5 * gridSize, GS.me.angle - 0.6, GS.me.angle + 0.6); 
    ctx.closePath(); ctx.fill();
    GS.attackFlash--;
  }

  // 3.8 Щит
  if (GS.isBlocking) {
    ctx.strokeStyle = '#0096ff'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(cx, cy, 30, GS.me.angle - 1.74, GS.me.angle + 1.74); ctx.stroke();
    ctx.fillStyle = 'rgba(0, 150, 255, 0.15)';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, 30, GS.me.angle - 1.74, GS.me.angle + 1.74); ctx.fill();
  }

  requestAnimationFrame(loop);
}

// Запуск
loop();