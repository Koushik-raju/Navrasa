// Navrasa menu illustrations — a hand-built SVG picture for every menu item.
// Each item is drawn from a small recipe: the vessel (bowl / glass / jar / ramekin), its colours and what sits on top.
// Crisp at any size, no image files to download. Uploading a real photo in the admin panel replaces the drawing.

// ---------- tiny helpers ----------
function rng(seed) { let h = 2166136261; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; }
const shade = (hex, k) => { // k<0 darker, k>0 lighter
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = k < 0 ? 0 : 255, p = Math.abs(k); r = Math.round(r + (t - r) * p); g = Math.round(g + (t - g) * p); b = Math.round(b + (t - b) * p);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
};

// ---------- toppings / pieces ----------
const P = {
  cube: (x, y, s, c, r) => `<g transform="translate(${x},${y}) rotate(${r * 40 - 20}) scale(${s})"><rect x="-7" y="-6" width="14" height="13" rx="3" fill="${shade(c, -0.12)}"/><rect x="-7" y="-8" width="14" height="10" rx="3" fill="${c}"/><rect x="-4.5" y="-6.5" width="6" height="3" rx="1.5" fill="#fff" opacity=".35"/></g>`,
  coin: (x, y, s, c, r, opt = {}) => `<g transform="translate(${x},${y}) rotate(${r * 30 - 15}) scale(${s})"><ellipse rx="10" ry="6.4" cy="1.6" fill="${shade(opt.rim || c, -0.25)}"/><ellipse rx="10" ry="6.4" fill="${opt.rim || c}"/><ellipse rx="8.2" ry="5.1" fill="${c}"/>${opt.core ? `<ellipse rx="3" ry="1.9" fill="${opt.core}"/>` : ''}${opt.seeds ? Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * 6.283; return `<ellipse cx="${(Math.cos(a) * 4.6).toFixed(1)}" cy="${(Math.sin(a) * 2.9).toFixed(1)}" rx=".9" ry=".5" fill="#2a1a0a"/>`; }).join('') : ''}${opt.ring ? `<ellipse rx="5.2" ry="3.2" fill="none" stroke="${opt.ring}" stroke-width=".8" opacity=".7"/>` : ''}<ellipse cx="-3" cy="-2" rx="3" ry="1.2" fill="#fff" opacity=".3"/></g>`,
  berry: (x, y, s, c) => `<g transform="translate(${x},${y}) scale(${s})"><circle r="6" fill="${c}"/><circle cx="-2" cy="-2.2" r="1.8" fill="#fff" opacity=".35"/><path d="M-1.6 -4.8 l1.6 1.2 l1.6 -1.2" stroke="${shade(c, -0.4)}" stroke-width="1" fill="none"/></g>`,
  grape: (x, y, s, c) => `<g transform="translate(${x},${y}) scale(${s})"><ellipse rx="5.6" ry="6.4" fill="${c}"/><ellipse cx="-2" cy="-2.6" rx="1.6" ry="2.2" fill="#fff" opacity=".4"/></g>`,
  pearl: (x, y, s, c) => `<g transform="translate(${x},${y}) scale(${s})"><circle r="3.2" fill="${c}"/><circle cx="-1" cy="-1.1" r="1" fill="#fff" opacity=".6"/></g>`,
  straw: (x, y, s, c, r) => `<g transform="translate(${x},${y}) rotate(${r * 40 - 20}) scale(${s})"><path d="M0 -9 C7 -9 9 -2 8 3 C6 9 -6 9 -8 3 C-9 -2 -7 -9 0 -9Z" fill="${c}"/>${Array.from({ length: 9 }, (_, i) => `<ellipse cx="${(i % 3) * 4.5 - 4.5}" cy="${Math.floor(i / 3) * 4.6 - 4}" rx=".8" ry="1.1" fill="#ffe08a"/>`).join('')}<path d="M-6 -8 C-3 -12 3 -12 6 -8 C3 -9 -3 -9 -6 -8Z" fill="#3f8f2a"/></g>`,
  leaf: (x, y, s, c, r) => `<g transform="translate(${x},${y}) rotate(${r * 120 - 60}) scale(${s})"><path d="M0 0 C6 -6 14 -5 18 0 C14 5 6 6 0 0Z" fill="${c}"/><path d="M1 0 L16 0" stroke="${shade(c, 0.35)}" stroke-width=".8"/></g>`,
  granola: (x, y, s, c, r) => `<g transform="translate(${x},${y}) rotate(${r * 360}) scale(${s})"><path d="M-5 -2 C-6 -6 -1 -7 1 -5 C4 -7 7 -3 5 0 C7 3 3 6 0 4 C-3 6 -7 3 -5 -2Z" fill="${c}"/><circle cx="-1" cy="-1" r="1.2" fill="${shade(c, 0.3)}"/><circle cx="2" cy="1.5" r=".9" fill="${shade(c, -0.25)}"/></g>`,
  seed: (x, y, s, c, r) => `<ellipse cx="${x}" cy="${y}" rx="${1.3 * s}" ry="${0.8 * s}" transform="rotate(${r * 180} ${x} ${y})" fill="${c}"/>`,
  dot: (x, y, s, c) => `<g transform="translate(${x},${y}) scale(${s})"><circle r="2.8" fill="${c}"/><circle cx="-.8" cy="-.9" r=".8" fill="#fff" opacity=".45"/></g>`,
  wedge: (x, y, s, c, r, opt = {}) => `<g transform="translate(${x},${y}) rotate(${r * 50 - 25}) scale(${s})"><path d="M-11 4 Q0 -12 11 4 Z" fill="${opt.skin || shade(c, -0.2)}"/><path d="M-9 3.5 Q0 -9 9 3.5 Z" fill="${c}"/>${opt.seeds ? '<ellipse cx="-3" cy="0" rx=".9" ry="1.4" fill="#1b1b1b"/><ellipse cx="2" cy="-1" rx=".9" ry="1.4" fill="#1b1b1b"/>' : ''}</g>`,
  drizzle: (x, y, s, c, r) => `<path d="M${x - 16 * s} ${y} q${8 * s} ${-6 * s} ${16 * s} 0 t${16 * s} 0" stroke="${c}" stroke-width="${2.2 * s}" fill="none" stroke-linecap="round" opacity=".9"/>`,
};
// what each topping keyword draws
const T = {
  mango: ['cube', '#ffa41b'], papaya: ['cube', '#ff8a3d'], melon: ['cube', '#f2455a'], pineapple: ['cube', '#ffd84d'], paneer: ['cube', '#fff7e6'], apple: ['wedge', '#fbf1cf', { skin: '#d7263d' }],
  greenapple: ['wedge', '#fbf1cf', { skin: '#8cc63f' }], watermelon: ['wedge', '#f2455a', { skin: '#2f7d32', seeds: 1 }], orange: ['wedge', '#ffa63a', { skin: '#ff8a1c' }],
  banana: ['coin', '#fbeec0', { rim: '#f6e39a', core: '#e9d29a' }], kiwi: ['coin', '#8cc63f', { rim: '#7a5a32', core: '#f1edc4', seeds: 1 }], cucumber: ['coin', '#d9f0b8', { rim: '#3d8b2f', ring: '#a6d07a' }],
  tomato: ['coin', '#e8433a', { rim: '#c8241c', ring: '#ffb3a0' }], carrot: ['coin', '#ff8c2a', { rim: '#e86f0e', ring: '#ffc06e' }], beet: ['coin', '#a3123f', { rim: '#7a0c2e', ring: '#d24a7a' }],
  strawberry: ['straw', '#e3262f'], blueberry: ['berry', '#3b4a9c'], grape: ['grape', '#7b2e8a'], greengrape: ['grape', '#a6cf45'],
  pomegranate: ['pearl', '#c0102c'], mint: ['leaf', '#3f9a2c'], lettuce: ['leaf', '#76b947'], coriander: ['leaf', '#4caa3c'], granola: ['granola', '#c98a43'],
  chia: ['seed', '#2a2622'], seeds: ['seed', '#8a6a3a'], corn: ['dot', '#ffd23f'], chickpea: ['dot', '#e8c98a'], sprout: ['dot', '#cfe6a0'], quinoa: ['dot', '#f2e2c0'],
  capsicum: ['cube', '#3fa34d'], redpepper: ['cube', '#e23d2e'], onion: ['wedge', '#f1d4ea', { skin: '#b85c9e' }], cocoa: ['seed', '#4a2a17'], coconut: ['wedge', '#fffaf0', { skin: '#8a5a32' }],
  honey: ['drizzle', '#f0a81c'], pb: ['drizzle', '#a86a2a'], choc: ['drizzle', '#4a2416'], dates: ['granola', '#6a3818'], oats: ['granola', '#e8d2a0'],
};
const SMALL = new Set(['chia', 'seeds', 'cocoa', 'pomegranate', 'corn', 'chickpea', 'sprout', 'quinoa']);

// scatter toppings across an elliptical heap; back-to-front so it reads as 3D
function heap(rand, cx, cy, rx, ry, list, scale = 1) {
  const items = [];
  list.forEach(([key, n]) => {
    const t = T[key]; if (!t) return;
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * 0.92;
      const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d - (1 - d * d) * ry * 1.1;
      const s = (SMALL.has(key) ? 1 : 0.92 + rand() * 0.25) * scale * (key === 'chia' ? 1.4 : 1);
      items.push({ y, svg: P[t[0]](+x.toFixed(1), +y.toFixed(1), +s.toFixed(2), t[1], rand(), t[2]) });
    }
  });
  return items.sort((a, b) => a.y - b.y).map(i => i.svg).join('');
}

// ---------- vessels ----------
let uid = 0;
function bowl(id, spec, rand, o = {}) { // ceramic bowl with a heaped top
  const { x = 120, y = 0, s = 1 } = o, u = `b${uid++}`;
  const base = spec.base || '#fff3dc';
  return `<g transform="translate(${x - 120 * s},${y}) scale(${s})">
    <defs><linearGradient id="${u}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e9e1d4"/></linearGradient>
      <radialGradient id="${u}f" cx=".45" cy=".35" r=".8"><stop offset="0" stop-color="${shade(base, 0.25)}"/><stop offset="1" stop-color="${shade(base, -0.12)}"/></radialGradient></defs>
    <ellipse cx="120" cy="142" rx="62" ry="8" fill="#5a3a1a" opacity=".16"/>
    <path d="M52 84 C54 116 82 138 120 138 C158 138 186 116 188 84 Z" fill="url(#${u}w)"/>
    <path d="M60 96 C70 120 92 132 120 133" stroke="#fff" stroke-width="3" fill="none" opacity=".7" stroke-linecap="round"/>
    <rect x="98" y="133" width="44" height="7" rx="3.5" fill="#ddd3c3"/>
    ${spec.band ? `<path d="M56 100 C80 108 160 108 184 100" stroke="${spec.band}" stroke-width="4" fill="none" opacity=".85"/>` : ''}
    <ellipse cx="120" cy="84" rx="68" ry="14" fill="#efe7da"/>
    <ellipse cx="120" cy="82" rx="63" ry="11.5" fill="url(#${u}f)"/>
    <path d="M57 82 C60 52 90 44 120 44 C150 44 180 52 183 82 Z" fill="url(#${u}f)"/>
    ${heap(rand, 120, 66, 52, 17, spec.top || [], spec.pieceScale || 1.45)}
  </g>`;
}
function glass(id, spec, rand, o = {}) { // tall glass with a drink, straw and garnish
  const { x = 120, y = 0, s = 1 } = o, u = `g${uid++}`;
  const c = spec.liquid || '#ffb627', top = spec.foam ? shade(c, 0.45) : shade(c, 0.15);
  return `<g transform="translate(${x - 120 * s},${y}) scale(${s})">
    <defs><linearGradient id="${u}l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${shade(c, -0.18)}"/><stop offset=".45" stop-color="${shade(c, 0.12)}"/><stop offset="1" stop-color="${shade(c, -0.25)}"/></linearGradient></defs>
    <ellipse cx="120" cy="146" rx="34" ry="6" fill="#5a3a1a" opacity=".16"/>
    ${spec.straw === false ? '' : `<path d="M118 46 L134 6 L140 8 L125 47 Z" fill="${spec.strawColor || '#ff5a3c'}"/><path d="M134 6 L140 8 L138.4 12 L132.4 10 Z" fill="#fff" opacity=".5"/>`}
    <path d="M90 34 L96 140 C96 146 144 146 144 140 L150 34 Z" fill="#ffffff" opacity=".35"/>
    <path d="M92 ${spec.fill || 44} L97 139 C98 143 142 143 143 139 L148 ${spec.fill || 44} Z" fill="url(#${u}l)"/>
    <ellipse cx="120" cy="${spec.fill || 44}" rx="28" ry="5" fill="${top}"/>
    ${spec.foam ? `<ellipse cx="120" cy="${(spec.fill || 44) - 2}" rx="25" ry="4" fill="#fff" opacity=".35"/>` : ''}
    ${spec.ice ? `<rect x="104" y="${(spec.fill || 44) + 4}" width="11" height="10" rx="2" fill="#fff" opacity=".45" transform="rotate(-12 110 60)"/><rect x="122" y="${(spec.fill || 44) + 9}" width="10" height="9" rx="2" fill="#fff" opacity=".4" transform="rotate(10 127 64)"/>` : ''}
    ${spec.bits ? heap(rand, 120, 100, 18, 30, spec.bits, 0.7) : ''}
    <path d="M90 34 L96 140 C96 146 144 146 144 140 L150 34" fill="none" stroke="#ffffff" stroke-width="2.4" opacity=".9"/>
    <ellipse cx="120" cy="34" rx="30" ry="5.5" fill="none" stroke="#ffffff" stroke-width="2" opacity=".9"/>
    <path d="M97 48 L101 128" stroke="#fff" stroke-width="3.5" opacity=".45" stroke-linecap="round"/>
    ${spec.rim ? (T[spec.rim] ? P[T[spec.rim][0]](150, 34, 1.5, T[spec.rim][1], 0.35, T[spec.rim][2]) : '') : ''}
    ${spec.garnish ? heap(rand, 118, (spec.fill || 44) - 3, 14, 3, spec.garnish, 0.85) : ''}
  </g>`;
}
function jar(id, spec, rand, o = {}) { // layered jar (overnight oats, parfait, pudding)
  const { x = 120, y = 0, s = 1 } = o, L = spec.layers || ['#e8d2a0', '#fff6e6'];
  const h = 92 / L.length;
  return `<g transform="translate(${x - 120 * s},${y}) scale(${s})">
    <ellipse cx="120" cy="146" rx="40" ry="6" fill="#5a3a1a" opacity=".16"/>
    <rect x="84" y="40" width="72" height="104" rx="14" fill="#ffffff" opacity=".4"/>
    ${L.map((c, i) => `<rect x="87" y="${(48 + i * h).toFixed(1)}" width="66" height="${(h + 1).toFixed(1)}" fill="${c}" ${i === L.length - 1 ? 'rx="11"' : ''}/>`).join('')}
    ${L.slice(1).map((c, i) => `<path d="M87 ${(48 + (i + 1) * h).toFixed(1)} q8 -4 16 0 t16 0 t16 0 t16 0 t2 0" fill="${c}"/>`).join('')}
    <ellipse cx="120" cy="48" rx="33" ry="6" fill="${shade(L[0], 0.12)}"/>
    ${heap(rand, 120, 44, 26, 4, spec.top || [], 0.85)}
    <rect x="84" y="40" width="72" height="104" rx="14" fill="none" stroke="#fff" stroke-width="2.4" opacity=".95"/>
    <rect x="90" y="56" width="5" height="76" rx="2.5" fill="#fff" opacity=".45"/>
    <rect x="82" y="30" width="76" height="10" rx="4" fill="${spec.lid || '#2f6b3a'}"/>
  </g>`;
}
function ramekin(id, spec, rand, o = {}) { // small dish for add-ons
  const { x = 120, y = 0, s = 1 } = o;
  return `<g transform="translate(${x - 120 * s},${y}) scale(${s})">
    <ellipse cx="120" cy="128" rx="46" ry="7" fill="#5a3a1a" opacity=".16"/>
    <path d="M78 92 C80 116 98 126 120 126 C142 126 160 116 162 92 Z" fill="#ffffff"/>
    <ellipse cx="120" cy="92" rx="42" ry="10" fill="#efe7da"/>
    <path d="M84 92 C86 70 104 64 120 64 C136 64 154 70 156 92 Z" fill="${spec.base || '#f6ead8'}"/>
    ${heap(rand, 120, 80, 30, 10, spec.top || [], 1.3)}
  </g>`;
}
const V = { bowl, glass, jar, ramekin };

// ---------- recipe for every menu item ----------
const B = (base, top, extra = {}) => ({ v: 'bowl', base, top, ...extra });
const G = (liquid, extra = {}) => ({ v: 'glass', liquid, ...extra });
const J = (layers, top, extra = {}) => ({ v: 'jar', layers, top, ...extra });
const R = (base, top) => ({ v: 'ramekin', base, top });
export const ART = {
  'watermelon-fresh-bowl': B('#f2455a', [['melon', 14], ['mint', 2]]),
  'papaya-fresh-bowl': B('#ff8a3d', [['papaya', 14], ['mint', 2]]),
  'seasonal-mix-bowl': B('#fff0d6', [['apple', 3], ['banana', 3], ['grape', 4], ['orange', 3], ['pomegranate', 8]]),
  'tropical-fruit-bowl': B('#ffe7a8', [['pineapple', 4], ['mango', 4], ['banana', 3], ['melon', 3], ['mint', 2]]),
  'fruit-seed-bowl': B('#fff0d6', [['banana', 3], ['apple', 2], ['kiwi', 2], ['pomegranate', 8], ['chia', 26], ['seeds', 16]]),
  'mango-fruit-bowl': B('#ffb627', [['mango', 15], ['mint', 2]]),
  'apple-pomegranate-bowl': B('#fbeedc', [['apple', 6], ['greenapple', 2], ['pomegranate', 22]]),

  'banana-smoothie': G('#f6e2a0', { foam: 1, rim: 'banana' }),
  'banana-oats-smoothie': G('#e9d39a', { foam: 1, garnish: [['oats', 4]] }),
  'mango-smoothie': G('#ffa41b', { foam: 1, rim: 'mango' }),
  'choco-banana-smoothie': G('#7a4a2a', { foam: 1, garnish: [['cocoa', 10]], rim: 'banana' }),
  'strawberry-smoothie': G('#f26d8a', { foam: 1, rim: 'strawberry' }),
  'pineapple-coconut-smoothie': G('#fff0a8', { foam: 1, rim: 'pineapple' }),
  'banana-peanut-butter-smoothie': G('#c99a5c', { foam: 1, garnish: [['pb', 1]] }),
  'mango-banana-smoothie': G('#ffc04a', { foam: 1, rim: 'mango' }),
  'apple-cinnamon-smoothie': G('#e3c08a', { foam: 1, garnish: [['cocoa', 8]], rim: 'apple' }),
  'dates-banana-smoothie': G('#b98a5a', { foam: 1, garnish: [['dates', 2]] }),

  'banana-crunch-bowl': B('#f3dc8a', [['banana', 6], ['granola', 8], ['chia', 16], ['honey', 1]], { band: '#ffcf4a' }),
  'mango-tropical-bowl': B('#ffaa2b', [['mango', 5], ['pineapple', 4], ['coconut', 3], ['chia', 14]], { band: '#ffaa2b' }),
  'choco-banana-bowl': B('#6e3f22', [['banana', 6], ['granola', 6], ['cocoa', 18], ['choc', 1]], { band: '#6e3f22' }),
  'peanut-butter-bowl': B('#c99a5c', [['banana', 6], ['granola', 6], ['seeds', 14], ['pb', 1]], { band: '#c99a5c' }),
  'fruit-granola-bowl': B('#b05a9a', [['strawberry', 3], ['banana', 3], ['kiwi', 2], ['blueberry', 5], ['granola', 6], ['mint', 1]], { band: '#b05a9a' }),

  'watermelon-juice': G('#f2455a', { ice: 1, rim: 'watermelon' }),
  'mosambi-juice': G('#e9e27a', { ice: 1, rim: 'orange' }),
  'pineapple-juice': G('#ffd84d', { ice: 1, rim: 'pineapple' }),
  'orange-juice': G('#ff9a1f', { ice: 1, rim: 'orange' }),
  'papaya-smooth-juice': G('#ff8f4a', { rim: 'papaya' }),
  'carrot-juice': G('#ff7f1f', { rim: 'carrot' }),
  'beetroot-juice': G('#9a1238', { rim: 'beet' }),
  'cucumber-mint-cooler': G('#c8e89a', { ice: 1, rim: 'cucumber', garnish: [['mint', 2]] }),
  'pomegranate-juice': G('#b3102e', { ice: 1, garnish: [['pomegranate', 6]] }),
  'apple-juice': G('#f2c85a', { ice: 1, rim: 'apple' }),
  'mixed-fruit-juice': G('#ffad3b', { ice: 1, rim: 'orange', garnish: [['mint', 1]] }),

  'garden-crunch-salad': B('#9ccc65', [['lettuce', 6], ['cucumber', 3], ['tomato', 3], ['carrot', 3], ['capsicum', 3]]),
  'chickpea-chaat-salad': B('#e8c98a', [['chickpea', 22], ['onion', 3], ['tomato', 3], ['coriander', 4]]),
  'paneer-power-salad': B('#a5d36b', [['paneer', 7], ['lettuce', 4], ['cucumber', 2], ['redpepper', 3], ['tomato', 2]]),
  'sweet-corn-salad': B('#ffe08a', [['corn', 34], ['capsicum', 3], ['redpepper', 3], ['coriander', 2]]),
  'sprouts-veggie-salad': B('#cfe6a0', [['sprout', 30], ['onion', 2], ['tomato', 3], ['cucumber', 2], ['coriander', 3]]),
  'quinoa-veggie-salad': B('#f2e2c0', [['quinoa', 36], ['redpepper', 3], ['capsicum', 3], ['cucumber', 2], ['tomato', 2]]),
  'premium-paneer-salad': B('#94c45a', [['paneer', 8], ['lettuce', 5], ['tomato', 3], ['redpepper', 2], ['seeds', 14]], { band: '#2f6b3a' }),
  'cucumber-corn-salad': B('#d9f0b8', [['cucumber', 6], ['corn', 22], ['mint', 2]]),

  'banana-overnight-oats': J(['#efe1bf', '#e2cc95', '#f5ebd6'], [['banana', 4], ['chia', 10]]),
  'chocolate-overnight-oats': J(['#8a5a3a', '#6e4428', '#a8794e'], [['banana', 3], ['cocoa', 12]]),
  'fruit-yogurt-parfait': J(['#fffaf0', '#c98a43', '#fffaf0', '#f2a0b0'], [['strawberry', 2], ['banana', 2], ['granola', 3]]),
  'chia-fruit-pudding': J(['#ece3d2', '#ffb627'], [['mango', 3], ['banana', 2], ['chia', 12]], { lid: '#b8862f' }),
  'chickpea-power-bowl': B('#e8c98a', [['chickpea', 24], ['cucumber', 3], ['tomato', 3], ['coriander', 3]]),
  'paneer-veggie-bowl': B('#f3e0b0', [['paneer', 8], ['capsicum', 3], ['redpepper', 3], ['corn', 10], ['coriander', 2]]),
  'mango-yogurt-parfait': J(['#fffaf0', '#ffb627', '#c98a43', '#fffaf0'], [['mango', 4], ['granola', 2]], { lid: '#e08a10' }),

  'extra-banana': R('#fbeec0', [['banana', 5]]), 'extra-apple': R('#fbf1cf', [['apple', 4]]), 'pomegranate': R('#c0102c', [['pomegranate', 26]]),
  'mixed-seeds': R('#cdb98a', [['seeds', 40], ['chia', 20]]), 'chia-seeds': R('#3a332c', [['chia', 46]]), 'granola': R('#c98a43', [['granola', 12]]),
  'oats': R('#efe1bf', [['oats', 12]]), 'peanut-butter': R('#b07a3a', [['pb', 2]]), 'yogurt-dip': R('#fffaf0', [['mint', 1]]),
  'extra-paneer': R('#fff7e6', [['paneer', 7]]), 'chickpeas': R('#e8c98a', [['chickpea', 22]]),
};
const COMBOS = {
  'morning-fresh-combo': [['seasonal-mix-bowl', 'bowl'], ['watermelon-juice', 'glass']],
  'healthy-lunch-combo': [['garden-crunch-salad', 'bowl'], ['banana-smoothie', 'glass']],
  'breakfast-combo': [['banana-overnight-oats', 'jar'], ['banana-smoothie', 'glass']],
  'share-enjoy-combo': [['seasonal-mix-bowl', 'bowl'], ['banana-smoothie', 'glass'], ['seasonal-mix-bowl', 'bowl'], ['banana-smoothie', 'glass']],
};
const PLANS = {
  '5-day-fresh-fruit-plan': ['watermelon-fresh-bowl', 'tropical-fruit-bowl', 'mango-fruit-bowl', 'seasonal-mix-bowl', 'apple-pomegranate-bowl'],
  '5-day-smoothie-plan': ['strawberry-smoothie', 'mango-smoothie', 'banana-smoothie', 'choco-banana-smoothie', 'pineapple-coconut-smoothie'],
  '5-day-salad-plan': ['garden-crunch-salad', 'paneer-power-salad', 'sweet-corn-salad', 'quinoa-veggie-salad', 'chickpea-chaat-salad'],
  '5-day-mixed-healthy-plan': ['seasonal-mix-bowl', 'mango-smoothie', 'garden-crunch-salad', 'banana-overnight-oats', 'orange-juice'],
};
const CAT_DEFAULT = {
  'fruit-bowls': B('#fff0d6', [['apple', 3], ['banana', 3], ['grape', 3], ['mango', 3]]), 'smoothies': G('#f6c27a', { foam: 1 }),
  'smoothie-bowls': B('#c9a0d8', [['banana', 4], ['granola', 6], ['blueberry', 4]]), 'juices': G('#ffad3b', { ice: 1 }),
  'salads': B('#9ccc65', [['lettuce', 6], ['tomato', 3], ['cucumber', 3]]), 'breakfast': J(['#efe1bf', '#f5ebd6'], [['banana', 3]]),
  'addons': R('#f6ead8', [['granola', 8]]), 'combos': B('#fff0d6', [['apple', 3], ['banana', 3]]), 'plans': B('#fff0d6', [['apple', 3], ['banana', 3]]),
};
const one = (id, rand, o) => { const sp = ART[id]; return sp ? V[sp.v](id, sp, rand, o) : ''; };

export function artFor(item) {
  const rand = rng(item.id);
  let inner;
  if (COMBOS[item.id]) {
    const parts = COMBOS[item.id];
    const xs = parts.length === 2 ? [88, 168] : [60, 104, 150, 194], s = parts.length === 2 ? 0.66 : 0.46, y = parts.length === 2 ? 40 : 60;
    inner = parts.map(([id], i) => one(id, rng(id + i), { x: xs[i], y: y + (parts[i][1] === 'glass' ? -6 : 0), s })).join('');
  } else if (PLANS[item.id]) {
    const ids = PLANS[item.id], xs = [40, 80, 120, 160, 200];
    inner = ids.map((id, i) => one(id, rng(id), { x: xs[i], y: 66, s: 0.36 })).join('') +
      `<g transform="translate(120,40)"><rect x="-34" y="-17" width="68" height="34" rx="10" fill="#2f6b3a"/><rect x="-34" y="-17" width="68" height="11" rx="6" fill="#ff5a3c"/>
       <text y="12" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-weight="800" font-size="17" fill="#fff">5 DAYS</text></g>`;
  } else {
    const sp = ART[item.id] || CAT_DEFAULT[item.category] || CAT_DEFAULT['fruit-bowls'];
    inner = V[sp.v](item.id, sp, rand, {});
  }
  return `<svg class="menu-art" viewBox="0 0 240 160" role="img" aria-label="${String(item.name).replace(/"/g, '')}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}
