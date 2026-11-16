import { createStage, makeCup, wallFruit, makeToppings, arrangeFruits, whole, placeOnGround, LABEL, THREE, rand } from './fruits3d.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const HERO_FRUITS = ['mango', 'banana', 'strawberry', 'kiwi', 'pomegranate', 'blueberry'];
const DEFAULT_TOPPINGS = ['granola', 'chia', 'nuts'];

// drag to turn; when released the cup eases back to face the viewer (label front)
function spinControl(canvas) {
  const st = { offset: 0, vel: 0, dragging: false, lastX: 0, tiltY: 0 };
  canvas.addEventListener('pointerdown', e => { st.dragging = true; st.lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect(); st.tiltY = (e.clientY - r.top) / r.height - 0.5;
    if (!st.dragging) return;
    const dx = e.clientX - st.lastX; st.lastX = e.clientX; st.vel = dx * 0.008; st.offset += st.vel;
  });
  const up = () => { st.dragging = false; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => { st.tiltY = 0; });
  st.update = (dt, sway) => {
    if (!st.dragging) {
      st.offset += st.vel; st.vel *= 0.93;
      const home = Math.round(st.offset / (Math.PI * 2)) * Math.PI * 2; // nearest "label facing" angle
      st.offset += (home - st.offset) * Math.min(1, dt * 0.8);
    }
    return st.offset + sway;
  };
  return st;
}
function visible(el, cb) { new IntersectionObserver(([e]) => cb(e.isIntersecting), { rootMargin: '100px' }).observe(el); }
function stepDrop(it, dt, g = 15) {
  const p = it.group.position;
  if ((it.delay -= dt) > 0) return false;
  it.vy -= g * dt; p.y += it.vy * dt;
  p.x = THREE.MathUtils.lerp(p.x, it.target.x, 0.25); p.z = THREE.MathUtils.lerp(p.z, it.target.z, 0.25);
  if (p.y <= it.target.y) { p.y = it.target.y; if (Math.abs(it.vy) > 1.2) it.vy = -it.vy * 0.28; else { it.vy = 0; return true; } }
  return false;
}
// fit a box of half-width w and height h (centred on target) into the camera
function fitCamera(camera, w, h, ty, elev) {
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const d = Math.max(w / (t * camera.aspect), (h / 2) / t) * 1.08;
  camera.position.set(0, ty + d * elev, d); camera.lookAt(0, ty, 0);
}

// ---------------- HERO ----------------
export function initHero(canvas) {
  const { renderer, scene, camera } = createStage(canvas, { fov: 30 });
  const root = new THREE.Group(); scene.add(root);
  root.add(makeCup({ fruits: HERO_FRUITS }));
  const fill = arrangeFruits(HERO_FRUITS, 'cup');
  fill.forEach((f, i) => {
    root.add(f.group);
    if (reduceMotion) { f.group.position.copy(f.target); f.done = true; }
    else { f.group.position.copy(f.target).add(new THREE.Vector3(0, 3 + rand(0, 0.6), 0)); f.vy = 0; f.delay = 0.1 + i * 0.02; f.done = false; }
  });
  const tops = makeToppings(fill, DEFAULT_TOPPINGS); root.add(tops); tops.visible = reduceMotion;

  // a few loose pieces on the table, product-shot style
  const props = [];
  const add = (obj, x, z, ry = 0, extra) => { obj.rotation.y = ry; if (extra) extra(obj); obj.position.set(x, 0, z); placeOnGround(obj); scene.add(obj); props.push(obj); return obj; };
  add(whole.strawberry(), 1.2, 0.95, 0.9, o => { o.scale.setScalar(1.3); o.rotation.x = Math.PI / 2 - 0.15; });
  add(whole.kiwiHalf(), -1.22, 0.85, 0.6, o => o.scale.setScalar(1.15));
  for (const [x, z] of [[-0.85, 1.25], [-0.65, 1.4], [-1.02, 1.42], [0.75, 1.45]]) add(whole.blueberry(), x, z, rand(0, 6), o => { o.scale.setScalar(1.3); o.rotation.x = rand(-1, 1); });

  let lastAspect = 0;
  const ctrl = spinControl(canvas), clock = new THREE.Clock();
  let onScreen = false, looping = false, t = 0;
  visible(canvas, v => { onScreen = v; if (v && !looping) { looping = true; clock.getDelta(); loop(); } });
  function loop() {
    if (!onScreen) { looping = false; return; }
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05); t += dt;
    if (camera.aspect !== lastAspect) { lastAspect = camera.aspect; fitCamera(camera, 1.62, 2.55, 1.08, 0.3); }
    root.rotation.y = ctrl.update(dt, reduceMotion ? 0 : Math.sin(t * 0.35) * 0.45);
    root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, ctrl.tiltY * 0.08, 0.06);
    let settled = true;
    for (const f of fill) if (!f.done) { f.done = stepDrop(f, dt); settled = false; }
    if (settled && !tops.visible) { tops.visible = true; tops.scale.setScalar(0.001); }
    if (tops.visible && tops.scale.x < 1) tops.scale.setScalar(Math.min(1, tops.scale.x + dt * 3));
    renderer.render(scene, camera);
  }
}

// ---------------- BUILDER ----------------
export function initBuilder(canvas) {
  const { renderer, scene, camera } = createStage(canvas, { fov: 30 });
  const cupGroup = new THREE.Group(); scene.add(cupGroup);
  cupGroup.add(makeCup({ wall: false }));
  let wall = null, tops = null, items = [], toppingIds = [], topsDirty = false, lastAspect = 0;
  const ctrl = spinControl(canvas);

  function rebuildTops() {
    if (tops) { cupGroup.remove(tops); tops = null; }
    const live = items.filter(i => i.state !== 'out');
    if (!live.length) return;
    tops = makeToppings(live, toppingIds, { garnish: true }); tops.scale.setScalar(0.001); cupGroup.add(tops);
  }
  function setBowl(ids, toppings = []) {
    toppingIds = toppings;
    if (wall) cupGroup.remove(wall);
    wall = ids.length ? wallFruit(ids) : null; if (wall) cupGroup.add(wall);
    const next = arrangeFruits(ids, 'cup');
    const oldBy = {}, newBy = {}, result = [];
    items.filter(i => i.state !== 'out').forEach(i => (oldBy[i.fruit] ||= []).push(i));
    next.forEach(n => (newBy[n.fruit] ||= []).push(n));
    for (const [fruit, list] of Object.entries(newBy)) {
      const old = oldBy[fruit] || [];
      list.forEach((n, k) => {
        if (old[k]) { old[k].target = n.target; if (old[k].state !== 'drop') { old[k].state = 'move'; old[k].toQuat = n.group.quaternion.clone(); } result.push(old[k]); }
        else { n.group.position.copy(n.target).add(new THREE.Vector3(0, rand(2.2, 3.2), 0)); Object.assign(n, { vy: 0, state: 'drop', delay: k * 0.05 }); cupGroup.add(n.group); result.push(n); }
      });
      old.slice(list.length).forEach(o => { o.state = 'out'; result.push(o); });
    }
    for (const [fruit, old] of Object.entries(oldBy)) if (!newBy[fruit]) old.forEach(o => { o.state = 'out'; result.push(o); });
    items.filter(i => i.state === 'out' && !result.includes(i)).forEach(i => result.push(i));
    items = result;
    if (tops) { cupGroup.remove(tops); tops = null; }
    topsDirty = true;
    wake();
  }

  let running = false, onScreen = false;
  const clock = new THREE.Clock();
  visible(canvas, v => { onScreen = v; if (v) wake(); });
  function wake() { if (!running && onScreen) { running = true; clock.getDelta(); loop(); } }
  function loop() {
    if (!onScreen) { running = false; return; }
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (camera.aspect !== lastAspect) { lastAspect = camera.aspect; fitCamera(camera, 1.55, 2.3, 1.1, 0.5); }
    cupGroup.rotation.y = ctrl.update(dt, 0) + (reduceMotion ? 0 : clock.elapsedTime * 0.15);
    let busy = false;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.state === 'drop') { busy = true; if (stepDrop(it, dt, 16)) it.state = 'rest'; }
      else if (it.state === 'move') {
        busy = true;
        it.group.position.lerp(it.target, 0.15); if (it.toQuat) it.group.quaternion.slerp(it.toQuat, 0.15);
        if (it.group.position.distanceTo(it.target) < 0.003) it.state = 'rest';
      } else if (it.state === 'out') {
        const s = it.group.scale.x * 0.82; it.group.scale.setScalar(s); it.group.position.y += dt * 1.2;
        if (s < 0.02) { cupGroup.remove(it.group); items.splice(i, 1); }
      }
    }
    if (!busy && topsDirty) { topsDirty = false; rebuildTops(); }
    if (tops && tops.scale.x < 1) tops.scale.setScalar(Math.min(1, tops.scale.x + dt * 3));
    renderer.render(scene, camera);
  }
  return { setBowl, setFruits: ids => setBowl(ids, toppingIds) };
}

// ---------------- MENU THUMBNAILS ----------------
export async function renderThumbnails(bowls, w = 560, h = 400) {
  await LABEL.ready;
  const canvas = document.createElement('canvas');
  const { renderer, scene, camera } = createStage(canvas, { size: [w, h], fov: 28 });
  fitCamera(camera, 1.42, 2.75, 1.12, 0.34);
  const out = {};
  for (const b of bowls) {
    const g = new THREE.Group();
    g.add(makeCup({ fruits: b.fruits }));
    const fill = arrangeFruits(b.fruits, 'cup');
    fill.forEach(f => { f.group.position.copy(f.target); g.add(f.group); });
    g.add(makeToppings(fill, DEFAULT_TOPPINGS.slice(0, 2)));
    g.rotation.y = rand(-0.25, 0.25);
    scene.add(g);
    renderer.render(scene, camera);
    out[b.id] = canvas.toDataURL('image/webp', 0.9);
    scene.remove(g);
    await new Promise(r => setTimeout(r, 0));
  }
  renderer.dispose(); renderer.forceContextLoss();
  return out;
}
