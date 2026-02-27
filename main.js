/**
 * Harto - Card-based To-Do for Heartopia
 * Version: 0.4.0
 */

const CDN = (typeof window !== 'undefined' && window.__HARTO_BASE) ? window.__HARTO_BASE : 'https://cdn.jsdelivr.net/gh/demo0ne/harto-data@main';
const VERSION = '0.4.0';
const STORAGE_COMPLETIONS = 'harto_completions';
const STORAGE_COMPLETIONS_TW = 'harto_completions_tw';
const STORAGE_THEME = 'harto_theme';
const STORAGE_SETUP = 'harto_setup';
// harto_admin: read-only from app; set manually in browser localStorage to 'true' for admin mode

function isAdmin() {
  return localStorage.getItem('harto_admin') === 'true';
}

function getSetup() {
  const s = localStorage.getItem(STORAGE_SETUP) || 'SEA';
  return s === 'TW' ? 'TW' : 'SEA';
}

function getStorageCompletions() {
  return getSetup() === 'TW' ? STORAGE_COMPLETIONS_TW : STORAGE_COMPLETIONS;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getResetHour() {
  return getSetup() === 'TW' ? 6 : 7;
}

function getToday() {
  const hr = getResetHour();
  const now = new Date();
  const d = new Date(now);
  if (now.getHours() < hr) d.setDate(d.getDate() - 1);
  return formatDate(d);
}

function getWeekStart() {
  const hr = getResetHour();
  const now = new Date();
  const d = new Date(now);
  const day = d.getDay(); // 0=Sun, 6=Sat
  const hrs = d.getHours();
  const daysToSat = day === 6
    ? (hrs < hr ? 7 : 0)
    : (day + 1); // Sun->1, Mon->2, ..., Fri->6
  d.setDate(d.getDate() - daysToSat);
  return formatDate(d);
}

function getCompletions() {
  try {
    return JSON.parse(localStorage.getItem(getStorageCompletions()) || '{}');
  } catch {
    return {};
  }
}

function setCompletions(obj) {
  localStorage.setItem(getStorageCompletions(), JSON.stringify(obj));
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

function getDateKeyForPack(pack) {
  if (pack === 'Weekly') return getWeekStart();
  return getToday();
}

function completeCard(cardId, opts) {
  const completions = getCompletions();
  const card = window.__HARTO_CARDS?.find((c) => c.id === cardId);
  const dateKey = card ? getDateKeyForPack(card.pack) : getToday();
  completions[cardId] = { date: dateKey, timestamp: Date.now() };
  setCompletions(completions);
  render(opts);
}

function uncompleteCard(cardId, opts) {
  const completions = getCompletions();
  delete completions[cardId];
  setCompletions(completions);
  render(opts);
}

function renderCard(card, completions, done, index) {
  const imgSrc = card.image ? (card.image.startsWith('http') ? card.image : `${CDN}/${card.image}`) : '';
  const approvedUrl = `${CDN}/assets/images/approved.png`;
  const btnIcon = done ? '✓' : '';
  const approvedOverlay = done ? `<div class="harto-card-approved" style="background-image: url('${approvedUrl}')"></div>` : '';
  return `
    <div class="harto-card harto-card-dealing ${done ? 'harto-card-completed' : ''}" data-id="${escapeHtml(card.id)}" data-pack="${escapeHtml(card.pack)}" data-deal-index="${index >= 0 ? index : 0}">
      <div class="harto-card-content">
        <h3 class="harto-card-title">${escapeHtml(card.title)}</h3>
        <img class="harto-card-image" src="${imgSrc || ''}" alt="" onerror="this.style.display='none'">
        <div class="harto-card-body">
        ${card.description ? `<p class="harto-card-description">${escapeHtml(card.description)}</p>` : ''}
        <button class="harto-card-complete" data-action="${done ? 'uncomplete' : 'complete'}" title="${done ? 'Undo' : 'Complete'}">${btnIcon}</button>
        </div>
      </div>
      ${approvedOverlay}
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

function playFlipAnimation(deckEl, affectedPack, oldRects) {
  const section = deckEl.querySelector(`.harto-deck-section[data-pack="${affectedPack}"]`);
  if (!section) return;

  // Cards outside the affected pack stay hidden by harto-card-dealing; reveal them
  deckEl.querySelectorAll('.harto-card').forEach((card) => {
    if (!section.contains(card)) card.classList.remove('harto-card-dealing');
  });

  const cards = section.querySelectorAll('.harto-card');
  const duration = 280;

  requestAnimationFrame(() => {
    cards.forEach((card) => {
      const id = card.dataset.id;
      const newRect = card.getBoundingClientRect();
      const oldRect = oldRects.get(id);

      card.classList.remove('harto-card-dealing');
      if (oldRect) {
        const dx = oldRect.left - newRect.left;
        const dy = oldRect.top - newRect.top;
        card.style.transform = `translate(${dx}px, ${dy}px)`;
      }
      card.style.transition = 'none';
    });
    document.body.offsetHeight;
    requestAnimationFrame(() => {
      cards.forEach((card) => {
        card.style.transition = `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`;
        card.style.transform = '';
      });
      setTimeout(() => {
        cards.forEach((c) => { c.style.transition = ''; });
      }, duration);
    });
  });
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s || '';
  return div.innerHTML;
}

const PACKS = ['All', 'Daily', 'Daily-NPC', 'Weekly', 'Seasonal', 'Others'];

function render(opts) {
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
    const incompleteHtml = incomplete.map((c, i) => renderCard(c, completions, false, i)).join('');
    const completedCards = completed.map((c, i) => renderCard(c, completions, true, incomplete.length + i));
    const completedHtml = incomplete.length > 0 && completedCards.length > 0
      ? `<span class="harto-card-divider-wrap">${completedCards[0]}</span>` + completedCards.slice(1).join('')
      : completedCards.join('');
    return `
      <div class="harto-deck-section" data-pack="${escapeHtml(pack)}">
        <h4 class="harto-deck-section-title">${escapeHtml(pack)}</h4>
        <div class="harto-deck-cards">
          ${incompleteHtml}${completedHtml}
        </div>
      </div>
    `;
  }).filter(Boolean).join('');

  packsEl.querySelectorAll('.harto-pack').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.__HARTO_FILTER_PACK = btn.dataset.pack;
      render();
    });
  });

  if (opts?.affectedPack && opts?.oldRects) {
    playFlipAnimation(deckEl, opts.affectedPack, opts.oldRects);
  } else {
    playDealAnimation(deckEl);
  }

  deckEl.querySelectorAll('.harto-card-complete').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const cardEl = e.target.closest('.harto-card');
      if (!cardEl) return;
      const id = cardEl.dataset.id;
      const pack = cardEl.dataset.pack;
      const action = e.target.dataset.action;

      const section = deckEl.querySelector(`[data-pack="${pack}"]`);
      const oldRects = new Map();
      if (section) {
        section.querySelectorAll('.harto-card').forEach((c) => {
          oldRects.set(c.dataset.id, c.getBoundingClientRect());
        });
      }

      if (action === 'complete') {
        completeCard(id, { affectedPack: pack, oldRects });
      } else {
        uncompleteCard(id, { affectedPack: pack, oldRects });
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

function getEffectiveTheme(stored) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (stored === 'dark') return 'dark';
  if (stored === 'light') return 'light';
  return prefersDark ? 'dark' : 'light';
}

function getThemeIcon(stored) {
  if (stored === 'dark') return '☀';
  if (stored === 'light') return '🌙';
  return '⚙';
}

function applyTheme(stored) {
  const effective = getEffectiveTheme(stored);
  document.documentElement.setAttribute('data-theme', effective);
  const btn = document.getElementById('harto-theme-toggle');
  if (btn) {
    btn.textContent = getThemeIcon(stored);
    btn.title = stored === 'dark' ? 'Dark (click for light)' : stored === 'light' ? 'Light (click for system)' : 'System (click for dark)';
    btn.setAttribute('aria-label', btn.title);
  }
}

function initTheme() {
  const stored = localStorage.getItem(STORAGE_THEME) || 'system';
  applyTheme(stored);

  const btn = document.getElementById('harto-theme-toggle');
  if (btn) {
    btn.addEventListener('click', () => {
      const s = localStorage.getItem(STORAGE_THEME) || 'system';
      const next = s === 'dark' ? 'light' : s === 'light' ? 'system' : 'dark';
      localStorage.setItem(STORAGE_THEME, next);
      applyTheme(next);
    });
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const s = localStorage.getItem(STORAGE_THEME) || 'system';
    if (s === 'system') applyTheme(s);
  });
}

function getTimeSlot() {
  const h = new Date().getHours();
  if (getSetup() === 'TW') {
    // TW: 6am-12pm dawn, 12pm-6pm day, 6pm-12am dusk, 12am-6am night
    if (h >= 6 && h < 12) return 'dawn';
    if (h >= 12 && h < 18) return 'day';
    if (h >= 18) return 'dusk';
    return 'night';
  }
  // SEA: 7am-1pm dawn, 1pm-7pm day, 7pm-1am dusk, 1am-7am night
  if (h >= 7 && h < 13) return 'dawn';
  if (h >= 13 && h < 19) return 'day';
  if (h >= 19 || h < 1) return 'dusk';
  return 'night';
}

const WEATHER_LABELS = {
  sunny: 'Sunny Day',
  meteor: 'Meteor Shower',
  rain: 'Rainy',
  rainbow: 'Rainbow',
  aurora: 'Aurora'
};

function applySetup() {
  document.documentElement.setAttribute('data-setup', getSetup());
}

function createShell() {
  const CDN_BASE = (typeof window !== 'undefined' && window.__HARTO_BASE) ? window.__HARTO_BASE : 'https://cdn.jsdelivr.net/gh/demo0ne/harto-data@main';
  const iconSrc = `${CDN_BASE}/assets/images/hatopia.png`;
  const setup = getSetup();
  document.body.innerHTML = `
    <header class="harto-topbar">
      <a href="#" class="harto-topbar-brand">
        <img class="harto-topbar-icon" src="${iconSrc}" alt="">
        <span class="harto-topbar-title"><span class="harto-topbar-title-a">Harto</span>.<span class="harto-topbar-title-b">dashboard</span></span>
        <span class="harto-setup-label harto-admin-only" id="harto-setup-label">${setup}</span>
      </a>
      <div class="harto-topbar-end">
        <button id="harto-setup-toggle" class="harto-setup-toggle harto-admin-only" title="Switch setup (SEA / TW)" aria-label="Switch setup">SEA / TW</button>
        <button id="harto-theme-toggle" class="harto-theme-toggle" title="Toggle dark mode" aria-label="Toggle dark mode">🌙</button>
      </div>
    </header>
    <div class="harto-app">
      <div class="harto-clock-block">
        <div class="harto-clock">
          <div class="harto-clock-row"><span id="harto-time"></span></div>
          <div class="harto-clock-date" id="harto-date"></div>
          <div class="harto-clock-weather" id="harto-weather-label"></div>
        </div>
        <img id="harto-weather-icon" class="harto-weather-icon" src="" alt="">
      </div>
      <header class="harto-header">
        <nav class="harto-tabs">
          <button class="harto-tab active" data-tab="tasks">Tasks</button>
          <button class="harto-tab" data-tab="guides">Guides</button>
        </nav>
      </header>
      <div id="harto-tasks" class="harto-tab-panel active">
        <div id="harto-packs" class="harto-packs"></div>
        <div id="harto-deck" class="harto-deck"></div>
      </div>
      <div id="harto-guides" class="harto-tab-panel">
        <p class="harto-placeholder">Guides coming soon.</p>
      </div>
    </div>
  `;
}

async function initClock() {
  let weatherBySlot = { dawn: 'sunny', day: 'sunny', dusk: 'sunny', night: 'sunny' };
  try {
    const res = await fetch(`${CDN}/info/weather.json`);
    const data = await res.json();
    if (data && typeof data === 'object') {
      weatherBySlot = { ...weatherBySlot, ...data };
    }
  } catch (_) {}

  function updateClock() {
    const now = new Date();
    const hrs = now.getHours();
    const mins = now.getMinutes();
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    const h12 = hrs % 12 || 12;
    const timeStr = `${String(h12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${ampm}`;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateStr = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

    const slot = getTimeSlot();
    const weather = (weatherBySlot[slot] || 'sunny').toLowerCase().replace(/\s+/g, '-');
    const validWeather = ['sunny', 'meteor', 'rain', 'rainbow', 'aurora'].includes(weather) ? weather : 'sunny';
    const label = WEATHER_LABELS[validWeather] || 'Sunny Day';
    const imgName = validWeather === 'sunny' ? slot : validWeather;
    const imgSrc = `${CDN}/assets/images/weather/${imgName}.png`;

    const $time = document.getElementById('harto-time');
    const $date = document.getElementById('harto-date');
    const $label = document.getElementById('harto-weather-label');
    const $img = document.getElementById('harto-weather-icon');
    if ($time) $time.textContent = timeStr;
    if ($date) $date.textContent = dateStr;
    if ($label) $label.textContent = label;
    if ($img) {
      $img.src = imgSrc;
      $img.alt = label;
    }
  }

  updateClock();
  setInterval(updateClock, 60000);
  window.addEventListener('harto:setupChange', updateClock);
}

function initSetup() {
  applySetup();
  const admin = isAdmin();
  document.querySelectorAll('.harto-admin-only').forEach((el) => {
    el.style.display = admin ? (el.classList.contains('harto-setup-toggle') ? 'flex' : 'inline') : 'none';
  });
  const $label = document.getElementById('harto-setup-label');
  const $toggle = document.getElementById('harto-setup-toggle');
  if ($label) $label.textContent = getSetup();
  if ($toggle && admin) {
    $toggle.addEventListener('click', () => {
      const next = getSetup() === 'SEA' ? 'TW' : 'SEA';
      localStorage.setItem(STORAGE_SETUP, next);
      applySetup();
      if ($label) $label.textContent = next;
      window.dispatchEvent(new CustomEvent('harto:setupChange'));
      render();
    });
  }
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
    createShell();
    initSetup();
    initTheme();
    initClock();
    initTabs();
    init();
  });
} else {
  createShell();
  initSetup();
  initTheme();
  initClock();
  initTabs();
  init();
}
