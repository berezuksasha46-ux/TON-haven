
// ================= ИКОНКИ ПРЕДМЕТОВ =================
const ICONS = {
  // Ресурсы
  wood: '🪵', stone: '🪨', iron_ore: '⛏️', iron_ingot: '⛓️', cobalt_ore: '💠', cobalt_ingot: '🔷',
  adamantite_ore: '🟢', adamantite_ingot: '🟩', holy_ore: '✨', holy_ingot: '🌟', leather: '🟫',
  string: '🧵', bone: '🦴', diamond: '💎', magic_crystal: '🔮', star_fragment: '🌟',
  
  // Еда
  apple: '🍎', bread: '🍞', meat_cooked: '🍖', fish_cooked: '🐟', golden_apple: '🍏',
  
  // Оружие (Ближний)
  sword_wood: '⚔️', sword_stone: '🗡️', sword_iron: '⚔️', sword_cobalt: '💠', sword_adamantite: '🟢', sword_holy: '✨',
  spear_stone: '🔱', spear_iron: '🔱', spear_cobalt: '🔱',
  bat_wood: '🏏', bat_iron: '🏏',
  yoyo_wood: '🪀', yoyo_iron: '🪀',
  
  // Оружие (Дальний)
  bow_wood: '🏹', bow_iron: '🏹', bow_cobalt: '🏹',
  shuriken_iron: '🌀', shuriken_poison: '🌀', snowball: '❄️',
  star_pistol: '🔫', star_rifle: '🔫',
  
  // Магия
  staff_fire: '🪄', staff_ice: '🪄', book_lightning: '📖', book_heal: '📖', staff_summon: '🌿',
  
  // Инструменты
  pickaxe_wood: '⛏️', pickaxe_stone: '⛏️', pickaxe_iron: '⛏️', pickaxe_cobalt: '💠', pickaxe_adamantite: '🟢', pickaxe_holy: '✨',
  axe_wood: '🪓', axe_stone: '🪓', axe_iron: '🪓', axe_cobalt: '💠',
  fishing_rod: '🎣',
  
  // Броня
  helmet_leather: '🪖', helmet_iron: '🪖', helmet_cobalt: '💠', helmet_adamantite: '🟢', helmet_holy: '✨',
  chest_leather: '🥋', chest_iron: '🥋', chest_cobalt: '💠', chest_adamantite: '🟢', chest_holy: '✨',
  legs_leather: '👖', legs_iron: '👖', legs_cobalt: '💠',
  boots_leather: '👢', boots_iron: '👢', boots_cobalt: '💠',
  shield_wood: '🛡️', shield_iron: '🛡️', shield_cobalt: '💠',
  ring_gold: '💍',
  
  // Станки
  station_workbench: '🔨', station_furnace: '🔥', station_forge: '⚒️', station_anvil: '🛠️', station_spinning: '🧵'
};
const getIcon = (id) => ICONS[id] || '📦';

// ================= ХАРАКТЕРИСТИКИ ДЛЯ ТУЛТИПОВ =================
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
  station_workbench: { name: 'Верстак', desc: 'Используется для базового крафта.' },
};

// ================= ИНИЦИАЛИЗАЦИЯ =================
document.addEventListener("DOMContentLoaded", () => {
  const invGrid = document.getElementById('inv-grid');
  if (invGrid) for (let i = 0; i < 16; i++) invGrid.innerHTML += `<div class="i-slot" data-type="inv" data-index="${i}"></div>`;
  
  const hotbarInv = document.getElementById('hotbar-inv');
  if (hotbarInv) for (let i = 0; i < 4; i++) hotbarInv.innerHTML += `<div class="i-slot" data-type="hotbar" data-index="${i}"></div>`;
  
  initUI();
  initDragAndDrop();
});

// ================= ОБНОВЛЕНИЕ UI =================
window.updateUI = function() {
  const GS = window.GameState;
  if (!GS) return;

  // HP
  const fill = document.getElementById('hp-fill'), text = document.getElementById('hp-text');
  if (fill && text) { 
    fill.style.width = (GS.me.hp / GS.me.maxHp) * 100 + '%'; 
    text.innerText = `${Math.round(GS.me.hp)} / ${GS.me.maxHp}`; 
  }
  
  // Инвентарь
  const invSlots = document.querySelectorAll('#inv-grid .i-slot');
  invSlots.forEach(s => { s.innerHTML = ''; s.dataset.itemId = ''; });
  let idx = 0;
  for (const [key, qty] of Object.entries(GS.inv)) {
    if (qty > 0 && idx < 16) { 
      invSlots[idx].innerHTML = `<span>${getIcon(key)}</span><span class="item-count">${qty}</span>`; 
      invSlots[idx].dataset.itemId = key; 
      idx++; 
    }
  }

  // Хотбар в инвентаре
  const hotSlots = document.querySelectorAll('#hotbar-inv .i-slot');
  hotSlots.forEach((s, i) => { 
    s.innerHTML = GS.hotbar[i] ? getIcon(GS.hotbar[i]) : ''; 
    s.dataset.itemId = GS.hotbar[i] || ''; 
  });

  // Нижний хотбар
  document.querySelectorAll('.h-slot').forEach((s, i) => { 
    s.innerHTML = GS.hotbar[i] ? getIcon(GS.hotbar[i]) : ''; 
  });
  
  // Экипировка (без визуальных заглушек)
  ['helmet', 'chest', 'legs', 'boots', 'shield', 'ring'].forEach(slot => {
    const el = document.querySelector(`.eq-slot[data-slot="${slot}"]`);
    if(el) { 
      if (GS.equip[slot]) { 
        el.style.borderStyle = 'solid'; el.style.borderColor = '#00ff00'; 
        el.innerHTML = getIcon(GS.equip[slot]); 
      } else { 
        el.style.borderStyle = 'dashed'; el.style.borderColor = '#444'; 
        el.innerHTML = ''; 
      } 
    }
  });
};

// ================= ТУЛТИПЫ =================
const tooltipEl = document.getElementById('tooltip');
let tooltipTimer = null;

function showTooltip(e, itemId) {
  const data = ITEM_DATA[itemId];
  if (!data) return;
  
  tooltipEl.innerHTML = `<h4>${data.name}</h4><p>${data.desc}</p>`;
  tooltipEl.style.display = 'block';
  
  const x = e.clientX + 15;
  const y = e.clientY + 15;
  
  tooltipEl.style.left = (x + 200 > window.innerWidth ? e.clientX - 215 : x) + 'px';
  tooltipEl.style.top = (y + 100 > window.innerHeight ? e.clientY - 110 : y) + 'px';
}

function hideTooltip() {
  tooltipEl.style.display = 'none';
  if (tooltipTimer) clearTimeout(tooltipTimer);
}

// ================= DRAG AND DROP =================
let draggedItem = null, dragGhost = null;

function initDragAndDrop() {
  document.querySelectorAll('.i-slot, .eq-slot').forEach(el => {
    el.addEventListener('pointerdown', (e) => {
      const GS = window.GameState;
      if (!GS) return;

      const itemId = el.dataset.itemId || (el.dataset.type === 'equip' ? GS.equip[el.dataset.slot] : null);
      if (!itemId) return;
      
      // Тултип при долгом нажатии
      tooltipTimer = setTimeout(() => showTooltip(e, itemId), 400);
      
      // Начинаем drag
      draggedItem = { itemId, from: { type: el.dataset.type, index: el.dataset.index, slot: el.dataset.slot } };
      
      const moveHandler = (ev) => {
        if (!dragGhost && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) > 10) {
          hideTooltip();
          dragGhost = document.createElement('div'); 
          dragGhost.className = 'drag-ghost'; 
          dragGhost.innerText = getIcon(itemId);
          document.body.appendChild(dragGhost);
        }
        if (dragGhost) {
          dragGhost.style.left = ev.clientX + 'px'; 
          dragGhost.style.top = ev.clientY + 'px';
        }
      };
      
      const upHandler = (ev) => {
        hideTooltip();
        document.removeEventListener('pointermove', moveHandler); 
        document.removeEventListener('pointerup', upHandler);
        
        if (dragGhost && draggedItem && GS.socket) {
          const dropTarget = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.i-slot, .eq-slot');
          if (dropTarget) {
            const to = { type: dropTarget.dataset.type, index: dropTarget.dataset.index, slot: dropTarget.dataset.slot };
            GS.socket.emit('moveItem', { from: draggedItem.from, to, itemId: draggedItem.itemId });
          }
        }
        
        if (dragGhost) dragGhost.remove();
        dragGhost = null; 
        draggedItem = null;
      };
      
      document.addEventListener('pointermove', moveHandler); 
      document.addEventListener('pointerup', upHandler);
    });
  });
}

// ================= ОКНА И КНОПКИ =================
function initUI() {
  document.getElementById('inventory-btn')?.addEventListener('click', () => document.getElementById('inv-overlay')?.classList.add('open'));
  document.getElementById('close-inv')?.addEventListener('click', () => document.getElementById('inv-overlay')?.classList.remove('open'));
  
  document.getElementById('craft-btn')?.addEventListener('click', () => {
    document.getElementById('craft-overlay')?.classList.add('open');
    if(window.renderCrafting) window.renderCrafting();
  });
  document.getElementById('close-craft')?.addEventListener('click', () => document.getElementById('craft-overlay')?.classList.remove('open'));
  
  document.getElementById('place-btn')?.addEventListener('click', () => {
    const GS = window.GameState;
    if (!GS || !GS.socket) return;
    const station = GS.hotbar[GS.me.activeSlot];
    if (station && station.startsWith('station_')) {
      GS.socket.emit('placeStation', { itemId: station });
    } else {
      alert('Выберите станок в хотбаре (Верстак, Печь и т.д.)');
    }
  });
}

// ================= КРАФТ =================
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

window.renderCrafting = function() {
  const list = document.getElementById('craft-list');
  const GS = window.GameState;
  if (!list || !GS) return;
  
  list.innerHTML = '';
  
  for (const [id, recipe] of Object.entries(RECIPES_CLIENT)) {
    const canCraft = Object.entries(recipe.cost).every(([res, qty]) => (GS.inv[res] || 0) >= qty);
    const costStr = Object.entries(recipe.cost).map(([res, qty]) => `${getIcon(res)}${qty}`).join(' ');
    
    list.innerHTML += `
      <div class="craft-item">
        <div>
          <span>${getIcon(id)} ${recipe.name}</span><br>
          <small>Ресурсы: ${costStr}</small><br>
          <small>Станок: ${recipe.station}</small>
        </div>
        <button onclick="window.craftItem('${id}', '${recipe.station}')" ${canCraft ? '' : 'disabled'}>Создать</button>
      </div>
    `;
  }
};

window.craftItem = (id, station) => {
  if (window.GameState && window.GameState.socket) {
    window.GameState.socket.emit('craft', { recipeId: id, stationId: station });
  }
};