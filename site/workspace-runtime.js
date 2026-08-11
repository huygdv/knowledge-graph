(function () {
  'use strict';

  const DB_NAME = 'knowledge-graph-workspaces';
  const DB_VERSION = 1;
  const STORE_NAME = 'workspaces';
  const ACTIVE_KEY = 'knowledge-graph:active-workspace';
  const BUILTIN_ID = 'builtin.fullstack-engineering';
  const PACK_SCHEMA_VERSION = '1.0';
  const ALLOWED_KINDS = new Set(['domain', 'capability', 'concept', 'technique', 'tool', 'pattern', 'artifact']);
  const ALLOWED_RELATIONS = new Set(['contains', 'requires', 'relates_to', 'supports', 'implemented_by', 'applied_in']);
  const nativeFetch = window.fetch.bind(window);

  const DEFAULT_MASTERY_SCALE = [
    [0, 'unexplored', 'Unexplored'], [1, 'recognize', 'Recognize'], [2, 'understand', 'Understand'],
    [3, 'apply', 'Apply'], [4, 'diagnose', 'Diagnose'], [5, 'design', 'Design'], [6, 'teach', 'Teach']
  ].map(([value, key, label]) => ({ value, key, label }));

  const DEFAULT_OVERLAY = {
    version: 1,
    id: 'overlay.local-default',
    title: 'Local mastery overlay',
    assessments: []
  };

  const DEFAULT_PROFILE = {
    version: 1,
    id: 'profile.general-explorer',
    title: 'General Explorer',
    description: 'Fallback profile for knowledge packs without a career rubric.',
    role: 'Explorer',
    levels: [{ key: 'explorer', rank: 1, title: 'Explorer', outcome: 'Explore the knowledge pack without career-level requirements.', requirements: [] }]
  };

  const BUILTIN_MANIFEST = {
    id: BUILTIN_ID,
    title: 'Fullstack Engineering',
    description: 'Built-in personal engineering knowledge pack.',
    author: 'huygdv',
    builtin: true
  };

  function nowIso() { return new Date().toISOString(); }
  function safeClone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function responseJson(payload) {
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Knowledge-Workspace': getActiveId() } });
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { reject(new Error('IndexedDB is unavailable in this browser.')); return; }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open workspace database.'));
    });
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
    });
  }

  async function getRecord(id) {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      return await requestResult(tx.objectStore(STORE_NAME).get(id));
    } finally { db.close(); }
  }

  async function getAllRecords() {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      return await requestResult(tx.objectStore(STORE_NAME).getAll());
    } finally { db.close(); }
  }

  async function putRecord(record) {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const done = new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
      await requestResult(tx.objectStore(STORE_NAME).put(record));
      await done;
    } finally { db.close(); }
  }

  async function deleteRecord(id) {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const done = new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
      await requestResult(tx.objectStore(STORE_NAME).delete(id));
      await done;
    } finally { db.close(); }
  }

  function normalizePack(input) {
    const pack = safeClone(input || {});
    pack.schemaVersion = pack.schemaVersion || PACK_SCHEMA_VERSION;
    pack.manifest = pack.manifest || {};
    pack.manifest.id = String(pack.manifest.id || '').trim();
    pack.manifest.title = String(pack.manifest.title || '').trim();
    pack.manifest.description = String(pack.manifest.description || '').trim();
    pack.manifest.createdAt = pack.manifest.createdAt || nowIso();
    pack.manifest.updatedAt = pack.manifest.updatedAt || pack.manifest.createdAt;
    pack.graph = pack.graph || { version: 2, nodes: [], edges: [] };
    pack.graph.version = pack.graph.version || 2;
    pack.graph.meta = pack.graph.meta || { id: pack.manifest.id, title: pack.manifest.title, description: pack.manifest.description };
    pack.graph.masteryScale = Array.isArray(pack.graph.masteryScale) && pack.graph.masteryScale.length ? pack.graph.masteryScale : safeClone(DEFAULT_MASTERY_SCALE);
    pack.graph.nodes = Array.isArray(pack.graph.nodes) ? pack.graph.nodes : [];
    pack.graph.edges = Array.isArray(pack.graph.edges) ? pack.graph.edges : [];
    pack.overlay = pack.overlay && typeof pack.overlay === 'object' ? pack.overlay : safeClone(DEFAULT_OVERLAY);
    pack.overlay.assessments = Array.isArray(pack.overlay.assessments) ? pack.overlay.assessments : [];
    if (Array.isArray(pack.profiles)) pack.profiles = pack.profiles;
    else if (pack.profile) pack.profiles = [pack.profile];
    else pack.profiles = [];
    pack.views = pack.views || { defaultMode: 'library', defaultDepth: 3 };
    pack.inbox = Array.isArray(pack.inbox) ? pack.inbox : [];
    return pack;
  }

  function validatePack(input) {
    const pack = normalizePack(input);
    const errors = [];
    const warnings = [];
    if (pack.schemaVersion !== PACK_SCHEMA_VERSION) errors.push(`Unsupported schemaVersion: ${pack.schemaVersion || '(missing)'}. Expected ${PACK_SCHEMA_VERSION}.`);
    if (!pack.manifest.id) errors.push('manifest.id is required.');
    if (!/^[a-z0-9][a-z0-9._-]{1,79}$/i.test(pack.manifest.id || '')) errors.push('manifest.id must use letters, numbers, dot, underscore or dash (2-80 chars).');
    if (pack.manifest.id === BUILTIN_ID) errors.push(`manifest.id "${BUILTIN_ID}" is reserved for the built-in pack.`);
    if (!pack.manifest.title) errors.push('manifest.title is required.');
    if (pack.graph.version !== 2) errors.push('graph.version must be 2.');

    const ids = new Set();
    const parentByChild = new Map();
    for (const [index, node] of pack.graph.nodes.entries()) {
      if (!node || typeof node !== 'object') { errors.push(`graph.nodes[${index}] must be an object.`); continue; }
      if (!node.id) errors.push(`graph.nodes[${index}].id is required.`);
      else if (ids.has(node.id)) errors.push(`Duplicate node id: ${node.id}.`);
      else ids.add(node.id);
      if (!ALLOWED_KINDS.has(node.kind)) errors.push(`Unsupported node kind at ${node.id || index}: ${node.kind}.`);
      if (!String(node.title || '').trim()) errors.push(`Node title is required: ${node.id || index}.`);
      if ('status' in node || 'mastery' in node || 'level' in node) errors.push(`Canonical node contains learner state: ${node.id || index}.`);
    }

    for (const [index, edge] of pack.graph.edges.entries()) {
      if (!edge || typeof edge !== 'object') { errors.push(`graph.edges[${index}] must be an object.`); continue; }
      if (!ALLOWED_RELATIONS.has(edge.kind)) errors.push(`Unsupported relation at edge ${index}: ${edge.kind}.`);
      if (!ids.has(edge.source)) errors.push(`Edge ${index} source does not exist: ${edge.source}.`);
      if (!ids.has(edge.target)) errors.push(`Edge ${index} target does not exist: ${edge.target}.`);
      if (edge.source === edge.target) errors.push(`Self-referencing edge is not allowed: ${edge.source}.`);
      if (edge.kind === 'contains' && ids.has(edge.target)) {
        if (parentByChild.has(edge.target) && parentByChild.get(edge.target) !== edge.source) errors.push(`Node has multiple contains parents: ${edge.target}.`);
        parentByChild.set(edge.target, edge.source);
      }
    }

    const visiting = new Set();
    const visited = new Set();
    const checkCycle = (id) => {
      if (visited.has(id)) return;
      if (visiting.has(id)) { errors.push(`Cycle in contains hierarchy at ${id}.`); return; }
      visiting.add(id);
      const parent = parentByChild.get(id);
      if (parent) checkCycle(parent);
      visiting.delete(id); visited.add(id);
    };
    ids.forEach(checkCycle);

    for (const item of pack.overlay.assessments) {
      if (!ids.has(item.nodeId)) errors.push(`Overlay references missing node: ${item.nodeId}.`);
      if (!Number.isInteger(item.mastery) || item.mastery < 0 || item.mastery > 6) errors.push(`Overlay mastery must be 0-6: ${item.nodeId}.`);
    }
    for (const profile of pack.profiles) {
      if (!Array.isArray(profile.levels)) { warnings.push(`Profile ${profile.id || '(unnamed)'} has no levels and will be ignored.`); continue; }
      for (const level of profile.levels) for (const requirement of level.requirements || []) {
        if (!ids.has(requirement.nodeId)) errors.push(`Profile requirement references missing node: ${requirement.nodeId}.`);
      }
    }

    const domains = pack.graph.nodes.filter((node) => node.kind === 'domain').length;
    const artifacts = pack.graph.nodes.filter((node) => node.kind === 'artifact').length;
    if (!domains && pack.graph.nodes.length) warnings.push('No domain root found. The canvas can open, but hierarchy navigation may be less useful.');
    if (!pack.profiles.length) warnings.push('No career profile included. Career Lens will use the General Explorer fallback.');

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats: { nodes: pack.graph.nodes.length, edges: pack.graph.edges.length, domains, artifacts, profiles: pack.profiles.length, assessments: pack.overlay.assessments.length },
      pack
    };
  }

  async function savePack(input) {
    const result = validatePack(input);
    if (!result.valid) { const error = new Error(result.errors.join('\n')); error.validation = result; throw error; }
    const pack = result.pack;
    pack.manifest.updatedAt = nowIso();
    await putRecord({ id: pack.manifest.id, manifest: safeClone(pack.manifest), pack: safeClone(pack), updatedAt: pack.manifest.updatedAt });
    return pack;
  }

  async function getPack(id) {
    if (id === BUILTIN_ID) return getBuiltinPack();
    const record = await getRecord(id);
    return record?.pack ? normalizePack(record.pack) : null;
  }

  async function listWorkspaces() {
    let records = [];
    try { records = await getAllRecords(); } catch (error) { console.warn('Workspace database unavailable:', error); }
    return [BUILTIN_MANIFEST, ...records.map((record) => ({ ...record.manifest, builtin: false }))];
  }

  async function deleteWorkspace(id) {
    if (!id || id === BUILTIN_ID) throw new Error('The built-in workspace cannot be deleted.');
    await deleteRecord(id);
    localStorage.removeItem(inboxKey(id));
    if (getActiveId() === id) setActiveId(BUILTIN_ID);
  }

  async function renameWorkspace(id, title) {
    if (id === BUILTIN_ID) throw new Error('The built-in workspace cannot be renamed.');
    const pack = await getPack(id);
    if (!pack) throw new Error(`Workspace not found: ${id}`);
    pack.manifest.title = String(title || '').trim();
    if (!pack.manifest.title) throw new Error('Workspace title is required.');
    pack.graph.meta = { ...(pack.graph.meta || {}), title: pack.manifest.title };
    return savePack(pack);
  }

  function getActiveId() { return localStorage.getItem(ACTIVE_KEY) || BUILTIN_ID; }
  function setActiveId(id) { localStorage.setItem(ACTIVE_KEY, id || BUILTIN_ID); }
  function inboxKey(id = getActiveId()) { return id === BUILTIN_ID ? 'knowledge-graph:inbox:v1' : `knowledge-graph:inbox:v1:${id}`; }

  async function getBuiltinPack() {
    const [graphResponse, overlayResponse, profileResponse] = await Promise.all([
      nativeFetch('./data/graph.json', { cache: 'no-store' }),
      nativeFetch('./data/overlays/huy.public.json', { cache: 'no-store' }),
      nativeFetch('./data/profiles/backend-engineer.json', { cache: 'no-store' })
    ]);
    if (!graphResponse.ok) throw new Error('Built-in graph data is unavailable.');
    const graph = await graphResponse.json();
    const overlay = overlayResponse.ok ? await overlayResponse.json() : safeClone(DEFAULT_OVERLAY);
    const profile = profileResponse.ok ? await profileResponse.json() : safeClone(DEFAULT_PROFILE);
    let inbox = [];
    try { inbox = JSON.parse(localStorage.getItem(inboxKey(BUILTIN_ID)) || '[]'); } catch {}
    return normalizePack({
      schemaVersion: PACK_SCHEMA_VERSION,
      manifest: { ...BUILTIN_MANIFEST, createdAt: '2026-08-06T00:00:00Z', updatedAt: nowIso() },
      graph,
      overlay,
      profiles: [profile],
      views: { defaultMode: 'library', defaultDepth: 3 },
      inbox
    });
  }

  async function exportActivePack() {
    const id = getActiveId();
    const pack = await getPack(id);
    if (!pack) throw new Error(`Active workspace not found: ${id}`);
    try { pack.inbox = JSON.parse(localStorage.getItem(inboxKey(id)) || '[]'); } catch { pack.inbox = []; }
    pack.manifest.updatedAt = nowIso();
    delete pack.manifest.builtin;
    if (id === BUILTIN_ID) pack.manifest.id = 'fullstack-engineering';
    return pack;
  }

  async function activateImportedPack(pack) {
    const saved = await savePack(pack);
    if (saved.inbox?.length) localStorage.setItem(inboxKey(saved.manifest.id), JSON.stringify(saved.inbox));
    setActiveId(saved.manifest.id);
    return saved;
  }

  function pathKind(url) {
    let pathname = '';
    try { pathname = new URL(typeof url === 'string' ? url : url.url, location.href).pathname; } catch { return null; }
    if (pathname.endsWith('/data/graph.json')) return 'graph';
    if (pathname.endsWith('/data/overlays/huy.public.json')) return 'overlay';
    if (pathname.endsWith('/data/profiles/backend-engineer.json')) return 'profile';
    return null;
  }

  // Keep legacy modules workspace-aware without rewriting their storage code.
  // Only the existing Knowledge Inbox key is virtualized; all other localStorage keys stay untouched.
  const nativeStorageGet = Storage.prototype.getItem;
  const nativeStorageSet = Storage.prototype.setItem;
  const nativeStorageRemove = Storage.prototype.removeItem;
  function virtualizeInboxStorageKey(storage, key) {
    if (storage !== localStorage || key !== 'knowledge-graph:inbox:v1') return key;
    const activeId = nativeStorageGet.call(localStorage, ACTIVE_KEY) || BUILTIN_ID;
    return activeId === BUILTIN_ID ? key : `knowledge-graph:inbox:v1:${activeId}`;
  }
  Storage.prototype.getItem = function (key) { return nativeStorageGet.call(this, virtualizeInboxStorageKey(this, key)); };
  Storage.prototype.setItem = function (key, value) { return nativeStorageSet.call(this, virtualizeInboxStorageKey(this, key), value); };
  Storage.prototype.removeItem = function (key) { return nativeStorageRemove.call(this, virtualizeInboxStorageKey(this, key)); };

  window.fetch = async function workspaceFetch(input, init) {
    const kind = pathKind(input);
    const activeId = getActiveId();
    if (!kind || activeId === BUILTIN_ID) return nativeFetch(input, init);
    try {
      const pack = await getPack(activeId);
      if (!pack) {
        console.warn(`Active workspace ${activeId} no longer exists; falling back to built-in.`);
        setActiveId(BUILTIN_ID);
        return nativeFetch(input, init);
      }
      if (kind === 'graph') return responseJson(pack.graph);
      if (kind === 'overlay') return responseJson(pack.overlay || DEFAULT_OVERLAY);
      if (kind === 'profile') return responseJson(pack.profiles?.[0] || DEFAULT_PROFILE);
    } catch (error) {
      console.warn('Workspace virtual fetch failed; falling back to built-in.', error);
      setActiveId(BUILTIN_ID);
      return nativeFetch(input, init);
    }
    return nativeFetch(input, init);
  };

  window.KGWorkspace = Object.freeze({
    PACK_SCHEMA_VERSION,
    BUILTIN_ID,
    DEFAULT_PROFILE: safeClone(DEFAULT_PROFILE),
    validatePack,
    normalizePack,
    savePack,
    getPack,
    getBuiltinPack,
    exportActivePack,
    activateImportedPack,
    listWorkspaces,
    deleteWorkspace,
    renameWorkspace,
    getActiveId,
    setActiveId,
    inboxKey,
    nativeFetch
  });
})();
