/**
 * Harto - Card-based To-Do for Heartopia
 * Version: 0.2.0
 */

const CDN = (typeof window !== 'undefined' && window.__HARTO_BASE) ? window.__HARTO_BASE : 'https://cdn.jsdelivr.net/gh/demo0ne/harto-data@main';
const VERSION = '0.2.0';
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

function renderCard(card, completions, done, index) {
  const imgSrc = card.image ? (card.image.startsWith('http') ? card.image : `${CDN}/${card.image}`) : '';
  const btnIcon = done ? '↶' : '✓';
  return `
    <div class="harto-card harto-card-dealing ${done ? 'harto-card-completed' : ''}" data-id="${escapeHtml(card.id)}" data-pack="${escapeHtml(card.pack)}" data-deal-index="${index >= 0 ? index : 0}">
      <h3 class="harto-card-title">${escapeHtml(card.title)}</h3>
      <img class="harto-card-image" src="${imgSrc || ''}" alt="" onerror="this.style.display='none'">
      <div class="harto-card-body">
        ${card.description ? `<p class="harto-card-description">${escapeHtml(card.description)}</p>` : ''}
        <button class="harto-card-complete" data-action="${done ? 'uncomplete' : 'complete'}" title="${done ? 'Undo' : 'Complete'}">${btnIcon}</button>
      </div>
    </div>
  `;
}

function playDealAnimation(deckEl) {
  const cards = deckEl.querySelectorAll('.harto-card');
  if (cards.length === 0) return;
  const deckY = window.innerHeight - 120;
  const deckX = window.innerWidth / 2;
  const stagger = 45;
  const duration = 320;

  requestAnimationFrame(() => {
    const rects = [];
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      rects.push({ card, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 });
    });
    requestAnimationFrame(() => {
      rects.forEach(({ card, cx, cy }) => {
        const idx = parseInt(card.dataset.dealIndex, 10);
        const dx = deckX - cx;
        const dy = deckY - cy;

        card.style.willChange = 'transform, opacity';
        card.animate(
          [
            { transform: `translate3d(${dx}px, ${dy}px, 0) scale(0.9)`, opacity: 0 },
            { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 }
          ],
          {
            duration,
            delay: idx * stagger,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'forwards'
          }
        ).finished.then(() => {
          card.style.willChange = '';
          card.classList.remove('harto-card-dealing');
        });
      });
    });
  });
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s || '';
  return div.innerHTML;
}

const PACKS = ['All', 'Daily', 'Daily-NPC', 'Weekly', 'Seasonal', 'Others'];

function render() {
  const cards = window.__HARTO_CARDS || [];
  applyResets(getCompletions());
  const completions = getCompletions();
  const deckEl = document.getElementById('harto-deck');
  const packsEl = document.getElementById('harto-packs');
  const filterPack = window.__HARTO_FILTER_PACK || 'All';
  if (!deckEl || !packsEl) return;

  const byPack = { incomplete: {}, completed: {} };
  PACKS.slice(1).forEach((p) => { byPack.incomplete[p] = []; byPack.completed[p] = []; });
  let pendingCount = 0;
  cards.forEach((c) => {
    if (!byPack.incomplete[c.pack]) return;
    const done = isCompleted(c.id, completions);
    if (!done) pendingCount++;
    (done ? byPack.completed : byPack.incomplete)[c.pack].push(c);
  });

  const tasksTab = document.querySelector('.harto-tab[data-tab="tasks"]');
  if (tasksTab) {
    tasksTab.innerHTML = 'Tasks' + (pendingCount > 0 ? ` <span class="harto-tab-badge">${pendingCount}</span>` : '');
  }

  packsEl.innerHTML = PACKS.map((pack) => {
    const count = (byPack.incomplete[pack] || []).length;
    const badge = count > 0 ? ` <span class="harto-pack-badge">${count}</span>` : '';
    return `<button class="harto-pack ${filterPack === pack ? 'active' : ''}" data-pack="${escapeHtml(pack)}">${escapeHtml(pack)}${badge}</button>`;
  }).join('');

  const packsToShow = filterPack === 'All' ? PACKS.slice(1) : [filterPack];
  deckEl.innerHTML = packsToShow.map((pack) => {
    const incomplete = byPack.incomplete[pack] || [];
    const completed = byPack.completed[pack] || [];
    if (incomplete.length === 0 && completed.length === 0) return '';
    return `
      <div class="harto-deck-section" data-pack="${escapeHtml(pack)}">
        <h4 class="harto-deck-section-title">${escapeHtml(pack)}</h4>
        ${incomplete.length > 0 ? `
          <div class="harto-deck-cards">
            ${incomplete.map((c, i) => renderCard(c, completions, false, i)).join('')}
          </div>
        ` : ''}
        ${completed.length > 0 ? `
          <div class="harto-deck-completed">
            <h4 class="harto-deck-section-title">Completed</h4>
            <div class="harto-deck-cards">
              ${completed.map((c, i) => renderCard(c, completions, true, incomplete.length + i)).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).filter(Boolean).join('');

  packsEl.querySelectorAll('.harto-pack').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.__HARTO_FILTER_PACK = btn.dataset.pack;
      render();
    });
  });

  playDealAnimation(deckEl);

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
