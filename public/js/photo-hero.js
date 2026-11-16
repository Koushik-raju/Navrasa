// Photographic 3D hero: the real product photo, wrapped onto a surface shaped like the cup
// (from a depth map), so it turns and tilts in 3D while keeping full photo quality.
import * as THREE from 'three';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initPhotoHero(canvas, { image = '/img/hero-cup.webp', depth = '/img/hero-depth.png', aspect = 1.5, depthScale = 0.72 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);

  const loader = new THREE.TextureLoader();
  const photo = loader.load(image, () => { ready = true; });
  photo.colorSpace = THREE.SRGBColorSpace; photo.anisotropy = 8;
  const depthTex = loader.load(depth);
  let ready = false;

  const W = 3, H = W / aspect;
  const geo = new THREE.PlaneGeometry(W, H, 360, 240);
  // unlit: black base colour + photo as emissive keeps the photo's exact colours; map supplies alpha
  const mat = new THREE.MeshStandardMaterial({
    color: 0x000000, map: photo, emissive: 0xffffff, emissiveMap: photo, roughness: 1, metalness: 0,
    transparent: true, alphaTest: 0.02, displacementMap: depthTex, displacementScale: W * depthScale * 0.5, toneMapped: false,
  });
  const cup = new THREE.Mesh(geo, mat);
  const pivot = new THREE.Group(); pivot.add(cup); scene.add(pivot);

  // interaction: drag to turn (springs back), pointer tilt, gentle idle sway
  const st = { drag: false, lastX: 0, lastY: 0, ox: 0, oy: 0, tx: 0, ty: 0 };
  canvas.addEventListener('pointerdown', e => { st.drag = true; st.lastX = e.clientX; st.lastY = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    st.tx = (e.clientX - r.left) / r.width - 0.5; st.ty = (e.clientY - r.top) / r.height - 0.5;
    if (!st.drag) return;
    st.oy = THREE.MathUtils.clamp(st.oy + (e.clientX - st.lastX) * 0.004, -0.55, 0.55);
    st.ox = THREE.MathUtils.clamp(st.ox + (e.clientY - st.lastY) * 0.003, -0.25, 0.25);
    st.lastX = e.clientX; st.lastY = e.clientY;
  });
  const up = () => { st.drag = false; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => { st.tx = 0; st.ty = 0; });

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    // fit the photo plane with a little breathing room
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const d = Math.max((W * 0.5) / (t * camera.aspect), (H * 0.5) / t) * 1.08;
    camera.position.set(0, 0, d + W * depthScale * 0.25); camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas); resize();

  let onScreen = false, looping = false, t = 0;
  const clock = new THREE.Clock();
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen && !looping) { looping = true; clock.getDelta(); loop(); } }, { rootMargin: '100px' }).observe(canvas);
  function loop() {
    if (!onScreen) { looping = false; return; }
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05); t += dt;
    if (!st.drag) { st.oy *= 1 - Math.min(1, dt * 1.5); st.ox *= 1 - Math.min(1, dt * 1.5); }
    const sway = reduceMotion ? 0 : Math.sin(t * 0.5) * 0.22;
    const ry = st.oy + sway + st.tx * 0.25, rx = st.ox + st.ty * 0.12 + (reduceMotion ? 0 : Math.sin(t * 0.37) * 0.03);
    pivot.rotation.y = THREE.MathUtils.lerp(pivot.rotation.y, ry, 0.08);
    pivot.rotation.x = THREE.MathUtils.lerp(pivot.rotation.x, rx, 0.08);
    pivot.position.y = reduceMotion ? 0 : Math.sin(t * 0.9) * 0.02;
    if (ready) renderer.render(scene, camera);
  }
  return { setAngle: a => { st.oy = a; } };
}
