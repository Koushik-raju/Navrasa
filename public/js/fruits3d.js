// Realistic procedural fruit + bowl engine (Three.js).
// Everything is generated in the browser: sculpted geometry, procedural colour + bump textures,
// and physically-based materials (wet clearcoat, powdery sheen, translucent flesh).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
export { FRUIT_COLORS } from './colors.js';

const TAU = Math.PI * 2;
const V2 = THREE.Vector2, V3 = THREE.Vector3;
export const rand = (a, b) => a + Math.random() * (b - a);
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const setc = (o, c, k = 1) => { o[0] = c[0] * k; o[1] = c[1] * k; o[2] = c[2] * k; };

// ---------- Perlin noise ----------
const P = new Uint8Array(512);
(() => {
  const p = [...Array(256).keys()]; let s = 1337;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
})();
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
function grad(h, x, y, z) { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z; return (h & 1 ? -u : u) + (h & 2 ? -v : v); }
export function noise3(x, y, z) {
  let X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
  x -= X; y -= Y; z -= Z; X &= 255; Y &= 255; Z &= 255;
  const u = fade(x), v = fade(y), w = fade(z);
  const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
  return lerp(
    lerp(lerp(grad(P[AA], x, y, z), grad(P[BA], x - 1, y, z), u), lerp(grad(P[AB], x, y - 1, z), grad(P[BB], x - 1, y - 1, z), u), v),
    lerp(lerp(grad(P[AA + 1], x, y, z - 1), grad(P[BA + 1], x - 1, y, z - 1), u), lerp(grad(P[AB + 1], x, y - 1, z - 1), grad(P[BB + 1], x - 1, y - 1, z - 1), u), v), w);
}
function fbm(x, y, z, oct = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, z * f); a *= 0.5; f *= 2; } return s; }
// noise that wraps seamlessly around u (for spheres / lathes); fu = features around, fv = features along v
const nu = (u, v, fu, fv, oct = 1, seed = 0) => fbm(Math.cos(u * TAU) * fu / TAU + seed, Math.sin(u * TAU) * fu / TAU, v * fv + seed * 0.37, oct);

// ---------- texture painting ----------
function heightToNormal(H, w, h, strength, wrap) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  const at = (x, y) => {
    if (wrap) { x = (x + w) % w; y = (y + h) % h; } else { x = Math.min(w - 1, Math.max(0, x)); y = Math.min(h - 1, Math.max(0, y)); }
    return H[y * w + x];
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const du = (at(x + 1, y) - at(x - 1, y)) * strength, dv = -(at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(du, dv, 1), i = (y * w + x) * 4;
    d[i] = (-du / l * 0.5 + 0.5) * 255; d[i + 1] = (-dv / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// fn(u, v, out) → out[0..2] = sRGB colour 0-255, out[3] = height. v = 0 at the bottom of the texture (matches UVs).
function paint(w, h, fn, { normal = 0, wrap = false, post } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  const H = normal ? new Float32Array(w * h) : null, o = [0, 0, 0, 0];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    o[3] = 0; fn((x + 0.5) / w, 1 - (y + 0.5) / h, o);
    const i = y * w + x;
    d[i * 4] = o[0]; d[i * 4 + 1] = o[1]; d[i * 4 + 2] = o[2]; d[i * 4 + 3] = 255;
    if (H) H[i] = o[3];
  }
  g.putImageData(img, 0, 0);
  if (post) post(g, w, h, H);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  if (wrap) map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return { map, normalMap: H ? heightToNormal(H, w, h, normal, wrap) : null };
}

const cache = new Map();
const once = (k, fn) => { if (!cache.has(k)) cache.set(k, fn()); return cache.get(k); };
const phys = o => new THREE.MeshPhysicalMaterial(o);
function mesh(geo, mat) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; }
const nScale = s => new V2(s, s);

// ---------- geometry helpers ----------
function profile(pts, s = 1) { return new THREE.SplineCurve(pts.map(([r, y]) => new V2(r * s, y * s))); }
function lathe(curve, n, segs, phiStart = 0, phiLen = TAU) {
  const pts = curve.getPoints(n).map(p => new V2(Math.max(p.x, 0.0004), p.y));
  const g = new THREE.LatheGeometry(pts, segs, phiStart, phiLen);
  if (phiLen < TAU - 1e-6) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * phiLen / TAU); }
  return g;
}
// organic irregularity: radial (x,z) or full displacement by 3D noise
function wobble(geo, amp, freq, mode = 'radial', seed = rand(0, 50)) {
  const p = geo.attributes.position, v = new V3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + amp * noise3(v.x * freq + seed, v.y * freq, v.z * freq - seed);
    if (mode === 'radial') { v.x *= k; v.z *= k; } else v.multiplyScalar(k);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}
function roundedBox(r = 0.16, seg = 6) {
  const geo = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg);
  const p = geo.attributes.position, v = new V3(), c = new V3(), h = 0.5 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(THREE.MathUtils.clamp(v.x, -h, h), THREE.MathUtils.clamp(v.y, -h, h), THREE.MathUtils.clamp(v.z, -h, h));
    const d = v.clone().sub(c); if (d.lengthSq() > 0) d.setLength(r);
    p.setXYZ(i, c.x + d.x, c.y + d.y, c.z + d.z);
  }
  geo.computeVertexNormals(); return geo;
}

// =====================================================================
//  TEXTURES
// =====================================================================
const TX = {
  orangePeel: () => once('t.orangePeel', () => {
    const A = hex('#ef7a0c'), B = hex('#ff9d26'), STEM = hex('#8a8f2e');
    return paint(512, 256, (u, v, o) => {
      const low = nu(u, v, 5, 3, 3);
      const pore = nu(u, v, 300, 150, 1, 3.1), pore2 = nu(u, v, 140, 70, 1, 8.3);
      const pit = smooth(0.2, 0.5, pore) * 0.7 + smooth(0.3, 0.55, pore2) * 0.3;
      let c = mixc(A, B, clamp01(0.5 + low * 1.4));
      c = mixc(c, STEM, smooth(0.975, 1, v) * 0.7);
      setc(o, c, 1 - pit * 0.06);
      o[3] = -pit * 0.7 + low * 0.25;
    }, { normal: 1.6, wrap: true });
  }),
  orangeFace: () => once('t.orangeFace', () => {
    const PEEL = hex('#e86c06'), PITH = hex('#fbeacb'), F1 = hex('#ec7406'), F2 = hex('#ff9f1e'), MEM = hex('#ffd590');
    return paint(512, 512, (u, v, o) => {
      const x = u * 2 - 1, y = v * 2 - 1, r = Math.hypot(x, y), th = Math.atan2(y, x);
      if (r > 0.955) { setc(o, PEEL, 0.95 + 0.1 * noise3(x * 30, y * 30, 1)); o[3] = 0.6; return; }
      if (r > 0.875) { setc(o, mixc(PITH, hex('#f7d9a0'), smooth(0.9, 0.955, r))); o[3] = 0.4; return; }
      const seg = 11, a = ((th / TAU + 1) % 1) * seg, si = Math.floor(a), fa = a - si;
      const edge = Math.min(fa, 1 - fa) * (TAU / seg) * r;
      const memb = 1 - smooth(0.005, 0.02, edge), core = 1 - smooth(0.05, 0.11, r);
      const ves = 0.5 + 0.5 * noise3(fa * 9 + si * 13.1, r * 13, si * 1.7);
      const ves2 = 0.5 + 0.5 * noise3(fa * 26 + si * 7.3, r * 34, si);
      let c = mixc(F1, F2, ves * 0.7 + ves2 * 0.3);
      c = mixc(c, MEM, Math.max(memb * 0.9, core * 0.9, smooth(0.82, 0.875, r) * 0.5));
      setc(o, c); o[3] = ves * 0.5 + ves2 * 0.3 - memb * 0.6;
    }, { normal: 3 });
  }),
  appleSkin: (green) => once('t.apple' + green, () => {
    const BASE = hex(green ? '#a9cc45' : '#d7c24e'), RED = hex(green ? '#c9cf4a' : '#b0141f'), DARK = hex(green ? '#8fb83a' : '#6d0a13'), LENT = hex('#f4e6a6');
    return paint(512, 256, (u, v, o) => {
      const low = nu(u, v, 3, 2, 3), streak = nu(u, v, 45, 3, 3, 5) * 0.6;
      const blush = smooth(0.15, 0.6, 0.62 + low * 1.3 + streak * 0.35) * (1 - smooth(0.88, 1, v) * 0.6) * smooth(0, 0.12, v);
      let c = mixc(BASE, mixc(RED, DARK, clamp01(0.45 + streak * 0.9 + low * 0.8)), green ? blush * 0.35 : blush);
      const l = nu(u, v, 150, 75, 1, 9), dot = smooth(0.5, 0.68, l);
      c = mixc(c, LENT, dot * (green ? 0.35 : 0.55));
      if (v > 0.9) c = mixc(c, hex('#7d6a2a'), smooth(0.95, 1, v) * 0.5);
      setc(o, c); o[3] = low * 0.3 + dot * 0.4;
    }, { normal: 1.2, wrap: true });
  }),
  appleFlesh: () => once('t.appleFlesh', () => paint(256, 256, (u, v, o) => {
    const n = fbm(u * 6, v * 6, 2, 3);
    setc(o, mixc(hex('#efdfae'), hex('#e3cc8c'), clamp01(0.5 + n))); o[3] = noise3(u * 60, v * 60, 1) * 0.3;
  }, { normal: 1.5, wrap: true })),
  kiwiFace: () => once('t.kiwiFace', () => {
    const SKIN = hex('#5e4220'), OUT = hex('#4e9410'), MID = hex('#74b31a'), IN = hex('#a3cc3c'), CORE = hex('#f0ebbd'), SEED = hex('#1a1308');
    const seeds = [];
    for (let i = 0; i < 150; i++) { const a = rand(0, TAU), r = rand(0.27, 0.43); seeds.push([Math.cos(a) * r, Math.sin(a) * r, a]); }
    return paint(512, 512, (u, v, o) => {
      const x = u * 2 - 1, y = (v * 2 - 1) * 1.0, r = Math.hypot(x, y), th = Math.atan2(y, x);
      if (r > 0.965) { setc(o, SKIN, 0.9 + 0.2 * noise3(x * 40, y * 40, 0)); o[3] = 0.5; return; }
      const coreR = 0.22 + 0.03 * Math.cos(th * 2);
      const rays = 0.5 + 0.5 * noise3(th * 30, r * 3, 2);
      let c;
      if (r < coreR) c = mixc(CORE, hex('#e4e2a4'), noise3(x * 12, y * 12, 4) * 0.5 + 0.3);
      else {
        c = mixc(IN, MID, smooth(coreR, 0.5, r)); c = mixc(c, OUT, smooth(0.55, 0.95, r));
        c = mixc(c, mixc(c, CORE, 0.55), smooth(0.55, 0.85, rays) * (1 - smooth(coreR, 0.62, r)));
        const streak = 0.5 + 0.5 * noise3(th * 180, r * 2, 7);
        c = mixc(c, mixc(c, hex('#c8e070'), 0.4), streak * smooth(0.45, 0.9, r) * 0.6);
      }
      setc(o, c); o[3] = rays * 0.2;
    }, {
      normal: 3, post: (g, w, h, H) => {
        for (const [sx, sy, a] of seeds) {
          const px = (sx * 0.5 + 0.5) * w, py = (1 - (sy * 0.5 + 0.5)) * h;
          g.save(); g.translate(px, py); g.rotate(-a); g.fillStyle = '#1a1308';
          g.beginPath(); g.ellipse(0, 0, rand(5, 7), rand(2.2, 3), 0, 0, TAU); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(-1, -0.8, 1.6, 0.7, 0, 0, TAU); g.fill();
          g.restore();
          const cx = Math.round(px), cy = Math.round(py);
          for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const i = (cy + dy) * w + cx + dx; if (H[i] !== undefined) H[i] += Math.max(0, 1 - Math.hypot(dx, dy) / 4.5) * 0.8; }
        }
      },
    });
  }),
  kiwiSkin: () => once('t.kiwiSkin', () => paint(256, 256, (u, v, o) => {
    const n = fbm(u * 8, v * 8, 1, 4), hair = noise3(u * 120, v * 120, 3);
    setc(o, mixc(hex('#5c4120'), hex('#8a6a3c'), clamp01(0.5 + n + hair * 0.3))); o[3] = hair * 0.6 + n * 0.3;
  }, { normal: 2.5, wrap: true })),
  strawberry: (seeds) => once('t.straw', () => {
    const RED = hex('#c8101c'), BRIGHT = hex('#e8303a'), DARK = hex('#8f0711'), TOP = hex('#f0c49a');
    const w = 512, h = 512;
    return paint(w, h, (u, v, o) => {
      const n = nu(u, v, 6, 5, 3, 2);
      let c = mixc(RED, BRIGHT, clamp01(0.5 + n * 1.6));
      c = mixc(c, DARK, smooth(0.25, 0, v) * 0.4);
      c = mixc(c, TOP, smooth(0.9, 0.99, v) * 0.65);
      setc(o, c); o[3] = n * 0.4;
    }, {
      normal: 4, post: (g, W, Hh, H) => {
        for (const s of seeds) for (const du of [-1, 0, 1]) {
          const px = (s.u + du) * W, py = (1 - s.v) * Hh, rx = Math.min(9, 0.32 * W / s.n), ry = 7;
          if (px < -rx || px > W + rx) continue;
          const gr = g.createRadialGradient(px, py, 0, px, py, rx);
          gr.addColorStop(0, 'rgba(90,0,6,0.55)'); gr.addColorStop(0.6, 'rgba(120,0,10,0.25)'); gr.addColorStop(1, 'rgba(120,0,10,0)');
          g.fillStyle = gr; g.beginPath(); g.ellipse(px, py, rx, ry, 0, 0, TAU); g.fill();
          for (let dy = -ry; dy <= ry; dy++) for (let dx = -Math.ceil(rx); dx <= rx; dx++) {
            const x = Math.round(px + dx), y = Math.round(py + dy); if (x < 0 || x >= W || y < 0 || y >= Hh) continue;
            const q = 1 - Math.hypot(dx / rx, dy / ry); if (q > 0) H[y * W + x] -= q * q * 1.2;
          }
        }
      },
    });
  }),
  strawberryCut: (lookup, S, rmax) => once('t.strawCut', () => paint(256, 256, (u, v, o) => {
    const x = (u - 0.5) * 2 * rmax, y = v * S, r = lookup(y);
    const d = r > 0.001 ? clamp01(1 - Math.abs(x) / r) : 0;
    let c = mixc(hex('#c4101b'), hex('#ef5960'), smooth(0.0, 0.18, d));
    c = mixc(c, hex('#fbd4cc'), smooth(0.2, 0.7, d));
    const core = (1 - smooth(0.05, 0.16, Math.abs(x) / Math.max(r, 0.01))) * smooth(0.12, 0.3, v) * (1 - smooth(0.85, 0.95, v));
    c = mixc(c, hex('#fff3ee'), core * 0.9);
    const ang = Math.atan2(y - S * 0.62, x), streak = smooth(0.55, 0.85, 0.5 + 0.5 * noise3(ang * 7, d * 1.5, 3));
    c = mixc(c, hex('#fde2dc'), streak * smooth(0.15, 0.6, d) * 0.6);
    setc(o, c); o[3] = noise3(u * 40, v * 40, 1) * 0.3 + streak * 0.2;
  }, { normal: 2 })),
  blueberry: () => once('t.blue', () => paint(256, 128, (u, v, o) => {
    const n = nu(u, v, 6, 3, 4, 4);
    setc(o, mixc(hex('#141634'), hex('#4a5682'), clamp01(0.3 + n * 1.5) * 0.7)); o[3] = n * 0.4;
  }, { normal: 1, wrap: true })),
  grape: (green) => once('t.grape' + green, () => paint(256, 128, (u, v, o) => {
    const n = nu(u, v, 4, 3, 3, green ? 1 : 6), vein = nu(u, v, 18, 1, 1, 2);
    const c = green ? mixc(hex('#93b832'), hex('#b6d054'), clamp01(0.5 + n * 1.5)) : mixc(hex('#3e0f24'), hex('#7a2a4a'), clamp01(0.45 + n * 1.6));
    setc(o, mixc(c, green ? hex('#d5e58a') : hex('#8a4a66'), smooth(0.3, 0.5, vein) * 0.25)); o[3] = vein * 0.2;
  }, { normal: 1, wrap: true })),
  mango: () => once('t.mango', () => paint(256, 256, (u, v, o) => {
    const fib = noise3(u * 4, v * 60, 2), n = fbm(u * 4, v * 4, 5, 3);
    setc(o, mixc(hex('#e46400'), hex('#f99200'), clamp01(0.5 + n * 1.3 + fib * 0.3))); o[3] = fib * 0.6 + n * 0.3;
  }, { normal: 2.5, wrap: true })),
  pineapple: () => once('t.pine', () => paint(256, 256, (u, v, o) => {
    const fib = noise3(u * 3, v * 120, 4), fib2 = noise3(u * 9, v * 40, 2), n = fbm(u * 5, v * 3, 1, 3);
    let c = mixc(hex('#e6ad12'), hex('#f8d955'), clamp01(0.45 + fib * 0.7 + n));
    c = mixc(c, hex('#fff0a0'), smooth(0.3, 0.6, fib2) * 0.35);
    setc(o, c); o[3] = fib * 1.1 + fib2 * 0.4;
  }, { normal: 3, wrap: true })),
  watermelon: () => once('t.melon', () => paint(256, 256, (u, v, o) => {
    const cell = noise3(u * 70, v * 70, 1), n = fbm(u * 3, v * 3, 7, 3);
    const sparkle = smooth(0.35, 0.6, cell);
    setc(o, mixc(mixc(hex('#c8102c'), hex('#e83a52'), clamp01(0.5 + n * 1.4)), hex('#ff8090'), sparkle * 0.25)); o[3] = cell * 0.7;
  }, { normal: 3.5, wrap: true })),
  bananaFace: () => once('t.banFace', () => paint(256, 256, (u, v, o) => {
    const x = u * 2 - 1, y = v * 2 - 1, r = Math.hypot(x, y), th = Math.atan2(y, x);
    let c = mixc(hex('#ead07e'), hex('#d8b458'), smooth(0.6, 1, r));
    const lobe = Math.abs(Math.sin(th * 1.5)) * r;
    c = mixc(c, hex('#e9d29a'), (1 - smooth(0.0, 0.05, lobe)) * (1 - smooth(0.25, 0.4, r)) * 0.8);
    const speck = smooth(0.6, 0.75, noise3(x * 40, y * 40, 3)) * (1 - smooth(0.04, 0.08, lobe)) * (1 - smooth(0.2, 0.35, r)) * smooth(0.05, 0.1, r);
    c = mixc(c, hex('#6b4a22'), speck);
    setc(o, c); o[3] = noise3(x * 25, y * 25, 0) * 0.2 - speck * 0.4;
  }, { normal: 2 })),
  bananaSkin: () => once('t.banSkin', () => paint(512, 128, (u, v, o) => {
    // u along the banana (0 tip → 1 stem), v around
    const n = fbm(u * 6, v * 3, 3, 3), ridge = Math.abs(((v * 5) % 1) - 0.5) * 2; // 1 at ridge centre lines
    let c = mixc(hex('#f0c42a'), hex('#f8d94d'), clamp01(0.5 + n * 1.2));
    c = mixc(c, hex('#a7a93a'), smooth(0.78, 0.95, u) * 0.7);
    c = mixc(c, hex('#cfa424'), smooth(0.85, 1, ridge) * 0.35);
    const spot = smooth(0.62, 0.72, noise3(u * 60, v * 20, 8)) * smooth(0.06, 0.15, u) * (1 - smooth(0.7, 0.85, u));
    c = mixc(c, hex('#6e4a1c'), spot * 0.85);
    c = mixc(c, hex('#3b2a16'), 1 - smooth(0.015, 0.045, u));
    setc(o, c); o[3] = -smooth(0.85, 1, ridge) * 0.3 + n * 0.2;
  }, { normal: 1.5 })),
  wood: () => once('t.wood', () => {
    const E = hex('#a8683a'), L = hex('#5c2e14');
    return paint(768, 384, (u, v, o) => {
      const warp = fbm(u * 2.2, v * 1.6, 1.7, 4) * 1.6 + noise3(u * 0.7, v * 0.5, 5) * 1.2;
      const rings = v * 9 + warp, f = rings - Math.floor(rings);
      const late = smooth(0.55, 0.9, f) * (1 - smooth(0.92, 1, f)) * (0.55 + 0.45 * noise3(u * 1.3, rings * 0.5, 2));
      const pore = smooth(0.35, 0.8, noise3(u * 2.5, v * 260, 9)) * 0.5;
      const tone = fbm(u * 1.2, v * 1.5, 3.3, 3);
      setc(o, mixc(E, L, late * 0.55 + pore * 0.3 + Math.max(0, -tone) * 0.35), 1 + tone * 0.12);
      o[3] = -late * 0.4 - pore * 0.7;
    }, { normal: 1.6 });
  }),
  yogurt: () => once('t.yog', () => paint(256, 256, (u, v, o) => {
    const n = fbm(u * 5, v * 5, 4, 4); setc(o, mixc(hex('#e9dcc4'), hex('#f6efe2'), clamp01(0.5 + n))); o[3] = n;
  }, { normal: 2, wrap: true })),
  leaf: () => once('t.leaf', () => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#2f6e22'); gr.addColorStop(0.5, '#4f8f30'); gr.addColorStop(1, '#2c6420');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
    g.strokeStyle = 'rgba(200,230,150,0.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 64); g.lineTo(256, 64); g.stroke();
    g.lineWidth = 1.2;
    for (let i = 1; i < 9; i++) { const x = i * 27; g.beginPath(); g.moveTo(x, 64); g.quadraticCurveTo(x + 14, 40, x + 30, 8); g.moveTo(x, 64); g.quadraticCurveTo(x + 14, 88, x + 30, 120); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { map: t };
  }),
};

// =====================================================================
//  MATERIALS
// =====================================================================
const MAT = {
  orangePeel: () => once('m.peel', () => { const t = TX.orangePeel(); return phys({ map: t.map, normalMap: t.normalMap, normalScale: nScale(1.0), roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.45 }); }),
  orangeFace: () => once('m.oface', () => { const t = TX.orangeFace(); return phys({ map: t.map, normalMap: t.normalMap, normalScale: nScale(0.8), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.3, sheenColor: new THREE.Color('#ffd7a0') }); }),
  orangeCut: () => once('m.ocut', () => phys({ color: '#f9a540', roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15 })),
  appleSkin: g => once('m.apple' + g, () => { const t = TX.appleSkin(g); return phys({ map: t.map, normalMap: t.normalMap, normalScale: nScale(0.5), roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.28 }); }),
  appleFlesh: () => once('m.aflesh', () => { const t = TX.appleFlesh(); return phys({ map: t.map, normalMap: t.normalMap, normalScale: nScale(0.4), roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.35, side: THREE.DoubleSide }); }),
  stem: () => once('m.stem', () => phys({ color: '#5a3d1e', roughness: 0.8 })),
  leaf: () => once('m.leaf', () => phys({ map: TX.leaf().map, roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color('#bfe39a'), side: THREE.DoubleSide })),
  sepal: () => once('m.sepal', () => phys({ color: '#3f8a2a', roughness: 0.6, sheen: 0.8, sheenColor: new THREE.Color('#a8d982'), side: THREE.DoubleSide })),
  seed: () => once('m.seed', () => phys({ color: '#d9b04a', roughness: 0.4, clearcoat: 0.6 })),
  kiwiFace: () => once('m.kface', () => { const t = TX.kiwiFace(); return phys({ map: t.map, normalMap: t.normalMap, normalScale: nScale(0.7), roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2 }); }),
  kiwiSkin: () => once('m.kskin', () => { const t = TX.kiwiSkin(); return phys({ map: t.map, normalMap: t.normalMap, roughness: 0.9, sheen: 1, sheenColor: new THREE.Color('#b8955c'), sheenRoughness: 0.8 }); }),
  kiwiCut: () => once('m.kcut', () => phys({ color: '#8cc032', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 })),
  blueberry: () => once('m.blue', () => { const t = TX.blueberry(); return phys({ map: t.map, normalMap: t.normalMap, roughness: 0.5, sheen: 1, sheenColor: new THREE.Color('#7f8fb8'), sheenRoughness: 0.5 }); }),
  blueCrown: () => once('m.bcrown', () => phys({ color: '#2a2440', roughness: 0.7 })),
  grape: g => once('m.grape' + g, () => {
    const t = TX.grape(g);
    return g
      ? phys({ map: t.map, normalMap: t.normalMap, roughness: 0.16, transmission: 0.55, thickness: 0.3, ior: 1.36, attenuationColor: new THREE.Color('#8cb233'), attenuationDistance: 0.35, sheen: 0.5, sheenColor: new THREE.Color('#eef4d0'), clearcoat: 0.4 })
      : phys({ map: t.map, normalMap: t.normalMap, roughness: 0.3, transmission: 0.12, thickness: 0.3, attenuationColor: new THREE.Color('#4a0820'), attenuationDistance: 0.2, sheen: 1, sheenColor: new THREE.Color('#c4a8b8'), sheenRoughness: 0.4 });
  }),
  mango: () => once('m.mango', () => { const t = TX.mango(); return phys({ map: t.map, normalMap: t.normalMap, normalScale: nScale(0.25), roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.4, sheenColor: new THREE.Color('#ffc060') }); }),
  pineapple: () => once('m.pine', () => { const t = TX.pineapple(); t.map.repeat.set(3, 3); t.normalMap.repeat.set(3, 3); return phys({ map: t.map, normalMap: t.normalMap, normalScale: nScale(0.8), roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 0.4, sheenColor: new THREE.Color('#fff0a0') }); }),
  watermelon: () => once('m.melon', () => { const t = TX.watermelon(); return phys({ map: t.map, normalMap: t.normalMap, normalScale: nScale(0.6), roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.4, sheenColor: new THREE.Color('#ffb0b8') }); }),
  melonSeed: () => once('m.mseed', () => phys({ color: '#141010', roughness: 0.2, clearcoat: 1 })),
  bananaFace: () => once('m.bface', () => { const t = TX.bananaFace(); return phys({ map: t.map, normalMap: t.normalMap, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.4 }); }),
  bananaSide: () => once('m.bside', () => phys({ color: '#e6d090', roughness: 0.6, clearcoat: 0.2 })),
  bananaSkin: () => once('m.bskin', () => { const t = TX.bananaSkin(); return phys({ map: t.map, normalMap: t.normalMap, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.4 }); }),
  aril: () => once('m.aril', () => phys({ color: '#c0102a', roughness: 0.06, transmission: 0.8, thickness: 0.08, ior: 1.42, attenuationColor: new THREE.Color('#8a0018'), attenuationDistance: 0.06, clearcoat: 1, clearcoatRoughness: 0.05, specularIntensity: 1 })),
  arilSeed: () => once('m.arseed', () => phys({ color: '#f3e7d2', roughness: 0.5 })),
  strawSkin: () => once('m.straw', () => { const p = strawParts(); const t = TX.strawberry(p.seeds); return phys({ map: t.map, normalMap: t.normalMap, normalScale: nScale(0.9), roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.22 }); }),
  strawCut: () => once('m.strawcut', () => { const p = strawParts(); const t = TX.strawberryCut(p.lookup, p.S, p.rmax); return phys({ map: t.map, normalMap: t.normalMap, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12, side: THREE.DoubleSide }); }),
  wood: () => once('m.wood', () => { const t = TX.wood(); return phys({ map: t.map, normalMap: t.normalMap, normalScale: nScale(0.5), roughness: 0.42, clearcoat: 0.45, clearcoatRoughness: 0.35, side: THREE.DoubleSide }); }),
  yogurt: () => once('m.yog', () => { const t = TX.yogurt(); t.map.repeat.set(3, 3); t.normalMap.repeat.set(3, 3); return phys({ map: t.map, normalMap: t.normalMap, normalScale: nScale(0.4), roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.4, sheen: 0.4, sheenColor: new THREE.Color('#ffffff') }); }),
};

// =====================================================================
//  FRUIT MODELS
//  Units: the bowl is 2.5 wide (≈20 cm), so 1 unit ≈ 8 cm.
// =====================================================================

// --- strawberry -------------------------------------------------------
const STRAW_PROFILE = [[0, 0], [0.05, 0.03], [0.12, 0.1], [0.2, 0.21], [0.28, 0.34], [0.35, 0.49], [0.4, 0.63], [0.42, 0.74], [0.4, 0.84], [0.33, 0.92], [0.21, 0.97], [0.09, 0.99], [0, 0.985]];
function strawParts() {
  return once('p.straw', () => {
    const S = 0.5, curve = profile(STRAW_PROFILE, S);
    const seeds = [];
    const rows = 15;
    for (let k = 0; k < rows; k++) {
      const v = 0.07 + (k / (rows - 1)) * 0.8, r = curve.getPoint(v).x / (0.42 * S);
      const n = Math.max(4, Math.round(20 * r));
      for (let i = 0; i < n; i++) seeds.push({ u: ((i + (k % 2 ? 0.5 : 0)) / n + rand(-0.012, 0.012) + 1) % 1, v: v + rand(-0.008, 0.008), n });
    }
    // radius lookup by height for the cut-face texture
    const samp = curve.getPoints(200);
    const lookup = y => { let best = samp[0], bd = Infinity; for (const p of samp) { const d = Math.abs(p.y - y); if (d < bd) { bd = d; best = p; } } return best.x; };
    const rmax = 0.42 * S;
    return { S, curve, seeds, lookup, rmax };
  });
}
function strawSeeds(filter) {
  const { curve, seeds } = strawParts();
  const list = seeds.filter(filter);
  const inst = new THREE.InstancedMesh(once('g.seed', () => new THREE.SphereGeometry(1, 8, 6)), MAT.seed(), list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new V3(0, 1, 0), pos = new V3(), n = new V3(), sc = new V3(0.0055, 0.0035, 0.008);
  list.forEach((s, i) => {
    const p = curve.getPoint(s.v), t = curve.getTangent(s.v), phi = s.u * TAU;
    n.set(Math.sin(phi) * t.y, -t.x, Math.cos(phi) * t.y).normalize();
    pos.set(Math.sin(phi) * p.x, p.y, Math.cos(phi) * p.x).addScaledVector(n, -0.0015);
    q.setFromUnitVectors(up, n); m.compose(pos, q, sc); inst.setMatrixAt(i, m);
  });
  inst.castShadow = false; inst.receiveShadow = true;
  return inst;
}
function strawCalyx() {
  const { S } = strawParts();
  const g = new THREE.Group();
  const sepGeo = once('g.sepal', () => {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.bezierCurveTo(0.05, 0.03, 0.035, 0.12, 0, 0.17); sh.bezierCurveTo(-0.035, 0.12, -0.05, 0.03, 0, 0);
    const geo = new THREE.ShapeGeometry(sh, 8); const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i); p.setZ(i, -y * y * 2.2 + Math.abs(x) * 0.25); }
    geo.computeVertexNormals(); geo.scale(S * 1.25, S * 1.25, S * 1.25); return geo;
  });
  const top = S * 0.985;
  const n = 9;
  for (let i = 0; i < n; i++) {
    const piv = new THREE.Group(); piv.rotation.y = (i / n) * TAU + rand(-0.15, 0.15);
    const s = mesh(sepGeo, MAT.sepal()); s.rotation.x = Math.PI / 2 - rand(0.05, 0.35); s.position.set(0, top - 0.004, 0);
    piv.add(s); g.add(piv);
  }
  const stem = mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.07, 8), MAT.sepal()); stem.position.y = top + 0.03; stem.rotation.z = rand(-0.3, 0.3);
  g.add(stem);
  return g;
}
function strawberryWhole() {
  const { S, curve } = strawParts();
  const geo = once('g.strawWhole', () => wobble(lathe(curve, 48, 56), 0.025, 7, 'radial', 3));
  const body = new THREE.Group();
  body.add(mesh(geo, MAT.strawSkin()), strawSeeds(() => true), strawCalyx());
  body.position.y = -S * 0.5;
  const g = new THREE.Group(); g.add(body);
  g.userData.lift = 0.12;
  g.userData.lie = () => { g.rotation.set(Math.PI / 2 + rand(-0.4, 0.4), 0, rand(-0.3, 0.3)); };
  return g;
}
function strawberryHalf() {
  const { S, curve, rmax } = strawParts();
  const geo = once('g.strawHalf', () => lathe(curve, 48, 28, 0, Math.PI));
  const cut = once('g.strawCut', () => {
    const pts = curve.getPoints(48);
    const sh = new THREE.Shape(); sh.moveTo(0, pts[0].y);
    pts.forEach(p => sh.lineTo(p.x, p.y)); [...pts].reverse().forEach(p => sh.lineTo(-p.x, p.y));
    const gg = new THREE.ShapeGeometry(sh, 4); const uv = gg.attributes.uv, pos = gg.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / (2 * rmax) + 0.5, pos.getY(i) / S);
    gg.rotateY(-Math.PI / 2); return gg;
  });
  const body = new THREE.Group();
  body.add(mesh(geo, MAT.strawSkin()), mesh(cut, MAT.strawCut()), strawSeeds(s => s.u < 0.5));
  // calyx cut in half: keep sepals on the skin side only
  const cal = strawCalyx(); cal.children.forEach(c => { if (c.rotation && Math.sin(c.rotation.y) < -0.1) c.visible = false; }); body.add(cal);
  const inner = new THREE.Group(); inner.add(body); inner.rotation.z = -Math.PI / 2; inner.position.x = -S * 0.5;
  const g = new THREE.Group(); g.add(inner); g.userData.lift = 0.02; return g;
}

// --- citrus ------------------------------------------------------------
function orangeWhole(s = 1) {
  const geo = once('g.orange', () => { const g = new THREE.SphereGeometry(0.46, 72, 48); g.scale(1, 0.93, 1); return wobble(g, 0.012, 3, 'full', 11); });
  const g = new THREE.Group(); g.add(mesh(geo, MAT.orangePeel()));
  const navel = mesh(once('g.navel', () => new THREE.CircleGeometry(0.035, 5)), MAT.sepal()); navel.rotation.x = -Math.PI / 2; navel.position.y = 0.428; g.add(navel);
  const nub = mesh(once('g.nub', () => new THREE.SphereGeometry(0.014, 8, 6)), MAT.stem()); nub.position.y = 0.432; g.add(nub);
  g.scale.setScalar(s); g.userData.lift = 0.43 * s; return g;
}
function orangeHalfWheel() {
  const geo = once('g.owheel', () => new THREE.CylinderGeometry(0.38, 0.38, 0.07, 64, 1, false, 0, Math.PI));
  const cut = once('g.owcut', () => { const g = new THREE.PlaneGeometry(0.76, 0.07); g.rotateY(-Math.PI / 2); return g; });
  const g = new THREE.Group();
  g.add(mesh(geo, [MAT.orangePeel(), MAT.orangeFace(), MAT.orangeFace()]), mesh(cut, MAT.orangeCut()));
  const inner = new THREE.Group(); inner.add(...g.children); inner.position.x = -0.15;
  const out = new THREE.Group(); out.add(inner); out.userData.lift = 0.04; return out;
}
function orangeWheel() {
  const geo = once('g.owheelFull', () => new THREE.CylinderGeometry(0.38, 0.38, 0.07, 64));
  const g = new THREE.Group(); g.add(mesh(geo, [MAT.orangePeel(), MAT.orangeFace(), MAT.orangeFace()])); g.userData.lift = 0.04; return g;
}

// --- apple -------------------------------------------------------------
const APPLE_PROFILE = [[0, 0.065], [0.06, 0.04], [0.14, 0.02], [0.24, 0.03], [0.33, 0.08], [0.41, 0.17], [0.47, 0.29], [0.5, 0.42], [0.505, 0.52], [0.49, 0.63], [0.45, 0.73], [0.38, 0.81], [0.29, 0.865], [0.2, 0.875], [0.12, 0.845], [0.06, 0.79], [0.02, 0.75], [0, 0.74]];
const appleCurve = () => once('c.apple', () => profile(APPLE_PROFILE, 0.95));
function appleWhole(green = false) {
  const geo = once('g.apple', () => wobble(lathe(appleCurve(), 64, 72), 0.02, 4, 'radial', 21));
  const g = new THREE.Group(); g.add(mesh(geo, MAT.appleSkin(green)));
  const top = 0.74 * 0.95;
  const stemGeo = once('g.astem', () => new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new V3(0, top - 0.02, 0), new V3(0.005, top + 0.08, 0), new V3(0.04, top + 0.13, 0.01)), 12, 0.013, 6));
  g.add(mesh(stemGeo, MAT.stem()));
  const leafGeo = once('g.leaf', () => { const p = new THREE.PlaneGeometry(0.26, 0.12, 10, 4); const a = p.attributes.position; for (let i = 0; i < a.count; i++) { const x = a.getX(i), y = a.getY(i); const w = Math.sin((x / 0.26 + 0.5) * Math.PI); a.setY(i, y * w); a.setZ(i, -x * x * 2 + y * y * 3); } p.translate(0.13, 0, 0); p.computeVertexNormals(); return p; });
  const leaf = mesh(leafGeo, MAT.leaf()); leaf.position.set(0.03, top + 0.11, 0.01); leaf.rotation.set(-0.5, 0.4, 0.3); g.add(leaf);
  g.userData.lift = 0; return g;
}
function appleWedge(green = Math.random() < 0.35) {
  const PH = Math.PI / 4;
  const skin = once('g.awedge', () => lathe(appleCurve(), 48, 12, 0, PH));
  const face = once('g.awface', () => {
    const pts = appleCurve().getPoints(48); const sh = new THREE.Shape(); sh.moveTo(0, pts[0].y); pts.forEach(p => sh.lineTo(p.x, p.y)); sh.lineTo(0, pts[pts.length - 1].y);
    return new THREE.ShapeGeometry(sh, 2);
  });
  const g = new THREE.Group();
  g.add(mesh(skin, MAT.appleSkin(green)));
  const f1 = mesh(face, MAT.appleFlesh()); f1.rotation.y = -Math.PI / 2; g.add(f1);
  const f2 = mesh(face, MAT.appleFlesh()); f2.rotation.y = PH - Math.PI / 2; g.add(f2);
  // lie on a cut face, centred
  const inner = new THREE.Group(); inner.add(g); g.position.set(0, -0.42, 0);
  g.rotation.y = -PH / 2; // centre wedge on +Z
  const out = new THREE.Group(); const lie = new THREE.Group(); lie.add(inner); lie.rotation.set(0, 0, Math.PI / 2); inner.position.z = -0.22;
  out.add(lie); out.userData.lift = 0.06; return out;
}

// --- kiwi --------------------------------------------------------------
function kiwiSlice() {
  const geo = once('g.kslice', () => { const g = new THREE.CylinderGeometry(1, 1, 1, 64); g.scale(0.29, 0.06, 0.26); return g; });
  const g = new THREE.Group(); g.add(mesh(geo, [MAT.kiwiSkin(), MAT.kiwiFace(), MAT.kiwiFace()])); g.userData.lift = 0.035; return g;
}
function kiwiHalfSlice() {
  const geo = once('g.khslice', () => { const g = new THREE.CylinderGeometry(1, 1, 1, 48, 1, false, 0, Math.PI); g.scale(0.29, 0.06, 0.26); return g; });
  const cut = once('g.khcut', () => { const g = new THREE.PlaneGeometry(0.52, 0.06); g.rotateY(-Math.PI / 2); return g; });
  const inner = new THREE.Group(); inner.add(mesh(geo, [MAT.kiwiSkin(), MAT.kiwiFace(), MAT.kiwiFace()]), mesh(cut, MAT.kiwiCut())); inner.position.x = -0.12;
  const g = new THREE.Group(); g.add(inner); g.userData.lift = 0.035; return g;
}
function kiwiHalf() { // a kiwi cut in half, cut face up (for resting beside the bowl)
  const dome = once('g.kdome', () => { const g = new THREE.SphereGeometry(1, 48, 24, 0, TAU, Math.PI / 2, Math.PI / 2); g.scale(0.3, 0.38, 0.27); return wobble(g, 0.03, 4, 'full', 4); });
  const face = once('g.kface', () => { const g = new THREE.CircleGeometry(1, 64); g.rotateX(-Math.PI / 2); g.scale(0.3, 1, 0.27); return g; });
  const g = new THREE.Group(); g.add(mesh(dome, MAT.kiwiSkin()), mesh(face, MAT.kiwiFace()));
  g.userData.lift = 0.38; return g;
}

// --- berries & grapes ---------------------------------------------------
function blueberryOne() {
  const geo = once('g.blue', () => { const g = new THREE.SphereGeometry(0.075, 32, 20); g.scale(1, 0.86, 1); return wobble(g, 0.04, 30, 'full', 2); });
  const crown = once('g.bcrown', () => new THREE.TorusGeometry(0.022, 0.009, 6, 10));
  const g = new THREE.Group(); g.add(mesh(geo, MAT.blueberry()));
  const c = mesh(crown, MAT.blueCrown()); c.rotation.x = Math.PI / 2; c.position.y = 0.062; g.add(c);
  return g;
}
function blueberries() {
  const g = new THREE.Group(); const n = 3 + Math.floor(rand(0, 2));
  for (let i = 0; i < n; i++) { const b = blueberryOne(); b.position.set(rand(-0.1, 0.1), rand(0, 0.05), rand(-0.1, 0.1)); b.rotation.set(rand(-1, 1), rand(0, 6), rand(-1, 1)); g.add(b); }
  g.userData.lift = 0.06; return g;
}
function grapes(green = Math.random() < 0.55) {
  const geo = once('g.grape', () => { const g = new THREE.SphereGeometry(0.11, 32, 24); g.scale(1, 1.18, 1); return g; });
  const g = new THREE.Group(); const n = 2 + Math.floor(rand(0, 2));
  for (let i = 0; i < n; i++) {
    const m = mesh(geo, MAT.grape(green)); m.position.set(rand(-0.12, 0.12), rand(0, 0.05), rand(-0.12, 0.12)); m.rotation.set(rand(0.8, 2.2), rand(0, 6), 0); g.add(m);
  }
  g.userData.lift = 0.08; return g;
}
function pomegranate() {
  const geo = once('g.aril', () => {
    const g = new THREE.IcosahedronGeometry(1, 1); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 - 0.3 * Math.max(0, y); p.setXYZ(i, x * 0.036 * k, y * 0.05, z * 0.03 * k); }
    g.computeVertexNormals(); return g;
  });
  const seed = once('g.arilseed', () => { const g = new THREE.SphereGeometry(1, 10, 8); g.scale(0.012, 0.024, 0.01); return g; });
  const g = new THREE.Group(); const n = 9;
  for (let i = 0; i < n; i++) {
    const a = mesh(geo, MAT.aril());
    a.position.set(rand(-0.09, 0.09), rand(0, 0.06), rand(-0.09, 0.09)); a.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6)); g.add(a);
  }
  g.userData.lift = 0.04; return g;
}

// --- chopped fruit -------------------------------------------------------
function chunkGeo(key, seed) { return once(key + seed, () => { const g = roundedBox(0.2, 7); return wobble(g, 0.08, 2.2, 'full', seed * 7.7); }); }
function mangoCube() {
  const m = mesh(chunkGeo('g.mango', Math.floor(rand(0, 3))), MAT.mango()); m.scale.setScalar(0.21); m.rotation.set(rand(-0.3, 0.3), rand(0, 6), rand(-0.3, 0.3));
  const g = new THREE.Group(); g.add(m); g.userData.lift = 0.08; return g;
}
function pineappleChunk() {
  const geo = once('g.pine', () => {
    const sh = new THREE.Shape(); sh.moveTo(-0.05, 0); sh.lineTo(0.05, 0); sh.lineTo(0.13, 0.22); sh.quadraticCurveTo(0, 0.25, -0.13, 0.22); sh.lineTo(-0.05, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.15, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 3 });
    g.center(); return wobble(g, 0.05, 4, 'full', 3);
  });
  const m = mesh(geo, MAT.pineapple()); m.rotation.set(Math.PI / 2 + rand(-0.3, 0.3), 0, rand(0, 6));
  const g = new THREE.Group(); g.add(m); g.userData.lift = 0.08; return g;
}
function melonCube() {
  const g = new THREE.Group();
  const m = mesh(chunkGeo('g.melon', Math.floor(rand(0, 3))), MAT.watermelon()); m.scale.setScalar(0.26); m.rotation.set(rand(-0.25, 0.25), rand(0, 6), rand(-0.25, 0.25)); g.add(m);
  if (Math.random() < 0.6) {
    const s = mesh(once('g.mseed', () => { const q = new THREE.SphereGeometry(1, 10, 8); q.scale(0.018, 0.008, 0.028); return q; }), MAT.melonSeed());
    s.position.set(rand(-0.2, 0.2), 0.49, rand(-0.2, 0.2)); s.rotation.y = rand(0, 6); m.add(s); s.scale.divideScalar(0.26);
  }
  g.userData.lift = 0.1; return g;
}
function bananaCoins() {
  const geo = once('g.bcoin', () => { const g = new THREE.CylinderGeometry(0.15, 0.145, 0.07, 40); return g; });
  const g = new THREE.Group(); const n = 2;
  for (let i = 0; i < n; i++) {
    const m = mesh(geo, [MAT.bananaSide(), MAT.bananaFace(), MAT.bananaFace()]);
    m.position.set(rand(-0.06, 0.06) + i * 0.08, i * 0.035, rand(-0.06, 0.06)); m.rotation.set(rand(-0.35, 0.35), rand(0, 6), rand(-0.35, 0.35)); g.add(m);
  }
  g.userData.lift = 0.04; return g;
}
function bananaWhole(s = 1) {
  const geo = once('g.banana', () => {
    const curve = new THREE.CatmullRomCurve3([new V3(-0.95, 0.34, 0), new V3(-0.5, 0.07, 0), new V3(0, -0.02, 0), new V3(0.5, 0.07, 0), new V3(0.9, 0.3, 0)]);
    const segs = 80, rad = 30, R = 0.17;
    const frames = curve.computeFrenetFrames(segs, false);
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, P0 = curve.getPointAt(t), N = frames.normals[i], B = frames.binormals[i];
      const prof = t < 0.1 ? 0.3 + 0.7 * Math.sin((t / 0.1) * Math.PI / 2) : t > 0.82 ? lerp(1, 0.32, smooth(0.82, 0.96, t)) : 1;
      for (let j = 0; j <= rad; j++) {
        const th = (j / rad) * TAU, rr = R * prof * (1 + 0.055 * Math.cos(5 * th)) ;
        pos.push(P0.x + rr * (Math.cos(th) * N.x + Math.sin(th) * B.x), P0.y + rr * (Math.cos(th) * N.y + Math.sin(th) * B.y), P0.z + rr * (Math.cos(th) * N.z + Math.sin(th) * B.z));
        uv.push(t, j / rad);
      }
    }
    for (let i = 0; i < segs; i++) for (let j = 0; j < rad; j++) { const a = i * (rad + 1) + j, b = a + rad + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeVertexNormals();
    const n = g.attributes.normal; // stitch the seam
    for (let i = 0; i <= segs; i++) { const a = i * (rad + 1), b = a + rad; const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1; n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l); }
    g.userData.curve = curve; return g;
  });
  const g = new THREE.Group(); g.add(mesh(geo, MAT.bananaSkin()));
  const c = geo.userData.curve;
  const tip = mesh(once('g.btip', () => new THREE.SphereGeometry(0.055, 12, 8)), MAT.stem()); tip.position.copy(c.getPointAt(0)); g.add(tip);
  const end = c.getPointAt(1), dir = c.getTangentAt(1);
  const stem = mesh(once('g.bstem', () => { const q = new THREE.CylinderGeometry(0.045, 0.06, 0.2, 10); q.translate(0, 0.1, 0); return q; }), once('m.bstem', () => phys({ color: '#6b6a2c', roughness: 0.75 })));
  stem.position.copy(end); stem.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir.clone().normalize()); g.add(stem);
  const cap = mesh(once('g.bcap', () => new THREE.CircleGeometry(0.045, 10)), MAT.stem()); cap.position.copy(end).addScaledVector(dir, 0.2); cap.quaternion.copy(stem.quaternion); cap.rotateX(-Math.PI / 2); g.add(cap);
  g.scale.setScalar(s); return g;
}

// --- piece registry ----------------------------------------------------
const PIECES = {
  strawberry: { r: 0.17, make: () => (Math.random() < 0.5 ? strawberryHalf() : strawberryWhole()) },
  blueberry: { r: 0.15, make: blueberries },
  grapes: { r: 0.17, make: () => grapes() },
  kiwi: { r: 0.25, make: () => (Math.random() < 0.3 ? kiwiHalfSlice() : kiwiSlice()) },
  mango: { r: 0.15, make: mangoCube },
  apple: { r: 0.2, make: () => appleWedge() },
  orange: { r: 0.3, make: orangeHalfWheel },
  pomegranate: { r: 0.13, make: pomegranate },
  pineapple: { r: 0.16, make: pineappleChunk },
  watermelon: { r: 0.18, make: melonCube },
  banana: { r: 0.17, make: bananaCoins },
};
export function makePiece(id) {
  const p = PIECES[id].make();
  if (p.userData.lie) p.userData.lie();
  return p;
}
export const whole = { orange: orangeWhole, apple: appleWhole, banana: bananaWhole, strawberry: strawberryWhole, kiwiHalf, kiwiSlice, orangeWheel, blueberry: blueberryOne, grapes: () => grapes(true) };

// =====================================================================
//  BOWL
// =====================================================================
export const BOWL = { radius: 1.25, height: 0.95, wall: 0.06 };
const DOME = { base: 0.6, rise: 0.3, R: 1.14 };

export function makeBowl({ contactShadow = true } = {}) {
  const geo = once('g.bowl', () => {
    const R = BOWL.radius, H = BOWL.height, W = BOWL.wall, pts = [];
    const ell = (cx, cy, rx, ry, a0, a1, n) => { for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); pts.push(new V2(cx + rx * Math.sin(a), cy - ry * Math.cos(a))); } };
    pts.push(new V2(0.0004, 0.1));
    for (let i = 1; i <= 6; i++) pts.push(new V2((0.5 * i) / 6, 0.1));
    ell(0.5, H, R - W - 0.5, H - 0.1, 0.02, Math.PI / 2, 40);              // inner wall up to rim
    for (let i = 1; i < 10; i++) { const a = Math.PI - (i / 10) * Math.PI; pts.push(new V2(R - W / 2 + (W / 2) * Math.cos(a), H + (W / 2) * Math.sin(a) * 0.8)); } // rounded lip
    ell(0.55, H, R - 0.55, H - 0.05, Math.PI / 2, 0.02, 40);               // outer wall down
    pts.push(new V2(0.55, 0.035), new V2(0.53, 0.0), new V2(0.45, 0.0), new V2(0.43, 0.03), new V2(0.0004, 0.03)); // foot ring
    const g = new THREE.LatheGeometry(pts, 128);
    // planar wood-grain UVs: grain runs along X, growth rings around an axis below the bowl
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); uv.setXY(i, x * 0.2 + 0.5, (Math.hypot(y + 0.8, z * 0.9 + 0.5) - 0.3) * 0.42); }
    return g;
  });
  const g = new THREE.Group();
  g.add(mesh(geo, MAT.wood()));
  const base = mesh(once('g.yog', () => new THREE.SphereGeometry(1, 64, 24, 0, TAU, 0, Math.PI / 2)), MAT.yogurt());
  base.scale.set(DOME.R, DOME.rise, DOME.R); base.position.y = DOME.base; base.castShadow = false; g.add(base);
  if (contactShadow) {
    const t = once('t.contact', () => {
      const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
      const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
      gr.addColorStop(0, 'rgba(40,22,8,0.55)'); gr.addColorStop(0.32, 'rgba(40,22,8,0.42)'); gr.addColorStop(0.45, 'rgba(40,22,8,0.12)'); gr.addColorStop(1, 'rgba(40,22,8,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
    });
    const cs = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
    cs.rotation.x = -Math.PI / 2; cs.position.y = 0.003; cs.renderOrder = -1; g.add(cs);
  }
  return g;
}

// Vessels: where the heaped top sits and how big pieces are relative to the container.
export const VESSELS = {
  bowl: { base: 0.6, rise: 0.3, R: 1.14, rLimit: 1.1, scale: 1, pack: 2.1 },
  cup: { base: 1.3, rise: 0.46, R: 1.16, rLimit: 1.18, scale: 1.3, pack: 3.4, domeR: 0.9 },
};
export function surfaceY(r, v = VESSELS.bowl) { return v.base + v.rise * Math.sqrt(Math.max(0, 1 - (r / v.R) ** 2)); }

// Pack fruit pieces into sectors (one sector per fruit, like the photo), heaped on the dome.
export function arrangeFruits(ids, vesselName = 'bowl') {
  const v = VESSELS[vesselName] || VESSELS.bowl, S = v.scale;
  const out = [], n = ids.length; if (!n) return out;
  const placed = [];
  const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), up = new V3(0, 1, 0), axis = new V3();
  ids.forEach((id, k) => {
    const spec = PIECES[id]; if (!spec) return;
    const pr = spec.r * S;
    const a0 = (k / n) * TAU, a1 = ((k + 1) / n) * TAU;
    const rMax = v.rLimit - pr * 0.95;
    const area = ((a1 - a0) / 2) * rMax * rMax;
    const count = Math.max(2, Math.min(30, Math.round((area / (Math.PI * pr * pr)) * v.pack)));
    for (let i = 0; i < count; i++) {
      let best = null, bestD = -Infinity;
      for (let c = 0; c < 18; c++) {
        const a = n === 1 ? rand(0, TAU) : rand(a0 + 0.04, a1 - 0.04), r = Math.sqrt(rand(0.0, 1)) * rMax;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        let d = 9; for (const p of placed) d = Math.min(d, Math.hypot(p.x - x, p.z - z) - p.r - pr);
        if (d > bestD) { bestD = d; best = { x, z, a, r }; }
      }
      placed.push({ x: best.x, z: best.z, r: pr });
      const obj = makePiece(id), g = new THREE.Group(); g.add(obj); g.scale.setScalar(S);
      const stack = bestD < 0 ? Math.min(-bestD * 0.7, 0.12) : 0;
      const target = new V3(best.x, surfaceY(best.r, v) + (obj.userData.lift || 0) * S + stack, best.z);
      const slope = Math.atan((surfaceY(best.r, v) - surfaceY(best.r + 0.05, v)) / 0.05);
      axis.set(-Math.sin(best.a), 0, Math.cos(best.a));
      q1.setFromAxisAngle(up, rand(0, TAU)); q2.setFromAxisAngle(axis, -slope * 0.9 + rand(-0.15, 0.15));
      g.quaternion.copy(q2).multiply(q1);
      out.push({ fruit: id, group: g, target });
    }
  });
  return out;
}

// =====================================================================
//  CLEAR TAKEAWAY CUP (Navrasa packaging)
// =====================================================================
export const CUP = { rb: 0.9, rt: 1.22, H: 1.48 };
const cupR = y => CUP.rb + (CUP.rt - CUP.rb) * (y / CUP.H);

const TXC = {
  condensation: () => once('t.cond', () => {
    const w = 1024, h = 512, H = new Float32Array(w * h), R = new Float32Array(w * h).fill(0.12);
    const drop = (cx, cy, rad, k) => {
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
        const q = 1 - (dx * dx + dy * dy) / (rad * rad); if (q <= 0) continue;
        const x = (Math.round(cx + dx) + w) % w, y = Math.round(cy + dy); if (y < 0 || y >= h) continue;
        const i = y * w + x; H[i] = Math.max(H[i], Math.sqrt(q) * rad * k); R[i] = 0.03;
      }
    };
    // fog of micro-droplets on the cold lower part, bigger beads scattered over it
    for (let y = 0; y < h; y++) {
      const v = 1 - y / h, fog = smooth(0.92, 0.55, v);
      for (let x = 0; x < w; x++) { const i = y * w + x; R[i] = 0.06 + fog * (0.22 + 0.12 * noise3(x * 0.02, y * 0.02, 3)); }
    }
    for (let i = 0; i < 9000; i++) { const v = Math.pow(Math.random(), 0.7) * 0.9, y = (1 - v) * h; drop(rand(0, w), y, rand(0.8, 2.2), 0.6); }
    for (let i = 0; i < 700; i++) { const v = Math.pow(Math.random(), 0.8) * 0.85, y = (1 - v) * h, r = rand(2.5, 6.5); drop(rand(0, w), y, r, 0.5); if (Math.random() < 0.08) for (let t = 1; t < 12; t++) drop(rand(-1, 1) + 0, y + t * r * 0.9, r * 0.7, 0.4); }
    const normalMap = heightToNormal(H, w, h, 0.9, true);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), img = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { const r = Math.min(255, R[i] * 255); img.data[i * 4] = r; img.data[i * 4 + 1] = r; img.data[i * 4 + 2] = r; img.data[i * 4 + 3] = 255; }
    g.putImageData(img, 0, 0);
    const roughnessMap = new THREE.CanvasTexture(c); roughnessMap.wrapS = THREE.RepeatWrapping;
    return { normalMap, roughnessMap };
  }),
  granola: () => once('t.granola', () => paint(256, 256, (u, v, o) => {
    const n = fbm(u * 6, v * 6, 2, 4), flake = noise3(u * 26, v * 26, 5), toast = smooth(0.2, 0.6, fbm(u * 3, v * 3, 9, 2) + 0.3);
    let c = mixc(hex('#a9672a'), hex('#d89a4c'), clamp01(0.5 + n * 1.4));
    c = mixc(c, hex('#6e3d14'), toast * 0.6);
    c = mixc(c, hex('#f6dcaa'), smooth(0.35, 0.6, flake) * 0.4);
    setc(o, c); o[3] = flake * 0.8 + n * 0.6;
  }, { normal: 3, wrap: true })),
  mint: () => once('t.mint', () => paint(256, 256, (u, v, o) => {
    // u across leaf (0..1, midrib at .5), v along leaf (0 base → 1 tip)
    const x = u - 0.5, vein = Math.abs(x) < 0.012 ? 1 : 0;
    const side = Math.abs(x) * 6 - (v * 6) % 1; const lat = Math.abs(((Math.abs(x) * 4 + v * 5) % 1) - 0.5) < 0.04 ? 1 : 0;
    const n = fbm(u * 8, v * 8, 4, 3);
    let c = mixc(hex('#3c8f25'), hex('#5cb836'), clamp01(0.55 + n * 1.2 - Math.abs(x)));
    c = mixc(c, hex('#a6d77c'), Math.max(vein, lat * (Math.abs(x) > 0.03 ? 0.6 : 0)));
    setc(o, c); o[3] = -(vein * 0.8 + lat * 0.5) + n * 0.5 + noise3(u * 30, v * 30, 1) * 0.4;
  }, { normal: 3 })),
};
const MATC = {
  cup: () => once('m.cup', () => { const t = TXC.condensation(); return phys({ color: '#ffffff', transmission: 1, thickness: 0.02, ior: 1.5, roughness: 1, roughnessMap: t.roughnessMap, normalMap: t.normalMap, normalScale: nScale(0.9), clearcoat: 1, clearcoatRoughness: 0.04, specularIntensity: 1, side: THREE.DoubleSide, envMapIntensity: 1.2 }); }),
  label: () => once('m.label', () => phys({ map: LABEL.tex, transparent: true, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.2, side: THREE.FrontSide, depthWrite: true })),
  granola: () => once('m.gran', () => { const t = TXC.granola(); return phys({ map: t.map, normalMap: t.normalMap, normalScale: nScale(1), roughness: 0.75, clearcoat: 0.15, clearcoatRoughness: 0.6, envMapIntensity: 0.6 }); }),
  granolaCore: () => once('m.granCore', () => phys({ color: '#9d6a33', roughness: 0.9 })),
  yogurtCup: () => once('m.yogCup', () => phys({ color: '#fbf7ef', roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3, sheen: 0.6, sheenColor: new THREE.Color('#ffffff') })),
  mint: () => once('m.mint', () => { const t = TXC.mint(); return phys({ map: t.map, normalMap: t.normalMap, normalScale: nScale(0.35), roughness: 0.45, sheen: 0.7, sheenColor: new THREE.Color('#c9f0a8'), clearcoat: 0.3, side: THREE.DoubleSide }); }),
  chia: () => once('m.chia', () => phys({ color: '#ffffff', roughness: 0.35, clearcoat: 0.6 })),
  nut: () => once('m.nut', () => phys({ color: '#ead2a0', roughness: 0.55, clearcoat: 0.2 })),
  pepita: () => once('m.pepita', () => phys({ color: '#5f7f2e', roughness: 0.45, clearcoat: 0.3 })),
  coconut: () => once('m.coco', () => phys({ color: '#fbf8f1', roughness: 0.7, side: THREE.DoubleSide })),
  honey: () => once('m.honey', () => phys({ color: '#f0a81c', roughness: 0.04, transmission: 0.7, thickness: 0.05, ior: 1.5, attenuationColor: new THREE.Color('#b35d00'), attenuationDistance: 0.08, clearcoat: 1 })),
  fruitMix: () => once('m.fmix', () => {
    const t = paint(256, 256, (u, v, o) => {
      const a = fbm(u * 6, v * 6, 1, 3), b = fbm(u * 6, v * 6, 7, 3);
      let c = mixc(hex('#8a2a2e'), hex('#b8701e'), smooth(-0.3, 0.3, a));
      c = mixc(c, hex('#4f7024'), smooth(0.15, 0.4, b) * 0.6);
      setc(o, c, 0.38 + 0.12 * fbm(u * 20, v * 20, 2, 2));
    }, { wrap: true });
    t.map.repeat.set(3, 3);
    return phys({ map: t.map, roughness: 0.5, clearcoat: 0.4 });
  }),
  drop: () => once('m.drop', () => phys({ color: '#ffffff', roughness: 0.0, transmission: 1, thickness: 0.02, ior: 1.33, clearcoat: 1, specularIntensity: 1 })),
};

// Brand label (cut from the Navrasa photo). Loaded once; scenes await LABEL.ready before snapshots.
export const LABEL = (() => {
  const tex = new THREE.Texture(); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const ready = new Promise(res => {
    const img = new Image();
    img.onload = () => { tex.image = img; tex.needsUpdate = true; res(true); };
    img.onerror = () => res(false);
    img.src = '/img/navrasa-label.png';
  });
  return { tex, ready };
})();

function cupShell() {
  const geo = once('g.cup', () => {
    const { rb, rt, H } = CUP, pts = [];
    pts.push(new V2(0.0004, 0.006), new V2(rb - 0.06, 0.006), new V2(rb - 0.02, 0.012), new V2(rb - 0.004, 0.035));
    for (let i = 1; i <= 40; i++) { const y = 0.035 + (H - 0.035) * (i / 40); pts.push(new V2(cupR(y), y)); }
    const cx = rt + 0.022, r = 0.024; // rolled rim
    for (let i = 0; i <= 14; i++) { const a = Math.PI - (i / 14) * (Math.PI * 1.5); pts.push(new V2(cx + r * Math.cos(a), H + r * Math.sin(a))); }
    return new THREE.LatheGeometry(pts, 128);
  });
  const m = new THREE.Mesh(geo, MATC.cup()); m.castShadow = false; m.receiveShadow = false;
  return m;
}
function cupLabel() {
  const yc = 0.5, h = 0.56, th = 1.12;
  const geo = once('g.label', () => new THREE.CylinderGeometry(cupR(yc + h / 2) + 0.006, cupR(yc - h / 2) + 0.006, h, 48, 1, true, -th / 2, th));
  const m = new THREE.Mesh(geo, MATC.label()); m.position.y = yc; m.renderOrder = 2; return m;
}
function granolaGeos() {
  return once('g.granola', () => [0, 1, 2, 3].map(k => { const g = new THREE.IcosahedronGeometry(1, 2); wobble(g, 0.45, 1.6, 'full', k * 9.1); g.computeVertexNormals(); return g; }));
}
// granola clusters as instanced meshes, positions [{p, s}]
function granolaInstances(list) {
  const geos = granolaGeos(), g = new THREE.Group();
  const buckets = geos.map(() => []);
  list.forEach((it, i) => buckets[i % geos.length].push(it));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new V3();
  buckets.forEach((b, k) => {
    if (!b.length) return;
    const im = new THREE.InstancedMesh(geos[k], MATC.granola(), b.length);
    b.forEach((it, i) => { e.set(rand(0, 6), rand(0, 6), rand(0, 6)); q.setFromEuler(e); sc.set(it.s, it.s * rand(0.6, 0.9), it.s * rand(0.8, 1)); m4.compose(it.p, q, sc); im.setMatrixAt(i, m4); });
    im.castShadow = true; im.receiveShadow = true; g.add(im);
  });
  return g;
}

// fruit visible through the cup wall: a ring of pieces against the plastic, sectors matching the top
const noCalyx = o => { o.traverse(m => { if (m.material === MAT.sepal()) m.visible = false; }); return o; };
const WALL_MAKE = { strawberry: () => noCalyx(strawberryHalf()), kiwi: () => kiwiHalfSlice() };
const WALL_OK = { strawberry: 1, mango: 1, kiwi: 1, banana: 1, blueberry: 1, orange: 1, apple: 1, pineapple: 1, watermelon: 1 };
export function wallFruit(ids) {
  const g = new THREE.Group();
  const use = ids.filter(id => WALL_OK[id]);
  const list = use.length ? use : ['strawberry', 'mango', 'kiwi'];
  const n = ids.length || 1;
  for (const y of [0.92, 1.14, 1.36]) {
    const R = cupR(y), count = Math.round((TAU * R) / 0.3);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + rand(-0.05, 0.05) + y * 0.7;
      // pick the fruit whose top sector this angle falls in (fallback to any wall-friendly fruit)
      let id = ids[Math.floor(((a % TAU) / TAU) * n)] || list[0];
      if (!WALL_OK[id]) id = list[i % list.length];
      const spec = PIECES[id], obj = (WALL_MAKE[id] || (() => makePiece(id)))(), piece = new THREE.Group(); piece.add(obj);
      const s = 1.15, rr = R - spec.r * s - 0.09;
      piece.scale.setScalar(s); piece.position.set(Math.cos(a) * rr, y + rand(-0.03, 0.03), Math.sin(a) * rr);
      piece.rotation.set(rand(-0.6, 0.6), rand(0, TAU), rand(-0.6, 0.6));
      g.add(piece);
    }
  }
  g.traverse(o => { o.castShadow = false; });
  return g;
}

export function makeCup({ fruits = [], contactShadow = true, wall = true } = {}) {
  const g = new THREE.Group();
  g.add(cupShell());
  if (LABEL.tex.image) g.add(cupLabel()); else LABEL.ready.then(ok => ok && g.add(cupLabel()));
  // granola base: clusters packed against the wall, solid core behind
  const gl = [];
  for (let y = 0.08; y < 0.6; y += 0.085) {
    const R = cupR(y) - 0.075;
    for (let r = R; r > R - 0.3; r -= 0.1) { const n = Math.round((TAU * r) / 0.105); for (let i = 0; i < n; i++) { const a = (i / n) * TAU + rand(-0.04, 0.04) + y * 7; gl.push({ p: new V3(Math.cos(a) * r, y + rand(-0.02, 0.02), Math.sin(a) * r), s: rand(0.055, 0.075) }); } }
  }
  const gb = granolaInstances(gl); gb.traverse(o => { o.castShadow = false; }); g.add(gb);
  const core = mesh(new THREE.CylinderGeometry(cupR(0.6) - 0.3, cupR(0.05) - 0.3, 0.55, 32), MATC.granolaCore()); core.position.y = 0.33; g.add(core);
  // yogurt band with a wavy, layered edge
  const yg = once('g.yband', () => {
    const geo = new THREE.CylinderGeometry(cupR(0.86) - 0.014, cupR(0.56) - 0.014, 0.3, 96, 12, false);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x); if (Math.abs(y) > 0.14) p.setY(i, y + Math.sign(y) * 0.035 * noise3(Math.cos(a) * 2, Math.sin(a) * 2, y > 0 ? 1 : 5)); }
    geo.computeVertexNormals(); return geo;
  });
  const band = mesh(yg, MATC.yogurtCup()); band.position.y = 0.71; g.add(band);
  // fruit layer: yogurt core + ring of fruit against the wall
  const fcore = mesh(new THREE.CylinderGeometry(cupR(1.4) - 0.24, cupR(0.85) - 0.24, 0.55, 48), MATC.fruitMix()); fcore.position.y = 1.12; g.add(fcore);
  if (wall) g.add(wallFruit(fruits));
  // dome the top fruit sits on
  const v = VESSELS.cup;
  const dome = mesh(once('g.cdome', () => new THREE.SphereGeometry(1, 64, 24, 0, TAU, 0, Math.PI / 2)), MATC.yogurtCup());
  const dr = v.domeR || v.R, dh = v.base + v.rise * Math.sqrt(1 - (dr / v.R) ** 2);
  dome.scale.set(dr, dh - (v.base - 0.12), dr); dome.position.y = v.base - 0.12; dome.material = MATC.fruitMix(); dome.castShadow = false; dome.name = 'dome'; g.add(dome);
  if (contactShadow) {
    const t = once('t.contactCup', () => {
      const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
      const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
      gr.addColorStop(0, 'rgba(30,25,15,0.5)'); gr.addColorStop(0.3, 'rgba(30,25,15,0.38)'); gr.addColorStop(0.42, 'rgba(30,25,15,0.1)'); gr.addColorStop(1, 'rgba(30,25,15,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
    });
    const cs = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
    cs.rotation.x = -Math.PI / 2; cs.position.y = 0.003; cs.renderOrder = -1; g.add(cs);
  }
  return g;
}

// ---------- toppings & garnish, dropped onto the actual fruit surface ----------
function mintSprig() {
  const leafGeo = once('g.mintleaf', () => {
    const sh = new THREE.Shape(), N = 22, L = 0.42, W = 0.17;
    const pts = [];
    for (let i = 0; i <= N; i++) { const t = i / N, w = Math.sin(Math.pow(t, 0.8) * Math.PI) * W * (1 - t * 0.25), saw = (i % 2 ? 0.86 : 1); pts.push([w * saw, t * L]); }
    sh.moveTo(0, 0); pts.forEach(([x, y]) => sh.lineTo(x, y)); [...pts].reverse().forEach(([x, y]) => sh.lineTo(-x, y));
    const g = new THREE.ShapeGeometry(sh, 2), p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); uv.setXY(i, x / (2 * W) + 0.5, y / L); p.setZ(i, x * x * 2.2 - y * y * 0.6 + 0.006 * noise3(x * 30, y * 30, 2)); }
    g.computeVertexNormals(); return g;
  });
  const stemMat = once('m.mstem', () => phys({ color: '#5a8a2e', roughness: 0.5 }));
  const g = new THREE.Group();
  const stem = mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.22, 6), stemMat); stem.position.y = 0.06; g.add(stem);
  const pairs = [[0.15, 0.55, 0.75], [0.07, 0.95, 1.0], [-0.02, 1.0, 1.1]];
  pairs.forEach(([y, sc, tilt], k) => {
    for (const side of [-1, 1]) {
      const piv = new THREE.Group(); piv.position.y = y; piv.rotation.y = (side > 0 ? 0 : Math.PI) + k * 1.57;
      const l = mesh(leafGeo, MATC.mint()); l.scale.setScalar(sc); l.rotation.x = -Math.PI / 2 + tilt * 0.55; piv.add(l); g.add(piv);
    }
  });
  const top = new THREE.Group(); [0, 1, 2].forEach(i => { const l = mesh(leafGeo, MATC.mint()); l.scale.setScalar(0.45); l.rotation.set(-0.35, (i / 3) * TAU, 0); top.add(l); }); top.position.y = 0.17; g.add(top);
  return g;
}

// pieces: [{group, target}] (groups may be mid-animation; we raycast against their final pose)
export function makeToppings(pieces, toppings = [], { vessel = 'cup', garnish = true, droplets = true } = {}) {
  const v = VESSELS[vessel];
  const root = new THREE.Group();
  const saved = pieces.map(p => p.group.position.clone());
  const scene = new THREE.Group();
  const domeProxy = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 12, 0, TAU, 0, Math.PI / 2)); domeProxy.scale.set(v.R, v.rise, v.R); domeProxy.position.y = v.base;
  scene.add(domeProxy);
  const parents = pieces.map(p => p.group.parent);
  pieces.forEach(p => { p.group.position.copy(p.target); scene.add(p.group); });
  scene.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), down = new V3(0, -1, 0), nrm = new THREE.Matrix3();
  const hitAt = (r, a) => {
    ray.set(new V3(Math.cos(a) * r, 4, Math.sin(a) * r), down);
    const h = ray.intersectObject(scene, true).find(x => x.face);
    if (!h) return null;
    nrm.getNormalMatrix(h.object.matrixWorld);
    return { p: h.point.clone(), n: h.face.normal.clone().applyMatrix3(nrm).normalize(), o: h.object };
  };
  const scatter = (count, rMax = v.R * 0.95, fruitOnly = false) => { const out = []; for (let i = 0; i < count * 4 && out.length < count; i++) { const h = hitAt(Math.sqrt(Math.random()) * rMax, rand(0, TAU)); if (h && (!fruitOnly || h.o !== domeProxy)) out.push(h); } return out; };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new V3(0, 1, 0), sc = new V3(), tq = new THREE.Quaternion();
  const instanced = (geo, mat, hits, sizeFn, lift = 0, colors) => {
    const im = new THREE.InstancedMesh(geo, mat, hits.length);
    hits.forEach((h, i) => { q.setFromUnitVectors(up, h.n); tq.setFromAxisAngle(up, rand(0, TAU)); q.multiply(tq); const s = sizeFn(); sc.set(s[0], s[1], s[2]); m4.compose(h.p.clone().addScaledVector(h.n, lift * s[1]), q, sc); im.setMatrixAt(i, m4); if (colors) im.setColorAt(i, colors()); });
    im.castShadow = false; im.receiveShadow = true; return im;
  };
  const has = t => toppings.includes(t);
  if (has('granola')) root.add(granolaInstances(scatter(34).map(h => ({ p: h.p.addScaledVector(h.n, 0.03), s: rand(0.06, 0.09) }))));
  if (has('chia')) {
    const c = new THREE.Color();
    root.add(instanced(once('g.chia', () => new THREE.SphereGeometry(1, 6, 4)), MATC.chia(), scatter(380), () => { const s = rand(0.009, 0.013); return [s, s * 0.55, s * 0.75]; }, 0.3,
      () => c.setHSL(0.08, 0.1, rand(0.04, 0.22)).clone()));
  }
  if (has('nuts')) {
    const hits = scatter(16);
    const half = hits.filter((_, i) => i % 2), pep = hits.filter((_, i) => !(i % 2));
    root.add(instanced(once('g.nut', () => new THREE.SphereGeometry(1, 16, 10, 0, TAU, 0, Math.PI / 2)), MATC.nut(), half, () => { const s = rand(0.045, 0.06); return [s * 0.75, s * 0.5, s]; }));
    root.add(instanced(once('g.pep', () => new THREE.SphereGeometry(1, 14, 8)), MATC.pepita(), pep, () => { const s = rand(0.04, 0.05); return [s * 0.6, s * 0.22, s]; }, 0.5));
  }
  if (has('coconut')) {
    const geo = once('g.coco', () => { const g = new THREE.PlaneGeometry(1, 0.35, 6, 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getX(i) ** 2 * 0.6); g.rotateX(-Math.PI / 2); g.computeVertexNormals(); return g; });
    root.add(instanced(geo, MATC.coconut(), scatter(26), () => { const s = rand(0.08, 0.12); return [s, s, s]; }, 0.2));
  }
  if (has('yogurt')) {
    const h = hitAt(rand(0.2, 0.5), rand(0, TAU));
    if (h) {
      const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new V2(Math.max(0.001, 0.3 * Math.sin((1 - t) * Math.PI * 0.55) * (1 + 0.08 * Math.sin(t * 30))), t * 0.28)); }
      const dol = mesh(new THREE.LatheGeometry(pts, 32), MATC.yogurtCup()); dol.position.copy(h.p).y -= 0.04; root.add(dol);
    }
  }
  if (has('honey')) {
    const path = []; const a0 = rand(0, TAU);
    for (let i = 0; i <= 60; i++) { const t = i / 60, r = 0.15 + t * v.R * 0.75, a = a0 + Math.sin(t * 9) * 0.5 + t * 2.2; const h = hitAt(r, a); if (h) path.push(h.p.addScaledVector(h.n, 0.01)); }
    if (path.length > 4) root.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path), 160, 0.016, 8), MATC.honey()));
  }
  if (droplets) root.add(instanced(once('g.drop', () => new THREE.SphereGeometry(1, 12, 8)), MATC.drop(), scatter(40, v.R * 0.95, true), () => { const s = rand(0.012, 0.024); return [s, s * 0.6, s]; }, 0.2));
  if (garnish) {
    const h = hitAt(rand(0.05, 0.25), rand(0, TAU)) || { p: new V3(0, v.base + v.rise, 0) };
    const sp = mintSprig(); sp.scale.setScalar(1.0); sp.position.copy(h.p).y -= 0.03; sp.rotation.set(rand(-0.2, 0.2), rand(0, TAU), rand(-0.2, 0.2)); root.add(sp);
  }
  // restore pieces to their parents / animated positions
  pieces.forEach((p, i) => { if (parents[i]) parents[i].add(p.group); else scene.remove(p.group); p.group.position.copy(saved[i]); });
  return root;
}

// =====================================================================
//  STAGE
// =====================================================================
export function createStage(canvas, { fov = 32, camPos = [0, 3, 6], target = [0, 0.55, 0], shadow = true, size } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!size });
  const lowPower = (navigator.hardwareConcurrency || 8) <= 4 || Math.min(screen.width, screen.height) < 600;
  renderer.setPixelRatio(size ? 1 : Math.min(window.devicePixelRatio, lowPower ? 1.25 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = shadow;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  camera.position.set(...camPos); camera.lookAt(...target);

  scene.add(new THREE.HemisphereLight('#fff4e2', '#d9a77a', 0.5));
  const key = new THREE.DirectionalLight('#fff0dc', 2.6);
  key.position.set(-3.5, 7, 4); key.castShadow = shadow;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -3.2, right: 3.2, top: 3.2, bottom: -3.2, near: 1, far: 20 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
  scene.add(key);
  const fill = new THREE.DirectionalLight('#dfe9ff', 0.6); fill.position.set(5, 3, 2); scene.add(fill);
  const rim = new THREE.DirectionalLight('#ffe2c4', 1.2); rim.position.set(1, 4, -6); scene.add(rim);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.2 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  function resize() {
    const w = size ? size[0] : canvas.clientWidth, h = size ? size[1] : canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  if (!size) new ResizeObserver(resize).observe(canvas);
  resize();
  return { THREE, renderer, scene, camera, resize };
}

// sit an object on the ground plane (y = 0)
export function placeOnGround(obj, y = 0) {
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj);
  obj.position.y += y - b.min.y;
  return obj;
}

export { THREE };
