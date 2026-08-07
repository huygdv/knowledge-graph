const INTERACTION_KEY = 'knowledge-graph:interaction-mode';
const SIDEBAR_KEY = 'knowledge-graph:sidebar-collapsed';
const DOUBLE_ACTIVATION_MS = 380;
const MOVE_THRESHOLD = 7;
const PINCH_STEP = 1.075;
const MAX_TOUCH_ZOOM = 1.45;
const MIN_TOUCH_ZOOM = 0.24;

const interaction = {
  mode: localStorage.getItem(INTERACTION_KEY) === 'edit' ? 'edit' : 'navigate',
  canvas: document.querySelector('#canvas'),
  scene: document.querySelector('#scene'),
  pointers: new Map(),
  gesture: null,
  pinchDistance: 0,
  lastActivation: { id: null, at: 0 },
  bridgeMove: null,
  bridgeStop: null,
  canvasPointerDown: null,
  canvasWheel: null
};

function isMobileMenu() { return matchMedia('(max-width: 840px)').matches; }
function pointerBridgeHandler(type) { return window.__kgPointerBridge?.[type]?.[0] || null; }
function currentScale() {
  const text = interaction.scene?.style.transform || '';
  const match = text.match(/scale\(([-\d.]+)\)/);
  return match ? Number(match[1]) : 1;
}
function proxyEvent(event, overrides = {}) {
  return {
    button: event.button ?? 0,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    clientX: event.clientX,
    clientY: event.clientY,
    movementX: event.movementX || 0,
    movementY: event.movementY || 0,
    target: event.target,
    currentTarget: event.currentTarget,
    preventDefault() {},
    stopPropagation() {},
    ...overrides
  };
}
function setMode(mode) {
  interaction.mode = mode === 'edit' ? 'edit' : 'navigate';
  localStorage.setItem(INTERACTION_KEY, interaction.mode);
  document.body.dataset.interactionMode = interaction.mode;
  document.querySelectorAll('[data-interaction-mode]').forEach((button) => {
    const active = button.dataset.interactionMode === interaction.mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const status = document.querySelector('.interaction-mode-status');
  if (status) status.textContent = interaction.mode === 'edit' ? 'Edit layout' : 'Navigate';
  const hint = document.querySelector('.canvas-hint');
  if (hint) hint.textContent = interaction.mode === 'edit'
    ? 'Edit mode · Kéo node để chỉnh layout · 2 ngón để zoom · Double-click để Deep Dive'
    : 'Navigate mode · Kéo để pan · 2 ngón để zoom · Double-click để Deep Dive';
}

function installModeControl() {
  if (!interaction.canvas || document.querySelector('.interaction-mode-control')) return;
  const control = document.createElement('div');
  control.className = 'interaction-mode-control';
  control.setAttribute('role', 'group');
  control.setAttribute('aria-label', 'Canvas interaction mode');
  control.innerHTML = `
    <button type="button" data-interaction-mode="navigate" title="Navigate · Pan canvas without moving nodes (H)"><span>✋</span><small>Navigate</small></button>
    <button type="button" data-interaction-mode="edit" title="Edit layout · Drag nodes (V)"><span>↖</span><small>Edit</small></button>
    <em class="interaction-mode-status"></em>`;
  control.querySelectorAll('[data-interaction-mode]').forEach((button) => {
    button.addEventListener('click', () => setMode(button.dataset.interactionMode));
  });
  interaction.canvas.append(control);
  setMode(interaction.mode);
}

function installDesktopSidebarToggle() {
  const button = document.querySelector('.mobile-menu-button');
  if (!button) return;
  const sync = () => {
    if (isMobileMenu()) {
      document.body.classList.remove('sidebar-collapsed');
      return;
    }
    const collapsed = localStorage.getItem(SIDEBAR_KEY) === 'true';
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    button.setAttribute('aria-expanded', String(!collapsed));
    button.title = collapsed ? 'Hiện sidebar' : 'Ẩn sidebar';
  };
  button.onclick = () => {
    if (isMobileMenu()) {
      const open = !document.body.classList.contains('sidebar-open');
      document.body.classList.toggle('sidebar-open', open);
      button.setAttribute('aria-expanded', String(open));
      return;
    }
    const next = !document.body.classList.contains('sidebar-collapsed');
    document.body.classList.toggle('sidebar-collapsed', next);
    localStorage.setItem(SIDEBAR_KEY, String(next));
    button.setAttribute('aria-expanded', String(!next));
    button.title = next ? 'Hiện sidebar' : 'Ẩn sidebar';
  };
  sync();
  window.addEventListener('resize', sync);
}

function startAppPan(event) {
  if (!interaction.canvasPointerDown) return;
  interaction.canvasPointerDown(proxyEvent(event, { target: interaction.canvas, currentTarget: interaction.canvas }));
}
function startAppNodeDrag(event, card) {
  if (typeof card?.onpointerdown !== 'function') return false;
  try {
    card.onpointerdown(proxyEvent(event, { target: event.target, currentTarget: card }));
    return true;
  } catch {
    return false;
  }
}
function stopAppGesture(event) {
  interaction.bridgeStop?.(proxyEvent(event));
}
function moveAppGesture(event, previous) {
  interaction.bridgeMove?.(proxyEvent(event, {
    movementX: event.clientX - previous.x,
    movementY: event.clientY - previous.y
  }));
}

function pointerDistance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function pointerMidpoint(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
function invokeZoom(direction, midpoint) {
  if (!interaction.canvasWheel) return;
  const scale = currentScale();
  if (direction > 0 && scale >= MAX_TOUCH_ZOOM) return;
  if (direction < 0 && scale <= MIN_TOUCH_ZOOM) return;
  interaction.canvasWheel({
    preventDefault() {},
    deltaY: direction > 0 ? -1 : 1,
    clientX: midpoint.x,
    clientY: midpoint.y
  });
}
function beginPinch() {
  const points = [...interaction.pointers.values()];
  if (points.length < 2) return;
  points.forEach((point) => { point.moved = true; });
  if (interaction.gesture) {
    const first = points[0];
    stopAppGesture({ pointerId: first.id });
  }
  interaction.gesture = { type: 'pinch' };
  interaction.pinchDistance = pointerDistance(points[0], points[1]);
  document.body.classList.add('is-pinching');
}
function updatePinch() {
  const points = [...interaction.pointers.values()];
  if (points.length < 2 || !interaction.pinchDistance) return;
  const distance = pointerDistance(points[0], points[1]);
  const midpoint = pointerMidpoint(points[0], points[1]);
  let ratio = distance / interaction.pinchDistance;
  while (ratio >= PINCH_STEP && currentScale() < MAX_TOUCH_ZOOM) {
    invokeZoom(1, midpoint);
    interaction.pinchDistance *= PINCH_STEP;
    ratio = distance / interaction.pinchDistance;
  }
  while (ratio <= 1 / PINCH_STEP && currentScale() > MIN_TOUCH_ZOOM) {
    invokeZoom(-1, midpoint);
    interaction.pinchDistance /= PINCH_STEP;
    ratio = distance / interaction.pinchDistance;
  }
}

function handlePointerDown(event) {
  const card = event.target.closest('.knowledge-node');
  const touchLike = event.pointerType === 'touch' || event.pointerType === 'pen';
  const navigateMouseOnNode = event.pointerType === 'mouse' && interaction.mode === 'navigate' && card;
  if (!touchLike && !navigateMouseOnNode) return;

  if (touchLike || navigateMouseOnNode) {
    interaction.pointers.set(event.pointerId, {
      id: event.pointerId, x: event.clientX, y: event.clientY,
      startX: event.clientX, startY: event.clientY, moved: false,
      card, target: event.target
    });
    if (touchLike && interaction.pointers.size >= 2) {
      event.preventDefault(); event.stopImmediatePropagation();
      beginPinch();
      return;
    }
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  let type = 'pan';
  if (interaction.mode === 'edit' && card && touchLike && startAppNodeDrag(event, card)) type = 'drag-node';
  else startAppPan(event);
  interaction.gesture = { type, pointerId: event.pointerId, card };
}

function handlePointerMove(event) {
  const point = interaction.pointers.get(event.pointerId);
  if (point) {
    const previous = { x: point.x, y: point.y };
    point.x = event.clientX; point.y = event.clientY;
    if (Math.hypot(point.x - point.startX, point.y - point.startY) > MOVE_THRESHOLD) point.moved = true;
    if (interaction.pointers.size >= 2 || interaction.gesture?.type === 'pinch') {
      event.preventDefault(); event.stopImmediatePropagation();
      updatePinch();
      return;
    }
    if (interaction.gesture?.pointerId === event.pointerId) {
      event.preventDefault(); event.stopImmediatePropagation();
      moveAppGesture(event, previous);
    }
    return;
  }
}

function activateNode(card) {
  if (!card?.isConnected) return;
  card.click();
}
function triggerDeepDive(id, attempt = 0) {
  const current = (() => { try { return decodeURIComponent(location.hash.slice(1)); } catch { return location.hash.slice(1); } })();
  const button = document.querySelector('.deep-dive-action');
  if (button && current === id) { button.click(); return; }
  if (attempt < 8) window.setTimeout(() => triggerDeepDive(id, attempt + 1), 24);
}

function maybeDeepDive(card) {
  const id = card?.dataset.id;
  if (!id) return false;
  const now = performance.now();
  const isDouble = interaction.lastActivation.id === id && now - interaction.lastActivation.at <= DOUBLE_ACTIVATION_MS;
  interaction.lastActivation = { id, at: now };
  if (!isDouble) return false;
  interaction.lastActivation = { id: null, at: 0 };
  queueMicrotask(() => triggerDeepDive(id));
  return true;
}

function handlePointerUp(event) {
  const point = interaction.pointers.get(event.pointerId);
  if (!point && interaction.gesture?.pointerId !== event.pointerId) return;

  if (point) interaction.pointers.delete(event.pointerId);
  if (interaction.gesture?.type !== 'pinch') stopAppGesture(event);

  if (interaction.gesture?.type === 'pinch') {
    if (interaction.pointers.size < 2) {
      document.body.classList.remove('is-pinching');
      interaction.pinchDistance = 0;
      const remaining = [...interaction.pointers.values()][0];
      if (remaining) {
        interaction.gesture = { type: 'pan', pointerId: remaining.id, card: remaining.card };
        startAppPan({
          button: 0, pointerId: remaining.id, pointerType: 'touch',
          clientX: remaining.x, clientY: remaining.y, target: remaining.target
        });
      } else interaction.gesture = null;
    }
    event.preventDefault(); event.stopImmediatePropagation();
    return;
  }

  if (point && !point.moved && point.card) {
    event.preventDefault(); event.stopImmediatePropagation();
    const double = maybeDeepDive(point.card);
    if (!double) activateNode(point.card);
  }
  interaction.gesture = null;
}

function installDoubleActivation() {
  document.addEventListener('click', (event) => {
    const card = event.target.closest('#nodes-layer .knowledge-node');
    if (!card || event.detail === 0) return;
    if (maybeDeepDive(card)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

function installKeyboardModes() {
  document.addEventListener('keydown', (event) => {
    const tag = event.target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key.toLowerCase() === 'h') { event.preventDefault(); setMode('navigate'); }
    if (event.key.toLowerCase() === 'v') { event.preventDefault(); setMode('edit'); }
  });
}

function installInteractionLayer() {
  if (!interaction.canvas || !interaction.scene || document.body.dataset.interactionInstalled === 'true') return;
  interaction.bridgeMove = pointerBridgeHandler('pointermove');
  interaction.bridgeStop = pointerBridgeHandler('pointerup') || pointerBridgeHandler('pointercancel');
  interaction.canvasPointerDown = interaction.canvas.onpointerdown;
  interaction.canvasWheel = interaction.canvas.onwheel;

  interaction.canvas.addEventListener('pointerdown', handlePointerDown, true);
  window.addEventListener('pointermove', handlePointerMove, true);
  window.addEventListener('pointerup', handlePointerUp, true);
  window.addEventListener('pointercancel', handlePointerUp, true);
  installModeControl();
  installDesktopSidebarToggle();
  installDoubleActivation();
  installKeyboardModes();
  document.body.dataset.interactionInstalled = 'true';
}

function waitForCore(attempt = 0) {
  interaction.canvas = document.querySelector('#canvas');
  interaction.scene = document.querySelector('#scene');
  const ready = interaction.canvas?.onpointerdown && interaction.canvas?.onwheel && pointerBridgeHandler('pointermove') && pointerBridgeHandler('pointerup');
  if (ready) { installInteractionLayer(); return; }
  if (attempt < 180) window.setTimeout(() => waitForCore(attempt + 1), 25);
  else console.warn('Knowledge Graph interaction layer could not attach to the core canvas handlers.');
}

waitForCore();
