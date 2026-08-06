const STORAGE_KEY = 'knowledge-graph:canvas-background';
const DEFAULT_BACKGROUND = 'plain';
const MAX_COMFORTABLE_ZOOM = 1.45;

const backgroundOptions = [
  ['plain', 'Plain'],
  ['grid', 'Soft Grid'],
  ['dots', 'Dots'],
  ['slate', 'Slate']
];

function applyBackground(value) {
  const selected = backgroundOptions.some(([key]) => key === value) ? value : DEFAULT_BACKGROUND;
  document.body.dataset.canvasBackground = selected;
  localStorage.setItem(STORAGE_KEY, selected);
}

function installBackgroundControl() {
  const toolbar = document.querySelector('.toolbar');
  const stats = document.querySelector('.toolbar__stats');
  if (!toolbar || !stats || document.querySelector('#canvas-background')) return;

  const label = document.createElement('label');
  label.className = 'canvas-style-control';
  label.htmlFor = 'canvas-background';
  label.innerHTML = '<span>Canvas</span>';

  const select = document.createElement('select');
  select.id = 'canvas-background';
  select.className = 'canvas-style-select';
  select.setAttribute('aria-label', 'Canvas background');

  for (const [value, text] of backgroundOptions) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    select.append(option);
  }

  const initial = localStorage.getItem(STORAGE_KEY) || DEFAULT_BACKGROUND;
  select.value = backgroundOptions.some(([value]) => value === initial) ? initial : DEFAULT_BACKGROUND;
  select.addEventListener('change', () => applyBackground(select.value));
  label.append(select);
  toolbar.insertBefore(label, stats);
  applyBackground(select.value);
}

function currentScale() {
  const transform = document.querySelector('#scene')?.style.transform || '';
  const match = transform.match(/scale\(([-\d.]+)\)/);
  return match ? Number(match[1]) : 1;
}

function installZoomGuard() {
  const canvas = document.querySelector('#canvas');
  if (!canvas) return;

  canvas.addEventListener('wheel', (event) => {
    if (event.deltaY >= 0) return;
    const scale = currentScale();
    if (scale * 1.1 <= MAX_COMFORTABLE_ZOOM) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true, passive: false });

  document.addEventListener('click', (event) => {
    const zoomIn = event.target.closest('#zoom-in');
    if (!zoomIn) return;
    const scale = currentScale();
    if (scale * 1.15 <= MAX_COMFORTABLE_ZOOM) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
}

function installPixelSnapping() {
  const scene = document.querySelector('#scene');
  if (!scene) return;

  let applying = false;
  const observer = new MutationObserver(() => {
    if (applying) return;
    const transform = scene.style.transform;
    const match = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+)\)/);
    if (!match) return;

    const dpr = window.devicePixelRatio || 1;
    const snap = (value) => Math.round(Number(value) * dpr) / dpr;
    const next = `translate3d(${snap(match[1])}px, ${snap(match[2])}px, 0) scale(${match[3]})`;
    if (next === transform) return;

    applying = true;
    scene.style.transform = next;
    applying = false;
  });

  observer.observe(scene, { attributes: true, attributeFilter: ['style'] });
}

applyBackground(localStorage.getItem(STORAGE_KEY) || DEFAULT_BACKGROUND);
installBackgroundControl();
installZoomGuard();
installPixelSnapping();
