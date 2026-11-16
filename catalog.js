/* ─────────────────────────────────────────────
   NAVRASA — catalogue, ingredient model, cart
   Shared by the shop, cart, checkout, confirmation
   and admin pages.
   ───────────────────────────────────────────── */

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
      { n: "Watermelon Juice 250 ml", p: 35, d: "Watermelon 250 ml · lemon · black salt · mint." },
      { n: "Muskmelon Juice 250 ml", p: 45, d: "Muskmelon 250 ml · lemon · black salt." },
      { n: "Pineapple Juice 250 ml", p: 45, d: "Pineapple 250 ml · lemon · black salt · ice." },
      { n: "Orange Juice 250 ml", p: 55, d: "Orange 250 ml · lemon · black salt." },
      { n: "Papaya Smoothie Juice 250 ml", p: 40, d: "Papaya 200 ml · curd 40 ml · milk 40 ml · honey · cardamom." }
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
      { n: "Banana Crunch Bowl", p: 129, d: "Banana 90 g · curd 120 g · chia 10 g · peanut butter 20 g · granola 25 g · coconut 10 g." },
      { n: "Mango Tropical Bowl", p: 149, d: "Mango 120 g · pineapple 50 g · papaya 50 g · coconut 15 g · granola 25 g · curd 100 g." },
      { n: "Choco Banana Bowl", p: 149, d: "Banana 100 g · cocoa 10 g · oats 30 g · curd 100 g · chia 10 g · dark chocolate 10 g." },
      { n: "Peanut Butter Bowl", p: 159, d: "Banana 90 g · peanut butter 30 g · curd 110 g · oats 30 g · granola 20 g · coconut 10 g." },
      { n: "Fruit & Granola Bowl", p: 159, d: "Seasonal fruit 130 g · granola 30 g · mixed seeds 15 g · curd 100 g · honey 10 g." }
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

const ADDON_PRICES = {
  banana: 15, apple: 20, pomegranate: 20, "mixed seeds": 20, chia: 15, "chia seeds": 15,
  granola: 20, oats: 15, "peanut butter": 20, yogurt: 15, curd: 12, paneer: 25,
  chickpeas: 15, milk: 10, "coconut milk": 15, honey: 10, cocoa: 10, coconut: 12,
  lemon: 5, mint: 5, "salt & spice": 0, "black salt": 0, "chaat masala": 0, cardamom: 3,
  coriander: 3, ice: 0, lettuce: 10, cucumber: 8, tomato: 8, onion: 6, quinoa: 20,
  sprouts: 15, "sweet corn": 15, "dark chocolate": 15, almonds: 15, walnuts: 18,
  raisins: 10, peanuts: 10, "seasonal fruit": 20, pineapple: 15, papaya: 12,
  watermelon: 12, mango: 25, strawberry: 25, kiwi: 20, "olive oil": 8, dressing: 6,
  "coconut flakes": 10, berries: 25
};

const DEFAULT_INGREDIENT_PRICE = 8;

function ingredientPrice(name) {
  const key = name.toLowerCase().replace(/^extra\s+/, "").trim();
  if (key in ADDON_PRICES) return ADDON_PRICES[key];
  for (const [k, v] of Object.entries(ADDON_PRICES)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return DEFAULT_INGREDIENT_PRICE;
}

/* "Mango 120 g · curd 100 g" → [{name, qty, unit, label}] */
function parseIngredients(desc) {
  return desc
    .split(/\s*·\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(g|ml)?$/i);
      if (m) {
        const unit = m[3] || "";
        return { name: m[1].trim(), qty: Number(m[2]), unit, label: `${m[2]} ${unit}`.trim() };
      }
      return { name: part, qty: null, unit: "", label: "to taste" };
    });
}

const CATALOG = [];
MENU.forEach((cat) =>
  cat.items.forEach((item) => {
    CATALOG.push({
      id: `${cat.id}-${item.n.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      cat: cat.id,
      catLabel: cat.label,
      name: item.n,
      price: item.p,
      desc: item.d,
      tag: item.tag || "",
      addable: cat.id !== "combos",
      ingredients: cat.id === "addons" || cat.id === "plans" || cat.id === "combos" ? [] : parseIngredients(item.d)
    });
  })
);

function findItem(name) {
  return CATALOG.find((i) => i.name === name) || null;
}

/* Customisable add-on list shown inside the customiser */
const EXTRA_ADDONS = MENU.find((c) => c.id === "addons").items.map((a) => ({
  name: a.n.replace(/^Extra\s+/, "").replace(/^./, (c) => c.toUpperCase()),
  price: a.p
}));

/* ── pricing ─────────────────────────────────── */
function unitPriceFor(item, custom) {
  let total = item.price;
  if (!item.ingredients.length) {
    (custom.addons || []).forEach((a) => (total += a.price));
    return Math.max(total, 0);
  }
  custom.ingredients.forEach((ing) => {
    const def = item.ingredients.find((i) => i.name === ing.name);
    if (!def) return;
    const price = ingredientPrice(def.name);
    if (ing.count === 0) total -= price;
    else if (ing.count > 1) total += price * (ing.count - 1);
  });
  (custom.addons || []).forEach((a) => (total += a.price));
  return Math.max(total, 20);
}

/* ── cart storage ─────────────────────────────── */
const CART_KEY = "navrasa.cart.v1";

function readCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function writeCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  document.dispatchEvent(new CustomEvent("cart:updated", { detail: cart }));
}

function cartCount(cart = readCart()) {
  return cart.reduce((n, l) => n + l.qty, 0);
}

function cartSubtotal(cart = readCart()) {
  return cart.reduce((n, l) => n + l.unitPrice * l.qty, 0);
}

function addLine(line) {
  const cart = readCart();
  const signature = JSON.stringify({ id: line.id, custom: line.custom || null, notes: line.notes || "" });
  const existing = cart.find((l) => l.signature === signature);
  if (existing) existing.qty += line.qty;
  else cart.push({ ...line, signature, key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` });
  writeCart(cart);
}

function updateLineQty(key, qty) {
  const cart = readCart();
  const line = cart.find((l) => l.key === key);
  if (!line) return;
  line.qty = Math.max(0, qty);
  writeCart(cart.filter((l) => l.qty > 0));
}

function removeLine(key) {
  writeCart(readCart().filter((l) => l.key !== key));
}

function replaceLine(key, line) {
  const cart = readCart();
  const idx = cart.findIndex((l) => l.key === key);
  if (idx === -1) return;
  cart[idx] = { ...line, key };
  writeCart(cart);
}

function money(n) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

/* ── customiser summary used on cart/checkout ─── */
function customSummary(line) {
  const bits = [];
  (line.custom?.ingredients || []).forEach((i) => {
    if (i.count === 0) bits.push(`no ${i.name.toLowerCase()}`);
    else if (i.count > 1) bits.push(`${i.count}× ${i.name.toLowerCase()}`);
  });
  (line.custom?.addons || []).forEach((a) => bits.push(`+ ${a.name.toLowerCase()}`));
  if (line.notes) bits.push(`“${line.notes}”`);
  return bits.join(" · ");
}

const SHOP = {
  name: "Navrasa",
  /* Put the shop's WhatsApp number here (country code, digits only), e.g. "919876543210".
     It is used for the "Open WhatsApp" button on online-payment confirmations. */
  whatsapp: ""
};

window.NAV = {
  MENU, CATALOG, EXTRA_ADDONS, findItem, parseIngredients, ingredientPrice,
  unitPriceFor, readCart, writeCart, cartCount, cartSubtotal, addLine,
  updateLineQty, removeLine, replaceLine, money, customSummary, shop: SHOP
};
