const ICONS = { apple: '🍎', sword_wood: '⚔️', sword_stone: '🗡️', sword_iron: '⚔️', sword_cobalt: '💠', sword_adamantite: '🟢', sword_holy: '✨', spear_stone: '🔱', spear_iron: '🔱', spear_cobalt: '🔱', bat_wood: '🏏', bat_iron: '🏏', yoyo_wood: '🪀', yoyo_iron: '🪀', bow_wood: '🏹', bow_iron: '🏹', bow_cobalt: '🏹', shuriken_iron: '🌀', shuriken_poison: '🌀', snowball: '❄️', star_pistol: '🔫', star_rifle: '🔫', staff_fire: '🪄', staff_ice: '🪄', book_lightning: '📖', book_heal: '📖', staff_summon: '🌿', pickaxe_wood: '⛏️', pickaxe_stone: '⛏️', pickaxe_iron: '⛏️', pickaxe_cobalt: '💠', pickaxe_diamond: '💠', axe_wood: '🪓', axe_stone: '🪓', axe_iron: '🪓', fishing_rod: '🎣', helmet_leather: '🪖', helmet_iron: '🪖', helmet_cobalt: '💠', helmet_adamantite: '🟢', helmet_holy: '✨', chest_leather: '🥋', chest_iron: '🥋', chest_cobalt: '💠', chest_adamantite: '🟢', chest_holy: '✨', legs_leather: '👖', legs_iron: '👖', boots_leather: '👢', boots_iron: '👢', shield_wood: '🛡️', shield_iron: '🛡️', ring_gold: '💍', wood: '🪵', stone: '🪨', iron_ore: '⛏️', iron_ingot: '⛓️', cobalt_ore: '💠', cobalt_ingot: '🔷', adamantite_ore: '🟢', adamantite_ingot: '🟩', holy_ore: '✨', holy_ingot: '🌟', leather: '🟫', string: '🧵', bone: '🦴', diamond: '💎', magic_crystal: '🔮', bread: '🍞', meat_cooked: '🍖', golden_apple: '🍏', station_workbench: '🔨', station_furnace: '🔥', station_forge: '⚒️', station_anvil: '🛠️' };
const getIcon = (id) => ICONS[id] || '📦';

// Данные о предметах для тултипов (дублируем с сервера для скорости)
const ITEM_DATA = {
  sword_wood: { name: 'Деревянный меч', desc: 'Урон: 15 | Скорость: 0.5с | Дальность: 2.2' },
  sword_stone: { name: 'Каменный меч', desc: 'Урон: 28 | Скорость: 0.45с | Дальность: 2.3' },
  sword_iron: { name: 'Железный меч', desc: 'Урон: 45 | Скорость: 0.4с | Дальность: 2.5' },
  sword_cobalt: { name: 'Кобальтовый меч', desc: 'Урон: 65 | Скорость: 0.35с | Дальность: 2.6' },
  sword_adamantite: { name: 'Адамантитовый меч', desc: 'Урон: 90 | Скорость: 0.3с | Дальность: 2.8' },
  sword_holy: { name: 'Святой меч', desc: 'Урон: 150 | Скорость: 0.25с | Дальность: 3.0' },
  helmet_leather: { name: 'Кожаный шлем', desc: 'Защита: 3' },
  helmet_iron: { name: 'Железный шлем', desc: 'Защита: 8' },
  helmet_cobalt: { name: 'Кобальтовый шлем', desc: 'Защита: 15' },
  wood: { name: 'Дерево', desc: 'Базовый ресурс для крафта.' },
  apple: { name: 'Яблоко', desc: 'Восстанавливает 15 HP.' },
  // ... (можно добавить остальные, но для теста достаточно)
};

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
  
  ['helmet', 'chest', 'legs', 'boots', 'shield', 'ring'].forEach(slot => {
    const el = document.querySelector(`.eq-slot[data-slot="${slot}"]`);
    if(el) { if (GS.equip[slot]) { el.style.borderColor = '#00ff00'; el.innerHTML = getIcon(GS.equip[slot]); } else { el.style.borderColor = '#333'; el.innerHTML = '⬜'; } }
  });
};

// --- ТУЛТИП (При зажатии) ---
const tooltipEl = document.getElementById('tooltip');
let tooltipTimeout = null;

function showTooltip(e, itemId) {
  const data = ITEM_DATA[itemId];
  if (!data) return;
  tooltipEl.innerHTML = `<h4>${data.name}</h4><p>${data.desc}</p>`;
  tooltipEl.style.display = 'block';
  
  const rect = e.target.getBoundingClientRect();
  let x = rect.left + rect.width + 10;
  let y = rect.top;
  
  if (x + 200 > window.innerWidth) x = rect.left - 210;
  if (y + 100 > window.innerHeight) y = window.innerHeight - 110;
  
  tooltipEl.style.left = x + 'px';
  tooltipEl.style.top = y + 'px';
}

function hideTooltip() {
  tooltipEl.style.display = 'none';
  if (tooltipTimeout) clearTimeout(tooltipTimeout);
}

// --- DRAG AND DROP ---
let draggedItem = null, dragGhost = null;
function initDragAndDrop() {
  document.querySelectorAll('.i-slot, .eq-slot').forEach(el => {
    // Тултип при долгом нажатии
    el.addEventListener('pointerdown', (e) => {
      const itemId = el.dataset.itemId || (el.dataset.type === 'equip' ? window.GameState?.equip[el.dataset.slot] : null);
      if (itemId) {
        tooltipTimeout = setTimeout(() => showTooltip(e, itemId), 500);
      }
      
      // Логика Drag and Drop
      if (!itemId) return;
      const GS = window.GameState;
      if (!GS) return;
      
      draggedItem = { itemId, from: { type: el.dataset.type, index: el.dataset.index, slot: el.dataset.slot } };
      dragGhost = document.createElement('div'); dragGhost.className = 'drag-ghost'; dragGhost.innerText = getIcon(itemId);
      document.body.appendChild(dragGhost); dragGhost.style.left = e.clientX + 'px'; dragGhost.style.top = e.clientY + 'px';
      
      const moveHandler = (ev) => { 
        hideTooltip(); // Скрываем тултип при движении
        if (!dragGhost) return; 
        dragGhost.style.left = ev.clientX + 'px'; dragGhost.style.top = ev.clientY + 'px'; 
      };
      const upHandler = (ev) => {
        hideTooltip();
        document.removeEventListener('pointermove', moveHandler); document.removeEventListener('pointerup', upHandler);
        if (!dragGhost || !draggedItem) return;
        dragGhost.remove(); dragGhost = null;
        const dropTarget = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.i-slot, .eq-slot');
        if (dropTarget && GS.socket) {
          const to = { type: dropTarget.dataset.type, index: dropTarget.dataset.index, slot: dropTarget.dataset.slot };
          GS.socket.emit('moveItem', { from: draggedItem.from, to, itemId: draggedItem.itemId });
        }
        draggedItem = null;
      };
      document.addEventListener('pointermove', moveHandler); document.addEventListener('pointerup', upHandler);
    });
    
    // Скрываем тултип при отпускании без свайпа
    el.addEventListener('pointerup', hideTooltip);
    el.addEventListener('pointerleave', hideTooltip);
  });
}

// --- КРАФТ (С выбором станка) ---
const RECIPES_CLIENT = {
  sword_wood: { name: 'Деревянный меч', cost: { wood: 5 }, station: 'workbench' },
  pickaxe_wood: { name: 'Деревянная кирка', cost: { wood: 5 }, station: 'workbench' },
  station_furnace: { name: 'Печь', cost: { stone: 20 }, station: 'workbench' },
  station_anvil: { name: 'Наковальня', cost: { stone: 20, iron_ingot: 5 }, station: 'workbench' },
  iron_ingot: { name: 'Железный слиток', cost: { iron_ore: 2 }, station: 'furnace' },
  sword_iron: { name: 'Железный меч', cost: { wood: 2, iron_ingot: 5 }, station: 'forge' },
  helmet_iron: { name: 'Железный шлем', cost: { iron_ingot: 5 }, station: 'forge' },
  sword_cobalt: { name: 'Кобальтовый меч', cost: { cobalt_ingot: 5 }, station: 'anvil' },
};

function renderCrafting() {
  const list = document.getElementById('craft-list');
  const GS = window.GameState;
  if (!list || !GS) return;
  list.innerHTML = '';
  
  for (const [id, recipe] of Object.entries(RECIPES_CLIENT)) {
    const canCraft = Object.entries(recipe.cost).every(([res, qty]) => (GS.inv[res] || 0) >= qty);
    const costStr = Object.entries(recipe.cost).map(([res, qty]) => `${getIcon(res)}${qty}`).join(' ');
    
    list.innerHTML += `
      <div class="craft-item">
        <div><span>${getIcon(id)} ${recipe.name}</span><br><small>${costStr} (Станок: ${recipe.station})</small></div>
        <button onclick="window.craftItem('${id}', '${recipe.station}')" ${canCraft ? '' : 'disabled'}>Создать</button>
      </div>
    `;
  }
}

window.craftItem = (id, station) => {
  if (window.GameState && window.GameState.socket) {
    window.GameState.socket.emit('craft', { recipeId: id, stationId: station });
  }
};

// UI Окна
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById('inventory-btn')?.addEventListener('click', () => document.getElementById('inv-overlay')?.classList.add('open'));
  document.getElementById('close-inv')?.addEventListener('click', () => document.getElementById('inv-overlay')?.classList.remove('open'));
  document.getElementById('craft-btn')?.addEventListener('click', () => {
    document.getElementById('craft-overlay')?.classList.add('open');
    renderCrafting();
  });
  document.getElementById('close-craft')?.addEventListener('click', () => document.getElementById('craft-overlay')?.classList.remove('open'));
  
  document.getElementById('place-btn')?.addEventListener('click', () => {
    const GS = window.GameState;
    if (!GS || !GS.socket) return;
    const station = GS.hotbar[GS.me.activeSlot];
    if (station && station.startsWith('station_')) {
      GS.socket.emit('placeStation', { itemId: station });
    } else {
      alert('Выберите станок в хотбаре (Верстак, Печь, Кузница)');
    }
  });
});