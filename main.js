/**
 * Harto - Card-based To-Do for Heartopia
 * Version: 0.7.6
 */

const CDN = (typeof window !== 'undefined' && window.__HARTO_BASE) ? window.__HARTO_BASE : 'https://cdn.jsdelivr.net/gh/demo0ne/harto-data@main';
const VERSION = '0.7.6';
const STORAGE_COMPLETIONS = 'harto_completions';
const STORAGE_COMPLETIONS_TW = 'harto_completions_tw';
const STORAGE_THEME = 'harto_theme';
const STORAGE_SETUP = 'harto_setup';
const STORAGE_TASK_VIEW = 'harto_task_view';
// harto_admin: read-only from app; set manually in browser localStorage to 'true' for admin mode

function isAdmin() {
  return localStorage.getItem('harto_admin') === 'true';
}

function getSetup() {
  const s = localStorage.getItem(STORAGE_SETUP) || 'SEA';
  return s === 'TW' ? 'TW' : 'SEA';
}

function getTaskView() {
  const s = localStorage.getItem(STORAGE_TASK_VIEW) || 'card';
  return s === 'list' ? 'list' : 'card';
}

function setTaskView(view) {
  localStorage.setItem(STORAGE_TASK_VIEW, view === 'list' ? 'list' : 'card');
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

function isTrackerLocationValid(effectiveDate) {
  if (!effectiveDate || typeof effectiveDate !== 'string') return false;
  const today = getToday();
  return effectiveDate.trim() === today;
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

function getStepsCompleted(entry) {
  return entry?.stepsCompleted ?? 0;
}

function isCompleted(cardId, completions) {
  const entry = completions[cardId];
  const card = window.__HARTO_CARDS?.find((c) => c.id === cardId);
  if (!card) return !!entry;
  if (!entry) return false;
  if (shouldReset(card.pack, entry.date)) return false;
  const steps = card.steps || 0;
  if (steps > 0) return getStepsCompleted(entry) >= steps;
  return true;
}

function getDateKeyForPack(pack) {
  if (pack === 'Weekly') return getWeekStart();
  return getToday();
}

function getApprovedUrl() {
  const base = (typeof window !== 'undefined' && window.__HARTO_BASE) ? window.__HARTO_BASE : 'https://cdn.jsdelivr.net/gh/demo0ne/harto-data@main';
  return `${base}/assets/images/approved.png`;
}

function runCompleteAnimation(cardEl, packEl, opts) {
  const imageWrap = cardEl?.querySelector('.harto-card-image-wrap');
  if (!imageWrap || !packEl) {
    render(opts);
    return;
  }
  const approvedEl = document.createElement('div');
  approvedEl.className = 'harto-card-approved harto-card-approved-stamping';
  approvedEl.style.backgroundImage = `url('${getApprovedUrl()}')`;
  imageWrap.appendChild(approvedEl);
  cardEl.classList.add('harto-card-completed');
  cardEl.style.zIndex = '10';

  const stampDuration = 420;
  const flyDuration = 350;

  approvedEl.animate(
    [
      { transform: 'scale(3)', opacity: 0.9 },
      { transform: 'scale(1)', opacity: 1 }
    ],
    { duration: stampDuration, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'forwards' }
  ).finished.then(() => {
    approvedEl.classList.remove('harto-card-approved-stamping');
    const wiggleDuration = 280;
    cardEl.animate(
      [
        { transform: 'translate(0, 0) rotate(0deg)' },
        { transform: 'translate(0, 0) rotate(-4deg)' },
        { transform: 'translate(0, 0) rotate(4deg)' },
        { transform: 'translate(0, 0) rotate(-2deg)' },
        { transform: 'translate(0, 0) rotate(0deg)' }
      ],
      { duration: wiggleDuration, easing: 'ease-in-out' }
    ).finished.then(() => {
      const packRect = packEl.getBoundingClientRect();
      const cardRect = cardEl.getBoundingClientRect();
      const dx = packRect.left + packRect.width / 2 - (cardRect.left + cardRect.width / 2);
      const dy = packRect.top + packRect.height / 2 - (cardRect.top + cardRect.height / 2);
      cardEl.animate(
        [
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) scale(0.3)`, opacity: 0 }
        ],
        { duration: flyDuration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
      ).finished.then(() => {
        cardEl.style.zIndex = '';
        render(opts);
      });
    });
  });
}

function completeCard(cardId, opts) {
  const completions = getCompletions();
  const card = window.__HARTO_CARDS?.find((c) => c.id === cardId);
  const dateKey = card ? getDateKeyForPack(card.pack) : getToday();
  const steps = card?.steps || 0;
  completions[cardId] = {
    date: dateKey,
    timestamp: Date.now(),
    ...(steps > 0 ? { stepsCompleted: steps } : {})
  };
  setCompletions(completions);

  const packEl = opts?.flyToPack;
  const cardEl = document.querySelector(`.harto-card[data-id="${cardId}"]`);
  if (packEl && cardEl) {
    runCompleteAnimation(cardEl, packEl, opts);
  } else {
    render(opts);
  }
}

function toggleStep(cardId, stepIndex, opts) {
  const completions = getCompletions();
  const card = window.__HARTO_CARDS?.find((c) => c.id === cardId);
  const steps = card?.steps || 0;
  if (steps <= 0) return;
  const dateKey = getDateKeyForPack(card.pack);
  let entry = completions[cardId];
  if (!entry || shouldReset(card.pack, entry.date)) entry = { date: dateKey, timestamp: Date.now(), stepsCompleted: 0 };
  const completed = getStepsCompleted(entry);
  const stepDone = stepIndex < completed;
  entry.stepsCompleted = stepDone ? stepIndex : stepIndex + 1;
  entry.timestamp = Date.now();
  completions[cardId] = entry;
  setCompletions(completions);

  const allDone = entry.stepsCompleted >= steps;
  const cardEl = document.querySelector(`.harto-card[data-id="${cardId}"]`);
  const section = cardEl?.closest('.harto-deck-section');
  const packEl = section?.querySelector('.harto-deck-pack');
  if (allDone && packEl && cardEl) {
    runCompleteAnimation(cardEl, packEl, opts);
  } else {
    render(opts);
  }
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
  const steps = card.steps || 0;
  const stepsCompleted = getStepsCompleted(completions[card.id]);
  const isStepCard = steps > 0;
  let stepsHtml = '';
  if (isStepCard) {
    stepsHtml = `<div class="harto-card-steps" data-id="${escapeHtml(card.id)}" data-pack="${escapeHtml(card.pack)}">` +
      Array.from({ length: steps }, (_, i) => {
        const checked = i < stepsCompleted;
        return `<button type="button" class="harto-card-step ${checked ? 'checked' : ''}" data-step="${i}" aria-label="Step ${i + 1}">${checked ? '✓' : ''}</button>`;
      }).join('') + '</div>';
  }
  const completeBtn = `<button class="harto-card-complete" data-action="${done ? 'uncomplete' : 'complete'}" title="${done ? 'Undo' : 'Complete'}">${done ? '✓' : ''}</button>`;
  const approvedOverlay = done ? `<div class="harto-card-approved" style="background-image: url('${approvedUrl}')"></div>` : '';
  const trackerEntry = card.id === 'roamingoak' ? __trackerData?.roamingOak : card.id === 'flawless' ? __trackerData?.flawlessFlourite : null;
  const loc = trackerEntry?.location || '';
  const effectiveDate = trackerEntry?.effectiveDate || '';
  const isValid = loc ? isTrackerLocationValid(effectiveDate) : false;
  const isExpired = !isValid && loc;
  const expiredImg = isExpired ? `<img class="harto-card-expired-overlay" src="${CDN}/assets/images/expired.png" alt="" aria-hidden="true">` : '';
  const expiredClass = isExpired ? ' harto-card-location-expired' : '';
  const imageWrapExpiredClass = isExpired ? ' harto-card-image-expired' : '';
  const locationOverlay = loc ? `<span class="harto-card-location-overlay"><span class="harto-card-location-badge-wrap${expiredClass}"><span class="harto-card-location-badge">${escapeHtml(loc)}</span></span></span>` : '';
  const season = card.season || 'always';
  const weather = card.weather || 'any';
  const time = card.time || 'all';
  const metaBadges = `<div class="harto-card-meta">
    <span class="harto-card-meta-badge" data-meta="season"><span class="harto-card-meta-label">Season:</span> ${escapeHtml(season)}</span>
    <span class="harto-card-meta-badge" data-meta="weather"><span class="harto-card-meta-label">Weather:</span> ${escapeHtml(weather)}</span>
    <span class="harto-card-meta-badge" data-meta="time"><span class="harto-card-meta-label">Time:</span> ${escapeHtml(time)}</span>
  </div>`;
  return `
    <div class="harto-card harto-card-dealing ${done ? 'harto-card-completed' : ''}" data-id="${escapeHtml(card.id)}" data-pack="${escapeHtml(card.pack)}" data-deal-index="${index >= 0 ? index : 0}">
      <div class="harto-card-content">
        <div class="harto-card-left">
          <span class="harto-card-complete-wrap">${completeBtn}</span>
          <div class="harto-card-image-wrap${imageWrapExpiredClass}"><img class="harto-card-image" src="${imgSrc || ''}" alt="" onerror="this.style.display='none'">${locationOverlay}${expiredImg}${approvedOverlay}</div>
        </div>
        <div class="harto-card-right">
          ${isStepCard ? `<div class="harto-card-steps-row">${stepsHtml}</div>` : ''}
          <div class="harto-card-title-row">
            <h3 class="harto-card-title">${escapeHtml(card.title)}${loc ? `<span class="harto-card-location-title-badge${expiredClass}">${escapeHtml(loc)}</span>` : ''}</h3>
            <span class="harto-card-complete-wrap harto-card-complete-inline">${completeBtn}</span>
          </div>
          <div class="harto-card-body">
          ${isStepCard ? stepsHtml : ''}
          ${card.description ? `<p class="harto-card-description">${escapeHtml(card.description)}</p>` : ''}
          ${metaBadges}
          </div>
        </div>
      </div>
    </div>
  `;
}

function playDealAnimation(deckEl) {
  const sections = deckEl.querySelectorAll('.harto-deck-section');
  const duration = 280;
  const stagger = 120;

  sections.forEach((section) => {
    const packEl = section.querySelector('.harto-deck-pack');
    const cards = Array.from(section.querySelectorAll('.harto-card:not(.harto-card-completed)'));
    const completedContainer = section.querySelector('.harto-deck-completed');
    if (completedContainer) {
      completedContainer.querySelectorAll('.harto-card').forEach((c) => c.classList.add('harto-card-dealing'));
    }
    if (!packEl) return;

    cards.forEach((c) => c.classList.add('harto-card-dealing'));
    packEl.classList.add('harto-pack-dealing');

    const runDeal = () => {
      requestAnimationFrame(() => {
      const packRect = packEl.getBoundingClientRect();
      const packX = packRect.left + packRect.width / 2;
      const packY = packRect.top + packRect.height / 2;

      let delay = 0;
      cards.forEach((card, idx) => {
        const rect = card.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = packX - cx;
        const dy = packY - cy;

        card.style.willChange = 'transform, opacity';
        card.animate(
          [
            { transform: `translate3d(${dx}px, ${dy}px, 0) scale(0.85)`, opacity: 0 },
            { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 }
          ],
          { duration, delay, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
        ).finished.then(() => {
          card.style.willChange = '';
          card.classList.remove('harto-card-dealing');
        });
        delay += stagger;
      });

      setTimeout(() => {
        packEl.classList.remove('harto-pack-dealing');
        if (completedContainer && window.__HARTO_PACK_EXPANDED?.[section.dataset.pack]) {
          completedContainer.classList.add('harto-deck-completed-visible');
        }
        completedContainer?.querySelectorAll('.harto-card').forEach((c) => c.classList.remove('harto-card-dealing'));
      }, delay + duration);
      });
    };
    requestAnimationFrame(runDeal);
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

function packImageSlug(pack) {
  const s = (pack || 'others').toLowerCase().replace(/\s+/g, '-');
  return s.replace(/[^a-z0-9-]/g, '') || 'others';
}

function renderPack(packName, hasCompleted, completedCount, isExpanded) {
  const approvedUrl = `${CDN}/assets/images/approved.png`;
  const imgSlug = packImageSlug(packName);
  const imgSrc = `${CDN}/assets/images/${imgSlug}_pack.png`;
  const approvedOverlay = hasCompleted ? `<div class="harto-card-approved" style="background-image: url('${approvedUrl}')"></div>` : '';
  const countBadge = (hasCompleted && !isExpanded && completedCount > 0)
    ? ` <span class="harto-pack-completed-badge">${completedCount}</span>`
    : '';
  return `
    <div class="harto-deck-pack" data-pack="${escapeHtml(packName)}" role="button" tabindex="0" aria-label="Toggle completed cards">
      <div class="harto-deck-pack-content">
        <h3 class="harto-deck-pack-title">${escapeHtml(packName)} · Completed${countBadge}</h3>
        <img class="harto-deck-pack-image" src="${imgSrc}" alt="" onerror="this.style.display='none'">
      </div>
      ${approvedOverlay}
    </div>
  `;
}

const PACKS = ['All', 'Daily', 'Daily-NPC', 'Weekly', 'Others'];

let __weatherData = null;
let __trackerData = null;

async function loadTrackerData() {
  try {
    const res = await fetch(`${CDN}/info/tracker.json`);
    const data = await res.json();
    if (data && typeof data === 'object') __trackerData = data;
  } catch (_) {}
}

async function loadWeatherData() {
  try {
    const res = await fetch(`${CDN}/info/weather.json`);
    const data = await res.json();
    if (data && typeof data === 'object') __weatherData = data;
  } catch (_) {}
}

function getCurrentSeason() {
  return __weatherData?.season || 'winter';
}

function getCurrentWeatherBySlot(slot) {
  if (!__weatherData) return 'sunny';
  return (__weatherData[slot] || 'sunny').toLowerCase().replace(/\s+/g, '-');
}

function cardVisible(card) {
  if (card.active === false) return false;
  const season = getCurrentSeason();
  const slot = getTimeSlot();
  const weather = getCurrentWeatherBySlot(slot);
  if (card.season && card.season !== 'always' && card.season !== season) return false;
  if (card.weather && card.weather !== 'any' && card.weather !== weather) return false;
  if (card.time && card.time !== 'all' && card.time !== slot) return false;
  return true;
}

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
    if (!cardVisible(c)) return;
    if (!byPack.incomplete[c.pack]) return;
    const done = isCompleted(c.id, completions);
    if (!done) pendingCount++;
    (done ? byPack.completed : byPack.incomplete)[c.pack].push(c);
  });

  const tasksTab = document.querySelector('.harto-tab[data-tab="tasks"]');
  if (tasksTab) {
    tasksTab.innerHTML = 'Tasks' + (pendingCount > 0 ? ` <span class="harto-tab-badge">${pendingCount}</span>` : '');
  }

  deckEl.classList.toggle('harto-deck-view-list', getTaskView() === 'list');

  packsEl.innerHTML = PACKS.map((pack) => {
    const count = (byPack.incomplete[pack] || []).length;
    const badge = count > 0 ? ` <span class="harto-pack-badge">${count}</span>` : '';
    return `<button class="harto-pack ${filterPack === pack ? 'active' : ''}" data-pack="${escapeHtml(pack)}">${escapeHtml(pack)}${badge}</button>`;
  }).join('');

  const packsToShow = filterPack === 'All' ? PACKS.slice(1) : [filterPack];
  const packExpanded = window.__HARTO_PACK_EXPANDED || {};
  deckEl.innerHTML = packsToShow.map((pack) => {
    const incomplete = byPack.incomplete[pack] || [];
    const completed = byPack.completed[pack] || [];
    if (incomplete.length === 0 && completed.length === 0) return '';
    let packHtml = renderPack(pack, completed.length > 0, completed.length, !!packExpanded[pack]);
    if (incomplete.length > 0) packHtml = `<span class="harto-card-divider-wrap">${packHtml}</span>`;
    const incompleteHtml = incomplete.map((c, i) => renderCard(c, completions, false, i)).join('');
    const completedCards = completed.map((c, i) => renderCard(c, completions, true, incomplete.length + 1 + i));
    const completedWrapperClass = packExpanded[pack] ? 'harto-deck-completed-visible' : '';
    const completedInner = completedCards.join('');
    const completedHtml = completedCards.length > 0
      ? `<div class="harto-deck-completed ${completedWrapperClass}" data-pack="${escapeHtml(pack)}">${completedInner}</div>`
      : '';
    return `
      <div class="harto-deck-section" data-pack="${escapeHtml(pack)}">
        <h4 class="harto-deck-section-title">${escapeHtml(pack)}</h4>
        <div class="harto-deck-cards">
          ${incompleteHtml}${packHtml}${completedHtml}
        </div>
      </div>
    `;
  }).filter(Boolean).join('');
  window.__HARTO_PACK_EXPANDED = packExpanded;

  packsEl.querySelectorAll('.harto-pack').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.__HARTO_FILTER_PACK = btn.dataset.pack;
      render();
    });
  });

  if (opts?.affectedPack && opts?.oldRects) {
    playFlipAnimation(deckEl, opts.affectedPack, opts.oldRects);
  } else {
    const isPackToggle = window.__HARTO_HAS_RENDERED;
    if (window.__HARTO_HAS_RENDERED === undefined) window.__HARTO_HAS_RENDERED = false;
    window.__HARTO_HAS_RENDERED = true;
    const runDeal = () => playDealAnimation(deckEl);
    isPackToggle ? setTimeout(runDeal, 50) : runDeal();
  }

  deckEl.querySelectorAll('.harto-card-complete').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const cardEl = e.target.closest('.harto-card');
      if (!cardEl) return;
      const id = cardEl.dataset.id;
      const pack = cardEl.dataset.pack;
      const action = e.target.dataset.action;
      const section = cardEl.closest('.harto-deck-section');
      const oldRects = new Map();
      if (section) {
        section.querySelectorAll('.harto-card').forEach((c) => {
          oldRects.set(c.dataset.id, c.getBoundingClientRect());
        });
      }
      if (action === 'complete') {
        const packEl = section?.querySelector('.harto-deck-pack');
        completeCard(id, { affectedPack: pack, oldRects, flyToPack: packEl });
      } else uncompleteCard(id, { affectedPack: pack, oldRects });
    });
  });

  deckEl.querySelectorAll('.harto-deck-pack').forEach((packEl) => {
    packEl.addEventListener('click', () => {
      const pack = packEl.dataset.pack;
      window.__HARTO_PACK_EXPANDED = window.__HARTO_PACK_EXPANDED || {};
      const section = packEl.closest('.harto-deck-section');
      const completedEl = section?.querySelector('.harto-deck-completed');
      if (!completedEl || completedEl.querySelectorAll('.harto-card').length === 0) return;
      const isExpanding = !window.__HARTO_PACK_EXPANDED[pack];
      window.__HARTO_PACK_EXPANDED[pack] = isExpanding;
      const packRect = packEl.getBoundingClientRect();
      const cards = Array.from(completedEl.querySelectorAll('.harto-card'));
      if (isExpanding) {
        completedEl.classList.add('harto-deck-completed-visible');
        cards.forEach((card, i) => {
          const rect = card.getBoundingClientRect();
          const dx = packRect.left + packRect.width / 2 - (rect.left + rect.width / 2);
          const dy = packRect.top + packRect.height / 2 - (rect.top + rect.height / 2);
          card.style.transform = `translate(${dx}px, ${dy}px) scale(0.7)`;
          card.style.opacity = '0';
          card.style.transition = 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease';
          card.style.transitionDelay = `${i * 60}ms`;
          requestAnimationFrame(() => {
            card.style.transform = '';
            card.style.opacity = '';
          });
        });
        setTimeout(() => cards.forEach((c) => { c.style.transition = ''; c.style.transitionDelay = ''; }), cards.length * 60 + 400);
      } else {
        cards.forEach((card, i) => {
          const rect = card.getBoundingClientRect();
          const dx = packRect.left + packRect.width / 2 - (rect.left + rect.width / 2);
          const dy = packRect.top + packRect.height / 2 - (rect.top + rect.height / 2);
          card.style.transition = 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease';
          card.style.transitionDelay = `${(cards.length - 1 - i) * 50}ms`;
        });
        requestAnimationFrame(() => {
          cards.forEach((card) => {
            const rect = card.getBoundingClientRect();
            const dx = packRect.left + packRect.width / 2 - (rect.left + rect.width / 2);
            const dy = packRect.top + packRect.height / 2 - (rect.top + rect.height / 2);
            card.style.transform = `translate(${dx}px, ${dy}px) scale(0.7)`;
            card.style.opacity = '0';
          });
          completedEl.classList.remove('harto-deck-completed-visible');
        });
        setTimeout(() => cards.forEach((c) => { c.style.transition = ''; c.style.transitionDelay = ''; c.style.transform = ''; c.style.opacity = ''; }), (cards.length - 1) * 50 + 400);
      }
    });
  });

  deckEl.querySelectorAll('.harto-card-step').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const stepsEl = e.target.closest('.harto-card-steps');
      const cardEl = stepsEl?.closest('.harto-card');
      if (!stepsEl || !cardEl) return;
      const id = stepsEl.dataset.id;
      const pack = stepsEl.dataset.pack;
      const stepIndex = parseInt(e.target.dataset.step, 10);
      const section = cardEl.closest('.harto-deck-section');
      const oldRects = new Map();
      if (section) {
        section.querySelectorAll('.harto-card').forEach((c) => {
          oldRects.set(c.dataset.id, c.getBoundingClientRect());
        });
      }
      toggleStep(id, stepIndex, { affectedPack: pack, oldRects });
    });
  });
}

async function init() {
  await Promise.all([loadWeatherData(), loadTrackerData()]);
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

const WEATHER_WORDS = {
  sunny: 'Sunny',
  meteor: 'Meteor',
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
        <span class="harto-setup-label harto-admin-only" id="harto-setup-label">
          <img class="harto-setup-icon" id="harto-setup-icon" src="${CDN_BASE}/assets/images/${setup}.png" alt="">
          <span class="harto-setup-text" id="harto-setup-text">${setup}</span>
        </span>
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
        <div class="harto-tasks-toolbar">
          <div id="harto-packs" class="harto-packs"></div>
          <button id="harto-reset-completed" class="harto-reset-completed harto-admin-only" title="Reset all completed in active filter" aria-label="Reset completed">↺</button>
          <button id="harto-view-toggle" class="harto-view-toggle" title="Toggle card/list view" aria-label="Toggle card/list view">⊞</button>
        </div>
        <div id="harto-deck" class="harto-deck"></div>
      </div>
      <div id="harto-guides" class="harto-tab-panel">
        <p class="harto-placeholder">Guides coming soon.</p>
      </div>
    </div>
  `;
}

async function initClock() {
  await loadWeatherData();

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
    const weather = getCurrentWeatherBySlot(slot);
    const validWeather = ['sunny', 'meteor', 'rain', 'rainbow', 'aurora'].includes(weather) ? weather : 'sunny';
    const weatherWord = WEATHER_WORDS[validWeather] || 'Sunny';
    const slotWord = slot.charAt(0).toUpperCase() + slot.slice(1);
    const label = `${weatherWord} ${slotWord}`;
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
    el.style.display = admin
      ? (el.classList.contains('harto-setup-toggle') ? 'flex' : el.classList.contains('harto-setup-label') ? 'inline-flex' : 'inline')
      : 'none';
  });
  const $label = document.getElementById('harto-setup-label');
  const $icon = document.getElementById('harto-setup-icon');
  const $text = document.getElementById('harto-setup-text');
  const CDN_BASE = (typeof window !== 'undefined' && window.__HARTO_BASE) ? window.__HARTO_BASE : 'https://cdn.jsdelivr.net/gh/demo0ne/harto-data@main';
  function updateSetupLabel(s) {
    if ($icon) $icon.src = `${CDN_BASE}/assets/images/${s}.png`;
    if ($text) $text.textContent = s;
  }
  updateSetupLabel(getSetup());
  const $toggle = document.getElementById('harto-setup-toggle');
  if ($toggle && admin) {
    $toggle.addEventListener('click', () => {
      const next = getSetup() === 'SEA' ? 'TW' : 'SEA';
      localStorage.setItem(STORAGE_SETUP, next);
      applySetup();
      updateSetupLabel(next);
      window.dispatchEvent(new CustomEvent('harto:setupChange'));
      render();
    });
  }
}

function initResetCompleted() {
  const btn = document.getElementById('harto-reset-completed');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const filterPack = window.__HARTO_FILTER_PACK || 'All';
    const cards = window.__HARTO_CARDS || [];
    const completions = getCompletions();
    const packsToReset = filterPack === 'All' ? PACKS.slice(1) : [filterPack];
    let changed = false;
    cards.forEach((c) => {
      if (cardVisible(c) && packsToReset.includes(c.pack) && completions[c.id]) {
        delete completions[c.id];
        changed = true;
      }
    });
    if (changed) {
      setCompletions(completions);
      render();
    }
  });
}

function initViewToggle() {
  const btn = document.getElementById('harto-view-toggle');
  const deckEl = document.getElementById('harto-deck');
  if (!btn || !deckEl) return;
  function updateLabel() {
    btn.textContent = getTaskView() === 'card' ? '≡' : '⊞';
    btn.title = getTaskView() === 'card' ? 'Switch to list view' : 'Switch to card view';
  }
  updateLabel();
  btn.addEventListener('click', () => {
    const next = getTaskView() === 'card' ? 'list' : 'card';
    setTaskView(next);
    deckEl.classList.toggle('harto-deck-view-list', next === 'list');
    updateLabel();
  });
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
    initViewToggle();
    initResetCompleted();
    init();
  });
} else {
  createShell();
  initSetup();
  initTheme();
  initClock();
  initTabs();
  initViewToggle();
  initResetCompleted();
  init();
}
