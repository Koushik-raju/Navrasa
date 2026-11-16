// Fruit colour palette (no Three.js dependency, so the shop works even if 3D can't load).
export const FRUIT_COLORS = {
  banana: '#ffe066', strawberry: '#e3262f', blueberry: '#3b4a9c', kiwi: '#7fbf2a', mango: '#ffb627', apple: '#d7263d',
  orange: '#ff8a1c', grapes: '#7b2e8a', pomegranate: '#c0102c', pineapple: '#f6d743', watermelon: '#f2455a',
};
export function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch { return false; }
}
