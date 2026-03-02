/**
 * Harto - Card-based To-Do for Heartopia
 * Version: 0.11.9
 */

const HARTO_RAW = 'https://raw.githubusercontent.com/demo0ne/harto-data/main';
const CDN = (typeof window !== 'undefined' && window.__HARTO_BASE) ? window.__HARTO_BASE : HARTO_RAW;
const VERSION = '0.11.9';
if (typeof window !== 'undefined') window.__HARTO_VERSION_JS = VERSION;
const STORAGE_COMPLETIONS = 'harto_completions';
const STORAGE_COMPLETIONS_TW = 'harto_completions_tw';
const STORAGE_THEME = 'harto_theme';
const STORAGE_SETUP = 'harto_setup';
const STORAGE_TASK_VIEW = 'harto_task_view';
const STORAGE_PENDING_ORDER = 'harto_pending_order';
const STORAGE_CUSTOM_CARDS = 'harto_custom_cards';
const STORAGE_SHOW_INACTIVE = 'harto_show_inactive';
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

function getPendingOrder() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_PENDING_ORDER) || '{}');
  } catch {
    return {};
  }
}

function setPendingOrder(order) {
  localStorage.setItem(STORAGE_PENDING_ORDER, JSON.stringify(order));
}

function getCustomCards() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_CUSTOM_CARDS) || '[]');
  } catch {
    return [];
  }
}

function setCustomCards(cards) {
  localStorage.setItem(STORAGE_CUSTOM_CARDS, JSON.stringify(cards));
}

function sortByPendingOrder(cards, displayPack) {
  const order = getPendingOrder()[displayPack];
  if (!order || !Array.isArray(order)) return cards;
  const byId = new Map(cards.map((c) => [c.id, c]));
  const result = [];
  for (const id of order) {
    const c = byId.get(id);
    if (c) {
      result.push(c);
      byId.delete(id);
    }
  }
  byId.forEach((c) => result.push(c));
  return result;
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

function isWeeklyMergeWindow() {
  const hr = getResetHour();
  const now = new Date();
  const day = now.getDay();
  const hrs = now.getHours();
  return (day === 5 && hrs >= hr) || (day === 6 && hrs < hr);
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
  const base = (typeof window !== 'undefined' && window.__HARTO_BASE) ? window.__HARTO_BASE : HARTO_RAW;
  return `${base}/assets/images/approved.png`;
}

function getCancelledUrl() {
  const base = (typeof window !== 'undefined' && window.__HARTO_BASE) ? window.__HARTO_BASE : HARTO_RAW;
  return `${base}/assets/images/cancelled.png`;
}

function runUncompleteAnimation(cardEl, packEl, cardId, opts) {
  const imageWrap = cardEl?.querySelector('.harto-card-image-wrap');
  if (!imageWrap || !packEl) {
    const completions = getCompletions();
    delete completions[cardId];
    setCompletions(completions);
    render(opts);
    return;
  }
  const approvedEl = imageWrap.querySelector('.harto-card-approved');
  if (approvedEl) approvedEl.remove();
  cardEl.classList.remove('harto-card-completed');

  const cancelledEl = document.createElement('div');
  cancelledEl.className = 'harto-card-approved harto-card-approved-stamping harto-card-cancelled';
  cancelledEl.style.backgroundImage = `url('${getCancelledUrl()}')`;
  imageWrap.appendChild(cancelledEl);
  cardEl.style.zIndex = '10';

  const stampDuration = 420;
  const wiggleDuration = 280;
  const flyDuration = 350;

  cancelledEl.animate(
    [
      { transform: 'scale(3)', opacity: 0.9 },
      { transform: 'scale(1)', opacity: 1 }
    ],
    { duration: stampDuration, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'forwards' }
  ).finished.then(() => {
    cancelledEl.classList.remove('harto-card-approved-stamping');
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
        cancelledEl.remove();
        cardEl.style.zIndex = '';
        const completions = getCompletions();
        delete completions[cardId];
        setCompletions(completions);
        render(opts);
      });
    });
  });
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
  const section = document.querySelector(`.harto-card[data-id="${cardId}"]`)?.closest('.harto-deck-section');
  const packEl = section?.querySelector('.harto-deck-pack');
  const cardEl = document.querySelector(`.harto-card[data-id="${cardId}"]`);
  if (packEl && cardEl) {
    runUncompleteAnimation(cardEl, packEl, cardId, opts);
  } else {
    const completions = getCompletions();
    delete completions[cardId];
    setCompletions(completions);
    render(opts);
  }
}

function renderCard(card, completions, done, index, opts) {
  const weeklyMerge = (opts?.mergeWindow && card.pack === 'Weekly') || opts?.expiryDay;
  const draggable = opts?.draggable && !done;
  const displayPack = opts?.displayPack || card.pack;
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
  const isCustom = opts?.isCustom;
  const isInactiveCustom = opts?.isInactiveCustom;
  let completeBtn;
  if (isInactiveCustom) {
    completeBtn = `<button class="harto-card-reactivate" data-action="reactivate" title="Reactivate">↻</button>`;
  } else {
    completeBtn = `<button class="harto-card-complete" data-action="${done ? 'uncomplete' : 'complete'}" title="${done ? 'Undo' : 'Complete'}">${done ? '✓' : ''}</button>`;
  }
  const customActions = isCustom && !isInactiveCustom
    ? `<div class="harto-card-custom-actions">
        <button type="button" class="harto-card-custom-btn" data-action="edit" title="Edit">✎</button>
        <button type="button" class="harto-card-custom-btn" data-action="delete" title="Delete">🗑</button>
      </div>`
    : '';
  const customActionsBody = isCustom && !isInactiveCustom
    ? `<div class="harto-card-custom-actions-bottom">${customActions}</div>`
    : '';
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
  const timeRange = (SPECIAL_WEATHER.includes(weather) && time !== 'all') ? getTimeSlotRange(time) : '';
  const titleSuffix = timeRange ? ` <span class="harto-card-title-time">(${timeRange})</span>` : '';
  const giftCodeHtml = (card.giftCode && String(card.giftCode).trim())
    ? `<div class="harto-gift-code-wrap">
        <code class="harto-gift-code">${escapeHtml(String(card.giftCode).trim())}</code>
        <button type="button" class="harto-gift-code-copy" data-gift-code="${escapeHtml(String(card.giftCode).trim())}" title="Copy to clipboard" aria-label="Copy gift code">📋</button>
      </div>`
    : '';
  const metaBadges = `<div class="harto-card-meta">
    <span class="harto-card-meta-badge" data-meta="season"><span class="harto-card-meta-label">Season:</span> ${escapeHtml(season)}</span>
    <span class="harto-card-meta-badge" data-meta="weather"><span class="harto-card-meta-label">Weather:</span> ${escapeHtml(weather)}</span>
    <span class="harto-card-meta-badge" data-meta="time"><span class="harto-card-meta-label">Time:</span> ${escapeHtml(time)}</span>
  </div>`;
  const weeklyMergeClass = weeklyMerge ? ' harto-card-weekly-merge' : '';
  const customClass = isCustom ? ' harto-card-custom' : '';
  const inactiveCustomClass = isInactiveCustom ? ' harto-card-inactive-custom' : '';
  const draggableAttr = draggable ? ' draggable="true"' : '';
  const displayPackAttr = draggable ? ` data-display-pack="${escapeHtml(displayPack)}"` : '';
  const dragHandle = draggable ? '<span class="harto-card-drag-handle" title="Drag to reorder">⋮⋮</span>' : '';
  const customIndicator = isCustom ? '<span class="harto-card-custom-indicator" aria-hidden="true"></span>' : '';
  return `
    <div class="harto-card harto-card-dealing ${done ? 'harto-card-completed' : ''}${weeklyMergeClass}${customClass}${inactiveCustomClass}"${draggableAttr}${displayPackAttr} data-id="${escapeHtml(card.id)}" data-pack="${escapeHtml(card.pack)}" data-deal-index="${index >= 0 ? index : 0}">
      ${customIndicator}${dragHandle}
      <div class="harto-card-content">
        <div class="harto-card-left">
          <span class="harto-card-complete-wrap">${completeBtn}</span>
          <div class="harto-card-image-wrap${imageWrapExpiredClass}"><img class="harto-card-image" src="${imgSrc || ''}" alt="" onerror="this.style.display='none'">${locationOverlay}${expiredImg}${approvedOverlay}</div>
        </div>
        <div class="harto-card-right">
          ${isStepCard ? `<div class="harto-card-steps-row">${stepsHtml}</div>` : ''}
          <div class="harto-card-title-row">
            <h3 class="harto-card-title">${escapeHtml(card.title)}${titleSuffix}${loc ? `<span class="harto-card-location-title-badge${expiredClass}">${escapeHtml(loc)}</span>` : ''}</h3>
            <span class="harto-card-complete-wrap harto-card-complete-inline">${completeBtn}</span>
          </div>
          <div class="harto-card-body">
          ${card.description ? `<p class="harto-card-description">${escapeHtml(card.description)}</p>` : ''}
          ${giftCodeHtml}
          ${metaBadges}
          ${customActionsBody}
          ${isStepCard ? stepsHtml : ''}
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
  const borderThickness = isExpanded ? 4 : 4 + Math.min(completedCount, 18);
  return `
    <div class="harto-deck-pack" data-pack="${escapeHtml(packName)}" data-completed="${completedCount}" style="--pack-border-thickness: ${borderThickness}px" role="button" tabindex="0" aria-label="Toggle completed cards">
      <div class="harto-deck-pack-content">
        <h3 class="harto-deck-pack-title">${escapeHtml(packName)} · Completed${countBadge}</h3>
        <img class="harto-deck-pack-image" src="${imgSrc}" alt="" onerror="this.style.display='none'">
      </div>
      ${approvedOverlay}
    </div>
  `;
}

const PACKS = ['All', 'Daily', 'Daily-NPC', 'Weekly', 'Gift Codes', 'Others'];

let __weatherData = null;
let __trackerData = null;

async function loadTrackerData() {
  try {
    const res = await fetch(`${CDN}/info/tracker.json`);
    const data = await res.json();
    if (data && typeof data === 'object') __trackerData = data;
  } catch (_) {}
}

let __weatherDataPromise = null;
async function loadWeatherData() {
  if (!__weatherDataPromise) {
    __weatherDataPromise = (async () => {
      try {
        const res = await fetch(`${CDN}/info/weather.json`);
        const data = await res.json();
        if (data && typeof data === 'object') __weatherData = data;
      } catch (_) {}
    })();
  }
  await __weatherDataPromise;
}

function getCurrentSeason() {
  return __weatherData?.season || 'winter';
}

function getCurrentWeatherBySlot(slot) {
  if (!__weatherData) return 'sunny';
  return (__weatherData[slot] || 'sunny').toLowerCase().replace(/\s+/g, '-');
}

function isTimeLimitedExpired(card) {
  if (!card.timeLimited || !card.expiryDate) return false;
  const today = getToday();
  return today > card.expiryDate.trim();
}

function isExpiryDay(card) {
  if (!card.timeLimited || !card.expiryDate) return false;
  return getToday() === card.expiryDate.trim();
}

function initPendingDrag(deckEl) {
  let dragCardId = null;
  let dragDisplayPack = null;

  deckEl.querySelectorAll('.harto-card[draggable="true"]').forEach((cardEl) => {
    cardEl.addEventListener('dragstart', (e) => {
      dragCardId = cardEl.dataset.id;
      dragDisplayPack = cardEl.dataset.displayPack || cardEl.closest('.harto-deck-section')?.dataset?.pack;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragCardId);
      e.dataTransfer.setData('application/json', JSON.stringify({ id: dragCardId, pack: dragDisplayPack }));
      const rect = cardEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      e.dataTransfer.setDragImage(cardEl, x, y);
      cardEl.classList.add('harto-card-dragging');
    });
    cardEl.addEventListener('dragend', () => {
      cardEl.classList.remove('harto-card-dragging');
      deckEl.querySelectorAll('.harto-card-drag-over').forEach((el) => el.classList.remove('harto-card-drag-over'));
      dragCardId = null;
      dragDisplayPack = null;
    });
    cardEl.addEventListener('dragover', (e) => {
      if (!dragCardId || dragCardId === cardEl.dataset.id) return;
      if ((cardEl.dataset.displayPack || cardEl.closest('.harto-deck-section')?.dataset?.pack) !== dragDisplayPack) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      cardEl.classList.add('harto-card-drag-over');
    });
    cardEl.addEventListener('dragleave', () => {
      cardEl.classList.remove('harto-card-drag-over');
    });
    cardEl.addEventListener('drop', (e) => {
      e.preventDefault();
      cardEl.classList.remove('harto-card-drag-over');
      const targetId = cardEl.dataset.id;
      const pack = cardEl.dataset.displayPack || cardEl.closest('.harto-deck-section')?.dataset?.pack;
      if (!pack || dragCardId === targetId || pack !== dragDisplayPack) return;
      const section = cardEl.closest('.harto-deck-section');
      if (!section) return;
      const cards = Array.from(section.querySelectorAll('.harto-card:not(.harto-card-completed)'));
      const ids = cards.map((c) => c.dataset.id);
      const fromIdx = ids.indexOf(dragCardId);
      const toIdx = ids.indexOf(targetId);
      if (fromIdx < 0 || toIdx < 0) return;
      ids.splice(fromIdx, 1);
      const newToIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
      ids.splice(newToIdx, 0, dragCardId);
      const order = getPendingOrder();
      order[pack] = ids;
      setPendingOrder(order);
      render();
    });
  });
}

function getShowInactive() {
  return localStorage.getItem(STORAGE_SHOW_INACTIVE) === 'true';
}

function setShowInactive(value) {
  localStorage.setItem(STORAGE_SHOW_INACTIVE, value ? 'true' : '');
}

const SPECIAL_WEATHER = ['meteor', 'rain', 'rainbow', 'aurora'];

function cardVisible(card) {
  const showInactive = getShowInactive();
  if (card.active === false) {
    if (card.custom && showInactive) return true;
    return false;
  }
  if (isTimeLimitedExpired(card)) return false;
  const season = getCurrentSeason();
  const slot = getTimeSlot();
  const weather = getCurrentWeatherBySlot(slot);
  if (card.season && card.season !== 'always' && card.season !== season) return false;
  if (card.weather && card.weather !== 'any' && card.weather !== weather) return false;
  if (card.time && card.time !== 'all' && card.time !== slot) return false;
  return true;
}

function getTimeSlotRange(slot) {
  if (!slot || slot === 'all') return '';
  const isTW = getSetup() === 'TW';
  const ranges = isTW
    ? { dawn: '6am-12pm', day: '12pm-6pm', dusk: '6pm-12am', night: '12am-6am' }
    : { dawn: '7am-1pm', day: '1pm-7pm', dusk: '7pm-1am', night: '1am-7am' };
  return ranges[slot] || '';
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
  const mergeWindow = isWeeklyMergeWindow();
  let pendingCount = 0;
  cards.forEach((c) => {
    if (!cardVisible(c)) return;
    if (!byPack.incomplete[c.pack]) return;
    const isInactiveCustom = c.custom && c.active === false;
    const done = isInactiveCustom ? false : isCompleted(c.id, completions);
    if (!done && !isInactiveCustom) pendingCount++;
    let displayPack = c.pack;
    if (mergeWindow && c.pack === 'Weekly') displayPack = 'Daily';
    else if (isExpiryDay(c)) displayPack = 'Daily';
    (done ? byPack.completed : byPack.incomplete)[displayPack].push(c);
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
    const incomplete = sortByPendingOrder(byPack.incomplete[pack] || [], pack);
    const completed = byPack.completed[pack] || [];
    if (incomplete.length === 0 && completed.length === 0) return '';
    let packHtml = renderPack(pack, completed.length > 0, completed.length, !!packExpanded[pack]);
    if (incomplete.length > 0) packHtml = `<span class="harto-card-divider-wrap">${packHtml}</span>`;
    const incompleteHtml = incomplete.map((c, i) => {
      const isInactiveCustom = c.custom && c.active === false;
      return renderCard(c, completions, false, i, { mergeWindow, expiryDay: isExpiryDay(c), displayPack: pack, draggable: !isInactiveCustom, isCustom: !!c.custom, isInactiveCustom });
    }).join('');
    const completedCards = completed.map((c, i) => renderCard(c, completions, true, incomplete.length + 1 + i, { mergeWindow, expiryDay: isExpiryDay(c), isCustom: !!c.custom, displayPack: pack }));
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

  initPendingDrag(deckEl);

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
      const completedCount = completedEl.querySelectorAll('.harto-card').length;
      packEl.style.setProperty('--pack-border-thickness', isExpanding ? '4px' : `${4 + Math.min(completedCount, 18)}px`);
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

  deckEl.querySelectorAll('.harto-card-reactivate').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const cardEl = e.target.closest('.harto-card');
      if (!cardEl) return;
      reactivateCustomCard(cardEl.dataset.id);
    });
  });

  deckEl.querySelectorAll('.harto-card-custom-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const cardEl = e.target.closest('.harto-card');
      if (!cardEl) return;
      const id = cardEl.dataset.id;
      const action = e.target.dataset.action;
      if (action === 'edit') openCustomModal(id);
      else if (action === 'inactive') setCustomInactive(id);
      else if (action === 'delete') deleteCustomCard(id);
    });
  });

  deckEl.querySelectorAll('.harto-gift-code-copy').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const el = e.currentTarget;
      const code = el.dataset.giftCode;
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code);
        const orig = el.textContent;
        el.textContent = '✓';
        el.classList.add('harto-gift-code-copied');
        setTimeout(() => { el.textContent = orig; el.classList.remove('harto-gift-code-copied'); }, 1200);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = code;
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          const orig = el.textContent;
          el.textContent = '✓';
          el.classList.add('harto-gift-code-copied');
          setTimeout(() => { el.textContent = orig; el.classList.remove('harto-gift-code-copied'); }, 1200);
        } finally {
          document.body.removeChild(ta);
        }
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

  updateReminderToasts();
}

function addCustomCard(card) {
  const custom = getCustomCards();
  custom.push(card);
  setCustomCards(custom);
  const builtIn = window.__HARTO_CARDS?.filter((c) => !c.custom) || [];
  window.__HARTO_CARDS = [...builtIn, ...custom];
  render();
}

function updateCustomCard(id, updates) {
  const custom = getCustomCards();
  const idx = custom.findIndex((c) => c.id === id);
  if (idx < 0) return;
  custom[idx] = { ...custom[idx], ...updates };
  setCustomCards(custom);
  const builtIn = window.__HARTO_CARDS?.filter((c) => !c.custom) || [];
  window.__HARTO_CARDS = [...builtIn, ...custom];
  render();
}

let __deleteConfirmId = null;

function openDeleteConfirm(id) {
  const modal = document.getElementById('harto-delete-confirm');
  if (!modal) return;
  __deleteConfirmId = id;
  modal.classList.add('harto-confirm-open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeDeleteConfirm() {
  const modal = document.getElementById('harto-delete-confirm');
  if (modal) {
    modal.classList.remove('harto-confirm-open');
    modal.setAttribute('aria-hidden', 'true');
  }
  __deleteConfirmId = null;
}

function performDeleteCustomCard(id) {
  const custom = getCustomCards().filter((c) => c.id !== id);
  setCustomCards(custom);
  const builtIn = window.__HARTO_CARDS?.filter((c) => !c.custom) || [];
  window.__HARTO_CARDS = [...builtIn, ...custom];
  render();
}

function deleteCustomCard(id) {
  openDeleteConfirm(id);
}

function setCustomInactive(id) {
  updateCustomCard(id, { active: false });
}

function reactivateCustomCard(id) {
  updateCustomCard(id, { active: true });
}

function openCustomModal(editId) {
  const modal = document.getElementById('harto-custom-modal');
  const form = document.getElementById('harto-custom-form');
  const titleInput = document.getElementById('harto-custom-title');
  const descInput = document.getElementById('harto-custom-desc');
  const freqInput = document.getElementById('harto-custom-freq');
  const titleEl = modal?.querySelector('.harto-custom-modal-title');
  const submitBtn = document.getElementById('harto-custom-submit');
  if (!modal || !form) return;
  const activeInput = document.getElementById('harto-custom-active');
  const activeRow = document.getElementById('harto-custom-active-row');
  if (editId) {
    const card = window.__HARTO_CARDS?.find((c) => c.custom && c.id === editId);
    if (card) {
      titleInput.value = card.title;
      descInput.value = card.description || '';
      freqInput.value = card.pack === 'Others' ? 'Others' : card.pack;
      if (activeInput) activeInput.checked = card.active !== false;
      if (activeRow) activeRow.style.display = '';
      titleEl.textContent = 'Edit custom task';
      submitBtn.textContent = 'Save';
      form.dataset.editId = editId;
    }
  } else {
    titleInput.value = '';
    descInput.value = '';
    freqInput.value = 'Daily';
    if (activeInput) activeInput.checked = true;
    if (activeRow) activeRow.style.display = 'none';
    titleEl.textContent = 'Add custom task';
    submitBtn.textContent = 'Add';
    delete form.dataset.editId;
  }
  modal.classList.add('harto-custom-modal-open');
  modal.setAttribute('aria-hidden', 'false');
  titleInput.focus();
}

function closeCustomModal() {
  const modal = document.getElementById('harto-custom-modal');
  if (modal) {
    modal.classList.remove('harto-custom-modal-open');
    modal.setAttribute('aria-hidden', 'true');
  }
}

function initCustomTasks() {
  const addBtn = document.getElementById('harto-add-custom');
  const showInactive = document.getElementById('harto-show-inactive');
  const modal = document.getElementById('harto-custom-modal');
  const form = document.getElementById('harto-custom-form');
  const cancelBtn = document.getElementById('harto-custom-cancel');
  const backdrop = modal?.querySelector('.harto-custom-modal-backdrop');

  if (showInactive) {
    showInactive.checked = getShowInactive();
    showInactive.addEventListener('change', () => {
      setShowInactive(showInactive.checked);
      render();
    });
  }

  if (addBtn) {
    addBtn.addEventListener('click', () => openCustomModal(null));
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const titleInput = document.getElementById('harto-custom-title');
      const descInput = document.getElementById('harto-custom-desc');
      const freqInput = document.getElementById('harto-custom-freq');
      const title = titleInput?.value?.trim();
      if (!title) return;
      const pack = freqInput?.value || 'Daily';
      const editId = form.dataset.editId;
      if (editId) {
        const activeInput = document.getElementById('harto-custom-active');
        const active = activeInput ? activeInput.checked : true;
        updateCustomCard(editId, { title, description: descInput?.value?.trim() || '', pack, active });
      } else {
        const card = {
          id: 'custom_' + Date.now(),
          pack,
          title,
          description: descInput?.value?.trim() || '',
          custom: true,
          season: 'always',
          weather: 'any',
          time: 'all',
          active: true,
          steps: 0,
          image: 'assets/images/placeholder.png'
        };
        addCustomCard(card);
      }
      closeCustomModal();
    });
  }

  if (cancelBtn) cancelBtn.addEventListener('click', closeCustomModal);
  if (backdrop) backdrop.addEventListener('click', closeCustomModal);

  const deleteModal = document.getElementById('harto-delete-confirm');
  const deleteCancelBtn = document.getElementById('harto-delete-cancel');
  const deleteConfirmBtn = document.getElementById('harto-delete-confirm-btn');
  const deleteBackdrop = deleteModal?.querySelector('.harto-confirm-backdrop');
  if (deleteCancelBtn) deleteCancelBtn.addEventListener('click', closeDeleteConfirm);
  if (deleteBackdrop) deleteBackdrop.addEventListener('click', closeDeleteConfirm);
  if (deleteConfirmBtn) {
    deleteConfirmBtn.addEventListener('click', () => {
      if (__deleteConfirmId) {
        performDeleteCustomCard(__deleteConfirmId);
        closeDeleteConfirm();
      }
    });
  }
}

function getVisibleGuides(guides) {
  if (!Array.isArray(guides)) return [];
  const today = formatDate(new Date());
  return guides.filter((g) => {
    if (!g.active) return false;
    if (g.timeLimited && g.expiryDate) {
      if (today > g.expiryDate) return false;
    }
    return true;
  });
}

function guideImageUrl(guideId, filename) {
  return `${CDN}/assets/images/guides/${guideId}/${filename}`;
}

function renderGuidesBookshelf(guides) {
  const shelf = document.getElementById('harto-guides-bookshelf');
  const reader = document.getElementById('harto-guides-reader');
  if (!shelf || !reader) return;
  shelf.style.display = '';
  reader.style.display = 'none';
  if (!guides.length) {
    shelf.innerHTML = '<p class="harto-placeholder">No guides available.</p>';
    return;
  }
  shelf.innerHTML = guides.map((g) => {
    const coverSrc = guideImageUrl(g.id, 'cover.png');
    return `<button type="button" class="harto-guides-book-cover" data-guide-id="${escapeHtml(g.id)}" title="${escapeHtml(g.title)}">
      <img src="${coverSrc}" alt="${escapeHtml(g.title)}" onerror="this.src='${CDN}/assets/images/hatopia.png'">
      <span class="harto-guides-book-title">${escapeHtml(g.title)}</span>
    </button>`;
  }).join('');
}

function renderGuidesGallery(guides) {
  const gallery = document.getElementById('harto-guides-gallery');
  if (!gallery) return;
  if (!guides.length) {
    gallery.innerHTML = '<p class="harto-placeholder">No guides available.</p>';
    return;
  }
  gallery.innerHTML = guides.map((g) => {
    const items = [];
    const coverSrc = guideImageUrl(g.id, 'cover.png');
    (g.pages || []).forEach((p) => {
      if (p.image) {
        items.push({ src: guideImageUrl(g.id, p.image), alt: p.imageAlt || p.title, label: p.title });
      }
    });
    const gridHtml = items.map((item) =>
      `<button type="button" class="harto-guides-gallery-item" tabindex="0">
        <img src="${item.src}" alt="${escapeHtml(item.alt)}" onerror="this.style.display='none'">
        <span class="harto-guides-gallery-label">${escapeHtml(item.label)}</span>
      </button>`
    ).join('');
    return `<div class="harto-guides-gallery-group harto-guides-gallery-group-collapsed" data-guide-id="${escapeHtml(g.id)}">
      <button type="button" class="harto-guides-gallery-cover" aria-expanded="false" title="${escapeHtml(g.title)}">
        <img src="${coverSrc}" alt="${escapeHtml(g.title)}" onerror="this.src='${CDN}/assets/images/hatopia.png'">
        <span class="harto-guides-gallery-cover-title">${escapeHtml(g.title)}</span>
        <span class="harto-guides-gallery-cover-icon">▶</span>
      </button>
      <div class="harto-guides-gallery-grid">${gridHtml}</div>
    </div>`;
  }).join('');
}

function buildGuidePages(guide) {
  const base = (p) => guideImageUrl(guide.id, p);
  const pages = [];
  // Page 0: Title and cover
  const coverImg = base('cover.png');
  pages.push({ html: `<div class="harto-guide-page harto-guide-cover"><h3 class="harto-guide-cover-title">${escapeHtml(guide.title)}</h3><div class="harto-guide-cover-img-wrap"><img src="${coverImg}" alt="" class="harto-guide-cover-img" onerror="this.style.display='none'"></div></div>`, density: 'hard' });
  // Page 1: Empty (no image on TOC)
  pages.push({ html: '<div class="harto-guide-page harto-guide-blank"></div>', density: 'hard' });
  // Page 2: TOC (content sections start at page 3)
  const padNum = (n) => String(n + 1).padStart(2, '0');
  const tocItems = (guide.pages || []).map((p, i) => {
    const targetPage = 3 + i * 2; // odd pages: title+desc
    return `<a href="#" class="harto-guide-toc-link" data-page="${targetPage}"><span class="harto-guide-toc-num">${padNum(i)}</span> ${escapeHtml(p.title)}</a>`;
  }).join('');
  pages.push({ html: `<div class="harto-guide-page harto-guide-toc-page"><h4>Table of Contents</h4><div class="harto-guide-toc">${tocItems}</div></div>`, density: 'hard' });
  // Pages 3,5,7...: Title and Description; 4,6,8...: Page image
  (guide.pages || []).forEach((p, i) => {
    pages.push({ html: `<div class="harto-guide-page"><h4><span class="harto-guide-page-num">${padNum(i)}</span> ${escapeHtml(p.title)}</h4><p>${escapeHtml(p.text)}</p></div>`, density: 'hard' });
    const imgUrl = base(p.image);
    pages.push({
      html: `<div class="harto-guide-page harto-guide-image"><img src="${imgUrl}" alt="${escapeHtml(p.imageAlt || '')}" data-zoomable onerror="this.style.display='none'"></div>`,
      density: 'hard'
    });
  });
  pages.push({ html: `<div class="harto-guide-page harto-guide-cover"><h3 class="harto-guide-cover-title">${escapeHtml(guide.title)}</h3></div>`, density: 'hard' });
  return pages;
}

let __guidePageFlip = null;

function openGuide(guide) {
  const shelf = document.getElementById('harto-guides-bookshelf');
  const reader = document.getElementById('harto-guides-reader');
  const bookEl = document.getElementById('harto-guides-book');
  if (!shelf || !reader || !bookEl) return;
  if (typeof St === 'undefined' || !St.PageFlip) {
    shelf.innerHTML = '<p class="harto-placeholder">Page flip library failed to load.</p>';
    return;
  }
  shelf.style.display = 'none';
  reader.style.display = '';
  reader.style.pointerEvents = '';
  bookEl.innerHTML = '';
  const pageData = buildGuidePages(guide);
  pageData.forEach((p) => {
    const div = document.createElement('div');
    div.className = 'harto-guide-stpage';
    if (p.density === 'hard') div.setAttribute('data-density', 'hard');
    div.innerHTML = p.html;
    bookEl.appendChild(div);
  });
  const pageEls = bookEl.querySelectorAll('.harto-guide-stpage');
  if (__guidePageFlip) __guidePageFlip.destroy();
  __guidePageFlip = new St.PageFlip(bookEl, {
    width: Math.min(400, window.innerWidth - 48),
    height: 560,
    flippingTime: 600,
    drawShadow: true,
    showCover: true,
    useMouseEvents: true
  });
  __guidePageFlip.loadFromHTML(Array.from(pageEls));
  pageEls.forEach((el) => {
    el.querySelectorAll('.harto-guide-toc-link').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const page = parseInt(a.dataset.page, 10);
        if (!isNaN(page)) __guidePageFlip.turnToPage(page);
      });
    });
    el.querySelectorAll('img[data-zoomable]').forEach((img) => {
      img.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, true);
      img.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openImageModal(img.src);
      }, true);
    });
  });
}

function openImageModal(src) {
  const modal = document.getElementById('harto-guides-image-modal');
  const img = document.getElementById('harto-guides-image-zoom');
  if (!modal || !img) return;
  img.src = src;
  img.style.transform = 'scale(1)';
  modal.setAttribute('aria-hidden', 'false');
  modal.classList.add('harto-guides-image-modal-open');
}

function closeImageModal() {
  const modal = document.getElementById('harto-guides-image-modal');
  if (!modal) return;
  modal.setAttribute('aria-hidden', 'true');
  modal.classList.remove('harto-guides-image-modal-open');
}

function initGuides() {
  const shelf = document.getElementById('harto-guides-bookshelf');
  const reader = document.getElementById('harto-guides-reader');
  const backBtn = document.getElementById('harto-guides-back');
  const prevBtn = document.getElementById('harto-guides-prev');
  const nextBtn = document.getElementById('harto-guides-next');
  const tocBtn = document.getElementById('harto-guides-toc');
  const coverBtn = document.getElementById('harto-guides-cover');
  const guides = getVisibleGuides(window.__HARTO_GUIDES || []);
  const gallery = document.getElementById('harto-guides-gallery');
  const viewBooksBtn = document.getElementById('harto-guides-view-books');
  const viewGalleryBtn = document.getElementById('harto-guides-view-gallery');

  function setGuidesView(view) {
    const isBooks = view === 'books';
    const bookEl = document.getElementById('harto-guides-book');
    const bookParent = bookEl?.parentElement;
    if (shelf) shelf.style.display = isBooks ? '' : 'none';
    if (gallery) {
      gallery.style.display = isBooks ? 'none' : '';
      gallery.classList.remove('harto-guides-gallery-has-expanded');
    }
    viewBooksBtn?.classList.toggle('active', isBooks);
    viewGalleryBtn?.classList.toggle('active', !isBooks);
    if (reader) {
      reader.style.display = 'none';
      if (__guidePageFlip) {
        __guidePageFlip.destroy();
        __guidePageFlip = null;
      }
    }
    if (bookEl && bookParent && !bookParent.contains(bookEl)) {
      bookEl.innerHTML = '';
      bookParent.appendChild(bookEl);
    }
    const gs = getVisibleGuides(window.__HARTO_GUIDES || []);
    if (isBooks) renderGuidesBookshelf(gs);
    else renderGuidesGallery(gs);
  }

  viewBooksBtn?.addEventListener('click', () => setGuidesView('books'));
  viewGalleryBtn?.addEventListener('click', () => setGuidesView('gallery'));

  renderGuidesBookshelf(guides);

  gallery?.addEventListener('click', (e) => {
    const coverBtn = e.target.closest('.harto-guides-gallery-cover');
    if (coverBtn) {
      e.preventDefault();
      const group = coverBtn.closest('.harto-guides-gallery-group');
      const icon = coverBtn?.querySelector('.harto-guides-gallery-cover-icon');
      if (group) {
        const isCollapsed = group.classList.toggle('harto-guides-gallery-group-collapsed');
        coverBtn.setAttribute('aria-expanded', !isCollapsed);
        if (icon) icon.textContent = isCollapsed ? '▶' : '▼';
        gallery?.classList.toggle('harto-guides-gallery-has-expanded', !isCollapsed);
        group.classList.toggle('harto-guides-gallery-group-expanded', !isCollapsed);
      }
      return;
    }
    const item = e.target.closest('.harto-guides-gallery-item');
    const img = item?.querySelector('img');
    if (img?.src) {
      e.preventDefault();
      openImageModal(img.src);
    }
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.harto-guides-book-cover');
    if (!btn) return;
    const panel = document.getElementById('harto-guides');
    if (!panel?.classList.contains('active')) return;
    if (shelf.style.display === 'none' || !shelf.contains(btn)) return;
    const id = btn.dataset.guideId;
    const guide = (window.__HARTO_GUIDES || []).find((g) => g.id === id);
    if (guide) {
      e.preventDefault();
      openGuide(guide);
    }
  }, true);
  const closeBook = () => {
    const bookEl = document.getElementById('harto-guides-book');
    const bookParent = bookEl?.parentElement;
    if (__guidePageFlip) {
      __guidePageFlip.destroy();
      __guidePageFlip = null;
    }
    if (bookEl && bookParent && !bookParent.contains(bookEl)) {
      bookEl.innerHTML = '';
      bookParent.appendChild(bookEl);
    } else if (bookEl) {
      bookEl.innerHTML = '';
    }
    reader.style.display = 'none';
    reader.style.pointerEvents = 'none';
    const gs = getVisibleGuides(window.__HARTO_GUIDES || []);
    const isBooks = viewBooksBtn?.classList.contains('active');
    shelf.style.display = isBooks ? '' : 'none';
    gallery.style.display = isBooks ? 'none' : '';
    shelf.style.pointerEvents = '';
    if (isBooks) renderGuidesBookshelf(gs);
    else renderGuidesGallery(gs);
  };
  backBtn?.addEventListener('click', closeBook);
  coverBtn?.addEventListener('click', () => __guidePageFlip?.turnToPage(0));
  tocBtn?.addEventListener('click', () => __guidePageFlip?.turnToPage(2));
  prevBtn?.addEventListener('click', () => __guidePageFlip?.flipPrev('bottom'));
  nextBtn?.addEventListener('click', () => __guidePageFlip?.flipNext('bottom'));
  const imgModal = document.getElementById('harto-guides-image-modal');
  const imgZoom = document.getElementById('harto-guides-image-zoom');
  imgModal?.querySelector('.harto-guides-image-backdrop')?.addEventListener('click', closeImageModal);
  imgModal?.querySelector('.harto-guides-image-close')?.addEventListener('click', closeImageModal);
  imgZoom?.addEventListener('wheel', (e) => {
    e.preventDefault();
    const s = parseFloat(imgZoom.style.transform.replace('scale(', '').replace(')', '')) || 1;
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    const next = Math.max(0.5, Math.min(3, s + delta));
    imgZoom.style.transform = `scale(${next})`;
  }, { passive: false });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeImageModal(); });
}

async function init() {
  await Promise.all([loadWeatherData(), loadTrackerData()]);
  const res = await fetch(`${CDN}/cards/data.json`);
  const data = await res.json();
  const builtIn = data.cards || [];
  const custom = getCustomCards();
  window.__HARTO_CARDS = [...builtIn, ...custom];
  applyResets(getCompletions());
  initCustomTasks();
  try {
    const guidesRes = await fetch(`${CDN}/info/guides.json`);
    const guidesData = await guidesRes.json();
    window.__HARTO_GUIDES = guidesData.guides || [];
  } catch {
    window.__HARTO_GUIDES = [];
  }
  initGuides();
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
  const CDN_BASE = (typeof window !== 'undefined' && window.__HARTO_BASE) ? window.__HARTO_BASE : HARTO_RAW;
  const iconSrc = `${CDN_BASE}/assets/images/hatopia.png`;
  const setup = getSetup();
  document.body.innerHTML = `
    <header class="harto-topbar">
      <div class="harto-topbar-left">
        <a href="#" class="harto-topbar-brand">
          <img class="harto-topbar-icon" src="${iconSrc}" alt="">
          <span class="harto-topbar-title"><span class="harto-topbar-title-a">Harto</span>.<span class="harto-topbar-title-b">dashboard</span></span>
        </a>
        <button type="button" class="harto-setup-label harto-admin-only" id="harto-setup-label" title="Switch setup (SEA / TW)" aria-label="Switch setup">
          <img class="harto-setup-icon" id="harto-setup-icon" src="${CDN_BASE}/assets/images/${setup.toLowerCase()}.png" alt="">
          <span class="harto-setup-text" id="harto-setup-text">${setup}</span>
        </button>
      </div>
      <div class="harto-topbar-end">
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
          <label class="harto-show-inactive-wrap" title="Show inactive custom tasks">
            <span class="harto-toggle-wrap">
              <input type="checkbox" id="harto-show-inactive" class="harto-show-inactive">
              <span class="harto-toggle-slider"></span>
            </span>
            <span class="harto-show-inactive-label">Show inactive</span>
          </label>
          <button id="harto-add-custom" class="harto-add-custom" title="Add custom task" aria-label="Add custom task">+</button>
          <button id="harto-reset-completed" class="harto-reset-completed harto-admin-only" title="Reset all completed in active filter" aria-label="Reset completed">↺</button>
          <button id="harto-view-toggle" class="harto-view-toggle" title="Toggle card/list view" aria-label="Toggle card/list view">⊞</button>
        </div>
        <div id="harto-deck" class="harto-deck"></div>
      </div>
      <div id="harto-guides" class="harto-tab-panel">
        <div class="harto-guides-toolbar">
          <button id="harto-guides-view-books" class="harto-guides-view-btn active" data-view="books">Books</button>
          <button id="harto-guides-view-gallery" class="harto-guides-view-btn" data-view="gallery">Gallery</button>
        </div>
        <div id="harto-guides-bookshelf" class="harto-guides-bookshelf"></div>
        <div id="harto-guides-gallery" class="harto-guides-gallery" style="display:none"></div>
        <div id="harto-guides-reader" class="harto-guides-reader" style="display:none">
          <div class="harto-guides-reader-header">
            <button id="harto-guides-back" class="harto-guides-back">← Back to shelf</button>
            <div class="harto-guides-quick-nav">
              <button id="harto-guides-toc" class="harto-guides-quick-btn" title="Table of contents">TOC</button>
              <button id="harto-guides-cover" class="harto-guides-quick-btn" title="Go to cover">Cover</button>
            </div>
          </div>
          <div id="harto-guides-book" class="harto-guides-book"></div>
          <div class="harto-guides-reader-controls">
            <button id="harto-guides-prev" class="harto-btn-secondary">Prev</button>
            <button id="harto-guides-next" class="harto-btn-secondary">Next</button>
          </div>
        </div>
      </div>
    </div>
    <div id="harto-custom-modal" class="harto-custom-modal" aria-hidden="true">
      <div class="harto-custom-modal-backdrop"></div>
      <div class="harto-custom-modal-content">
        <h3 class="harto-custom-modal-title">Add custom task</h3>
        <form id="harto-custom-form" class="harto-custom-form">
          <div class="harto-form-row">
            <label for="harto-custom-title">Title</label>
            <input id="harto-custom-title" type="text" required placeholder="Task title">
          </div>
          <div class="harto-form-row">
            <label for="harto-custom-desc">Description</label>
            <textarea id="harto-custom-desc" rows="2" placeholder="Optional description"></textarea>
          </div>
          <div class="harto-form-row">
            <label for="harto-custom-freq">Frequency</label>
            <select id="harto-custom-freq">
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Others">Other</option>
            </select>
          </div>
          <div class="harto-form-row harto-custom-active-row" id="harto-custom-active-row">
            <span class="harto-form-label">Active</span>
            <span class="harto-toggle-wrap harto-custom-active-toggle">
              <input type="checkbox" id="harto-custom-active" class="harto-custom-active" checked>
              <span class="harto-toggle-slider"></span>
            </span>
          </div>
          <div class="harto-custom-modal-actions">
            <button type="button" id="harto-custom-cancel" class="harto-btn-secondary">Cancel</button>
            <button type="submit" id="harto-custom-submit" class="harto-btn-primary">Add</button>
          </div>
        </form>
      </div>
    </div>
    <div id="harto-delete-confirm" class="harto-confirm-modal" aria-hidden="true">
      <div class="harto-confirm-backdrop"></div>
      <div class="harto-confirm-content">
        <p class="harto-confirm-message">Delete this custom task?</p>
        <div class="harto-confirm-actions">
          <button type="button" id="harto-delete-cancel" class="harto-btn-secondary">Cancel</button>
          <button type="button" id="harto-delete-confirm-btn" class="harto-btn-danger">Delete</button>
        </div>
      </div>
    </div>
    <div id="harto-reminder-toasts" class="harto-reminder-toasts" aria-live="polite"></div>
    <div id="harto-guides-image-modal" class="harto-guides-image-modal" aria-hidden="true">
      <div class="harto-guides-image-backdrop"></div>
      <div class="harto-guides-image-content">
        <button class="harto-guides-image-close" aria-label="Close">×</button>
        <img id="harto-guides-image-zoom" src="" alt="">
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
    updateReminderToasts();
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
      ? (el.classList.contains('harto-setup-label') ? 'inline-flex' : 'inline')
      : 'none';
  });
  const $label = document.getElementById('harto-setup-label');
  const $icon = document.getElementById('harto-setup-icon');
  const $text = document.getElementById('harto-setup-text');
  const CDN_BASE = (typeof window !== 'undefined' && window.__HARTO_BASE) ? window.__HARTO_BASE : HARTO_RAW;
  function updateSetupLabel(s) {
    if ($icon) $icon.src = `${CDN_BASE}/assets/images/${s.toLowerCase()}.png`;
    if ($text) $text.textContent = s;
  }
  updateSetupLabel(getSetup());
  if ($label && admin) {
    $label.addEventListener('click', () => {
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
    const label = filterPack === 'All' ? 'filters' : filterPack;
    if (!confirm(`Are you sure you want to reset all ${label}?`)) return;
    const cards = window.__HARTO_CARDS || [];
    const completions = getCompletions();
    const packsToReset = filterPack === 'All' ? PACKS.slice(1) : [filterPack];
    let changed = false;
    cards.forEach((c) => {
      if (packsToReset.includes(c.pack) && completions[c.id]) {
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

function parseVersionFromCss(text) {
  const m = (text || '').match(/Version:\s*([\d.]+)/);
  return m ? m[1] : '?';
}

function buildVersionReport(jsVer, cssVer) {
  return `main.js: ${jsVer}\nmain.css: ${cssVer}`;
}

function updateReminderToasts() {
  const container = document.getElementById('harto-reminder-toasts');
  if (!container) return;
  const cards = window.__HARTO_CARDS || [];
  const completions = getCompletions();
  const currentWeather = getCurrentWeatherBySlot(getTimeSlot());
  const mergeWindow = isWeeklyMergeWindow();
  const packs = PACKS.slice(1);

  const toasts = [];

  if (SPECIAL_WEATHER.includes(currentWeather)) {
    const hasIncompleteSpecialWeatherTask = cards.some((c) => {
      if (!cardVisible(c)) return false;
      if (c.custom && c.active === false) return false;
      if (isCompleted(c.id, completions)) return false;
      if (!packs.includes(c.pack)) return false;
      return c.weather && c.weather !== 'any' && c.weather === currentWeather;
    });
    if (hasIncompleteSpecialWeatherTask) {
      const weatherLabel = { meteor: 'meteor', rain: 'rain', rainbow: 'rainbow', aurora: 'aurora' }[currentWeather] || currentWeather;
      toasts.push({ type: 'weather', key: 'weather', msg: `Hey there's a ${weatherLabel} now. Don't forget to complete your tasks.` });
    }
  }

  cards.forEach((c) => {
    if (!cardVisible(c)) return;
    if (c.custom && c.active === false) return;
    if (isCompleted(c.id, completions)) return;
    if (!packs.includes(c.pack)) return;
    const isLastDay = (c.timeLimited && isExpiryDay(c)) || (c.pack === 'Weekly' && mergeWindow);
    if (isLastDay) {
      toasts.push({ type: 'lastday', key: c.id, msg: `Hey today is the last day for ${escapeHtml(c.title)} task. Don't forget to complete it.` });
    }
  });

  container.innerHTML = toasts.map((t) => `<div class="harto-reminder-toast" data-toast-key="${escapeHtml(t.key)}" data-toast-type="${escapeHtml(t.type)}">${t.msg}</div>`).join('');
  container.classList.toggle('harto-reminder-toasts-empty', toasts.length === 0);
}

function initVersionToast() {
  const topbar = document.querySelector('.harto-topbar');
  if (!topbar) return;
  topbar.style.cursor = 'pointer';
  topbar.addEventListener('dblclick', async () => {
    const base = (typeof window !== 'undefined' && window.__HARTO_BASE) ? window.__HARTO_BASE : HARTO_RAW;
    let cssVer = '?';
    try {
      const res = await fetch(`${base}/main.css`);
      if (res.ok) cssVer = parseVersionFromCss(await res.text());
    } catch (_) {}
    const report = buildVersionReport(VERSION, cssVer);
    try {
      await navigator.clipboard.writeText(report);
    } catch (_) {}
    const existing = document.getElementById('harto-version-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'harto-version-toast';
    toast.className = 'harto-version-toast';
    toast.innerHTML = `<pre>${report.replace(/</g, '&lt;')}</pre><button class="harto-version-toast-dismiss" aria-label="Dismiss">×</button>`;
    document.body.appendChild(toast);
    const dismiss = () => {
      toast.classList.add('harto-version-toast-hide');
      setTimeout(() => toast.remove(), 300);
    };
    toast.querySelector('.harto-version-toast-dismiss').addEventListener('click', dismiss);
    setTimeout(dismiss, 4000);
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
    initVersionToast();
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
  initVersionToast();
  initResetCompleted();
  init();
}
