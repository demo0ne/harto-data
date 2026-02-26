/**
 * Harto - Card-based To-Do for Heartopia
 * Version: 0.1.1
 */

const CDN = (typeof window !== 'undefined' && window.__HARTO_BASE) ? window.__HARTO_BASE : 'https://cdn.jsdelivr.net/gh/demo0ne/harto-data@main';
const VERSION = '0.1.1';
const STORAGE_COMPLETIONS = 'harto_completions';

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

function getCompletions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_COMPLETIONS) || '{}');
  } catch {
    return {};
  }
}

function setCompletions(obj) {
  localStorage.setItem(STORAGE_COMPLETIONS, JSON.stringify(obj));
}

function shouldReset(pack, dateKey) {
  const today = getToday();
  const weekStart = getWeekStart();
  if (pack === 'Daily' || pack === 'Daily-NPC') return dateKey !== today;
  if (pack === 'Weekly') return dateKey !== weekStart;
  return false;
}

function applyResets(completions) {
  let changed = false;
  for (const [cardId, entry] of Object.entries(completions)) {
    const card = window.__HARTO_CARDS?.find((c) => c.id === cardId);
    if (card && shouldReset(card.pack, entry.date)) {
      delete completions[cardId];
      changed = true;
    }
  }
  if (changed) setCompletions(completions);
}

function isCompleted(cardId, completions) {
  const entry = completions[cardId];
  if (!entry) return false;
  const card = window.__HARTO_CARDS?.find((c) => c.id === cardId);
  if (!card) return true;
  return !shouldReset(card.pack, entry.date);
}

function completeCard(cardId) {
  const completions = getCompletions();
  const today = getToday();
  completions[cardId] = { date: today, timestamp: Date.now() };
  setCompletions(completions);
  render();
}

function uncompleteCard(cardId) {
  const completions = getCompletions();
  delete completions[cardId];
  setCompletions(completions);
  render();
}

function renderCard(card, completions, inDeck) {
  const done = isCompleted(card.id, completions);
  const imgSrc = card.image ? (card.image.startsWith('http') ? card.image : `${CDN}/${card.image}`) : '';
  return `
    <div class="harto-card" data-id="${escapeHtml(card.id)}" data-pack="${escapeHtml(card.pack)}">
      <img class="harto-card-image" src="${imgSrc || ''}" alt="" onerror="this.style.display='none'">
      <div class="harto-card-body">
        <h3 class="harto-card-title">${escapeHtml(card.title)}</h3>
        ${card.description ? `<p class="harto-card-description">${escapeHtml(card.description)}</p>` : ''}
        <button class="harto-card-complete" data-action="${done ? 'uncomplete' : 'complete'}">
          ${done ? 'Undo' : 'Complete'}
        </button>
      </div>
    </div>
  `;
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s || '';
  return div.innerHTML;
}

const PACKS = ['Daily', 'Daily-NPC', 'Weekly', 'Seasonal', 'Others'];

function render() {
  const cards = window.__HARTO_CARDS || [];
  applyResets(getCompletions());
  const completions = getCompletions();
  const deckEl = document.getElementById('harto-deck');
  const packsEl = document.getElementById('harto-packs');
  if (!deckEl || !packsEl) return;

  const incomplete = cards.filter((c) => !isCompleted(c.id, completions));
  const byPack = {};
  PACKS.forEach((p) => { byPack[p] = []; });
  incomplete.forEach((c) => {
    if (byPack[c.pack]) byPack[c.pack].push(c);
  });

  packsEl.innerHTML = PACKS.map(
    (pack) =>
      `<button class="harto-pack" data-pack="${escapeHtml(pack)}">${escapeHtml(pack)}</button>`
  ).join('');

  deckEl.innerHTML = PACKS.map((pack) => {
    const cards = byPack[pack] || [];
    if (cards.length === 0) return '';
    return `
      <div class="harto-deck-section" data-pack="${escapeHtml(pack)}">
        <h4 class="harto-deck-section-title">${escapeHtml(pack)}</h4>
        <div class="harto-deck-cards">
          ${cards.map((c) => renderCard(c, completions, true)).join('')}
        </div>
      </div>
    `;
  }).filter(Boolean).join('');

  deckEl.querySelectorAll('.harto-card-complete').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const cardEl = e.target.closest('.harto-card');
      if (!cardEl) return;
      const id = cardEl.dataset.id;
      const action = e.target.dataset.action;
      if (action === 'complete') {
        cardEl.classList.add('harto-card-exit');
        cardEl.addEventListener('animationend', () => {
          completeCard(id);
        }, { once: true });
      } else {
        uncompleteCard(id);
      }
    });
  });
}

async function init() {
  const res = await fetch(`${CDN}/cards/data.json`);
  const data = await res.json();
  window.__HARTO_CARDS = data.cards || [];
  applyResets(getCompletions());
  render();
  console.log(`Harto v${VERSION}`);
}

function initTabs() {
  document.querySelectorAll('.harto-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const name = tab.dataset.tab;
      document.querySelectorAll('.harto-tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.harto-tab-panel').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.getElementById('harto-' + name);
      if (panel) panel.classList.add('active');
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    init();
  });
} else {
  initTabs();
  init();
}
