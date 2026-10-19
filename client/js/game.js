window.onerror = function(m) { console.error(m); return true; };
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); }

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
window.addEventListener('resize', resize); resize();
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

window.GameState = {
  me: { id: -1, x: 40, y: 40, angle: 0, hp: 100, maxHp: 100, activeSlot: 0 },
  players: [], mobs: [], resources: [], drops: [], stations: [], projectiles: [],
  targetMe: { x: 40, y: 40, angle: 0 },
  isBlocking: false, attackFlash: 0, socket: null, inv: {}, hotbar: [], equip: {},
  isAiming: false
};
const GS = window.GameState;
const gridSize = 40;

fetch('/api/auth', {
  method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ initData: tg?.initData || '', devTgId: tg ? null : Date.now() % 100000 })
})
.then(r => r.json())
.then(({ playerId }) => {
  if (!playerId) return alert('Ошибка авторизации');
  GS.me.id = playerId;
  GS.socket = io({ query: { playerId }, reconnectionAttempts: Infinity });
  
  GS.socket.on('init', (data) => {
    const state = data.state;
    GS.me.hp = state.hp; GS.me.maxHp = state.maxHp; GS.me.x = state.x; GS.me.y = state.y;
    GS.targetMe.x = state.x; GS.targetMe.y = state.y;
    GS.inv = state.inv; GS.hotbar = state.hotbar; GS.equip = state.equip;
    GS.stations = data.stations || [];
    if (GS.equip.shield) document.getElementById('shield-btn').style.display = 'flex';
    if(window.updateUI) window.updateUI();
  });

  GS.socket.on('worldUpdate', (w) => {
    GS.players = w.players.filter(p => p.id !== GS.me.id);
    GS.mobs = w.mobs; GS.resources = w.resources; GS.drops = w.drops;
    GS.projectiles = w.projectiles || []; GS.stations = w.stations || [];
  });

  GS.socket.on('hp', (hp) => { GS.me.hp = hp; if(window.updateUI) window.updateUI(); });
  GS.socket.on('error', alert);
  GS.socket.on('updateEquip', (eq) => { GS.equip = eq; const b = document.getElementById('shield-btn'); if(b) b.style.display = eq.shield ? 'flex' : 'none'; if(window.updateUI) window.updateUI(); });
  GS.socket.on('updateHotbar', (hb) => { GS.hotbar = hb; if(window.updateUI) window.updateUI(); });
  GS.socket.on('updateInv', (inv) => { GS.inv = inv; if(window.updateUI) window.updateUI(); });
  GS.socket.on('craftSuccess', (id) => { if(window.renderCrafting) renderCrafting(); });
  GS.socket.on('stationPlaced', (st) => { GS.stations.push(st); });
});

let moveVec = { x: 0, y: 0 }, aimActive = false;
function setupJoystick(joyId, knobId, onChange, onRelease) {
  const joy = document.getElementById(joyId), knob = document.getElementById(knobId);
  if (!joy || !knob) return;
  let pointerId = null, center = { x: 0, y: 0 };
  joy.addEventListener('pointerdown', (e) => {
    pointerId = e.pointerId; joy.setPointerCapture(e.pointerId);
    const rect = joy.getBoundingClientRect(); center = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
    GS.isAiming = true; handleMove(e);
  });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === pointerId) handleMove(e); });
  const endTouch = (e) => { 
    if (e.pointerId === pointerId) { 
      pointerId = null; knob.style.transform = `translate(0px, 0px)`; onChange(0, 0); 
      GS.isAiming = false; if (onRelease) onRelease(); 
    } 
  };
  joy.addEventListener('pointerup', endTouch); joy.addEventListener('pointercancel', endTouch);
  function handleMove(e) {
    let dx = e.clientX - center.x, dy = e.clientY - center.y;
    const dist = Math.hypot(dx, dy), maxDist = 40;
    if (dist > maxDist) { dx = (dx/dist)*maxDist; dy = (dy/dist)*maxDist; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    onChange(dx/maxDist, dy/maxDist);
  }
}
setupJoystick('joy-left', 'knob-left', (x, y) => { moveVec = { x, y }; });
setupJoystick('joy-right', 'knob-right', 
  (x, y) => { if (x !== 0 || y !== 0) { GS.targetMe.angle = Math.atan2(y, x); aimActive = true; } }, 
  () => { if (aimActive && GS.socket) { GS.socket.emit('attack'); GS.attackFlash = 8; } aimActive = false; }
);

document.getElementById('shield-btn')?.addEventListener('pointerdown', (e) => { e.preventDefault(); GS.isBlocking = true; e.target.style.background = 'rgba(0,150,255,0.9)'; });
document.getElementById('shield-btn')?.addEventListener('pointerup', (e) => { e.preventDefault(); GS.isBlocking = false; e.target.style.background = 'rgba(0,150,255,0.6)'; });

document.querySelectorAll('.h-slot').forEach((slot, i) => {
  slot.addEventListener('click', () => {
    document.querySelectorAll('.h-slot').forEach(s => s.classList.remove('active'));
    slot.classList.add('active');
    GS.me.activeSlot = i;
    if(GS.socket) GS.socket.emit('selectSlot', i);
  });
});

// Зона наводки
function drawAimZone(cx, cy) {
  if (!GS.isAiming) return;
  const itemId = GS.hotbar[GS.me.activeSlot];
  const shapes = {
    sword_wood: 'arc', sword_stone: 'arc', sword_iron: 'arc', sword_cobalt: 'arc', sword_adamantite: 'arc', sword_holy: 'arc',
    spear_stone: 'line', spear_iron: 'line', spear_cobalt: 'line', bat_wood: 'arc', bat_iron: 'arc',
    bow_wood: 'ray', bow_iron: 'ray', bow_cobalt: 'ray', shuriken_iron: 'ray', star_pistol: 'ray', star_rifle: 'ray',
    staff_fire: 'ray', staff_ice: 'ray', book_lightning: 'ray', pickaxe_wood: 'line', pickaxe_stone: 'line', 
    pickaxe_iron: 'line', pickaxe_cobalt: 'line', axe_wood: 'line', axe_stone: 'line', axe_iron: 'line',
  };
  const shape = shapes[itemId] || 'arc';
  
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(GS.me.angle);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'; ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; ctx.lineWidth = 2;

  if (shape === 'arc') {
    ctx.beginPath(); ctx.arc(0, 0, 2.5 * gridSize, -0.8, 0.8); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (shape === 'line') {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(3.0 * gridSize, -0.3 * gridSize); ctx.lineTo(3.0 * gridSize, 0.3 * gridSize); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (shape === 'ray') {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(8.0 * gridSize, 0); ctx.stroke();
  }
  ctx.restore();
}

function loop() {
  GS.targetMe.x += moveVec.x * 0.12; GS.targetMe.y += moveVec.y * 0.12;
  GS.me.x += (GS.targetMe.x - GS.me.x) * 0.3; GS.me.y += (GS.targetMe.y - GS.me.y) * 0.3;
  GS.me.angle = GS.targetMe.angle;
  if (GS.socket) GS.socket.emit('move', { x: GS.me.x, y: GS.me.y, angle: GS.me.angle });

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 2, cy = canvas.height / 2;
  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1; ctx.beginPath();
  const offsetX = (GS.me.x * gridSize) % gridSize, offsetY = (GS.me.y * gridSize) % gridSize;
  for (let i = -gridSize; i < canvas.width + gridSize; i += gridSize) { ctx.moveTo(i - offsetX, 0); ctx.lineTo(i - offsetX, canvas.height); }
  for (let i = -gridSize; i < canvas.height + gridSize; i += gridSize) { ctx.moveTo(0, i - offsetY); ctx.lineTo(canvas.width, i - offsetY); }
  ctx.stroke();

  // Ресурсы
  GS.resources.forEach(res => {
    const px = cx + (res.x - GS.me.x) * gridSize, py = cy + (res.y - GS.me.y) * gridSize;
    if (res.type === 'tree') { ctx.fillStyle = '#5c3a21'; ctx.fillRect(px - 6, py - 10, 12, 20); ctx.fillStyle = '#2d6a2e'; ctx.fillRect(px - 15, py - 25, 30, 20); }
    else if (res.type === 'stone') { ctx.fillStyle = '#7f8c8d'; ctx.fillRect(px - 15, py - 10, 30, 20); }
    else if (res.type === 'iron') { ctx.fillStyle = '#a67c52'; ctx.fillRect(px - 15, py - 10, 30, 20); }
    else if (res.type === 'cobalt') { ctx.fillStyle = '#3498db'; ctx.fillRect(px - 15, py - 10, 30, 20); }
    else if (res.type === 'adamantite') { ctx.fillStyle = '#2ecc71'; ctx.fillRect(px - 15, py - 10, 30, 20); }
    else if (res.type === 'holy') { ctx.fillStyle = '#f1c40f'; ctx.fillRect(px - 15, py - 10, 30, 20); }
    if (res.hp < res.maxHp) { ctx.fillStyle = 'red'; ctx.fillRect(px - 15, py - 40, 30, 4); ctx.fillStyle = 'yellow'; ctx.fillRect(px - 15, py - 40, 30 * (res.hp / res.maxHp), 4); }
  });

  // Мобы
  const time = Date.now() / 200;
  GS.mobs.forEach(mob => {
    if (!mob.alive) return;
    const px = cx + (mob.x - GS.me.x) * gridSize, py = cy + (mob.y - GS.me.y) * gridSize;
    const bounce = Math.sin(time + mob.x) * 3;
    ctx.fillStyle = mob.type === 'slime' ? '#9b59b6' : mob.type === 'goblin' ? '#e67e22' : '#95a5a6';
    ctx.beginPath(); ctx.ellipse(px, py + bounce, 18, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px - 6, py - 4 + bounce, 4, 0, Math.PI * 2); ctx.arc(px + 6, py - 4 + bounce, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(px - 6, py - 4 + bounce, 2, 0, Math.PI * 2); ctx.arc(px + 6, py - 4 + bounce, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'red'; ctx.fillRect(px - 20, py - 30, 40, 6); ctx.fillStyle = 'lime'; ctx.fillRect(px - 20, py - 30, 40 * (mob.hp / mob.maxHp), 6);
  });

  // Станки
  GS.stations.forEach(st => {
    const px = cx + (st.x - GS.me.x) * gridSize, py = cy + (st.y - GS.me.y) * gridSize;
    ctx.fillStyle = '#bdc3c7'; ctx.fillRect(px - 15, py - 15, 30, 30);
    ctx.font = '20px Arial'; ctx.textAlign = 'center'; ctx.fillText('🔨', px, py + 5);
  });

  // Дроп
  GS.drops.forEach(drop => {
    const px = cx + (drop.x - GS.me.x) * gridSize, py = cy + (drop.y - GS.me.y) * gridSize;
    ctx.fillStyle = drop.item === 'wood' ? '#8B4513' : drop.item === 'stone' ? '#7f8c8d' : '#fff'; 
    ctx.fillRect(px - 8, py - 8, 16, 16);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(px - 8, py - 8, 16, 16);
  });

  // Снаряды
  GS.projectiles.forEach(proj => {
    const px = cx + (proj.x - GS.me.x) * gridSize, py = cy + (proj.y - GS.me.y) * gridSize;
    ctx.fillStyle = proj.type === 'aoe_proj' ? '#ff6600' : '#fff';
    ctx.beginPath(); ctx.arc(px, py, proj.aoe ? 10 : 5, 0, Math.PI * 2); ctx.fill();
  });

  // Другие игроки
  GS.players.forEach(p => {
    const px = cx + (p.x - GS.me.x) * gridSize, py = cy + (p.y - GS.me.y) * gridSize;
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(px - 10, py - 10, 20, 20); ctx.fillStyle = '#f1c40f'; ctx.fillRect(px - 6, py - 20, 12, 12);
  });

  // Мой персонаж
  ctx.fillStyle = '#3498db'; ctx.fillRect(cx - 10, cy - 10, 20, 20);
  ctx.fillStyle = '#f1c40f'; ctx.fillRect(cx - 6, cy - 20, 12, 12);
  
  drawAimZone(cx, cy);

  // Прицел
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(GS.me.angle) * 35, cy + Math.sin(GS.me.angle) * 35); ctx.stroke();

  // Вспышка
  if (GS.attackFlash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${GS.attackFlash / 10})`;
    ctx.beginPath(); ctx.arc(cx, cy, 2.5 * gridSize, GS.me.angle - 0.6, GS.me.angle + 0.6); ctx.closePath(); ctx.fill();
    GS.attackFlash--;
  }

  // Щит
  if (GS.isBlocking) {
    ctx.strokeStyle = '#0096ff'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(cx, cy, 30, GS.me.angle - 1.74, GS.me.angle + 1.74); ctx.stroke();
    ctx.fillStyle = 'rgba(0, 150, 255, 0.15)';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, 30, GS.me.angle - 1.74, GS.me.angle + 1.74); ctx.fill();
  }
  requestAnimationFrame(loop);
}
loop();