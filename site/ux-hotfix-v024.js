const UX24 = {
  graphPromise: null,
  focusTap: { id: null, at: 0 },
  focusRealmActive: null,
  DOUBLE_TAP_MS: 380
};

function isCoarsePointer() {
  return matchMedia('(pointer: coarse)').matches || matchMedia('(hover: none)').matches;
}

function preloadGraph() {
  if (!UX24.graphPromise) {
    UX24.graphPromise = fetch('./data/graph.json', { cache: 'force-cache' })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`graph.json ${response.status}`)))
      .catch((error) => {
        UX24.graphPromise = null;
        throw error;
      });
  }
  return UX24.graphPromise;
}

function syncCaptureOptions(graph) {
  const domain = document.querySelector('#capture-domain');
  const datalist = document.querySelector('#capture-node-list');
  if (!domain || !datalist || domain.dataset.ready === 'true') return;

  graph.nodes.filter((node) => node.kind === 'domain').forEach((node) => {
    const option = document.createElement('option');
    option.value = node.id;
    option.textContent = node.title;
    domain.append(option);
  });
  graph.nodes.forEach((node) => {
    const option = document.createElement('option');
    option.value = node.id;
    option.label = node.title;
    datalist.append(option);
  });
  domain.dataset.ready = 'true';
}

function prefillCaptureRelated(graph) {
  const input = document.querySelector('#capture-related');
  if (!input || input.value) return;
  let id = '';
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { id = location.hash.slice(1); }
  if (graph.nodes.some((node) => node.id === id)) input.value = id;
}

async function stableOpenCapture(tab = 'capture') {
  const dialog = document.querySelector('#capture-dialog');
  if (!dialog) return;

  const tabButton = dialog.querySelector(`.capture-tab[data-tab="${tab}"]`);
  tabButton?.click();

  if (!dialog.open) {
    dialog.classList.add('capture-dialog--opening');
    try { dialog.showModal(); } catch { return; }
    requestAnimationFrame(() => dialog.classList.remove('capture-dialog--opening'));
  }

  preloadGraph().then((graph) => {
    syncCaptureOptions(graph);
    prefillCaptureRelated(graph);
  }).catch(() => {});

  if (!isCoarsePointer() && tab === 'capture') {
    requestAnimationFrame(() => dialog.querySelector('#capture-title')?.focus({ preventScroll: true }));
  }
}

function installStableCapture() {
  const idle = window.requestIdleCallback || ((callback) => setTimeout(callback, 120));
  idle(() => preloadGraph().catch(() => {}));

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-open-capture]');
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const tab = trigger.closest('.project-links') ? 'inbox' : 'capture';
    stableOpenCapture(tab);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (!((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'k')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    stableOpenCapture('capture');
  }, true);
}

function decorateDeepDiveHint() {
  const action = document.querySelector('.deep-dive-action');
  if (action && !action.dataset.doubleOnly) {
    action.dataset.doubleOnly = 'true';
    action.classList.add('deep-dive-action--double-only');
    action.setAttribute('aria-disabled', 'true');
    const strong = action.querySelector('strong');
    const small = action.querySelector('small');
    if (strong) strong.textContent = 'Double-click to Deep Dive';
    if (small) small.textContent = 'Single click only selects. Double-click / double-tap enters Focus Realm.';
  }

  const diveButton = document.querySelector('.focus-realm__detail [data-dive]');
  if (diveButton) {
    if (!diveButton.hidden) diveButton.hidden = true;
    let hint = document.querySelector('.focus-realm__detail .focus-double-hint');
    if (!hint) {
      hint = document.createElement('small');
      hint.className = 'focus-double-hint';
      hint.textContent = 'Double-click / double-tap a card to dive deeper.';
      diveButton.insertAdjacentElement('afterend', hint);
    }
  }
}

function installDoubleOnlyDeepDive() {
  document.addEventListener('click', (event) => {
    const action = event.target.closest('.deep-dive-action');
    if (action && event.isTrusted) {
      event.preventDefault();
      event.stopImmediatePropagation();
      action.animate?.([
        { transform: 'translateX(0)' },
        { transform: 'translateX(2px)' },
        { transform: 'translateX(0)' }
      ], { duration: 180 });
      return;
    }

    const dive = event.target.closest('.focus-realm__detail [data-dive]');
    if (dive && event.isTrusted) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('dblclick', (event) => {
    if (!event.target.closest('#nodes-layer .knowledge-node')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener('pointerup', (event) => {
    const card = event.target.closest('.focus-realm .focus-node');
    if (!card || !['touch', 'pen'].includes(event.pointerType)) return;
    const id = card.dataset.id;
    const now = performance.now();
    const doubleTap = UX24.focusTap.id === id && now - UX24.focusTap.at <= UX24.DOUBLE_TAP_MS;
    UX24.focusTap = doubleTap ? { id: null, at: 0 } : { id, at: now };
    if (!doubleTap) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window }));
  }, true);

  const observer = new MutationObserver(decorateDeepDiveHint);
  const inspector = document.querySelector('#inspector');
  if (inspector) observer.observe(inspector, { childList: true, subtree: true });
  const realm = document.querySelector('#focus-realm');
  if (realm) observer.observe(realm, { childList: true, subtree: true });
  decorateDeepDiveHint();
}

function triggerExisting(selector) {
  const target = document.querySelector(selector);
  if (target instanceof HTMLElement) target.click();
}

function installFocusHeaderActions() {
  const nav = document.querySelector('.focus-nav');
  if (!nav || nav.querySelector('.focus-nav-actions')) return;
  const actions = document.createElement('div');
  actions.className = 'focus-nav-actions';
  actions.innerHTML = `
    <button type="button" data-focus-action="menu" title="Menu" aria-label="Menu">☰</button>
    <button type="button" data-focus-action="capture" title="Quick Capture" aria-label="Quick Capture">＋</button>
    <button type="button" data-focus-action="fullscreen" title="Fullscreen" aria-label="Fullscreen">⛶</button>`;
  nav.insertBefore(actions, nav.querySelector('.focus-exit'));
  actions.addEventListener('click', (event) => {
    const button = event.target.closest('[data-focus-action]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    if (button.dataset.focusAction === 'menu') triggerExisting('.mobile-menu-button');
    if (button.dataset.focusAction === 'capture') stableOpenCapture('capture');
    if (button.dataset.focusAction === 'fullscreen') triggerExisting('#toggle-fullscreen');
  });
}

function syncFocusRealmState() {
  const active = document.body.classList.contains('is-focus-realm');

  // MutationObserver callbacks must be idempotent. Without this transition guard,
  // mutating body.class from inside the body.class observer can schedule itself forever.
  if (active === UX24.focusRealmActive) return;
  UX24.focusRealmActive = active;
  if (!active) return;

  if (document.body.classList.contains('inspector-open')) {
    document.body.classList.remove('inspector-open');
  }
  installFocusHeaderActions();
  decorateDeepDiveHint();
}

function installFocusRealmPolish() {
  installFocusHeaderActions();
  const bodyObserver = new MutationObserver(syncFocusRealmState);
  bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  syncFocusRealmState();
}

installStableCapture();
installDoubleOnlyDeepDive();
installFocusRealmPolish();
