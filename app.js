/* ─────────────────────────────────────────────
   NAVRASA — menu data, 3D bowls, interactions
   ───────────────────────────────────────────── */
document.documentElement.classList.add("js");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canHover = window.matchMedia("(hover: hover)").matches;

/* ── MENU (transcribed from the kitchen sheet) ── */
const MENU = [
  {
    id: "fruit",
    label: "Fruit Bowls",
    kicker: "Fresh, cut to order",
    items: [
      { n: "Watermelon Fresh Bowl", p: 35, d: "Watermelon 90 g · pomegranate 30 g · mint 5 g · lemon 20 g · salt & spice.", tag: "Lightest" },
      { n: "Papaya Fresh Bowl", p: 49, d: "Papaya 120 g · banana 40 g · lemon 20 g · mint · salt & spice." },
      { n: "Seasonal Mix Bowl", p: 79, d: "Seasonal fruit 150 g · curd 40 g · granola 25 g · honey 5 g." },
      { n: "Tropical Fruit Bowl", p: 99, d: "Pineapple 80 g · banana 60 g · papaya 70 g · coconut 20 g · pomegranate 30 g.", tag: "Bestseller" },
      { n: "Fruit & Seed Bowl", p: 109, d: "Seasonal fruit 150 g · mixed seeds 20 g · curd 50 g · pomegranate 30 g." }
    ]
  },
  {
    id: "salads",
    label: "Salads",
    kicker: "Savoury bowls",
    items: [
      { n: "Garden Crunch Salad", p: 79, d: "Lettuce 60 g · cucumber 50 g · tomato 40 g · pomegranate 20 g · lemon 10 g · dressing." },
      { n: "Chickpea Chat Salad", p: 99, d: "Chickpeas 100 g · onion 40 g · tomato 40 g · cucumber 40 g · mint 5 g · chaat masala." },
      { n: "Paneer Power Salad", p: 129, d: "Paneer 100 g · lettuce 60 g · tomato 40 g · cucumber 40 g · olive oil · lemon." },
      { n: "Sweet Corn Salad", p: 89, d: "Sweet corn 100 g · cucumber 50 g · tomato 40 g · onion 30 g · lemon 10 g · coriander." },
      { n: "Sprouts & Veggie Salad", p: 99, d: "Sprouts 80 g · cucumber 50 g · tomato 40 g · onion 30 g · lemon 10 g · chaat masala." },
      { n: "Quinoa Veggie Salad", p: 149, d: "Quinoa 90 g · cucumber 40 g · tomato 40 g · onion 30 g · olive oil · lemon." },
      { n: "Premium Paneer Salad", p: 169, d: "Paneer 120 g · lettuce 60 g · pomegranate 30 g · walnuts 15 g · olive oil.", tag: "Most protein" }
    ]
  },
  {
    id: "breakfast",
    label: "Breakfast",
    kicker: "Overnight & warm",
    items: [
      { n: "Banana Overnight Oats", p: 99, d: "Oats 50 g · milk 120 ml · curd 60 g · banana 80 g · chia 10 g." },
      { n: "Chocolate Overnight Oats", p: 109, d: "Oats 50 g · milk 120 ml · cocoa 10 g · banana 60 g · chia 10 g." },
      { n: "Fruit & Yogurt Parfait", p: 109, d: "Curd 150 g · seasonal fruit 100 g · granola 30 g · honey 10 g." },
      { n: "Chia Fruit Pudding", p: 99, d: "Chia 25 g · milk 150 ml · seasonal fruit 80 g · honey 10 g." },
      { n: "Chickpea Power Bowl", p: 129, d: "Chickpeas 120 g · quinoa 60 g · cucumber 40 g · tomato 40 g · curd 30 g." },
      { n: "Paneer Veggie Bowl", p: 149, d: "Paneer 100 g · quinoa 60 g · cucumber 40 g · tomato 40 g · mint 5 g." }
    ]
  },
  {
    id: "juices",
    label: "Juices",
    kicker: "250 ml · pressed daily",
    items: [
      { n: "Watermelon Juice 250 ml", p: 35, d: "Watermelon · lemon · black salt · mint." },
      { n: "Muskmelon Juice 250 ml", p: 45, d: "Muskmelon · lemon · black salt." },
      { n: "Pineapple Juice 250 ml", p: 45, d: "Pineapple · lemon · black salt · ice." },
      { n: "Orange Juice 250 ml", p: 55, d: "Orange · lemon · black salt." },
      { n: "Papaya Smoothie Juice 250 ml", p: 40, d: "Papaya · curd · milk · honey · cardamom." }
    ]
  },
  {
    id: "smoothies",
    label: "Smoothies",
    kicker: "250 ml · blended to order",
    items: [
      { n: "Banana Smoothie 250 ml", p: 69, d: "Banana 100 g · milk 150 ml · curd 40 g · honey 10 g." },
      { n: "Banana Oats Smoothie 250 ml", p: 89, d: "Banana 80 g · oats 30 g · milk 150 ml · curd 40 g." },
      { n: "Mango Smoothie 250 ml", p: 99, d: "Mango 120 g · curd 50 g · milk 120 ml · honey 10 g.", tag: "Seasonal" },
      { n: "Choco Banana Smoothie 250 ml", p: 99, d: "Banana 90 g · cocoa 10 g · milk 150 ml · curd 40 g." },
      { n: "Strawberry Smoothie 250 ml", p: 139, d: "Strawberry 120 g · curd 50 g · milk 120 ml · honey 10 g." },
      { n: "Pineapple Coconut Smoothie 250 ml", p: 99, d: "Pineapple 100 g · coconut milk 80 ml · curd 40 g." },
      { n: "Banana Peanut Butter Smoothie 250 ml", p: 109, d: "Banana 90 g · peanut butter 20 g · milk 150 ml · curd 40 g." }
    ]
  },
  {
    id: "bowls",
    label: "Smoothie Bowls",
    kicker: "Thick, spoonable",
    items: [
      { n: "Banana Crunch Bowl", p: 129, d: "Banana · curd · chia · peanut butter · granola · coconut." },
      { n: "Mango Tropical Bowl", p: 149, d: "Mango · pineapple · banana · papaya · coconut · granola · curd.", tag: "Signature" },
      { n: "Choco Banana Bowl", p: 149, d: "Banana · cocoa · oats · curd · chia · dark chocolate." },
      { n: "Peanut Butter Bowl", p: 159, d: "Banana · peanut butter · curd · oats · granola · coconut." },
      { n: "Fruit & Granola Bowl", p: 159, d: "Seasonal fruit · granola · mixed seeds · curd · honey." }
    ]
  },
  {
    id: "combos",
    label: "Combos",
    kicker: "Better together",
    items: [
      { n: "Morning Fresh Combo", p: 129, d: "Watermelon Fresh Bowl + Watermelon Juice 250 ml." },
      { n: "Healthy Lunch Combo", p: 149, d: "Garden Crunch Salad + Orange Juice 250 ml." },
      { n: "Breakfast Combo", p: 169, d: "Banana Overnight Oats + Banana Smoothie 250 ml." },
      { n: "Share & Enjoy Combo", p: 249, d: "Any two fruit bowls + any two juices 250 ml.", tag: "For two" }
    ]
  },
  {
    id: "addons",
    label: "Add-ons",
    kicker: "Any bowl, any time",
    items: [
      { n: "Extra banana", p: 15, d: "60 g · sliced to order." },
      { n: "Extra apple", p: 20, d: "60 g · crisp, diced." },
      { n: "Pomegranate", p: 20, d: "30 g · deseeded." },
      { n: "Mixed seeds", p: 20, d: "15 g · pumpkin, sunflower, flax, chia." },
      { n: "Chia seeds", p: 15, d: "10 g · soaked." },
      { n: "Granola", p: 20, d: "20 g · house-baked, never fried." },
      { n: "Oats", p: 15, d: "25 g · rolled." },
      { n: "Peanut butter", p: 20, d: "15 g · ground in-house." },
      { n: "Yogurt dip", p: 15, d: "30 g · curd, salt, mint." },
      { n: "Extra paneer", p: 25, d: "40 g · grilled." },
      { n: "Chickpeas", p: 15, d: "40 g · boiled, spiced." }
    ]
  },
  {
    id: "plans",
    label: "Subscriptions",
    kicker: "Five days at a time",
    items: [
      { n: "5-Day Fresh Fruit Plan", p: 349, d: "One fresh fruit bowl daily · rotating seasonal selection · morning pickup.", tag: "₹69.80 / bowl" },
      { n: "5-Day Smoothie Plan", p: 449, d: "One 250 ml smoothie daily · any flavour on the sheet · oats or peanut butter free.", tag: "₹89.80 / smoothie" },
      { n: "5-Day Salad Plan", p: 549, d: "One salad bowl daily · two dressings, changed weekly · lunch pickup.", tag: "₹109.80 / salad" },
      { n: "5-Day Mixed Healthy Plan", p: 599, d: "Bowl + juice or smoothie daily · chef's pick, savoury or sweet · priority pickup.", tag: "₹119.80 / day" }
    ]
  }
];

/* ── BOWL SPECS ───────────────────────────────── */
const BOWLS = {
  tropical: { name: "Tropical Fruit Bowl", price: 99, colors: ["#ffc247", "#ff9d3f", "#ffe08a", "#f7e9b0", "#8cbf77"], leaves: 2, chips: 2 },
  mango:    { name: "Mango Tropical Bowl", price: 149, colors: ["#ffcf5e", "#ffb03a", "#ff9d3f", "#f7e6a8", "#ff8f5e"], leaves: 2, chips: 3 },
  banana:   { name: "Banana Crunch Bowl", price: 129, colors: ["#f6e39a", "#f0d777", "#e9dfb4", "#d9a05b", "#faf0cf"], leaves: 1, chips: 6 },
  choco:    { name: "Choco Banana Bowl", price: 149, colors: ["#6b4630", "#4e3020", "#8a5c3c", "#f3dfa2", "#3d2418"], leaves: 1, chips: 4 },
  berry:    { name: "Fruit & Granola Bowl", price: 159, colors: ["#e0505f", "#c22f45", "#f2d06b", "#a8487f", "#e8857a"], leaves: 2, chips: 5 }
};

/* fruit layout: x / y in % of the bowl opening, w = diameter in % */
const LAYOUT = [
  { x: 50, y: 62, w: 25 }, { x: 24, y: 50, w: 20 }, { x: 75, y: 48, w: 21 },
  { x: 38, y: 34, w: 17 }, { x: 63, y: 32, w: 18 }, { x: 13, y: 64, w: 16 },
  { x: 87, y: 62, w: 17 }, { x: 50, y: 20, w: 14 }, { x: 27, y: 74, w: 14 },
  { x: 74, y: 76, w: 15 }, { x: 8, y: 44, w: 12 }, { x: 92, y: 40, w: 13 }
];

function bowlMarkup(spec) {
  const colors = spec.colors && spec.colors.length ? spec.colors : ["#ffb03a", "#ef8b2c"];
  let fruits = "";
  LAYOUT.forEach((pos, i) => {
    const c1 = colors[i % colors.length];
    const c2 = colors[(i + 1) % colors.length];
    const rotate = (i * 47) % 360;
    fruits += `<span class="fruit${i % 4 === 0 ? " fruit--wedge" : ""}" style="left:${pos.x}%;top:${pos.y}%;--w:${pos.w}%;--c1:${c1};--c2:${c2};z-index:${Math.round(pos.y)};transform:translate(-50%,-50%) rotate(${rotate}deg)"></span>`;
  });
  const leaves = spec.leaves || 0;
  for (let i = 0; i < leaves; i++) {
    const x = 22 + i * 33;
    fruits += `<span class="leaf-shape" style="left:${x}%;top:${16 + i * 9}%;--w:${13 + i * 2}%;z-index:${90 + i};transform:translate(-50%,-50%) rotate(${-24 + i * 42}deg)"></span>`;
  }
  const chips = spec.chips || 0;
  for (let i = 0; i < chips; i++) {
    const x = 18 + ((i * 23) % 66);
    const y = 26 + ((i * 31) % 52);
    const w = 3.2 + ((i * 7) % 10) / 4;
    fruits += `<span class="crumb" style="left:${x}%;top:${y}%;--w:${w}%;z-index:${95 + i};transform:translate(-50%,-50%) rotate(${(i * 61) % 180}deg)"></span>`;
  }
  return `<div class="bowl__scene"><div class="bowl__tilt">
    <div class="bowl__shadow"></div>
    <div class="bowl__interior"></div>
    <div class="bowl__fruits">${fruits}</div>
    <div class="bowl__wall"></div>
    <div class="bowl__gloss"></div>
    <div class="bowl__rim"></div>
    <div class="bowl__foot"></div>
  </div></div>`;
}

function paintBowl(el, spec) {
  if (!el) return;
  el.innerHTML = bowlMarkup(spec);
}

/* ── MENU UI ──────────────────────────────────── */
const tabsEl = document.getElementById("menuTabs");
const panelEl = document.getElementById("menuPanel");
let activeCat = MENU[0].id;

function priceRange(cat) {
  const prices = cat.items.map((i) => i.p);
  return `₹${Math.min(...prices)}–${Math.max(...prices)}`;
}

function buildTabs() {
  tabsEl.innerHTML = MENU.map(
    (cat) => `<button class="tab" role="tab" id="tab-${cat.id}" aria-controls="menuPanel"
      aria-selected="${cat.id === activeCat}" data-cat="${cat.id}" type="button">
      ${cat.label} <span>${cat.items.length}</span></button>`
  ).join("");
  tabsEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn || btn.dataset.cat === activeCat) return;
    activeCat = btn.dataset.cat;
    tabsEl.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.cat === activeCat)));
    renderPanel();
  });
}

function renderPanel() {
  const cat = MENU.find((c) => c.id === activeCat);
  panelEl.innerHTML =
    cat.items
      .map(
        (item) => `<article class="dish">
          <div class="dish__row">
            <h3>${item.n}</h3><span class="dish__leader"></span><span class="price">₹${item.p}</span>
          </div>
          <p>${item.d}</p>
          ${item.tag ? `<span class="dish__badge">${item.tag}</span>` : ""}
        </article>`
      )
      .join("") +
    `<div class="menu__foot">
      <span>${cat.kicker} · ${cat.items.length} items</span>
      <span>${priceRange(cat)} · prices inclusive of packaging</span>
    </div>`;
  attachTilt(panelEl.querySelectorAll(".dish"), 5);
}

/* ── BUILD-YOUR-BOWL ──────────────────────────── */
const BASES = [
  { key: "mango", price: 149 },
  { key: "banana", price: 129 },
  { key: "choco", price: 149 },
  { key: "berry", price: 159 }
];

const ADDONS = [
  { n: "Extra banana", p: 15, colors: ["#f6e39a", "#f0d777"] },
  { n: "Extra apple", p: 20, colors: ["#e0574f", "#a82f32", "#e8d98a"] },
  { n: "Pomegranate", p: 20, colors: ["#c1273f", "#8e1526"] },
  { n: "Mixed seeds", p: 20, chips: 7 },
  { n: "Chia seeds", p: 15, chips: 4 },
  { n: "Granola", p: 20, chips: 6 },
  { n: "Oats", p: 15, chips: 3 },
  { n: "Peanut butter", p: 20, colors: ["#d9a05b", "#a9762f"] },
  { n: "Yogurt dip", p: 15, colors: ["#fdfaf1", "#e6dcc7"] },
  { n: "Extra paneer", p: 25, colors: ["#fffaf0", "#e8dcc2"] },
  { n: "Chickpeas", p: 15, colors: ["#e3c88a", "#c9a86a"] }
];

const state = { base: "mango", addons: new Set() };

const baseChips = document.getElementById("baseChips");
const addonChips = document.getElementById("addonChips");
const buildBowlEl = document.getElementById("buildBowl");
const buildName = document.getElementById("buildName");
const buildList = document.getElementById("buildList");
const buildTotal = document.getElementById("buildTotal");
const addonCount = document.getElementById("addonCount");

function renderBuildControls() {
  baseChips.innerHTML = BASES.map((b) => {
    const bowl = BOWLS[b.key];
    return `<button class="chip" type="button" data-base="${b.key}" aria-pressed="${state.base === b.key}">
      ${bowl.name.replace(" Bowl", "")}<b>₹${b.price}</b></button>`;
  }).join("");

  addonChips.innerHTML = ADDONS.map(
    (a, i) => `<button class="chip" type="button" data-addon="${i}" aria-pressed="${state.addons.has(i)}">
      ${a.n}<b>+₹${a.p}</b></button>`
  ).join("");
}

function renderBuild() {
  const base = BASES.find((b) => b.key === state.base);
  const spec = { ...BOWLS[state.base] };
  spec.colors = [...spec.colors];
  spec.chips = spec.chips || 0;
  let total = base.price;

  state.addons.forEach((i) => {
    const a = ADDONS[i];
    total += a.p;
    if (a.colors) spec.colors = spec.colors.concat(a.colors);
    if (a.chips) spec.chips += a.chips;
  });

  paintBowl(buildBowlEl, spec);

  buildName.textContent = spec.name;
  buildTotal.textContent = `₹${total}`;

  const rows = [`<li><span>${spec.name}</span><b>₹${base.price}</b></li>`];
  state.addons.forEach((i) => {
    rows.push(`<li><span>${ADDONS[i].n}</span><b>+₹${ADDONS[i].p}</b></li>`);
  });
  if (!state.addons.size) rows.push(`<li class="empty">No add-ons yet — try granola or peanut butter.</li>`);
  buildList.innerHTML = rows.join("");

  addonCount.textContent = `${state.addons.size} selected`;

  if (!reduceMotion && buildBowlEl) {
    buildBowlEl.animate(
      [{ transform: "scale(0.96)", opacity: 0.55 }, { transform: "scale(1)", opacity: 1 }],
      { duration: 420, easing: "cubic-bezier(.19,1,.22,1)" }
    );
  }
}

function wireBuild() {
  baseChips.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-base]");
    if (!btn) return;
    state.base = btn.dataset.base;
    renderBuildControls();
    renderBuild();
  });
  addonChips.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-addon]");
    if (!btn) return;
    const i = Number(btn.dataset.addon);
    state.addons.has(i) ? state.addons.delete(i) : state.addons.add(i);
    btn.setAttribute("aria-pressed", String(state.addons.has(i)));
    renderBuild();
  });
  document.getElementById("buildReset").addEventListener("click", () => {
    state.base = "mango";
    state.addons.clear();
    renderBuildControls();
    renderBuild();
  });
}

/* ── 3D TILT ──────────────────────────────────── */
function attachTilt(nodes, max = 7) {
  if (!canHover || reduceMotion) return;
  nodes.forEach((el) => {
    if (el.dataset.tiltReady) return;
    el.dataset.tiltReady = "1";
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--ry", `${(px * max * 2).toFixed(2)}deg`);
      el.style.setProperty("--rx", `${(-py * max * 2).toFixed(2)}deg`);
    });
    el.addEventListener("pointerleave", () => {
      el.style.setProperty("--ry", "0deg");
      el.style.setProperty("--rx", "0deg");
    });
  });
}

/* ── HERO PARALLAX ────────────────────────────── */
function heroParallax() {
  if (reduceMotion || !canHover) return;
  const scene = document.querySelector("[data-scene]");
  const layers = scene ? scene.querySelectorAll("[data-depth]") : [];
  if (!scene || !layers.length) return;
  let targetX = 0, targetY = 0, curX = 0, curY = 0, raf = null;

  const loop = () => {
    curX += (targetX - curX) * 0.08;
    curY += (targetY - curY) * 0.08;
    layers.forEach((l) => {
      const d = Number(l.dataset.depth) || 1;
      l.style.transform = `translate3d(${(curX * d * 14).toFixed(2)}px, ${(curY * d * 14).toFixed(2)}px, 0)`;
    });
    if (Math.abs(targetX - curX) > 0.001 || Math.abs(targetY - curY) > 0.001) {
      raf = requestAnimationFrame(loop);
    } else {
      raf = null;
    }
  };

  scene.addEventListener("pointermove", (e) => {
    const r = scene.getBoundingClientRect();
    targetX = (e.clientX - r.left) / r.width - 0.5;
    targetY = (e.clientY - r.top) / r.height - 0.5;
    if (!raf) raf = requestAnimationFrame(loop);
  });
  scene.addEventListener("pointerleave", () => {
    targetX = 0;
    targetY = 0;
    if (!raf) raf = requestAnimationFrame(loop);
  });
}

/* ── SCROLL CHROME ────────────────────────────── */
function scrollChrome() {
  const nav = document.getElementById("nav");
  const bar = document.getElementById("progressBar");
  const onScroll = () => {
    nav.classList.toggle("is-stuck", window.scrollY > 24);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = `${max > 0 ? (window.scrollY / max) * 100 : 0}%`;
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
}

/* ── REVEAL ───────────────────────────────────── */
function reveal() {
  const targets = document.querySelectorAll(
    ".section__head, .sig-card, .plan, .menu, .build__copy, .build__ticket, .story__lead, .story__big, .story__facts, .visit__card, .visit > div:first-child"
  );
  if (reduceMotion || !("IntersectionObserver" in window)) return;
  targets.forEach((el, i) => {
    el.setAttribute("data-reveal", "");
    el.style.transitionDelay = `${(i % 4) * 70}ms`;
  });
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );
  targets.forEach((el) => io.observe(el));
}

/* ── BOOT ─────────────────────────────────────── */
function init() {
  document.querySelectorAll(".bowl[data-bowl]").forEach((el) => {
    const spec = BOWLS[el.dataset.bowl];
    if (spec) paintBowl(el, spec);
  });

  buildTabs();
  renderPanel();
  wireBuild();
  renderBuildControls();

  attachTilt(document.querySelectorAll("[data-tilt]"));

  // subtle stage animation for the hero bowl, and tilt-on-hover for it
  heroParallax();
  scrollChrome();
  reveal();

  const year = new Date().getFullYear();
  document.querySelectorAll(".footer__small").forEach((el) => el.setAttribute("data-year", year));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
