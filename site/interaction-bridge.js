// Capture the core app's pointer handlers before app.js registers them.
// This lets the interaction layer reuse the canonical pan/drag state instead
// of maintaining a second transform state that can drift out of sync.
(() => {
  const registry = { pointermove: [], pointerup: [], pointercancel: [] };
  const originalAdd = window.addEventListener.bind(window);
  window.__kgPointerBridge = registry;
  window.addEventListener = function patchedAddEventListener(type, listener, options) {
    if (type in registry && typeof listener === 'function') registry[type].push(listener);
    return originalAdd(type, listener, options);
  };
})();
