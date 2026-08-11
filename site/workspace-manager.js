const W = window.KGWorkspace;

const managerState = {
  workspaces: [],
  pendingImport: null,
  dialog: null,
  fileInput: null
};

const esc = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
const slug = (value) => String(value || '').toLocaleLowerCase('en').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64);

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function showStatus(message, tone = 'info') {
  const element = managerState.dialog?.querySelector('.workspace-status');
  if (!element) return;
  element.textContent = message || '';
  element.dataset.tone = tone;
}

function installWorkspaceSwitcher() {
  if (!W || document.querySelector('.workspace-switcher')) return;
  const toolbarLeft = document.querySelector('.toolbar__left');
  if (!toolbarLeft) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'workspace-switcher';
  button.title = 'Switch or manage Knowledge Pack';
  button.setAttribute('aria-haspopup', 'dialog');
  button.innerHTML = '<span class="workspace-switcher__icon">◫</span><span class="workspace-switcher__copy"><small>Workspace</small><strong>Loading…</strong></span><span class="workspace-switcher__chevron">⌄</span>';
  button.onclick = () => openManager();
  toolbarLeft.prepend(button);
}

function createDialog() {
  if (managerState.dialog) return managerState.dialog;
  const dialog = document.createElement('dialog');
  dialog.id = 'workspace-dialog';
  dialog.className = 'workspace-dialog';
  dialog.innerHTML = `
    <div class="workspace-shell">
      <header class="workspace-header">
        <div><span class="workspace-eyebrow">Knowledge Packs · schema ${W?.PACK_SCHEMA_VERSION || '1.0'}</span><h2>Workspace Manager</h2><p>Import, structure, reuse and export independent knowledge maps.</p></div>
        <button class="workspace-close" type="button" aria-label="Close workspace manager">×</button>
      </header>

      <section class="workspace-actions" aria-label="Workspace actions">
        <button type="button" data-workspace-action="new"><span>＋</span><strong>New blank</strong><small>Start a clean local pack</small></button>
        <button type="button" data-workspace-action="import"><span>⇩</span><strong>Import pack</strong><small>Validate before saving</small></button>
        <button type="button" data-workspace-action="export"><span>⇧</span><strong>Export current</strong><small>Portable .kg.json</small></button>
        <button type="button" data-workspace-action="example"><span>▣</span><strong>Use example</strong><small>Research system map</small></button>
      </section>

      <div class="workspace-status" data-tone="info" aria-live="polite"></div>

      <section class="workspace-main">
        <div class="workspace-list-pane">
          <div class="workspace-section-heading"><div><span>My workspaces</span><small>Local · IndexedDB</small></div><strong class="workspace-count">0</strong></div>
          <div class="workspace-list"></div>
        </div>

        <aside class="workspace-side-pane">
          <section class="workspace-template-card">
            <span class="workspace-eyebrow">Bring your own knowledge</span>
            <h3>Template files</h3>
            <p>Download a valid pack, replace the sample content with your own research, then import it here.</p>
            <div class="workspace-template-actions">
              <a href="./templates/minimal.kg.json" download="knowledge-pack-minimal.kg.json">Minimal template</a>
              <a href="./templates/example.kg.json" download="knowledge-pack-example.kg.json">Example template</a>
            </div>
          </section>
          <section class="workspace-import-preview" hidden></section>
        </aside>
      </section>

      <input class="workspace-file-input" type="file" accept="application/json,.json,.kg.json" hidden />
    </div>`;
  document.body.append(dialog);
  managerState.dialog = dialog;
  managerState.fileInput = dialog.querySelector('.workspace-file-input');

  dialog.querySelector('.workspace-close').onclick = () => dialog.close();
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog.querySelector('[data-workspace-action="new"]').onclick = createBlankWorkspace;
  dialog.querySelector('[data-workspace-action="import"]').onclick = () => managerState.fileInput.click();
  dialog.querySelector('[data-workspace-action="export"]').onclick = exportCurrent;
  dialog.querySelector('[data-workspace-action="example"]').onclick = useExample;
  managerState.fileInput.addEventListener('change', handleImportFile);
  return dialog;
}

async function refreshWorkspaces() {
  if (!W) return;
  managerState.workspaces = await W.listWorkspaces();
  const activeId = W.getActiveId();
  const active = managerState.workspaces.find((item) => item.id === activeId) || managerState.workspaces[0];
  document.querySelectorAll('.workspace-switcher strong').forEach((element) => element.textContent = active?.title || 'Fullstack Engineering');
  document.title = `${active?.title || 'Knowledge Graph'} · Knowledge Graph`;

  const list = managerState.dialog?.querySelector('.workspace-list');
  if (!list) return;
  managerState.dialog.querySelector('.workspace-count').textContent = String(managerState.workspaces.length);
  list.innerHTML = managerState.workspaces.map((item) => {
    const isActive = item.id === activeId;
    return `<article class="workspace-item${isActive ? ' is-active' : ''}" data-workspace-id="${esc(item.id)}">
      <button class="workspace-item__open" type="button" data-open-workspace="${esc(item.id)}">
        <span class="workspace-item__mark">${item.builtin ? 'K' : '◫'}</span>
        <span class="workspace-item__copy"><strong>${esc(item.title)}</strong><small>${esc(item.description || (item.builtin ? 'Built-in Knowledge Pack' : item.id))}</small></span>
        <span class="workspace-item__badges">${item.builtin ? '<em>Built-in</em>' : '<em>Local</em>'}${isActive ? '<b>Active</b>' : ''}</span>
      </button>
      ${item.builtin ? '' : `<div class="workspace-item__tools"><button type="button" data-rename-workspace="${esc(item.id)}" title="Rename">✎</button><button type="button" data-delete-workspace="${esc(item.id)}" title="Delete">⌫</button></div>`}
    </article>`;
  }).join('');

  list.querySelectorAll('[data-open-workspace]').forEach((button) => button.onclick = () => activateWorkspace(button.dataset.openWorkspace));
  list.querySelectorAll('[data-rename-workspace]').forEach((button) => button.onclick = () => renameWorkspace(button.dataset.renameWorkspace));
  list.querySelectorAll('[data-delete-workspace]').forEach((button) => button.onclick = () => deleteWorkspace(button.dataset.deleteWorkspace));
}

async function openManager() {
  const dialog = createDialog();
  managerState.pendingImport = null;
  dialog.querySelector('.workspace-import-preview').hidden = true;
  showStatus('');
  if (!dialog.open) dialog.showModal();
  try { await refreshWorkspaces(); }
  catch (error) { showStatus(error.message, 'error'); }
}

async function activateWorkspace(id) {
  if (!id || id === W.getActiveId()) { managerState.dialog?.close(); return; }
  W.setActiveId(id);
  showStatus('Opening workspace…');
  location.reload();
}

async function createBlankWorkspace() {
  const title = prompt('Tên workspace mới?', 'New Research Map');
  if (!title) return;
  let id = slug(title) || `workspace-${Date.now().toString(36)}`;
  const existing = new Set((await W.listWorkspaces()).map((item) => item.id));
  let suffix = 2;
  const base = id;
  while (existing.has(id) || id === W.BUILTIN_ID) id = `${base}-${suffix++}`;
  const rootId = `domain.${id}`;
  const now = new Date().toISOString();
  const pack = {
    schemaVersion: W.PACK_SCHEMA_VERSION,
    manifest: { id, title: title.trim(), description: 'Local knowledge workspace.', createdAt: now, updatedAt: now },
    graph: {
      version: 2,
      meta: { id, title: title.trim(), description: 'Local knowledge workspace.' },
      nodes: [{ id: rootId, kind: 'domain', title: title.trim(), summary: 'Root domain. Add or import structured knowledge under this node.', tags: ['workspace'] }],
      edges: []
    },
    overlay: { version: 1, id: `overlay.${id}`, assessments: [] },
    profiles: [],
    views: { defaultMode: 'library', defaultDepth: 3 },
    inbox: []
  };
  try {
    await W.activateImportedPack(pack);
    location.reload();
  } catch (error) { showStatus(error.message, 'error'); }
}

async function exportCurrent() {
  try {
    showStatus('Preparing portable pack…');
    const pack = await W.exportActivePack();
    const filename = `${slug(pack.manifest.title) || pack.manifest.id}.kg.json`;
    downloadJson(filename, pack);
    showStatus(`Exported ${pack.graph.nodes.length} nodes and ${pack.graph.edges.length} relations.`, 'success');
  } catch (error) { showStatus(error.message, 'error'); }
}

async function handleImportFile() {
  const file = managerState.fileInput.files?.[0];
  managerState.fileInput.value = '';
  if (!file) return;
  try {
    const input = JSON.parse(await file.text());
    previewImport(input, file.name);
  } catch (error) {
    managerState.pendingImport = null;
    renderImportPreview({ valid: false, errors: [`Could not parse JSON: ${error.message}`], warnings: [], stats: null }, file.name);
  }
}

function previewImport(input, sourceName = 'Knowledge Pack') {
  const result = W.validatePack(input);
  managerState.pendingImport = result.valid ? result.pack : null;
  renderImportPreview(result, sourceName);
}

function renderImportPreview(result, sourceName) {
  const panel = managerState.dialog.querySelector('.workspace-import-preview');
  panel.hidden = false;
  const stats = result.stats;
  panel.innerHTML = `
    <span class="workspace-eyebrow">Import preview</span>
    <h3>${esc(sourceName)}</h3>
    ${stats ? `<div class="workspace-stats"><span><strong>${stats.nodes}</strong> nodes</span><span><strong>${stats.edges}</strong> relations</span><span><strong>${stats.domains}</strong> domains</span><span><strong>${stats.artifacts}</strong> artifacts</span></div>` : ''}
    <div class="workspace-validation ${result.valid ? 'is-valid' : 'is-invalid'}"><strong>${result.valid ? '✓ Pack is valid' : `✕ ${result.errors.length} validation error${result.errors.length === 1 ? '' : 's'}`}</strong>
      ${result.errors.length ? `<ul>${result.errors.slice(0, 8).map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}
      ${result.warnings.length ? `<div class="workspace-warnings"><b>Warnings</b><ul>${result.warnings.slice(0, 5).map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}
    </div>
    ${result.valid ? `<button class="workspace-import-confirm" type="button">Import as “${esc(result.pack.manifest.title)}”</button>` : '<p class="workspace-help">Fix the source file and choose Import pack again. Nothing has been written to storage.</p>'}`;
  panel.querySelector('.workspace-import-confirm')?.addEventListener('click', commitImport);
}

async function commitImport() {
  const pack = managerState.pendingImport;
  if (!pack) return;
  try {
    const existing = (await W.listWorkspaces()).find((item) => item.id === pack.manifest.id && !item.builtin);
    if (existing && !confirm(`Replace existing workspace “${existing.title}”?`)) return;
    showStatus('Saving pack to local workspace storage…');
    await W.activateImportedPack(pack);
    showStatus('Imported successfully. Opening workspace…', 'success');
    location.reload();
  } catch (error) { showStatus(error.message, 'error'); }
}

async function useExample() {
  try {
    showStatus('Loading example pack…');
    const response = await W.nativeFetch('./templates/example.kg.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Example template is unavailable.');
    previewImport(await response.json(), 'Example Knowledge Pack');
  } catch (error) { showStatus(error.message, 'error'); }
}

async function renameWorkspace(id) {
  const current = managerState.workspaces.find((item) => item.id === id);
  const title = prompt('Tên workspace mới?', current?.title || id);
  if (!title || title === current?.title) return;
  try { await W.renameWorkspace(id, title); await refreshWorkspaces(); showStatus('Workspace renamed.', 'success'); }
  catch (error) { showStatus(error.message, 'error'); }
}

async function deleteWorkspace(id) {
  const current = managerState.workspaces.find((item) => item.id === id);
  if (!confirm(`Delete local workspace “${current?.title || id}”? This does not affect exported files.`)) return;
  try { await W.deleteWorkspace(id); await refreshWorkspaces(); showStatus('Workspace deleted.', 'success'); }
  catch (error) { showStatus(error.message, 'error'); }
}

function installSidebarEntry() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar || sidebar.querySelector('.workspace-sidebar-entry')) return;
  const section = document.createElement('section');
  section.className = 'sidebar-section workspace-sidebar-entry';
  section.innerHTML = `<h2>Workspace</h2><button class="nav-item" type="button" data-open-workspace-manager><span>◫ Manage packs</span><small>Import / Export</small></button>`;
  const projectSection = sidebar.querySelector('.project-links-section');
  sidebar.insertBefore(section, projectSection || sidebar.querySelector('#reset-view'));
  section.querySelector('[data-open-workspace-manager]').onclick = openManager;
}

function installGlobalShortcuts() {
  document.addEventListener('keydown', (event) => {
    if (!((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'o')) return;
    event.preventDefault();
    openManager();
  });
}

async function initWorkspaceManager() {
  if (!W) { console.warn('Knowledge workspace runtime is unavailable.'); return; }
  installWorkspaceSwitcher();
  createDialog();
  installSidebarEntry();
  installGlobalShortcuts();
  try { await refreshWorkspaces(); }
  catch (error) { console.warn('Could not initialize workspace manager:', error); }
}

initWorkspaceManager();
