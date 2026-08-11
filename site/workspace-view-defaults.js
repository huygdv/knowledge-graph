const W = window.KGWorkspace;

const MODE_ORDER = ['library', 'career', 'growth', 'evidence'];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check, timeout = 6000) {
  const started = performance.now();
  while (performance.now() - started < timeout) {
    try {
      const value = check();
      if (value) return value;
    } catch {}
    await sleep(30);
  }
  return null;
}

async function applyWorkspaceDefaults() {
  if (!W) return;
  try {
    const pack = await W.getPack(W.getActiveId());
    if (!pack) return;

    const ready = await waitFor(() => {
      const depth = document.querySelector('#depth-input');
      const levels = document.querySelector('#career-level');
      const modes = document.querySelectorAll('#view-modes .nav-item');
      return depth && levels?.options?.length && modes.length === MODE_ORDER.length ? { depth, levels, modes } : null;
    });
    if (!ready) return;

    // Core state historically defaulted to the built-in "senior" key. Replaying the
    // actual selected option makes arbitrary pack profiles safe before Career Lens opens.
    ready.levels.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(0);

    const defaultDepth = Number(pack.views?.defaultDepth);
    if (Number.isFinite(defaultDepth)) {
      const depth = document.querySelector('#depth-input');
      const min = Number(depth.min || 1);
      const max = Number(depth.max || 6);
      depth.value = String(Math.max(min, Math.min(max, Math.round(defaultDepth))));
      depth.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(0);
    }

    const defaultMode = String(pack.views?.defaultMode || 'library');
    const modeIndex = MODE_ORDER.indexOf(defaultMode);
    if (modeIndex > 0) {
      const buttons = document.querySelectorAll('#view-modes .nav-item');
      buttons[modeIndex]?.click();
    }

    document.dispatchEvent(new CustomEvent('kg:workspace-defaults-applied', {
      detail: { workspaceId: pack.manifest.id, defaultDepth, defaultMode }
    }));
  } catch (error) {
    console.warn('Could not apply workspace view defaults:', error);
  }
}

applyWorkspaceDefaults();
