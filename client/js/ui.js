// ui.js
window.invData = { wood: 5, apple: 3, shield_wood: 1, axe_wood: 1 };
window.hotbarData = ['apple', 'sword', 'pickaxe', 'axe'];
window.equipData = { helmet: null, chest: null, legs: null, boots: null, shield: null, ring: null };

const getIcon = (id) => id === 'apple' ? '🍎' : id === 'sword' ? '⚔️' : id === 'pickaxe' ? '⛏️' : id === 'axe' ? '🪓' : id === 'shield_wood' ? '🛡️' : id === 'wood' ? '🪵' : '📦';

// Инициализация сеток
document.addEventListener("DOMContentLoaded", () => {
  const invGrid = document.getElementById('inv-grid');
  for (let i = 0; i < 16; i++) invGrid.innerHTML += `<div class="i-slot" data-type="inv" data-index="${i}"></div>`;
  const hotbarInv = document.getElementById('hotbar-inv');
  for (let i = 0; i < 4; i++) hotbarInv.innerHTML += `<div class="i-slot" data-type="hotbar" data-index="${i}"></div>`;
  renderUI();
});

function renderUI() {
  // Инвентарь
  const invSlots = document.querySelectorAll('#inv-grid .i-slot');
  invSlots.forEach(s => { s.innerHTML = ''; s.dataset.itemId = ''; });
  let idx = 0;
  for (const [key, qty] of Object.entries(window.invData)) {
    if (qty > 0 && idx < 16) {
      invSlots[idx].innerHTML = `<span>${getIcon(key)}</span><span class="item-count">${qty}</span>`;
      invSlots[idx].dataset.itemId = key;
      idx++;
    }
  }

  // Хотбар внутри инвентаря
  const hotSlots = document.querySelectorAll('#hotbar-inv .i-slot');
  hotSlots.forEach((s, i) => {
    s.innerHTML = window.hotbarData[i] ? getIcon(window.hotbarData[i]) : '';
    s.dataset.itemId = window.hotbarData[i] || '';
  });

  // Нижний хотбар
  document.querySelectorAll('.h-slot').forEach((s, i) => {
    s.innerHTML = window.hotbarData[i] ? getIcon(window.hotbarData[i]) : '';
  });

  // Экипировка
  Object.keys(window.equipData).forEach(slot => {
    const el = document.querySelector(`.eq-slot[data-slot="${slot}"]`);
    if(el) {
      if (window.equipData[slot]) {
        el.style.borderColor = '#00ff00';
        // Можно добавить иконку поверх
      } else {
        el.style.borderColor = '#444';
      }
    }
  });
}

// Drag and Drop для тача
let dragGhost = null;
let dragData = null;

function handleDragStart(e, el) {
  const itemId = el.dataset.itemId;
  if (!itemId) return;
  
  dragData = { itemId, from: { type: el.dataset.type, index: el.dataset.index, slot: el.dataset.slot } };
  dragGhost = document.createElement('div');
  dragGhost.className = 'drag-ghost';
  dragGhost.innerText = getIcon(itemId);
  document.body.appendChild(dragGhost);
  moveGhost(e.touches[0]);
  e.preventDefault();
}

function moveGhost(touch) {
  if (dragGhost) {
    dragGhost.style.left = touch.clientX + 'px';
    dragGhost.style.top = touch.clientY + 'px';
  }
}

function handleDragEnd(e) {
  if (!dragGhost) return;
  dragGhost.remove();
  const touch = e.changedTouches[0];
  const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY).closest('.i-slot, .eq-slot');
  
  if (dropTarget && dropTarget.dataset.type && window.socket) {
    const to = { type: dropTarget.dataset.type, index: dropTarget.dataset.index, slot: dropTarget.dataset.slot };
    window.socket.emit('moveItem', { from: dragData.from, to, itemId: dragData.itemId });
  }
  dragGhost = null;
  dragData = null;
}

// Навешиваем события после рендера
setTimeout(() => {
  document.querySelectorAll('.i-slot, .eq-slot').forEach(el => {
    el.addEventListener('touchstart', (e) => handleDragStart(e, el), { passive: false });
    el.addEventListener('touchmove', (e) => { moveGhost(e.touches[0]); e.preventDefault(); }, { passive: false });
    el.addEventListener('touchend', handleDragEnd);
  });

  document.getElementById('inventory-btn').addEventListener('click', () => {
    document.getElementById('inv-overlay').classList.add('open');
    renderUI();
  });
  document.getElementById('close-inv').addEventListener('click', () => {
    document.getElementById('inv-overlay').classList.remove('open');
  });
}, 100);