// Fruit Bowl shop server — zero dependencies, Node 18+.
// Run:  ADMIN_PASSWORD=yourSecret node server.js
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
// DATA_DIR can point at a persistent disk on your host (e.g. /var/data) so orders survive redeploys
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const ORDERS_JSON = path.join(DATA_DIR, 'orders.json');
const ORDERS_MD = path.join(DATA_DIR, 'orders.md');
const MENU_JSON = path.join(DATA_DIR, 'menu.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

const STATUSES = ['pending', 'preparing', 'out-for-delivery', 'delivered', 'cancelled'];
const SLOTS = ['08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00', '18:00-20:00'];
const PAYMENTS = ['cash', 'upi-on-delivery', 'card-on-delivery'];

if (!process.env.ADMIN_PASSWORD) {
  console.warn('\n⚠  ADMIN_PASSWORD not set — using default "admin123". Set it before going live!\n');
}

// ---------- storage ----------
fs.mkdirSync(DATA_DIR, { recursive: true });
// first run on an empty disk: start from the bundled menu
if (!fs.existsSync(path.join(DATA_DIR, 'menu.json'))) fs.copyFileSync(path.join(ROOT, 'data', 'menu.json'), path.join(DATA_DIR, 'menu.json'));
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(ORDERS_JSON)) fs.writeFileSync(ORDERS_JSON, '[]');

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeAtomic(file, content) {
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

let orders = readJSON(ORDERS_JSON, []);
let menu = readJSON(MENU_JSON, null);
if (!menu) { console.error('data/menu.json missing or invalid'); process.exit(1); }

function saveOrders() {
  writeAtomic(ORDERS_JSON, JSON.stringify(orders, null, 2));
  writeAtomic(ORDERS_MD, ordersToMarkdown());
}
function saveMenu() { writeAtomic(MENU_JSON, JSON.stringify(menu, null, 2)); }

function localDate(d = new Date()) { const z = new Date(d); return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, '0')}-${String(z.getDate()).padStart(2, '0')}`; }
function money(n) { return menu.currency + Number(n).toFixed(2).replace(/\.00$/, ''); }
function mdEscape(s) { return String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' '); }

function ordersToMarkdown() {
  const lines = [];
  const revenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
  lines.push('# Fruit Bowl — Orders Log', '');
  lines.push(`_Auto-generated ${new Date().toISOString()} · ${orders.length} orders · revenue (excl. cancelled) ${money(revenue)}_`, '');
  lines.push('| Order | Placed | Customer | Phone | Delivery | Total | Status |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const o of [...orders].reverse()) {
    lines.push(`| ${o.id} | ${o.createdAt.replace('T', ' ').slice(0, 16)} | ${mdEscape(o.customer.name)} | ${mdEscape(o.customer.phone)} | ${o.delivery.date} ${o.delivery.slot} | ${money(o.total)} | ${o.status} |`);
  }
  lines.push('', '---', '');
  for (const o of [...orders].reverse()) {
    lines.push(`## ${o.id} — ${o.status.toUpperCase()}`, '');
    lines.push(`- **Placed:** ${o.createdAt}`);
    lines.push(`- **Customer:** ${mdEscape(o.customer.name)} · ${mdEscape(o.customer.phone)}${o.customer.email ? ' · ' + mdEscape(o.customer.email) : ''}`);
    lines.push(`- **Address:** ${mdEscape(o.customer.address)}`);
    lines.push(`- **Delivery:** ${o.delivery.date}, ${o.delivery.slot}`);
    lines.push(`- **Payment:** ${o.payment}`);
    if (o.notes) lines.push(`- **Notes:** ${mdEscape(o.notes)}`);
    lines.push('', '| Item | Qty | Unit | Line total |', '|---|---|---|---|');
    for (const it of o.items) {
      const extra = it.details ? ` (${mdEscape(it.details)})` : '';
      lines.push(`| ${mdEscape(it.name)}${extra} | ${it.qty} | ${money(it.unitPrice)} | ${money(it.lineTotal)} |`);
    }
    lines.push('', `Subtotal ${money(o.subtotal)} · Delivery ${money(o.deliveryFee)} · **Total ${money(o.total)}**`, '');
    if (o.history?.length) {
      lines.push('Status history: ' + o.history.map(h => `${h.status} @ ${h.at.replace('T', ' ').slice(0, 16)}`).join(' → '), '');
    }
  }
  return lines.join('\n') + '\n';
}
saveOrders(); // make sure orders.md exists and is current

// ---------- helpers ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp', '.jpg': 'image/jpeg',
};

function send(res, status, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(isObj ? JSON.stringify(body) : body);
}

function readRaw(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('Image too large (max 6 MB).')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks))); req.on('error', reject);
  });
}
const IMG_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
function sniffImage(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return '.jpg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return '.webp';
  return null;
}

function readBody(req, limit = 100_000) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('Body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const clientIp = req => req.socket.remoteAddress || 'unknown';

// simple fixed-window rate limiter
const buckets = new Map();
function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.start > windowMs) { buckets.set(key, { start: now, count: 1 }); return false; }
  b.count++;
  return b.count > max;
}

// ---------- admin sessions ----------
const sessions = new Map(); // token -> expiry
const SESSION_MS = 12 * 60 * 60 * 1000;
function isAdmin(req) {
  const t = parseCookies(req).fb_admin;
  const exp = t && sessions.get(t);
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(t); return false; }
  return true;
}
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// ---------- order logic ----------
function newOrderId() {
  const d = new Date();
  const ymd = d.toISOString().slice(2, 10).replace(/-/g, '');
  let id;
  do { id = `FB-${ymd}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`; } while (orders.some(o => o.id === id));
  return id;
}

function priceItems(rawItems) {
  if (!Array.isArray(rawItems) || !rawItems.length) throw new Error('Your cart is empty.');
  if (rawItems.length > 30) throw new Error('Too many items in one order.');
  const items = [];
  for (const raw of rawItems) {
    const qty = Math.floor(Number(raw?.qty));
    if (!(qty >= 1 && qty <= 20)) throw new Error('Quantity must be between 1 and 20.');
    if (raw.type === 'custom') {
      const fruitIds = [...new Set(Array.isArray(raw.fruits) ? raw.fruits : [])];
      const topIds = [...new Set(Array.isArray(raw.toppings) ? raw.toppings : [])];
      const fruits = fruitIds.map(id => menu.custom.fruits.find(f => f.id === id)).filter(Boolean);
      const tops = topIds.map(id => menu.custom.toppings.find(t => t.id === id)).filter(Boolean);
      if (fruits.length < 2) throw new Error('A custom bowl needs at least 2 fruits.');
      if (fruits.length > 8) throw new Error('A custom bowl can have at most 8 fruits.');
      const unit = menu.custom.basePrice + fruits.reduce((s, f) => s + f.price, 0) + tops.reduce((s, t) => s + t.price, 0);
      items.push({
        type: 'custom', id: 'custom', name: 'Custom Bowl', qty, unitPrice: unit, lineTotal: unit * qty,
        fruits: fruits.map(f => f.id), toppings: tops.map(t => t.id),
        details: fruits.map(f => f.name).join(', ') + (tops.length ? ' + ' + tops.map(t => t.name).join(', ') : ''),
      });
    } else {
      const bowl = menu.bowls.find(b => b.id === raw.id);
      if (!bowl) throw new Error('One of the bowls in your cart no longer exists.');
      if (!bowl.available) throw new Error(`"${bowl.name}" is sold out right now.`);
      items.push({ type: 'bowl', id: bowl.id, name: bowl.name, qty, unitPrice: bowl.price, lineTotal: bowl.price * qty });
    }
  }
  return items;
}

function createOrder(body) {
  const c = body.customer || {};
  const customer = {
    name: str(c.name, 80), phone: str(c.phone, 20), email: str(c.email, 120), address: str(c.address, 300),
  };
  if (customer.name.length < 2) throw new Error('Please enter your name.');
  if (!/^[+\d][\d\s-]{6,18}$/.test(customer.phone)) throw new Error('Please enter a valid phone number.');
  if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) throw new Error('Please enter a valid email or leave it blank.');
  if (customer.address.length < 8) throw new Error('Please enter your full delivery address.');

  const d = body.delivery || {};
  const date = str(d.date, 10), slot = str(d.slot, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Please choose a delivery date.');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const chosen = new Date(date + 'T00:00:00');
  const diffDays = Math.round((chosen - today) / 86400000);
  if (isNaN(diffDays) || diffDays < 0 || diffDays > 14) throw new Error('Delivery date must be within the next 14 days.');
  if (!SLOTS.includes(slot)) throw new Error('Please choose a delivery time slot.');
  if (diffDays === 0 && parseInt(slot, 10) <= new Date().getHours()) throw new Error('That time slot has already passed today — please pick a later slot or another day.');

  const payment = PAYMENTS.includes(body.payment) ? body.payment : 'cash';
  const items = priceItems(body.items);
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const deliveryFee = subtotal >= menu.freeDeliveryAbove ? 0 : menu.deliveryFee;
  const now = new Date().toISOString();
  const order = {
    id: newOrderId(), createdAt: now, status: 'pending',
    customer, delivery: { date, slot }, payment, notes: str(body.notes, 500),
    items, subtotal, deliveryFee, total: subtotal + deliveryFee,
    adminNote: '', history: [{ status: 'pending', at: now }],
  };
  orders.push(order);
  saveOrders();
  return order;
}

function computeStats() {
  const now = new Date();
  const todayKey = localDate(now);
  const live = orders.filter(o => o.status !== 'cancelled');
  const byStatus = Object.fromEntries(STATUSES.map(s => [s, 0]));
  orders.forEach(o => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });

  // last 14 days revenue + order counts
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    days.push({ date: localDate(d), revenue: 0, orders: 0 });
  }
  const dayIdx = Object.fromEntries(days.map((d, i) => [d.date, i]));
  live.forEach(o => {
    const k = localDate(o.createdAt);
    if (k in dayIdx) { days[dayIdx[k]].revenue += o.total; days[dayIdx[k]].orders++; }
  });

  const products = {};
  live.forEach(o => o.items.forEach(it => {
    const p = products[it.name] ||= { name: it.name, qty: 0, revenue: 0 };
    p.qty += it.qty; p.revenue += it.lineTotal;
  }));
  const fruitCount = {};
  live.forEach(o => o.items.forEach(it => {
    const fr = it.type === 'custom' ? it.fruits : (menu.bowls.find(b => b.id === it.id)?.fruits || []);
    fr.forEach(f => { fruitCount[f] = (fruitCount[f] || 0) + it.qty; });
  }));
  const slotCount = Object.fromEntries(SLOTS.map(s => [s, 0]));
  live.forEach(o => { slotCount[o.delivery.slot] = (slotCount[o.delivery.slot] || 0) + 1; });

  const customers = new Map();
  orders.forEach(o => {
    const key = o.customer.phone.replace(/\D/g, '');
    const c = customers.get(key) || { name: o.customer.name, phone: o.customer.phone, email: o.customer.email, orders: 0, spent: 0, last: o.createdAt };
    c.orders++; if (o.status !== 'cancelled') c.spent += o.total; c.last = o.createdAt > c.last ? o.createdAt : c.last; c.name = o.customer.name;
    customers.set(key, c);
  });

  const revenue = live.reduce((s, o) => s + o.total, 0);
  const todays = live.filter(o => localDate(o.createdAt) === todayKey);
  const deliveriesToday = orders.filter(o => o.delivery.date === todayKey && !['cancelled', 'delivered'].includes(o.status));
  return {
    currency: menu.currency,
    totals: {
      orders: orders.length, revenue, avgOrder: live.length ? revenue / live.length : 0,
      todayOrders: todays.length, todayRevenue: todays.reduce((s, o) => s + o.total, 0),
      open: byStatus.pending + byStatus.preparing + byStatus['out-for-delivery'],
      customers: customers.size, deliveriesToday: deliveriesToday.length,
    },
    byStatus, days,
    topProducts: Object.values(products).sort((a, b) => b.qty - a.qty).slice(0, 8),
    fruits: Object.entries(fruitCount).map(([id, qty]) => ({ id, name: menu.custom.fruits.find(f => f.id === id)?.name || id, qty })).sort((a, b) => b.qty - a.qty),
    slots: slotCount,
    customers: [...customers.values()].sort((a, b) => b.spent - a.spent),
    recent: [...orders].reverse().slice(0, 6),
  };
}

function csvCell(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function ordersCsv() {
  const head = ['Order ID', 'Placed', 'Status', 'Name', 'Phone', 'Email', 'Address', 'Delivery date', 'Slot', 'Payment', 'Items', 'Subtotal', 'Delivery fee', 'Total', 'Customer notes', 'Admin note'];
  const rows = orders.map(o => [o.id, o.createdAt, o.status, o.customer.name, o.customer.phone, o.customer.email, o.customer.address,
    o.delivery.date, o.delivery.slot, o.payment, o.items.map(i => `${i.qty}x ${i.name}${i.details ? ' (' + i.details + ')' : ''}`).join('; '),
    o.subtotal, o.deliveryFee, o.total, o.notes, o.adminNote]);
  return [head, ...rows].map(r => r.map(csvCell).join(',')).join('\n');
}

// ---------- routing ----------
async function handleApi(req, res, url) {
  const p = url.pathname;
  const m = req.method;

  // public
  if (p === '/api/menu' && m === 'GET') {
    return send(res, 200, { ...menu, bowls: menu.bowls, slots: SLOTS, payments: PAYMENTS });
  }
  if (p === '/api/orders' && m === 'POST') {
    if (rateLimited('order:' + clientIp(req), 10, 10 * 60 * 1000)) return send(res, 429, { error: 'Too many orders from this device. Please try again later.' });
    const body = await readBody(req);
    try {
      const o = createOrder(body);
      console.log(`🧾 New order ${o.id} — ${o.customer.name} — ${money(o.total)}`);
      return send(res, 201, { id: o.id, total: o.total, status: o.status, delivery: o.delivery });
    } catch (e) { return send(res, 400, { error: e.message }); }
  }
  if (p === '/api/orders/track' && m === 'GET') {
    if (rateLimited('track:' + clientIp(req), 30, 60 * 1000)) return send(res, 429, { error: 'Slow down a little.' });
    const id = (url.searchParams.get('id') || '').trim().toUpperCase();
    const phone = (url.searchParams.get('phone') || '').replace(/\D/g, '');
    const o = orders.find(x => x.id === id);
    if (!o || !phone || o.customer.phone.replace(/\D/g, '').slice(-6) !== phone.slice(-6)) return send(res, 404, { error: 'No order found with that ID and phone number.' });
    return send(res, 200, { id: o.id, status: o.status, createdAt: o.createdAt, delivery: o.delivery, items: o.items, total: o.total, history: o.history });
  }

  // admin auth
  if (p === '/api/admin/login' && m === 'POST') {
    if (rateLimited('login:' + clientIp(req), 8, 15 * 60 * 1000)) return send(res, 429, { error: 'Too many attempts. Try again in 15 minutes.' });
    const { password } = await readBody(req);
    if (!password || !safeEqual(password, ADMIN_PASSWORD)) return send(res, 401, { error: 'Wrong password.' });
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + SESSION_MS);
    return send(res, 200, { ok: true }, { 'Set-Cookie': `fb_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}` });
  }
  if (p === '/api/admin/logout' && m === 'POST') {
    sessions.delete(parseCookies(req).fb_admin);
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'fb_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  }
  if (p.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return send(res, 401, { error: 'Not logged in.' });

    if (p === '/api/admin/me') return send(res, 200, { ok: true });
    if (p === '/api/admin/stats' && m === 'GET') return send(res, 200, computeStats());
    if (p === '/api/admin/orders' && m === 'GET') return send(res, 200, { orders: [...orders].reverse(), statuses: STATUSES, currency: menu.currency });
    if (p === '/api/admin/export.csv' && m === 'GET') {
      return send(res, 200, ordersCsv(), { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"` });
    }
    if (p === '/api/admin/orders.md' && m === 'GET') {
      return send(res, 200, fs.readFileSync(ORDERS_MD, 'utf8'), { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': 'attachment; filename="orders.md"' });
    }
    const om = p.match(/^\/api\/admin\/orders\/([A-Z0-9-]+)$/);
    if (om) {
      const o = orders.find(x => x.id === om[1]);
      if (!o) return send(res, 404, { error: 'Order not found.' });
      if (m === 'PATCH') {
        const body = await readBody(req);
        if (body.status !== undefined) {
          if (!STATUSES.includes(body.status)) return send(res, 400, { error: 'Invalid status.' });
          if (body.status !== o.status) { o.status = body.status; o.history.push({ status: o.status, at: new Date().toISOString() }); }
        }
        if (body.adminNote !== undefined) o.adminNote = str(body.adminNote, 500);
        saveOrders();
        return send(res, 200, o);
      }
      if (m === 'DELETE') {
        orders = orders.filter(x => x !== o);
        saveOrders();
        return send(res, 200, { ok: true });
      }
    }
    if (p === '/api/admin/menu' && m === 'GET') return send(res, 200, menu);
    if (p === '/api/admin/upload' && m === 'POST') {
      if (!IMG_TYPES[(req.headers['content-type'] || '').split(';')[0]]) return send(res, 415, { error: 'Please upload a JPG, PNG or WebP image.' });
      const buf = await readRaw(req, 6 * 1024 * 1024);
      const ext = sniffImage(buf); if (!ext) return send(res, 415, { error: 'That file is not a valid image.' });
      const name = `bowl-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}${ext}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
      return send(res, 201, { url: '/uploads/' + name });
    }
    if (p === '/api/admin/menu' && m === 'PUT') {
      const body = await readBody(req);
      try { menu = validateMenu(body); saveMenu(); return send(res, 200, menu); } catch (e) { return send(res, 400, { error: e.message }); }
    }
  }
  return send(res, 404, { error: 'Not found' });
}

const FRUIT_IDS = () => menu.custom.fruits.map(f => f.id);
function validateMenu(b) {
  const num = (v, name) => { const n = Number(v); if (!(n >= 0 && n < 100000)) throw new Error(`Invalid ${name}.`); return Math.round(n * 100) / 100; };
  if (!Array.isArray(b.bowls)) throw new Error('Invalid menu.');
  const ids = new Set();
  const bowls = b.bowls.map(x => {
    const id = str(x.id, 40).toLowerCase().replace(/[^a-z0-9-]/g, '-') || ('bowl-' + crypto.randomBytes(2).toString('hex'));
    if (ids.has(id)) throw new Error(`Duplicate bowl id "${id}".`);
    ids.add(id);
    const name = str(x.name, 60); if (!name) throw new Error('Every bowl needs a name.');
    return {
      id, name, description: str(x.description, 300), price: num(x.price, 'price for ' + name),
      calories: Math.floor(num(x.calories || 0, 'calories')), tag: str(x.tag, 20),
      fruits: (Array.isArray(x.fruits) ? x.fruits : []).filter(f => FRUIT_IDS().includes(f)).slice(0, 8),
      available: !!x.available,
      image: typeof x.image === 'string' && /^\/uploads\/[A-Za-z0-9._-]+$/.test(x.image) ? x.image : '',
    };
  });
  const custom = { ...menu.custom, basePrice: num(b.custom?.basePrice ?? menu.custom.basePrice, 'base price') };
  if (Array.isArray(b.custom?.fruits)) custom.fruits = menu.custom.fruits.map(f => { const u = b.custom.fruits.find(x => x.id === f.id); return u ? { ...f, price: num(u.price, f.name + ' price') } : f; });
  if (Array.isArray(b.custom?.toppings)) custom.toppings = menu.custom.toppings.map(t => { const u = b.custom.toppings.find(x => x.id === t.id); return u ? { ...t, price: num(u.price, t.name + ' price') } : t; });
  return {
    currency: str(b.currency, 4) || menu.currency,
    deliveryFee: num(b.deliveryFee, 'delivery fee'),
    freeDeliveryAbove: num(b.freeDeliveryAbove, 'free delivery threshold'),
    bowls, custom,
  };
}

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  if (p === '/admin' || p === '/admin/') p = '/admin.html';
  if (p === '/track' || p === '/track/') p = '/track.html';
  const isUpload = p.startsWith('/uploads/');
  const root = isUpload ? UPLOAD_DIR : PUBLIC_DIR;
  const file = path.normalize(path.join(root, isUpload ? p.slice('/uploads'.length) : p));
  if (!file.startsWith(root + path.sep)) return send(res, 403, 'Forbidden');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': isUpload ? 'public, max-age=31536000, immutable' : 'no-cache',
      ...(p === '/admin.html' ? { 'X-Robots-Tag': 'noindex', 'X-Frame-Options': 'DENY' } : {}),
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, e.message === 'Invalid JSON' || e.message === 'Body too large' ? 400 : 500, { error: e.message || 'Server error' });
  }
});

server.listen(PORT, () => {
  console.log(`🍓 Fruit Bowl running at http://localhost:${PORT}`);
  console.log(`   Admin panel:  http://localhost:${PORT}/admin`);
  console.log(`   Orders saved: ${ORDERS_JSON} and ${ORDERS_MD}`);
});
