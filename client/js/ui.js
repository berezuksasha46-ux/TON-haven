const getIcon = (id) => ({ apple: '🍎', sword: '⚔️', pickaxe: '⛏️', axe: '🪓', shield_wood: '🛡️', wood: '🪵', stone: '🪨' }[id] || '📦');

document.addEventListener("DOMContentLoaded", () => {
  const invGrid = document.getElementById('inv-grid');
  if (invGrid) for (let i = 0; i < 16; i++) invGrid.innerHTML += `<div class="i-slot" data-type="inv" data-index="${i}"></div>`;
  const hotbarInv = document.getElementById('hotbar-inv');
  if (hotbarInv) for (let i = 0; i < 4; i++) hotbarInv.innerHTML += `<div class="i-slot" data-type="hotbar" data-index="${i}"></div>`;
  initDragAndDrop();
});

window.updateUI = function() {
  const GS = window.GameState;
  if (!GS) return;
  const fill = document.getElementById('hp-fill'), text = document.getElementById('hp-text');
  if (fill && text) { fill.style.width = (GS.me.hp / GS.me.maxHp) * 100 + '%'; text.innerText = `${Math.round(GS.me.hp)} / ${GS.me.maxHp}`; }
  
  const invSlots = document.querySelectorAll('#inv-grid .i-slot');
  invSlots.forEach(s => { s.innerHTML = ''; s.dataset.itemId = ''; });
  let idx = 0;
  for (const [key, qty] of Object.entries(GS.inv)) {
    if (qty > 0 && idx < 16) { invSlots[idx].innerHTML = `<span>${getIcon(key)}</span><span class="item-count">${qty}</span>`; invSlots[idx].dataset.itemId = key; idx++; }
  }
  const hotSlots = document.querySelectorAll('#hotbar-inv .i-slot');
  hotSlots.forEach((s, i) => { s.innerHTML = GS.hotbar[i] ? getIcon(GS.hotbar[i]) : ''; s.dataset.itemId = GS.hotbar[i] || ''; });
  document.querySelectorAll('.h-slot').forEach((s, i) => { s.innerHTML = GS.hotbar[i] ? getIcon(GS.hotbar[i]) : ''; });
  ['helmet', 'chest', 'shield'].forEach(slot => {
    const el = document.querySelector(`.eq-slot[data-slot="${slot}"]`);
    if(el) { if (GS.equip[slot]) { el.style.borderColor = '#00ff00'; el.innerHTML = getIcon(GS.equip[slot]); } else { el.style.borderColor = '#333'; el.innerHTML = slot === 'helmet' ? '🪖' : slot === 'chest' ? '🥋' : '🛡️'; } }
  });
};

let draggedItem = null, dragGhost = null, dragStartTime = 0;

function initDragAndDrop() {
  document.querySelectorAll('.i-slot, .eq-slot').forEach(el => {
    el.addEventListener('pointerdown', (e) => startDrag(e, el));
  });
}

function startDrag(e, el) {
  const GS = window.GameState;
  if (!GS) return;
  const itemId = el.dataset.itemId || (el.dataset.type === 'equip' ? (GS.equip[el.dataset.slot] || null) : null);
  if (!itemId) return;
  
  // Задержка для Touch (250ms), чтобы не конфликтовать со свайпом [citation:16]
  const isTouch = e.pointerType === 'touch';
  const delay = isTouch ? 250 : 0;
  
  const timer = setTimeout(() => {
    dragStartTime = Date.now();
    draggedItem = { itemId, from: { type: el.dataset.type, index: el.dataset.index, slot: el.dataset.slot } };
    dragGhost = document.createElement('div');
    dragGhost.className = 'drag-ghost'; dragGhost.innerText = getIcon(itemId);
    document.body.appendChild(dragGhost);
    dragGhost.style.left = e.clientX + 'px'; dragGhost.style.top = e.clientY + 'px';
    
    const moveHandler = (ev) => {
      if (!dragGhost) return;
      dragGhost.style.left = ev.clientX + 'px'; dragGhost.style.top = ev.clientY + 'px';
    };
    const upHandler = (ev) => {
      document.removeEventListener('pointermove', moveHandler);
      document.removeEventListener('pointerup', upHandler);
      if (!dragGhost || !draggedItem) return;
      dragGhost.remove(); dragGhost = null;
      const dropTarget = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.i-slot, .eq-slot');
      if (dropTarget && GS.socket) {
        const to = { type: dropTarget.dataset.type, index: dropTarget.dataset.index, slot: dropTarget.dataset.slot };
        GS.socket.emit('moveItem', { from: draggedItem.from, to, itemId: draggedItem.itemId });
      }
      draggedItem = null;
    };
    document.addEventListener('pointermove', moveHandler);
    document.addEventListener('pointerup', upHandler);
  }, delay);
  
  const cancelHandler = () => { clearTimeout(timer); el.removeEventListener('pointerup', cancelHandler); el.removeEventListener('pointermove', cancelHandler); };
  el.addEventListener('pointerup', cancelHandler, { once: true });
  el.addEventListener('pointermove', cancelHandler, { once: true });
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById('inventory-btn')?.addEventListener('click', () => document.getElementById('inv-overlay')?.classList.add('open'));
  document.getElementById('close-inv')?.addEventListener('click', () => document.getElementById('inv-overlay')?.classList.remove('open'));
});