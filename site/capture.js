const INBOX_KEY = 'knowledge-graph:inbox:v1';
const captureState = { graph: null, drafts: [], editingId: null };
const captureEsc = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));

function loadDrafts() {
  try { const value = JSON.parse(localStorage.getItem(INBOX_KEY) || '[]'); captureState.drafts = Array.isArray(value) ? value : []; }
  catch { captureState.drafts = []; }
}
function saveDrafts() { localStorage.setItem(INBOX_KEY, JSON.stringify(captureState.drafts)); syncInboxCounts(); }
function syncInboxCounts() {
  const count = captureState.drafts.length;
  const sidebarCount = document.querySelector('#inbox-sidebar-count'); if (sidebarCount) sidebarCount.textContent = String(count);
  const launch = document.querySelector('.capture-launch-button');
  if (launch) { launch.querySelector('.capture-badge')?.remove(); if (count) launch.insertAdjacentHTML('beforeend', `<span class="capture-badge">${count}</span>`); }
  document.querySelectorAll('[data-inbox-count]').forEach((element) => element.textContent = String(count));
}
async function loadGraph() {
  if (captureState.graph) return captureState.graph;
  const response = await fetch('./data/graph.json'); if (!response.ok) throw new Error('Không tải được graph data.');
  captureState.graph = await response.json(); return captureState.graph;
}

function createDialog() {
  if (document.querySelector('#capture-dialog')) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'capture-dialog'; dialog.className = 'capture-dialog';
  dialog.innerHTML = `<div class="capture-shell">
    <header class="capture-header"><div><h2>Knowledge Inbox</h2><p>Capture quickly, review later, export safely.</p></div><button class="capture-close" type="button" aria-label="Đóng">×</button></header>
    <div class="capture-tabs" role="tablist"><button class="capture-tab is-active" type="button" data-tab="capture">Quick Capture</button><button class="capture-tab" type="button" data-tab="inbox">Inbox <span class="capture-badge" data-inbox-count>0</span></button></div>
    <section class="capture-panel is-active" data-panel="capture"><form class="capture-form" id="capture-form"><div class="capture-grid">
      <div class="capture-field capture-field--wide"><label for="capture-title">Title</label><input class="capture-input" id="capture-title" name="title" required maxlength="120" placeholder="Ví dụ: PostgreSQL autovacuum tuning" /></div>
      <div class="capture-field"><label for="capture-kind">Kind</label><select class="capture-select" id="capture-kind" name="kind"><option>concept</option><option>technique</option><option>pattern</option><option>tool</option><option>capability</option><option>artifact</option></select></div>
      <div class="capture-field"><label for="capture-domain">Suggested domain</label><select class="capture-select" id="capture-domain" name="domain"><option value="">Unassigned</option></select></div>
      <div class="capture-field capture-field--wide"><label for="capture-note">Note / why it matters</label><textarea class="capture-textarea" id="capture-note" name="note" required placeholder="Điều gì cần nhớ, cần nghiên cứu hoặc cần dạy lại?"></textarea></div>
      <div class="capture-field"><label for="capture-tags">Tags</label><input class="capture-input" id="capture-tags" name="tags" placeholder="postgresql, performance" /></div>
      <div class="capture-field"><label for="capture-related">Related node</label><input class="capture-input" id="capture-related" name="related" list="capture-node-list" placeholder="Search by ID or title" /><datalist id="capture-node-list"></datalist></div>
    </div><div class="capture-status" aria-live="polite"></div><div class="capture-actions"><button class="capture-button" type="button" data-reset-capture>Clear</button><div class="capture-actions__right"><button class="capture-button" type="button" data-save-ready>Save as ready</button><button class="capture-button capture-button--primary" type="submit">Save to Inbox</button></div></div></form></section>
    <section class="capture-panel" data-panel="inbox"><div class="inbox-toolbar"><strong>Local-first drafts</strong><div class="inbox-toolbar__actions"><button class="capture-button" type="button" data-export-inbox>Export JSON</button><button class="capture-button capture-button--danger" type="button" data-clear-inbox>Clear all</button></div></div><div class="inbox-list"></div></section>
  </div>`;
  document.body.append(dialog);
  dialog.querySelector('.capture-close').onclick = () => dialog.close();
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog.querySelectorAll('[data-tab]').forEach((button) => button.onclick = () => switchTab(button.dataset.tab));
  dialog.querySelector('#capture-form').onsubmit = (event) => { event.preventDefault(); persist('inbox'); };
  dialog.querySelector('[data-save-ready]').onclick = () => persist('ready');
  dialog.querySelector('[data-reset-capture]').onclick = () => resetForm();
  dialog.querySelector('[data-export-inbox]').onclick = exportInbox;
  dialog.querySelector('[data-clear-inbox]').onclick = () => { if (captureState.drafts.length && confirm('Xóa toàn bộ Knowledge Inbox trên thiết bị này?')) { captureState.drafts = []; saveDrafts(); renderInbox(); } };
}
async function populateOptions() {
  const graph = await loadGraph(); const domain = document.querySelector('#capture-domain'); const datalist = document.querySelector('#capture-node-list');
  if (!domain || domain.dataset.ready) return;
  graph.nodes.filter((node) => node.kind === 'domain').forEach((node) => { const option = document.createElement('option'); option.value = node.id; option.textContent = node.title; domain.append(option); });
  graph.nodes.forEach((node) => { const option = document.createElement('option'); option.value = node.id; option.label = node.title; datalist.append(option); });
  domain.dataset.ready = 'true';
}
function switchTab(tab) {
  document.querySelectorAll('.capture-tab').forEach((button) => button.classList.toggle('is-active', button.dataset.tab === tab));
  document.querySelectorAll('.capture-panel').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.panel === tab));
  if (tab === 'inbox') renderInbox();
}
function openCapture(tab = 'capture') {
  createDialog();
  populateOptions().then(() => { prefillRelated(); switchTab(tab); const dialog = document.querySelector('#capture-dialog'); dialog.showModal(); if (tab === 'capture') setTimeout(() => dialog.querySelector('#capture-title')?.focus(), 30); }).catch((error) => alert(error.message));
}
function prefillRelated() {
  if (captureState.editingId) return; const input = document.querySelector('#capture-related'); if (!input || input.value) return;
  const id = decodeURIComponent(location.hash.slice(1)); if (captureState.graph?.nodes.some((node) => node.id === id)) input.value = id;
}
function slug(value) { return value.toLocaleLowerCase('en').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72); }
function value(name) { return document.querySelector(`#capture-form [name="${name}"]`)?.value.trim() || ''; }
function status(message) { const element = document.querySelector('.capture-status'); if (element) element.textContent = message; }
function persist(state) {
  const title = value('title'), note = value('note'); if (!title || !note) { status('Title và note là bắt buộc.'); return; }
  const now = new Date().toISOString(), previous = captureState.drafts.find((item) => item.id === captureState.editingId);
  const draft = { id: captureState.editingId || `draft.${Date.now().toString(36)}`, title, note, kind: value('kind') || 'concept', suggestedDomain: value('domain') || null, tags: value('tags').split(',').map((item) => item.trim()).filter(Boolean), relatedNodeId: value('related') || null, status: state, createdAt: previous?.createdAt || now, updatedAt: now };
  const index = captureState.drafts.findIndex((item) => item.id === draft.id); if (index >= 0) captureState.drafts[index] = draft; else captureState.drafts.unshift(draft);
  saveDrafts(); status(state === 'ready' ? 'Đã lưu và đánh dấu ready for canonical review.' : 'Đã lưu vào Knowledge Inbox.'); resetForm(false); setTimeout(() => switchTab('inbox'), 180);
}
function resetForm(clear = true) { document.querySelector('#capture-form')?.reset(); captureState.editingId = null; if (clear) status(''); prefillRelated(); }
function proposal(draft) {
  const prefix = ['tool','pattern','technique','capability','artifact'].includes(draft.kind) ? draft.kind : 'concept';
  const node = { id: `${prefix}.${slug(draft.title) || 'new-node'}`, kind: draft.kind, title: draft.title, summary: draft.note, tags: draft.tags };
  const edges = []; if (draft.suggestedDomain) edges.push({ kind: 'contains', source: draft.suggestedDomain, target: node.id }); if (draft.relatedNodeId) edges.push({ kind: 'relates_to', source: draft.relatedNodeId, target: node.id });
  return { node, edges, sourceDraftId: draft.id };
}
function renderInbox() {
  const list = document.querySelector('.inbox-list'); if (!list) return; syncInboxCounts();
  if (!captureState.drafts.length) { list.innerHTML = '<div class="inbox-empty"><strong>Inbox đang trống</strong>Capture một ý tưởng khi nó xuất hiện, review khi có thời gian.</div>'; return; }
  list.innerHTML = captureState.drafts.map((draft) => `<article class="inbox-item" data-draft-id="${captureEsc(draft.id)}"><div class="inbox-item__head"><strong>${captureEsc(draft.title)}</strong><span class="inbox-chip">${captureEsc(draft.status)}</span></div><div class="inbox-item__meta"><span class="inbox-chip">${captureEsc(draft.kind)}</span>${draft.suggestedDomain ? `<span class="inbox-chip">${captureEsc(draft.suggestedDomain)}</span>` : ''}${draft.tags.map((tag) => `<span class="inbox-chip">#${captureEsc(tag)}</span>`).join('')}</div><p>${captureEsc(draft.note)}</p><div class="inbox-item__actions"><button class="capture-button" data-edit-draft>Edit</button><button class="capture-button" data-copy-proposal>Copy proposal</button><button class="capture-button capture-button--danger" data-delete-draft>Delete</button></div></article>`).join('');
  list.querySelectorAll('.inbox-item').forEach((item) => { const id = item.dataset.draftId; item.querySelector('[data-edit-draft]').onclick = () => editDraft(id); item.querySelector('[data-copy-proposal]').onclick = () => copyProposal(id); item.querySelector('[data-delete-draft]').onclick = () => { captureState.drafts = captureState.drafts.filter((draft) => draft.id !== id); saveDrafts(); renderInbox(); }; });
}
function editDraft(id) {
  const draft = captureState.drafts.find((item) => item.id === id); if (!draft) return; captureState.editingId = id; switchTab('capture');
  const form = document.querySelector('#capture-form');
  for (const [name, fieldValue] of Object.entries({ title: draft.title, note: draft.note, kind: draft.kind, domain: draft.suggestedDomain || '', tags: draft.tags.join(', '), related: draft.relatedNodeId || '' })) { const field = form.elements.namedItem(name); if (field) field.value = fieldValue; }
  status('Đang chỉnh sửa draft.');
}
async function copyProposal(id) {
  const draft = captureState.drafts.find((item) => item.id === id); if (!draft) return; await navigator.clipboard.writeText(JSON.stringify(proposal(draft), null, 2));
  const button = document.querySelector(`[data-draft-id="${CSS.escape(id)}"] [data-copy-proposal]`); if (button) { const old = button.textContent; button.textContent = 'Copied'; setTimeout(() => button.textContent = old, 900); }
}
function exportInbox() {
  const payload = { version: 1, exportedAt: new Date().toISOString(), drafts: captureState.drafts, proposals: captureState.drafts.map(proposal) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `knowledge-inbox-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url);
}

loadDrafts(); createDialog(); syncInboxCounts();
document.addEventListener('click', (event) => { const target = event.target.closest('[data-open-capture]'); if (target) openCapture(target.closest('.project-links') ? 'inbox' : 'capture'); });
document.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'k') { event.preventDefault(); openCapture('capture'); } });
