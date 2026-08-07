const shell = {
  body: document.body,
  toolbar: document.querySelector('.toolbar'),
  toolbarLeft: document.querySelector('.toolbar__left'),
  workspace: document.querySelector('.workspace'),
  canvas: document.querySelector('#canvas'),
  inspector: document.querySelector('#inspector'),
  sidebar: document.querySelector('.sidebar')
};

function makeButton(className, label, icon, title = label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `toolbar-action ${className}`;
  button.title = title;
  button.setAttribute('aria-label', title);
  button.innerHTML = `<span aria-hidden="true">${icon}</span><span class="toolbar-action__label">${label}</span>`;
  return button;
}

function installToolbarActions() {
  if (!shell.toolbar || document.querySelector('.toolbar-actions')) return;
  const actions = document.createElement('div');
  actions.className = 'toolbar-actions';

  const menu = makeButton('mobile-menu-button', 'Menu', '☰', 'Mở menu');
  menu.setAttribute('aria-expanded', 'false');
  menu.onclick = () => {
    const open = !document.body.classList.contains('sidebar-open');
    document.body.classList.toggle('sidebar-open', open);
    menu.setAttribute('aria-expanded', String(open));
  };

  const docs = document.createElement('a');
  docs.className = 'toolbar-action docs-link';
  docs.href = './system-design-overview/';
  docs.title = 'System design overview';
  docs.innerHTML = '<span aria-hidden="true">⌘</span><span class="toolbar-action__label">System</span>';

  const capture = makeButton('capture-launch-button', 'Capture', '+', 'Quick Capture');
  capture.dataset.openCapture = 'true';

  actions.append(menu, docs, capture);
  const styleControl = document.querySelector('.canvas-style-control');
  shell.toolbar.insertBefore(actions, styleControl || document.querySelector('.toolbar__stats'));
}

function installSidebarProjectLinks() {
  if (!shell.sidebar || shell.sidebar.querySelector('.project-links')) return;
  const section = document.createElement('section');
  section.className = 'sidebar-section project-links-section';
  section.innerHTML = `
    <h2>Project</h2>
    <nav class="project-links" aria-label="Project documentation">
      <a class="project-link" href="./system-design-overview/"><span>System design</span><small>↗</small></a>
      <a class="project-link" href="./changelog/"><span>Changelog</span><small>↗</small></a>
      <button class="nav-item" type="button" data-open-capture="true"><span>Knowledge Inbox</span><small id="inbox-sidebar-count">0</small></button>
    </nav>`;
  const reset = shell.sidebar.querySelector('#reset-view');
  shell.sidebar.insertBefore(section, reset || null);
}

function installBackdrop() {
  if (document.querySelector('.sidebar-backdrop')) return;
  const backdrop = document.createElement('button');
  backdrop.type = 'button';
  backdrop.className = 'sidebar-backdrop';
  backdrop.ariaLabel = 'Đóng menu';
  backdrop.onclick = closeSidebar;
  document.body.append(backdrop);
}

function closeSidebar() {
  document.body.classList.remove('sidebar-open');
  document.querySelector('.mobile-menu-button')?.setAttribute('aria-expanded', 'false');
}

function installFullscreen() {
  const controls = document.querySelector('.canvas-controls');
  if (!controls || controls.querySelector('.canvas-fullscreen-button')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'toggle-fullscreen';
  button.className = 'canvas-fullscreen-button';
  button.title = 'Fullscreen canvas';
  button.ariaLabel = 'Fullscreen canvas';
  button.textContent = '⛶';
  controls.append(button);

  const sync = () => {
    const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement || document.body.classList.contains('canvas-fullscreen-fallback'));
    button.textContent = active ? '⤢' : '⛶';
    button.title = active ? 'Thoát fullscreen' : 'Fullscreen canvas';
    document.body.classList.toggle('canvas-is-fullscreen', active);
  };

  button.onclick = async () => {
    const nativeActive = document.fullscreenElement || document.webkitFullscreenElement;
    if (nativeActive) {
      await (document.exitFullscreen?.() || document.webkitExitFullscreen?.());
      return;
    }
    if (document.body.classList.contains('canvas-fullscreen-fallback')) {
      document.body.classList.remove('canvas-fullscreen-fallback');
      sync();
      return;
    }
    try {
      const request = shell.workspace?.requestFullscreen || shell.workspace?.webkitRequestFullscreen;
      if (!request) throw new Error('Fullscreen API unavailable');
      await request.call(shell.workspace);
    } catch {
      document.body.classList.add('canvas-fullscreen-fallback');
    }
    sync();
  };
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
}

function installInspectorSheet() {
  if (!shell.inspector) return;
  const observer = new MutationObserver(() => {
    const empty = Boolean(shell.inspector.querySelector('.inspector-empty'));
    const meaningful = shell.inspector.textContent.trim().length > 0 && !empty;
    document.body.classList.toggle('inspector-open', meaningful);
    if (meaningful && !shell.inspector.querySelector('.mobile-inspector-handle')) {
      const handle = document.createElement('div');
      handle.className = 'mobile-inspector-handle';
      handle.ariaHidden = 'true';
      shell.inspector.prepend(handle);
    }
  });
  observer.observe(shell.inspector, { childList: true, subtree: true });

  shell.inspector.addEventListener('click', (event) => {
    if (event.target.closest('.inspector__close')) document.body.classList.remove('inspector-open');
  });
}

function installResponsiveBehavior() {
  document.addEventListener('click', (event) => {
    if (event.target.closest('.sidebar .nav-item, .sidebar a')) {
      if (matchMedia('(max-width: 840px)').matches) closeSidebar();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (document.body.classList.contains('sidebar-open')) closeSidebar();
    if (document.body.classList.contains('canvas-fullscreen-fallback')) {
      document.body.classList.remove('canvas-fullscreen-fallback');
      document.body.classList.remove('canvas-is-fullscreen');
    }
  });
  window.addEventListener('resize', () => {
    if (!matchMedia('(max-width: 840px)').matches) closeSidebar();
  });
}

installToolbarActions();
installSidebarProjectLinks();
installBackdrop();
installFullscreen();
installInspectorSheet();
installResponsiveBehavior();
