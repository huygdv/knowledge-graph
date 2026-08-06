const KIND = {
  domain: { label: 'Domain', icon: '◫' },
  capability: { label: 'Capability', icon: '▦' },
  concept: { label: 'Concept', icon: '○' },
  technique: { label: 'Technique', icon: '△' },
  tool: { label: 'Tool', icon: '◇' },
  pattern: { label: 'Pattern', icon: '⬡' },
  artifact: { label: 'Artifact', icon: '◆' }
};

const RELATION = {
  contains: ['Contains', 'Belongs to'],
  requires: ['Requires', 'Required by'],
  relates_to: ['Relates to', 'Relates to'],
  supports: ['Supports', 'Supported by'],
  implemented_by: ['Implemented by', 'Implements'],
  applied_in: ['Applied in', 'Demonstrates']
};

const VIEW = {
  library: { title: 'Library', description: 'Canonical knowledge map by domain and semantic depth', icon: '▦' },
  career: { title: 'Career Lens', description: 'Expected capability by Backend Engineer career level', icon: '↗' },
  growth: { title: 'Growth', description: 'Your public mastery overlay: recognize → understand → apply → diagnose → design → teach', icon: '◎' },
  evidence: { title: 'Evidence', description: 'Projects and the knowledge they demonstrate', icon: '◆' }
};

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));

const E = {
  canvas: $('#canvas'), scene: $('#scene'), nodes: $('#nodes-layer'), edges: $('#edges-layer'), inspector: $('#inspector'),
  viewModes: $('#view-modes'), domains: $('#domain-filters'), libraryControls: $('#library-controls'),
  careerControls: $('#career-controls'), growthControls: $('#growth-controls'), depthInput: $('#depth-input'),
  depthValue: $('#depth-value'), careerLevel: $('#career-level'), careerGapOnly: $('#career-gap-only'),
  masteryFilter: $('#mastery-filter'), search: $('#search-input'), visible: $('#visible-count'), total: $('#total-count'),
  viewTitle: $('#view-title'), viewDescription: $('#view-description'), legend: $('#canvas-legend')
};

const S = {
  graph: null, overlay: null, profile: null, nodesById: new Map(), assessments: new Map(), parents: new Map(),
  children: new Map(), depth: new Map(), mode: 'library', domain: null, depthLimit: 3, careerLevel: 'senior',
  gapOnly: false, minMastery: 0, query: '', selected: null, collapsed: new Set(), visible: new Set(),
  positions: new Map(), manual: new Map(), view: { x: 28, y: 30, scale: 0.72 }, panning: false, drag: null
};

function validate(graph, overlay, profile) {
  if (!graph || graph.version !== 2 || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new Error('Canonical graph schema không hợp lệ.');
  const ids = new Set();
  for (const node of graph.nodes) {
    if (!node.id || ids.has(node.id) || !KIND[node.kind]) throw new Error(`Node không hợp lệ: ${node.id}`);
    if ('status' in node || 'mastery' in node || 'level' in node) throw new Error(`Canonical node không được chứa learner state: ${node.id}`);
    ids.add(node.id);
  }
  for (const edge of graph.edges) if (!ids.has(edge.source) || !ids.has(edge.target) || !RELATION[edge.kind]) throw new Error(`Edge không hợp lệ: ${edge.id}`);
  for (const item of overlay.assessments || []) if (!ids.has(item.nodeId) || !Number.isInteger(item.mastery) || item.mastery < 0 || item.mastery > 6) throw new Error(`Overlay assessment không hợp lệ: ${item.nodeId}`);
  for (const level of profile.levels || []) for (const requirement of level.requirements || []) if (!ids.has(requirement.nodeId)) throw new Error(`Career requirement không tồn tại: ${requirement.nodeId}`);
}

function buildIndexes() {
  S.nodesById = new Map(S.graph.nodes.map((node) => [node.id, node]));
  S.assessments = new Map((S.overlay.assessments || []).map((item) => [item.nodeId, item]));
  S.parents = new Map(); S.children = new Map();
  for (const node of S.graph.nodes) S.children.set(node.id, []);
  for (const edge of S.graph.edges) {
    if (edge.kind !== 'contains') continue;
    S.parents.set(edge.target, edge.source);
    S.children.get(edge.source)?.push(edge.target);
  }
  const computeDepth = (id, stack = new Set()) => {
    if (S.depth.has(id)) return S.depth.get(id);
    if (stack.has(id)) throw new Error(`Cycle trong contains hierarchy tại ${id}`);
    stack.add(id);
    const parent = S.parents.get(id);
    const depth = parent ? computeDepth(parent, stack) + 1 : 0;
    stack.delete(id); S.depth.set(id, depth); return depth;
  };
  S.depth = new Map();
  for (const node of S.graph.nodes) computeDepth(node.id);
}

function byId(id) { return S.nodesById.get(id); }
function mastery(value) { return S.graph.masteryScale.find((item) => item.value === value) || S.graph.masteryScale[0]; }
function ancestors(id) { const result = []; let current = S.parents.get(id); while (current) { result.unshift(current); current = S.parents.get(current); } return result; }
function descendants(id) { const result = new Set(); const visit = (parent) => { for (const child of S.children.get(parent) || []) { result.add(child); visit(child); } }; visit(id); return result; }
function rootDomain(id) { let current = id; let parent = S.parents.get(current); while (parent) { current = parent; parent = S.parents.get(current); } return byId(current)?.kind === 'domain' ? current : null; }
function requirementMap() { const selected = S.profile.levels.find((level) => level.key === S.careerLevel) || S.profile.levels[0]; return new Map(selected.requirements.map((item) => [item.nodeId, item])); }
function linkedArtifacts(nodeId) { return S.graph.edges.filter((edge) => edge.kind === 'applied_in' && edge.source === nodeId).map((edge) => edge.target); }
function linkedKnowledge(artifactId) { return S.graph.edges.filter((edge) => edge.kind === 'applied_in' && edge.target === artifactId).map((edge) => edge.source); }
function searchMatches() {
  const query = S.query.trim().toLocaleLowerCase('vi'); if (!query) return null;
  const matches = new Set();
  for (const node of S.graph.nodes) {
    const haystack = [node.title, node.summary, ...(node.tags || []), ...(node.aliases || [])].join(' ').toLocaleLowerCase('vi');
    if (haystack.includes(query)) matches.add(node.id);
  }
  return matches;
}
function includeWithAncestors(target, id) { target.add(id); for (const ancestor of ancestors(id)) target.add(ancestor); }
function applyDomainFilter(ids) {
  if (!S.domain) return ids;
  const allowed = descendants(S.domain); allowed.add(S.domain); const result = new Set();
  for (const id of ids) {
    const node = byId(id);
    if (allowed.has(id)) result.add(id);
    if (node?.kind === 'artifact' && linkedKnowledge(id).some((source) => allowed.has(source))) result.add(id);
  }
  return result;
}
function applyCollapsed(ids) { const hidden = new Set(); for (const id of S.collapsed) for (const child of descendants(id)) hidden.add(child); return new Set([...ids].filter((id) => !hidden.has(id))); }

function visibleIds() {
  let ids = new Set(); const matches = searchMatches(); const reqMap = requirementMap();
  if (S.mode === 'library') {
    for (const node of S.graph.nodes) if (node.kind !== 'artifact' && (S.depth.get(node.id) || 0) <= S.depthLimit) ids.add(node.id);
    if (S.depthLimit >= 4) for (const node of S.graph.nodes.filter((item) => item.kind === 'artifact')) if (linkedKnowledge(node.id).some((source) => ids.has(source))) ids.add(node.id);
  }
  if (S.mode === 'career') {
    for (const [id, requirement] of reqMap) { const current = S.assessments.get(id)?.mastery ?? 0; if (!S.gapOnly || current < requirement.expectedMastery) includeWithAncestors(ids, id); }
    for (const id of [...ids]) for (const artifact of linkedArtifacts(id)) ids.add(artifact);
  }
  if (S.mode === 'growth') {
    for (const [id, assessment] of S.assessments) if (assessment.mastery >= S.minMastery) includeWithAncestors(ids, id);
    for (const id of [...ids]) for (const artifact of linkedArtifacts(id)) ids.add(artifact);
  }
  if (S.mode === 'evidence') for (const node of S.graph.nodes.filter((item) => item.kind === 'artifact')) { ids.add(node.id); for (const source of linkedKnowledge(node.id)) includeWithAncestors(ids, source); }
  ids = applyDomainFilter(ids);
  if (matches) {
    const searched = new Set();
    for (const id of ids) {
      if (!matches.has(id)) continue;
      includeWithAncestors(searched, id);
      for (const edge of S.graph.edges) { if (edge.source === id && ids.has(edge.target)) searched.add(edge.target); if (edge.target === id && ids.has(edge.source)) searched.add(edge.source); }
    }
    ids = searched;
  }
  return applyCollapsed(ids);
}

function treeLayout(ids) {
  const positions = new Map(); const rowHeight = 126; const columnWidth = 292; let cursor = 0;
  const place = (id) => {
    if (!ids.has(id) || byId(id)?.kind === 'artifact') return null;
    const visibleChildren = (S.children.get(id) || []).filter((child) => ids.has(child)); let y;
    if (visibleChildren.length) { const childYs = visibleChildren.map(place).filter((value) => value !== null); y = childYs.length ? (childYs[0] + childYs[childYs.length - 1]) / 2 : cursor++ * rowHeight; }
    else y = cursor++ * rowHeight;
    const depth = S.depth.get(id) || 0; positions.set(id, { x: 32 + depth * columnWidth, y: 30 + y }); return y;
  };
  const roots = S.graph.nodes.filter((node) => node.kind === 'domain' && ids.has(node.id));
  for (const root of roots) { place(root.id); cursor += 0.65; }
  for (const node of S.graph.nodes) if (ids.has(node.id) && node.kind !== 'artifact' && !positions.has(node.id)) place(node.id);
  const maxDepth = Math.max(2, ...[...positions.keys()].map((id) => S.depth.get(id) || 0)); let artifactCursor = 0;
  for (const artifact of S.graph.nodes.filter((node) => node.kind === 'artifact' && ids.has(node.id))) {
    const sources = linkedKnowledge(artifact.id).filter((id) => positions.has(id));
    const y = sources.length ? sources.map((id) => positions.get(id).y).reduce((sum, value) => sum + value, 0) / sources.length : 30 + artifactCursor++ * rowHeight;
    positions.set(artifact.id, { x: 32 + (maxDepth + 1) * columnWidth, y });
  }
  for (const [id, position] of S.manual) if (ids.has(id)) positions.set(id, position);
  return positions;
}

function navButton(label, active, onClick, suffix = '') {
  const button = document.createElement('button'); button.type = 'button'; button.className = `nav-item${active ? ' is-active' : ''}`;
  button.innerHTML = `<span>${label}</span>${suffix ? `<small>${suffix}</small>` : ''}`; button.onclick = onClick; return button;
}

function renderSidebar() {
  E.viewModes.replaceChildren();
  for (const [key, view] of Object.entries(VIEW)) E.viewModes.append(navButton(`${view.icon} ${view.title}`, S.mode === key, () => { S.mode = key; S.query = ''; E.search.value = ''; render(true); }));
  const domains = S.graph.nodes.filter((node) => node.kind === 'domain');
  E.domains.replaceChildren(navButton('All domains', !S.domain, () => { S.domain = null; render(true); }, domains.length));
  for (const domain of domains) E.domains.append(navButton(domain.title, S.domain === domain.id, () => { S.domain = S.domain === domain.id ? null : domain.id; render(true); }, descendants(domain.id).size));
  E.libraryControls.classList.toggle('is-hidden', S.mode !== 'library'); E.careerControls.classList.toggle('is-hidden', S.mode !== 'career'); E.growthControls.classList.toggle('is-hidden', S.mode !== 'growth');
  E.depthInput.value = String(S.depthLimit); E.depthValue.value = String(S.depthLimit);
  E.careerLevel.replaceChildren(...S.profile.levels.map((level) => { const option = document.createElement('option'); option.value = level.key; option.textContent = `${level.title} — ${level.requirements.length} expectations`; option.selected = level.key === S.careerLevel; return option; }));
  E.careerGapOnly.checked = S.gapOnly;
  E.masteryFilter.replaceChildren(...S.graph.masteryScale.map((item) => { const option = document.createElement('option'); option.value = String(item.value); option.textContent = `${item.value} · ${item.label}`; option.selected = item.value === S.minMastery; return option; }));
}

function nodeWidth(node) { if (node.kind === 'domain') return 252; if (node.kind === 'artifact') return 260; return 232; }
function nodeElement(node) {
  const position = S.positions.get(node.id); const current = S.assessments.get(node.id); const req = requirementMap().get(node.id);
  const gap = req ? (current?.mastery ?? 0) - req.expectedMastery : null; const hasChildren = (S.children.get(node.id) || []).length > 0;
  const element = document.createElement('article');
  element.className = ['knowledge-node', `knowledge-node--${node.kind}`, S.selected === node.id ? 'is-selected' : '', req ? 'is-required' : '', gap !== null && gap < 0 ? 'has-gap' : '', S.selected && !connectedToSelected(node.id) ? 'is-dimmed' : ''].filter(Boolean).join(' ');
  element.dataset.id = node.id; element.style.transform = `translate(${position.x}px, ${position.y}px)`; element.tabIndex = 0; element.role = 'button'; element.ariaLabel = `${KIND[node.kind].label}: ${node.title}`;
  const masteryBadge = current ? `<span class="mastery-badge mastery-${current.mastery}" title="Personal mastery">M${current.mastery} ${esc(mastery(current.mastery).label)}</span>` : '';
  const expectationBadge = req ? `<span class="expectation-badge" title="Expected mastery for ${esc(S.careerLevel)}">Need M${req.expectedMastery}</span>` : '';
  element.innerHTML = `<div class="knowledge-node__head"><span class="node-icon">${KIND[node.kind].icon}</span><span class="node-kind">${KIND[node.kind].label} · D${S.depth.get(node.id) || 0}</span>${masteryBadge}</div><div class="knowledge-node__title-row"><strong>${esc(node.title)}</strong>${hasChildren ? `<button class="node-toggle" type="button" title="Collapse / expand">${S.collapsed.has(node.id) ? '+' : '−'}</button>` : ''}</div><p>${esc(node.summary)}</p><div class="knowledge-node__footer"><div class="knowledge-node__tags">${(node.tags || []).slice(0, 2).map((tag) => `<span>#${esc(tag)}</span>`).join('')}</div>${expectationBadge}</div>`;
  element.onclick = (event) => { if (event.target.closest('.node-toggle')) { if (S.collapsed.has(node.id)) S.collapsed.delete(node.id); else S.collapsed.add(node.id); render(true); return; } select(node.id); };
  element.onkeydown = (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(node.id); } };
  element.onpointerdown = (event) => startNodeDrag(event, node.id); return element;
}
function connectedToSelected(id) { if (!S.selected || id === S.selected) return true; return S.graph.edges.some((edge) => (edge.source === S.selected && edge.target === id) || (edge.target === S.selected && edge.source === id)); }
function renderNodes() { E.nodes.replaceChildren(...S.graph.nodes.filter((node) => S.visible.has(node.id)).map(nodeElement)); }

function renderEdges() {
  const ns = 'http://www.w3.org/2000/svg'; E.edges.replaceChildren();
  for (const edge of S.graph.edges) {
    if (!S.visible.has(edge.source) || !S.visible.has(edge.target)) continue;
    const source = S.positions.get(edge.source);
    const target = S.positions.get(edge.target);
    const sourceNode = byId(edge.source);
    const x1 = source.x + nodeWidth(sourceNode);
    const y1 = source.y + 54;
    const x2 = target.x;
    const y2 = target.y + 54;
    const control = Math.max(58, Math.abs(x2 - x1) * 0.43);
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', `M ${x1} ${y1} C ${x1 + control} ${y1}, ${x2 - control} ${y2}, ${x2} ${y2}`);
    path.setAttribute('class', `edge edge--${edge.kind.replace('_', '-')}`);
    E.edges.append(path);
  }
}

function breadcrumb(nodeId) { return [...ancestors(nodeId), nodeId].map((id) => byId(id)?.title).filter(Boolean).join(' › '); }
function relationRows(node) {
  const rows = [];
  for (const edge of S.graph.edges) {
    let other; let label;
    if (edge.source === node.id) { other = byId(edge.target); label = RELATION[edge.kind][0]; }
    else if (edge.target === node.id) { other = byId(edge.source); label = RELATION[edge.kind][1]; }
    else continue;
    if (!other) continue;
    rows.push(`<button data-go="${esc(other.id)}"><strong>${esc(other.title)}</strong><span>→</span><small>${esc(label)}</small></button>`);
  }
  return rows.length ? rows.join('') : '<p class="muted">Chưa có quan hệ trực tiếp.</p>';
}
function careerMatrix(nodeId) {
  const rows = [];
  for (const level of S.profile.levels) {
    const req = level.requirements.find((item) => item.nodeId === nodeId);
    if (!req) continue;
    rows.push(`<div class="matrix-row"><span>${esc(level.title)}</span><strong>M${req.expectedMastery}</strong><small>${esc(req.outcome)}</small></div>`);
  }
  return rows.length ? rows.join('') : '<p class="muted">Node này chưa nằm trong Backend Engineer profile.</p>';
}
function renderInspector() {
  const node = byId(S.selected);
  if (!node) { E.inspector.innerHTML = $('#empty-inspector-template').innerHTML; return; }
  const assessment = S.assessments.get(node.id);
  const req = requirementMap().get(node.id);
  const evidence = node.kind === 'artifact' ? linkedKnowledge(node.id) : linkedArtifacts(node.id);
  const current = assessment?.mastery ?? 0;
  const gap = req ? current - req.expectedMastery : null;
  E.inspector.innerHTML = `<button class="inspector__close" type="button">×</button><div class="eyebrow">${esc(breadcrumb(node.id))}</div><h1>${esc(node.title)}</h1><div class="badge-row"><span class="kind-badge">${KIND[node.kind].label}</span><span class="depth-badge">Depth ${S.depth.get(node.id) || 0}</span>${assessment ? `<span class="mastery-badge mastery-${assessment.mastery}">M${assessment.mastery} ${esc(mastery(assessment.mastery).label)}</span>` : ''}</div><p class="inspector__summary">${esc(node.summary)}</p><section><h2>Canonical knowledge</h2><div class="tag-list">${(node.tags || []).map((tag) => `<span>#${esc(tag)}</span>`).join('') || '<span>Chưa gắn tag</span>'}</div></section><section><h2>Personal overlay</h2>${assessment ? `<div class="mastery-card"><strong>M${assessment.mastery} · ${esc(mastery(assessment.mastery).label)}</strong><p>${esc(assessment.note || 'Public seed assessment; refine through daily use.')}</p><small>Updated ${esc(assessment.updatedAt)}</small></div>` : '<p class="muted">Chưa có public assessment. Canonical node vẫn tồn tại độc lập.</p>'}</section>${req ? `<section><h2>${esc(S.profile.role)} · ${esc(S.careerLevel)}</h2><div class="career-card ${gap < 0 ? 'career-card--gap' : ''}"><strong>Expected M${req.expectedMastery} · ${esc(req.importance)}</strong><p>${esc(req.outcome)}</p><small>${gap < 0 ? `Gap ${Math.abs(gap)} level` : 'Meets or exceeds expectation'}</small></div></section>` : ''}<section><h2>Career progression</h2><div class="career-matrix">${careerMatrix(node.id)}</div></section><section><h2>${node.kind === 'artifact' ? 'Knowledge demonstrated' : 'Project evidence'}</h2><div class="evidence-list">${evidence.map((id) => { const item = byId(id); return `<button data-go="${esc(id)}"><strong>${esc(item?.title || id)}</strong><span>→</span></button>`; }).join('') || '<p class="muted">Chưa nối evidence.</p>'}</div>${node.url ? `<a class="external-link" href="${esc(node.url)}" target="_blank" rel="noreferrer">Open project ↗</a>` : ''}</section><section><h2>Relations</h2><div class="relation-list">${relationRows(node)}</div></section>`;
  E.inspector.querySelector('.inspector__close').onclick = () => select(null);
  E.inspector.querySelectorAll('[data-go]').forEach((button) => { button.onclick = () => navigateTo(button.dataset.go); });
}
function renderLegend() {
  if (S.mode === 'career') { E.legend.innerHTML = '<span><i class="legend-chip legend-chip--current"></i>personal mastery</span><span><i class="legend-chip legend-chip--expected"></i>career expectation</span><span><i class="legend-chip legend-chip--gap"></i>gap</span>'; return; }
  if (S.mode === 'growth') { E.legend.innerHTML = '<span>M1 recognize</span><span>M3 apply</span><span>M4 diagnose</span><span>M5 design</span><span>M6 teach</span>'; return; }
  E.legend.innerHTML = '<span><i class="legend-line legend-line--contains"></i>contains</span><span><i class="legend-line legend-line--requires"></i>requires</span><span><i class="legend-line legend-line--applied"></i>applied in</span>';
}
function renderHeader() {
  const view = VIEW[S.mode]; E.viewTitle.textContent = view.title;
  if (S.mode === 'career') { const level = S.profile.levels.find((item) => item.key === S.careerLevel); E.viewDescription.textContent = `${level.title}: ${level.outcome}`; }
  else E.viewDescription.textContent = view.description;
}
function applyView() { E.scene.style.transform = `translate(${S.view.x}px, ${S.view.y}px) scale(${S.view.scale})`; }
function fit() {
  const entries = [...S.positions.entries()].filter(([id]) => S.visible.has(id)); if (!entries.length) return;
  const minX = Math.min(...entries.map(([, position]) => position.x)); const minY = Math.min(...entries.map(([, position]) => position.y));
  const maxX = Math.max(...entries.map(([id, position]) => position.x + nodeWidth(byId(id)))); const maxY = Math.max(...entries.map(([, position]) => position.y + 118));
  const bounds = E.canvas.getBoundingClientRect();
  const scale = Math.max(0.22, Math.min(1.05, (bounds.width - 90) / Math.max(1, maxX - minX), (bounds.height - 90) / Math.max(1, maxY - minY)));
  S.view = { scale, x: (bounds.width - (maxX - minX) * scale) / 2 - minX * scale, y: (bounds.height - (maxY - minY) * scale) / 2 - minY * scale };
  applyView();
}
function render(shouldFit = false) {
  S.visible = visibleIds(); S.positions = treeLayout(S.visible); renderSidebar(); renderHeader(); renderNodes(); renderEdges(); renderInspector(); renderLegend();
  E.visible.textContent = String(S.visible.size); E.total.textContent = String(S.graph.nodes.length); applyView(); if (shouldFit) requestAnimationFrame(fit);
}
function select(id) { S.selected = id; history.replaceState(null, '', id ? `#${encodeURIComponent(id)}` : location.pathname + location.search); render(false); }
function navigateTo(id) {
  const node = byId(id); if (!node) return; S.query = ''; E.search.value = '';
  if (node.kind !== 'artifact') { const domain = rootDomain(id); if (domain) S.domain = domain; S.depthLimit = Math.max(S.depthLimit, S.depth.get(id) || 0); }
  select(id); requestAnimationFrame(fit);
}
function startNodeDrag(event, id) {
  if (event.button !== 0) return; event.stopPropagation(); const element = event.currentTarget; const position = S.positions.get(id);
  S.drag = { id, element, startX: event.clientX, startY: event.clientY, x: position.x, y: position.y }; element.setPointerCapture(event.pointerId);
}
function move(event) {
  if (S.drag) { const dx = (event.clientX - S.drag.startX) / S.view.scale; const dy = (event.clientY - S.drag.startY) / S.view.scale; const position = { x: S.drag.x + dx, y: S.drag.y + dy }; S.manual.set(S.drag.id, position); S.positions.set(S.drag.id, position); S.drag.element.style.transform = `translate(${position.x}px, ${position.y}px)`; renderEdges(); return; }
  if (S.panning) { S.view.x += event.movementX; S.view.y += event.movementY; applyView(); }
}
function stop(event) { if (S.drag) { try { S.drag.element.releasePointerCapture(event.pointerId); } catch {} S.drag = null; } S.panning = false; E.canvas.classList.remove('is-panning'); }
function reset() { S.mode = 'library'; S.domain = null; S.depthLimit = 3; S.careerLevel = 'senior'; S.gapOnly = false; S.minMastery = 0; S.query = ''; S.selected = null; S.collapsed.clear(); S.manual.clear(); E.search.value = ''; render(true); }
function bind() {
  E.search.oninput = (event) => { S.query = event.target.value; render(true); };
  E.depthInput.oninput = (event) => { S.depthLimit = Number(event.target.value); E.depthValue.value = String(S.depthLimit); render(true); };
  E.careerLevel.onchange = (event) => { S.careerLevel = event.target.value; render(true); };
  E.careerGapOnly.onchange = (event) => { S.gapOnly = event.target.checked; render(true); };
  E.masteryFilter.onchange = (event) => { S.minMastery = Number(event.target.value); render(true); };
  document.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); E.search.focus(); } if (event.key === 'Escape') { S.query = ''; S.selected = null; E.search.value = ''; render(true); } });
  E.canvas.onpointerdown = (event) => { if (event.target.closest('.knowledge-node,.canvas-controls')) return; S.panning = true; E.canvas.classList.add('is-panning'); };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop);
  E.canvas.onwheel = (event) => { event.preventDefault(); const bounds = E.canvas.getBoundingClientRect(); const mouseX = event.clientX - bounds.left; const mouseY = event.clientY - bounds.top; const oldScale = S.view.scale; const nextScale = Math.max(0.2, Math.min(1.8, oldScale * (event.deltaY < 0 ? 1.1 : 0.9))); S.view.x = mouseX - (mouseX - S.view.x) * (nextScale / oldScale); S.view.y = mouseY - (mouseY - S.view.y) * (nextScale / oldScale); S.view.scale = nextScale; applyView(); };
  $('#zoom-in').onclick = () => { S.view.scale = Math.min(1.8, S.view.scale * 1.15); applyView(); };
  $('#zoom-out').onclick = () => { S.view.scale = Math.max(0.2, S.view.scale / 1.15); applyView(); };
  $('#fit-view').onclick = fit; $('#reset-view').onclick = reset;
}
async function loadJson(path) { const response = await fetch(path); if (!response.ok) throw new Error(`Không tải được ${path} (${response.status}).`); return response.json(); }
async function init() {
  try {
    [S.graph, S.overlay, S.profile] = await Promise.all([loadJson('./data/graph.json'), loadJson('./data/overlays/huy.public.json'), loadJson('./data/profiles/backend-engineer.json')]);
    validate(S.graph, S.overlay, S.profile); buildIndexes(); bind();
    const hash = decodeURIComponent(location.hash.slice(1)); if (hash && byId(hash)) { S.selected = hash; S.depthLimit = Math.max(S.depthLimit, S.depth.get(hash) || 0); }
    render(true);
  } catch (error) { document.body.innerHTML = `<main class="fatal-error"><h1>Không thể mở Knowledge Graph</h1><p>${esc(error.message)}</p><p>Hãy chạy qua HTTP server và kiểm tra data validation.</p></main>`; console.error(error); }
}
init();
