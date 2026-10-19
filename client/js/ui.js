// ui.js
window.invData = {};
window.hotbarData = [];
window.equipData = {};

const getIcon = (id) => id === 'apple' ? '🍎' : id === 'sword' ? '⚔️' : id === 'pickaxe' ? '⛏️' : id === 'axe' ? '🪓' : id === 'shield_wood' ? '🛡️' : id === 'wood' ? '🪵' : '📦';

document.addEventListener("DOMContentLoaded", () => {
  const invGrid = document.getElementById('inv-grid');
  if (invGrid) {
    for (let i = 0; i < 16; i++) invGrid.innerHTML += `<div class="i-slot" data-type="inv" data-index="${i}"></div>`;
  }
  
  const hotbarInv = document.getElementById('hotbar-inv');
  if (hotbarInv) {
    for (let i = 0; i < 4; i++) hotbarInv.innerHTML += `<div class="i-slot" data-type="hotbar" data-index="${i}"></div>`;
  }
  
  initDragAndDrop();
  renderUI();
});

function renderUI() {
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

  const hotSlots = document.querySelectorAll('#hotbar-inv .i-slot');
  hotSlots.forEach((s, i) => {
    s.innerHTML = window.hotbarData[i] ? getIcon(window.hotbarData[i]) : '';
    s.dataset.itemId = window.hotbarData[i] || '';
  });

  document.querySelectorAll('.h-slot').forEach((s, i) => {
    s.innerHTML = window.hotbarData[i] ? getIcon(window.hotbarData[i]) : '';
  });

  Object.keys(window.equipData).forEach(slot => {
    const el = document.querySelector(`.eq-slot[data-slot="${slot}"]`);
    if(el) {
      if (window.equipData[slot]) {
        el.style.borderColor = '#00ff00';
        el.innerHTML = getIcon(window.equipData[slot]);
      } else {
        el.style.borderColor = '#333';
        el.innerHTML = slot === 'helmet' ? '🪖' : slot === 'chest' ? '🥋' : '🛡️';
      }
    }
  });
}

let draggedItem = null;
let dragGhost = null;

function initDragAndDrop() {
  const interactables = document.querySelectorAll('.i-slot, .eq-slot');
  interactables.forEach(el => {
    el.addEventListener('touchstart', (e) => startDrag(e, el), { passive: false });
    el.addEventListener('touchmove', (e) => moveDrag(e), { passive: false });
    el.addEventListener('touchend', (e) => endDrag(e));
    el.addEventListener('mousedown', (e) => startDrag(e, el));
  });
}

function startDrag(e, el) {
  const itemId = el.dataset.itemId || (el.dataset.type === 'equip' ? window.equipData[el.dataset.slot] : null);
  if (!itemId) return;

  draggedItem = { itemId, from: { type: el.dataset.type, index: el.dataset.index, slot: el.dataset.slot } };
  dragGhost = document.createElement('div');
  dragGhost.className = 'drag-ghost';
  dragGhost.innerText = getIcon(itemId);
  document.body.appendChild(dragGhost);

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  dragGhost.style.left = clientX + 'px';
  dragGhost.style.top = clientY + 'px';
  e.preventDefault();
}

function moveDrag(e) {
  if (!dragGhost) return;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  dragGhost.style.left = clientX + 'px';
  dragGhost.style.top = clientY + 'px';
  e.preventDefault();
}

function endDrag(e) {
  if (!dragGhost || !draggedItem) return;
  const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
  const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
  dragGhost.remove();
  dragGhost = null;

  const dropTarget = document.elementFromPoint(clientX, clientY).closest('.i-slot, .eq-slot');
  
  // ИСПРАВЛЕНО: Отправляем через GameState.socket
  if (dropTarget && window.GameState && window.GameState.socket) {
    const to = { type: dropTarget.dataset.type, index: dropTarget.dataset.index, slot: dropTarget.dataset.slot };
    window.GameState.socket.emit('moveItem', { from: draggedItem.from, to, itemId: draggedItem.itemId });
  }
  draggedItem = null;
}

document.getElementById('inventory-btn')?.addEventListener('click', () => {
  document.getElementById('inv-overlay')?.classList.add('open');
  renderUI();
});
document.getElementById('close-inv')?.addEventListener('click', () => {
  document.getElementById('inv-overlay')?.classList.remove('open');
});

window.updateUIFromServer = function(inv, hotbar, equip) {
  window.invData = inv;
  window.hotbarData = hotbar;
  window.equipData = equip;
  renderUI();
};