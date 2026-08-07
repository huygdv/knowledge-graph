const FOCUS_KIND = {
  domain: { label: 'Domain', icon: '◫' },
  capability: { label: 'Capability', icon: '▦' },
  concept: { label: 'Concept', icon: '○' },
  technique: { label: 'Technique', icon: '△' },
  tool: { label: 'Tool', icon: '◇' },
  pattern: { label: 'Pattern', icon: '⬡' },
  artifact: { label: 'Artifact', icon: '◆' }
};

const FOCUS_RELATION = {
  contains: 'contains',
  requires: 'requires',
  relates_to: 'related',
  supports: 'supports',
  implemented_by: 'implemented by',
  applied_in: 'applied in'
};

const focusState = {
  graph: null,
  overlay: null,
  nodes: new Map(),
  assessments: new Map(),
  parents: new Map(),
  children: new Map(),
  edgesByNode: new Map(),
  active: false,
  rootId: null,
  selectedId: null,
  path: [],
  scope: [],
  resizeTimer: null
};

const focusEsc = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
}[char]));

function focusNode(id) {
  return focusState.nodes.get(id);
}

function buildFocusIndexes() {
  focusState.nodes = new Map(focusState.graph.nodes.map((node) => [node.id, node]));
  focusState.assessments = new Map((focusState.overlay?.assessments || []).map((item) => [item.nodeId, item]));
  focusState.parents = new Map();
  focusState.children = new Map(focusState.graph.nodes.map((node) => [node.id, []]));
  focusState.edgesByNode = new Map(focusState.graph.nodes.map((node) => [node.id, []]));

  for (const edge of focusState.graph.edges) {
    focusState.edgesByNode.get(edge.source)?.push(edge);
    focusState.edgesByNode.get(edge.target)?.push(edge);
    if (edge.kind === 'contains') {
      focusState.parents.set(edge.target, edge.source);
      focusState.children.get(edge.source)?.push(edge.target);
    }
  }
}

function fullAncestorPath(id) {
  const result = [];
  let current = id;
  const visited = new Set();
  while (current && !visited.has(current)) {
    visited.add(current);
    result.unshift(current);
    current = focusState.parents.get(current);
  }
  return result;
}

function semanticNeighbors(id) {
  const neighbors = [];
  for (const edge of focusState.edgesByNode.get(id) || []) {
    if (edge.kind === 'contains') continue;
    const otherId = edge.source === id ? edge.target : edge.source;
    const node = focusNode(otherId);
    if (!node) continue;
    neighbors.push({ id: otherId, edge, relation: FOCUS_RELATION[edge.kind] || edge.kind });
  }
  return neighbors;
}

function focusScope(rootId) {
  const children = (focusState.children.get(rootId) || []).map((id) => ({
    id,
    group: 'child',
    edge: focusState.graph.edges.find((item) => item.kind === 'contains' && item.source === rootId && item.target === id)
  }));

  const childIds = new Set(children.map((item) => item.id));
  const linked = semanticNeighbors(rootId)
    .filter((item) => !childIds.has(item.id))
    .sort((a, b) => {
      const aArtifact = focusNode(a.id)?.kind === 'artifact' ? 0 : 1;
      const bArtifact = focusNode(b.id)?.kind === 'artifact' ? 0 : 1;
      return aArtifact - bArtifact || focusNode(a.id).title.localeCompare(focusNode(b.id).title);
    })
    .slice(0, Math.max(5, 14 - children.length))
    .map((item) => ({ ...item, group: 'linked' }));

  const maxChildren = children.slice(0, 12);
  return [{ id: rootId, group: 'root', edge: null }, ...maxChildren, ...linked].slice(0, 18);
}

function createFocusRealm() {
  const canvas = document.querySelector('#canvas');
  if (!canvas || document.querySelector('#focus-realm')) return;

  const realm = document.createElement('section');
  realm.id = 'focus-realm';
  realm.className = 'focus-realm';
  realm.hidden = true;
  realm.setAttribute('aria-label', 'Deep dive knowledge space');
  realm.innerHTML = `
    <div class="focus-realm__mist" aria-hidden="true"></div>
    <div class="focus-realm__portal" aria-hidden="true"><i></i><i></i><i></i></div>
    <nav class="focus-nav" aria-label="Deep dive breadcrumb">
      <button class="focus-back" type="button" title="Quay lại tầng ngoài">← Back</button>
      <div class="focus-breadcrumb"></div>
      <div class="focus-count"></div>
      <button class="focus-exit" type="button" title="Thoát Deep Dive">×</button>
    </nav>
    <svg class="focus-realm__edges" aria-hidden="true"></svg>
    <div class="focus-realm__nodes"></div>
    <aside class="focus-realm__detail" aria-live="polite"></aside>
    <div class="focus-realm__hint">Click để xem · Double-click hoặc “Dive deeper” để đi sâu · Esc để quay lại</div>
  `;
  canvas.append(realm);

  realm.querySelector('.focus-back').addEventListener('click', backFocusRealm);
  realm.querySelector('.focus-exit').addEventListener('click', exitFocusRealm);
  realm.querySelector('.focus-realm__nodes').addEventListener('click', handleRealmClick);
  realm.querySelector('.focus-realm__nodes').addEventListener('dblclick', handleRealmDoubleClick);
}

function currentHashId() {
  try { return decodeURIComponent(location.hash.slice(1)); } catch { return location.hash.slice(1); }
}

function addDeepDiveAction() {
  const inspector = document.querySelector('#inspector');
  if (!inspector || inspector.querySelector('.deep-dive-action')) return;
  const id = currentHashId();
  const node = focusNode(id);
  if (!node) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'deep-dive-action';
  button.innerHTML = '<span class="deep-dive-action__icon">◎</span><span><strong>Deep Dive</strong><small>Focus node, children & linked knowledge</small></span><span aria-hidden="true">→</span>';
  button.addEventListener('click', () => enterFocusRealm(id));

  const summary = inspector.querySelector('.inspector__summary');
  if (summary) summary.insertAdjacentElement('afterend', button);
  else inspector.prepend(button);
}

function observeInspector() {
  const inspector = document.querySelector('#inspector');
  if (!inspector) return;
  const observer = new MutationObserver(() => queueMicrotask(addDeepDiveAction));
  observer.observe(inspector, { childList: true, subtree: true });
  addDeepDiveAction();
}

function enterFocusRealm(id, options = {}) {
  const node = focusNode(id);
  const realm = document.querySelector('#focus-realm');
  if (!node || !realm) return;

  const previousRoot = focusState.rootId;
  focusState.active = true;
  focusState.rootId = id;
  focusState.selectedId = id;
  focusState.path = fullAncestorPath(id);
  focusState.scope = focusScope(id);

  realm.hidden = false;
  document.body.classList.add('is-focus-realm');
  realm.classList.remove('is-leaving');
  realm.classList.toggle('is-descending', Boolean(previousRoot && previousRoot !== id));
  realm.classList.add('is-entering');

  renderFocusRealm();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => realm.classList.remove('is-entering'));
  });

  if (!options.preserveHash) history.replaceState(null, '', `#${encodeURIComponent(id)}`);
  document.querySelector('.focus-back')?.focus({ preventScroll: true });
}

function exitFocusRealm() {
  const realm = document.querySelector('#focus-realm');
  if (!realm || !focusState.active) return;
  realm.classList.add('is-leaving');
  window.setTimeout(() => {
    realm.hidden = true;
    realm.classList.remove('is-leaving', 'is-descending');
    document.body.classList.remove('is-focus-realm');
    focusState.active = false;
    focusState.rootId = null;
    focusState.selectedId = null;
    focusState.path = [];
    focusState.scope = [];
    const id = currentHashId();
    if (window.CSS?.escape) document.querySelector(`[data-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
  }, prefersReducedMotion() ? 0 : 420);
}

function backFocusRealm() {
  if (!focusState.active) return;
  const parent = focusState.parents.get(focusState.rootId);
  if (parent) enterFocusRealm(parent);
  else exitFocusRealm();
}

function navigateBreadcrumb(id) {
  if (id === focusState.rootId) return;
  enterFocusRealm(id);
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function radialPositions(items, width, height) {
  const positions = new Map();
  const cx = width * 0.5;
  const cy = height * 0.48;
  positions.set(focusState.rootId, { x: cx, y: cy, group: 'root' });

  const children = items.filter((item) => item.group === 'child');
  const linked = items.filter((item) => item.group === 'linked');
  const minSide = Math.min(width, height);
  const childRadius = Math.max(190, Math.min(330, minSide * 0.31));
  const linkedRadius = Math.max(270, Math.min(455, minSide * 0.43));

  const placeRing = (entries, radius, offset, group) => {
    if (!entries.length) return;
    const count = entries.length;
    entries.forEach((entry, index) => {
      const angle = offset + (Math.PI * 2 * index) / count;
      const xRadius = radius * (width < 900 ? 0.78 : 1.16);
      const yRadius = radius * (height < 650 ? 0.62 : 0.76);
      positions.set(entry.id, {
        x: cx + Math.cos(angle) * xRadius,
        y: cy + Math.sin(angle) * yRadius,
        group
      });
    });
  };

  placeRing(children, childRadius, -Math.PI / 2, 'child');
  placeRing(linked, linkedRadius, -Math.PI / 2 + Math.PI / Math.max(3, linked.length), 'linked');
  return positions;
}

function renderFocusRealm() {
  const realm = document.querySelector('#focus-realm');
  if (!realm || !focusState.active) return;
  const root = focusNode(focusState.rootId);
  if (!root) return;

  const breadcrumb = realm.querySelector('.focus-breadcrumb');
  breadcrumb.innerHTML = focusState.path.map((id, index) => {
    const node = focusNode(id);
    const current = id === focusState.rootId;
    return `<button type="button" data-breadcrumb="${focusEsc(id)}" ${current ? 'aria-current="page"' : ''}>${index ? '<span>/</span>' : ''}${focusEsc(node.title)}</button>`;
  }).join('');
  breadcrumb.querySelectorAll('[data-breadcrumb]').forEach((button) => {
    button.addEventListener('click', () => navigateBreadcrumb(button.dataset.breadcrumb));
  });

  realm.querySelector('.focus-count').textContent = `${focusState.scope.length} nodes in this realm`;

  const nodesLayer = realm.querySelector('.focus-realm__nodes');
  const bounds = realm.getBoundingClientRect();
  const width = Math.max(720, bounds.width);
  const height = Math.max(520, bounds.height);
  const positions = radialPositions(focusState.scope, width, height);

  nodesLayer.replaceChildren(...focusState.scope.map((item, index) => {
    const node = focusNode(item.id);
    const position = positions.get(item.id);
    const assessment = focusState.assessments.get(item.id);
    const hasDepth = (focusState.children.get(item.id) || []).length > 0 || semanticNeighbors(item.id).length > 0;
    const card = document.createElement('article');
    card.className = `focus-node focus-node--${item.group}${focusState.selectedId === item.id ? ' is-selected' : ''}`;
    card.dataset.id = item.id;
    card.style.setProperty('--focus-x', `${position.x}px`);
    card.style.setProperty('--focus-y', `${position.y}px`);
    card.style.setProperty('--focus-delay', `${Math.min(index * 42, 420)}ms`);
    card.tabIndex = 0;
    card.role = 'button';
    card.ariaLabel = `${FOCUS_KIND[node.kind]?.label || node.kind}: ${node.title}`;
    card.innerHTML = `
      <div class="focus-node__glow" aria-hidden="true"></div>
      <header><span>${FOCUS_KIND[node.kind]?.icon || '○'}</span><small>${focusEsc(FOCUS_KIND[node.kind]?.label || node.kind)}</small>${assessment ? `<b>M${assessment.mastery}</b>` : ''}</header>
      <strong>${focusEsc(node.title)}</strong>
      <p>${focusEsc(node.summary)}</p>
      <footer>${item.group === 'root' ? 'Current realm' : item.group === 'child' ? 'Inner knowledge' : focusEsc(item.relation || 'Linked knowledge')}${hasDepth ? '<i>↘</i>' : ''}</footer>
    `;
    return card;
  }));

  nodesLayer.querySelectorAll('.focus-node').forEach((card) => {
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (event.shiftKey) enterFocusRealm(card.dataset.id);
        else selectFocusNode(card.dataset.id);
      }
    });
  });

  renderFocusEdges(positions);
  renderFocusDetail();
}

function renderFocusEdges(positions) {
  const realm = document.querySelector('#focus-realm');
  const svg = realm.querySelector('.focus-realm__edges');
  const ns = 'http://www.w3.org/2000/svg';
  const width = Math.max(720, realm.clientWidth);
  const height = Math.max(520, realm.clientHeight);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.replaceChildren();

  for (const item of focusState.scope) {
    if (item.group === 'root' || !item.edge) continue;
    const start = positions.get(focusState.rootId);
    const end = positions.get(item.id);
    if (!start || !end) continue;
    const path = document.createElementNS(ns, 'path');
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const curve = Math.max(36, Math.min(130, Math.hypot(dx, dy) * 0.22));
    const normalX = -dy / Math.max(1, Math.hypot(dx, dy));
    const normalY = dx / Math.max(1, Math.hypot(dx, dy));
    const midX = (start.x + end.x) / 2 + normalX * curve;
    const midY = (start.y + end.y) / 2 + normalY * curve;
    path.setAttribute('d', `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`);
    path.setAttribute('class', `focus-edge focus-edge--${item.edge.kind}`);
    svg.append(path);
  }
}

function selectFocusNode(id) {
  focusState.selectedId = id;
  history.replaceState(null, '', `#${encodeURIComponent(id)}`);
  const realm = document.querySelector('#focus-realm');
  realm.querySelectorAll('.focus-node').forEach((card) => card.classList.toggle('is-selected', card.dataset.id === id));
  renderFocusDetail();
}

function renderFocusDetail() {
  const panel = document.querySelector('.focus-realm__detail');
  const node = focusNode(focusState.selectedId);
  if (!panel || !node) return;
  const assessment = focusState.assessments.get(node.id);
  const childCount = (focusState.children.get(node.id) || []).length;
  const linkCount = semanticNeighbors(node.id).length;
  const canDive = childCount + linkCount > 0 && node.id !== focusState.rootId;

  panel.innerHTML = `
    <div class="focus-detail__eyebrow">${focusEsc(FOCUS_KIND[node.kind]?.label || node.kind)}</div>
    <strong>${focusEsc(node.title)}</strong>
    <p>${focusEsc(node.summary)}</p>
    <div class="focus-detail__meta">
      ${assessment ? `<span>Mastery M${assessment.mastery}</span>` : '<span>Canonical knowledge</span>'}
      <span>${childCount} children</span>
      <span>${linkCount} links</span>
    </div>
    ${canDive ? `<button type="button" data-dive="${focusEsc(node.id)}">Dive deeper <span>◎</span></button>` : node.id === focusState.rootId ? '<small>Đây là chủ thể trung tâm của không gian hiện tại.</small>' : '<small>Node này chưa có không gian con để đi sâu.</small>'}
  `;
  panel.querySelector('[data-dive]')?.addEventListener('click', () => enterFocusRealm(node.id));
}

function handleRealmClick(event) {
  const card = event.target.closest('.focus-node');
  if (!card) return;
  selectFocusNode(card.dataset.id);
}

function handleRealmDoubleClick(event) {
  const card = event.target.closest('.focus-node');
  if (!card) return;
  event.preventDefault();
  const id = card.dataset.id;
  if ((focusState.children.get(id) || []).length || semanticNeighbors(id).length) enterFocusRealm(id);
}

function bindFocusEntryPoints() {
  document.querySelector('#nodes-layer')?.addEventListener('dblclick', (event) => {
    const card = event.target.closest('.knowledge-node');
    if (!card?.dataset.id) return;
    event.preventDefault();
    event.stopPropagation();
    enterFocusRealm(card.dataset.id);
  });

  document.addEventListener('keydown', (event) => {
    if (!focusState.active) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      backFocusRealm();
    }
  }, true);

  window.addEventListener('resize', () => {
    clearTimeout(focusState.resizeTimer);
    focusState.resizeTimer = window.setTimeout(() => {
      if (focusState.active) renderFocusRealm();
    }, 100);
  });
}

async function initFocusMode() {
  try {
    [focusState.graph, focusState.overlay] = await Promise.all([
      fetch('./data/graph.json').then((response) => {
        if (!response.ok) throw new Error(`graph.json ${response.status}`);
        return response.json();
      }),
      fetch('./data/overlays/huy.public.json').then((response) => response.ok ? response.json() : { assessments: [] })
    ]);
    buildFocusIndexes();
    createFocusRealm();
    observeInspector();
    bindFocusEntryPoints();
  } catch (error) {
    console.warn('Focus Realm unavailable:', error);
  }
}

initFocusMode();
