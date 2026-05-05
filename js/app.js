'use strict';

const ITEM_BASE_URL = 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21/assets/minecraft/textures/item/';
const BLOCK_BASE_URL = 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21/assets/minecraft/textures/block/';
const FALLBACK_URL = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="%233a3a3a"/><text x="50%25" y="55%25" dominant-baseline="middle" text-anchor="middle" font-size="28" fill="%23888">?</text></svg>';

function getItemImageUrl(itemId) {
  if (!itemId || !window.ITEMS) return FALLBACK_URL;
  const item = window.ITEMS[itemId];
  if (!item) return FALLBACK_URL;
  const base = item.textureType === 'block' ? BLOCK_BASE_URL : ITEM_BASE_URL;
  return base + item.textureName + '.png';
}

function imgWithFallback(src, alt, cls) {
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt || '';
  if (cls) img.className = cls;
  img.onerror = function () { this.src = FALLBACK_URL; this.onerror = null; };
  return img;
}

// ---- State ----
let currentFilter = 'all';
let currentSearch = '';
let searchTimer = null;
let filteredRecipes = [];

// ---- DOM refs ----
const grid = document.getElementById('recipe-grid');
const searchInput = document.getElementById('search-input');
const statsText = document.getElementById('stats-text');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalClose = document.querySelector('.modal-close');
const ingredientUl = document.getElementById('ingredient-ul');
const modalDescription = document.querySelector('.modal-description');
const offlineBanner = document.getElementById('offline-banner');

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  registerSW();
  updateOfflineBanner();
  window.addEventListener('online', updateOfflineBanner);
  window.addEventListener('offline', updateOfflineBanner);

  renderCards(window.RECIPES);
  setupSearch();
  setupFilters();
  setupModal();
});

// ---- Service Worker ----
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// ---- Offline banner ----
function updateOfflineBanner() {
  if (!navigator.onLine) {
    offlineBanner.classList.add('show');
  } else {
    offlineBanner.classList.remove('show');
  }
}

// ---- Search ----
function setupSearch() {
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      currentSearch = searchInput.value.trim().toLowerCase();
      applyFilters();
    }, 200);
  });
}

// ---- Filters ----
function setupFilters() {
  const btns = document.querySelectorAll('.filter-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      applyFilters();
    });
  });
}

// ---- Apply filters + search ----
function applyFilters() {
  let recipes = window.RECIPES;

  if (currentFilter === '3x3') {
    recipes = recipes.filter(r => r.gridSize === '3x3');
  } else if (currentFilter === '2x2') {
    recipes = recipes.filter(r => r.gridSize === '2x2');
  }

  if (currentSearch) {
    recipes = recipes.filter(r => {
      const item = window.ITEMS[r.resultId];
      if (!item) return false;
      if (item.name.toLowerCase().includes(currentSearch)) return true;
      if (item.category.toLowerCase().includes(currentSearch)) return true;
      // Search ingredients
      for (const slot of r.pattern) {
        if (!slot) continue;
        const ing = window.ITEMS[slot];
        if (ing && ing.name.toLowerCase().includes(currentSearch)) return true;
        if (slot.toLowerCase().includes(currentSearch)) return true;
      }
      return false;
    });
  }

  filteredRecipes = recipes;
  renderCards(recipes);
}

// ---- Render cards ----
function renderCards(recipes) {
  grid.innerHTML = '';

  if (!recipes || recipes.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.setAttribute('role', 'listitem');
    empty.textContent = '⚒ No recipes found';
    grid.appendChild(empty);
    statsText.textContent = '0 recipes';
    return;
  }

  statsText.textContent = `Showing ${recipes.length} recipe${recipes.length !== 1 ? 's' : ''}`;

  const fragment = document.createDocumentFragment();

  recipes.forEach(recipe => {
    const item = window.ITEMS[recipe.resultId];
    if (!item) return;

    const card = document.createElement('div');
    card.className = 'recipe-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('tabindex', '0');
    card.dataset.recipeId = recipe.id;

    const imgUrl = getItemImageUrl(recipe.resultId);
    const img = imgWithFallback(imgUrl, item.name, 'card-img');
    card.appendChild(img);

    const h3 = document.createElement('h3');
    h3.textContent = item.name;
    card.appendChild(h3);

    const badges = document.createElement('div');
    badges.className = 'card-badges';

    const catBadge = document.createElement('span');
    catBadge.className = 'category-badge';
    catBadge.textContent = item.category;
    badges.appendChild(catBadge);

    const gridBadge = document.createElement('span');
    gridBadge.className = 'grid-badge';
    gridBadge.textContent = recipe.gridSize === '3x3' ? '3×3 Table' : '2×2 Hand';
    badges.appendChild(gridBadge);

    card.appendChild(badges);

    if (recipe.resultCount > 1) {
      const countBadge = document.createElement('span');
      countBadge.className = 'result-count-badge';
      countBadge.textContent = `× ${recipe.resultCount}`;
      card.appendChild(countBadge);
    }

    card.addEventListener('click', () => openModal(recipe.id));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModal(recipe.id);
      }
    });

    fragment.appendChild(card);
  });

  grid.appendChild(fragment);
}

// ---- Modal ----
function setupModal() {
  modalClose.addEventListener('click', closeModal);

  document.querySelector('.modal-overlay').addEventListener('click', closeModal);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeModal();
    }
  });

  modal.addEventListener('keydown', trapFocus);
}

function trapFocus(e) {
  if (e.key !== 'Tab') return;
  const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first) { e.preventDefault(); last.focus(); }
  } else {
    if (document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

function openModal(recipeId) {
  const recipe = window.RECIPES.find(r => r.id === recipeId);
  if (!recipe) return;
  const item = window.ITEMS[recipe.resultId];
  if (!item) return;

  modalTitle.textContent = item.name;

  // Build crafting grid container
  const craftingContainer = document.querySelector('.crafting-container');
  craftingContainer.innerHTML = '';

  // Input grid
  const inputDiv = document.createElement('div');
  inputDiv.className = 'crafting-input';

  const gridDiv = document.createElement('div');
  gridDiv.className = 'crafting-grid';

  // Always render as 3x3 (9 slots)
  const fullPattern = normalizePatternTo3x3(recipe);
  for (let i = 0; i < 9; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    const ingId = fullPattern[i];
    if (ingId && window.ITEMS[ingId]) {
      const ingItem = window.ITEMS[ingId];
      const ingImg = imgWithFallback(getItemImageUrl(ingId), ingItem.name, '');
      slot.appendChild(ingImg);
      slot.title = ingItem.name;
    }
    gridDiv.appendChild(slot);
  }

  inputDiv.appendChild(gridDiv);
  craftingContainer.appendChild(inputDiv);

  // Arrow
  const arrow = document.createElement('div');
  arrow.className = 'arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '➜';
  craftingContainer.appendChild(arrow);

  // Output
  const outputDiv = document.createElement('div');
  outputDiv.className = 'crafting-output';

  const resultSlot = document.createElement('div');
  resultSlot.className = 'slot result-slot';
  const resultImg = imgWithFallback(getItemImageUrl(recipe.resultId), item.name, '');
  resultSlot.appendChild(resultImg);
  resultSlot.title = item.name;
  outputDiv.appendChild(resultSlot);

  const countSpan = document.createElement('span');
  countSpan.className = 'result-count';
  countSpan.textContent = recipe.resultCount > 1 ? `× ${recipe.resultCount}` : '';
  outputDiv.appendChild(countSpan);

  craftingContainer.appendChild(outputDiv);

  // Description
  if (recipe.description) {
    modalDescription.textContent = recipe.description;
    modalDescription.style.display = '';
  } else {
    modalDescription.style.display = 'none';
  }

  // Ingredient list
  const seen = new Set();
  const counts = {};
  for (const ingId of recipe.pattern) {
    if (!ingId) continue;
    counts[ingId] = (counts[ingId] || 0) + 1;
    seen.add(ingId);
  }

  ingredientUl.innerHTML = '';
  if (seen.size === 0) {
    const li = document.createElement('li');
    li.textContent = 'No crafting ingredients (not craftable or special recipe)';
    ingredientUl.appendChild(li);
  } else {
    seen.forEach(ingId => {
      const ingItem = window.ITEMS[ingId];
      const name = ingItem ? ingItem.name : ingId;
      const li = document.createElement('li');
      const ingImg = imgWithFallback(getItemImageUrl(ingId), name, '');
      li.appendChild(ingImg);
      const text = document.createTextNode(`${name}${counts[ingId] > 1 ? ' ×' + counts[ingId] : ''}`);
      li.appendChild(text);
      ingredientUl.appendChild(li);
    });
  }

  modal.classList.add('open');
  modal.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';

  requestAnimationFrame(() => { modalClose.focus(); });
}

function closeModal() {
  modal.classList.remove('open');
  modal.setAttribute('hidden', '');
  document.body.style.overflow = '';
}

function normalizePatternTo3x3(recipe) {
  if (recipe.gridSize === '3x3') return recipe.pattern;
  // 2x2 pattern has 4 elements: top-left, top-right, bot-left, bot-right
  // Map to 3x3: index 0->0, 1->1, 2->3, 3->4 (top-left 2x2 corner of 3x3)
  const p = recipe.pattern;
  return [
    p[0] || null, p[1] || null, null,
    p[2] || null, p[3] || null, null,
    null,         null,         null
  ];
}
