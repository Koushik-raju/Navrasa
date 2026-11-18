// Navrasa shop — request handler shared by the local/dev server and the Vercel function.
'use strict';
const crypto = require('crypto');
const { createStore } = require('./store');
const DEFAULT_MENU = require('../data/menu.json');
// A menu saved before the current menu file version (e.g. the old 6-bowl menu) is replaced by the bundled one.
function currentMenu(m) {
  const fresh = () => JSON.parse(JSON.stringify(DEFAULT_MENU));
  const v = (m && m.menuVersion) || 1;
  if (!m || v < 2) return fresh();                 // old 6-bowl menu → full menu
  if (v < DEFAULT_MENU.menuVersion) {              // menu edited in admin → keep those edits, add the new "what's inside" lists
    const byId = Object.fromEntries(DEFAULT_MENU.bowls.map(b => [b.id, b]));
    return { ...m, menuVersion: DEFAULT_MENU.menuVersion,
      bowls: m.bowls.map(b => (Array.isArray(b.includes) ? b : { ...b, includes: byId[b.id]?.includes || [] })) };
  }
  return m;
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update('navrasa-session:' + ADMIN_PASSWORD).digest('hex');
const STATUSES = ['pending', 'preparing', 'out-for-delivery', 'delivered', 'cancelled'];
const SLOTS = ['08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00', '18:00-20:00'];
const PAYMENTS = ['cash', 'upi-on-delivery', 'card-on-delivery'];
if (!process.env.ADMIN_PASSWORD) console.warn('⚠  ADMIN_PASSWORD not set — using default "admin123". Set it before going live!');

// In file mode we also keep a human-readable orders.md next to orders.json
const fs = require('fs'), path = require('path');
let menuForMd = null;
const store = createStore({ onOrdersChanged: (list, dir) => {
  if (!menuForMd) return null;
  const md = ordersToMarkdown(list, menuForMd);
  if (dir) { try { fs.writeFileSync(path.join(dir, 'orders.md'), md); } catch {} }
  return md;
} });

function localDate(d = new Date()) { const z = new Date(d); return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, '0')}-${String(z.getDate()).padStart(2, '0')}`; }
function mdEscape(s) { return String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' '); }

function ordersToMarkdown(orders, menu) {
  const money = n => menu.currency + Number(n).toFixed(2).replace(/\.00$/, '');
  const lines = [];
  const revenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
  lines.push('# Navrasa — Orders Log', '');
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

// On Vercel the request body may already have been read and parsed into req.body
function vercelBody(req) {
  if (!process.env.VERCEL) return undefined;
  try { return req.body; } catch { return undefined; }
}

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
  const pre = vercelBody(req);
  if (pre !== undefined) { const b = Buffer.isBuffer(pre) ? pre : Buffer.from(typeof pre === 'string' ? pre : ''); if (b.length > limit) return Promise.reject(new Error('Image too large.')); return Promise.resolve(b); }
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
  const pre = vercelBody(req);
  if (pre !== undefined) {
    if (pre && typeof pre === 'object' && !Buffer.isBuffer(pre)) return Promise.resolve(pre);
    const s = Buffer.isBuffer(pre) ? pre.toString('utf8') : String(pre || '');
    if (!s) return Promise.resolve({});
    try { return Promise.resolve(JSON.parse(s)); } catch { return Promise.reject(new Error('Invalid JSON')); }
  }
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
const clientIp = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';

// simple fixed-window rate limiter
const buckets = new Map();
function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.start > windowMs) { buckets.set(key, { start: now, count: 1 }); return false; }
  b.count++;
  return b.count > max;
}


// ---------- admin sessions: signed cookie (works across serverless instances) ----------
const SESSION_MS = 12 * 60 * 60 * 1000;
const sign = v => crypto.createHmac('sha256', SESSION_SECRET).update(v).digest('base64url');
function makeToken() { const exp = String(Date.now() + SESSION_MS); return `${exp}.${sign(exp)}`; }
function isAdmin(req) {
  const t = parseCookies(req).fb_admin || ''; const [exp, sig] = t.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
const isHttps = req => String(req.headers['x-forwarded-proto'] || '').includes('https');
const cookie = (req, v, maxAge) => `fb_admin=${v}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${isHttps(req) ? '; Secure' : ''}`;

// ---------- order logic ----------
function newOrderId() {
  const ymd = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `FB-${ymd}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}
function priceItems(rawItems, menu, admin = false) {
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
      if (!bowl) throw new Error('One of the items in your cart is no longer on the menu — please remove it.');
      if (!bowl.available && !admin) throw new Error(`"${bowl.name}" is sold out right now.`);
      items.push({ type: 'bowl', id: bowl.id, name: bowl.name, qty, unitPrice: bowl.price, lineTotal: bowl.price * qty, ...(bowl.portion ? { details: bowl.portion } : {}) });
    }
  }
  return items;
}

function buildOrder(body, menu, admin = false) {
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
  if (isNaN(diffDays)) throw new Error('Please choose a valid delivery date.');
  if (!admin && (diffDays < 0 || diffDays > 14)) throw new Error('Delivery date must be within the next 14 days.');
  if (!SLOTS.includes(slot)) throw new Error('Please choose a delivery time slot.');
  if (!admin && diffDays === 0 && parseInt(slot, 10) <= new Date().getHours()) throw new Error('That time slot has already passed today — please pick a later slot or another day.');

  const payment = PAYMENTS.includes(body.payment) ? body.payment : 'cash';
  const items = priceItems(body.items, menu, admin);
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const deliveryFee = subtotal >= menu.freeDeliveryAbove ? 0 : menu.deliveryFee;
  const now = new Date().toISOString();
  const status = admin && STATUSES.includes(body.status) ? body.status : 'pending';
  const order = {
    id: newOrderId(), createdAt: now, status,
    customer, delivery: { date, slot }, payment, notes: str(body.notes, 500),
    items, subtotal, deliveryFee, total: subtotal + deliveryFee,
    adminNote: admin ? str(body.adminNote, 500) : '', history: [{ status, at: now }],
  };
  return order;
}

function computeStats(orders, menu) {
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
  const p = url.pathname, m = req.method;
  const menu = currentMenu(await store.getMenu()); menuForMd = menu;

  if (p === '/api/menu' && m === 'GET') return send(res, 200, { ...menu, slots: SLOTS, payments: PAYMENTS }, { 'Cache-Control': 'no-store' });
  if (p.startsWith('/api/img/') && m === 'GET') {
    const name = p.slice('/api/img/'.length);
    if (!/^[A-Za-z0-9._-]+$/.test(name)) return send(res, 400, 'Bad name');
    const img = await store.getImage(name); if (!img) return send(res, 404, 'Not found');
    res.writeHead(200, { 'Content-Type': img.type, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
    return res.end(img.buf);
  }
  if (p === '/api/orders' && m === 'POST') {
    if (rateLimited('order:' + clientIp(req), 10, 10 * 60 * 1000)) return send(res, 429, { error: 'Too many orders from this device. Please try again later.' });
    const body = await readBody(req);
    let o;
    try { o = buildOrder(body, menu); } catch (e) { return send(res, 400, { error: e.message }); }
    for (let i = 0; i < 3 && !(await store.addOrder(o)); i++) o.id = newOrderId();
    console.log(`New order ${o.id} — ${o.customer.name} — ${menu.currency}${o.total}`);
    return send(res, 201, { id: o.id, total: o.total, status: o.status, delivery: o.delivery });
  }
  if (p === '/api/orders/track' && m === 'GET') {
    if (rateLimited('track:' + clientIp(req), 30, 60 * 1000)) return send(res, 429, { error: 'Slow down a little.' });
    const id = (url.searchParams.get('id') || '').trim().toUpperCase();
    const phone = (url.searchParams.get('phone') || '').replace(/\D/g, '');
    const o = /^[A-Z0-9-]{4,40}$/.test(id) ? await store.getOrder(id) : null;
    if (!o || !phone || o.customer.phone.replace(/\D/g, '').slice(-6) !== phone.slice(-6)) return send(res, 404, { error: 'No order found with that ID and phone number.' });
    return send(res, 200, { id: o.id, status: o.status, createdAt: o.createdAt, delivery: o.delivery, items: o.items, total: o.total, history: o.history });
  }

  if (p === '/api/admin/login' && m === 'POST') {
    if (rateLimited('login:' + clientIp(req), 8, 15 * 60 * 1000)) return send(res, 429, { error: 'Too many attempts. Try again in 15 minutes.' });
    const { password } = await readBody(req);
    if (!password || !safeEqual(password, ADMIN_PASSWORD)) return send(res, 401, { error: 'Wrong password.' });
    return send(res, 200, { ok: true }, { 'Set-Cookie': cookie(req, makeToken(), SESSION_MS / 1000) });
  }
  if (p === '/api/admin/logout' && m === 'POST') return send(res, 200, { ok: true }, { 'Set-Cookie': cookie(req, '', 0) });

  if (p.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return send(res, 401, { error: 'Not logged in.' });
    if (p === '/api/admin/me') return send(res, 200, { ok: true, storage: store.mode });
    const orders = await store.listOrders();
    if (p === '/api/admin/stats' && m === 'GET') return send(res, 200, { ...computeStats(orders, menu), storage: store.mode });
    if (p === '/api/admin/orders' && m === 'GET') return send(res, 200, { orders: [...orders].reverse(), statuses: STATUSES, currency: menu.currency });
    if (p === '/api/admin/export.csv' && m === 'GET') return send(res, 200, ordersCsv(orders), { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"` });
    if (p === '/api/admin/orders.md' && m === 'GET') return send(res, 200, ordersToMarkdown(orders, menu), { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': 'attachment; filename="orders.md"' });
    // CREATE (admin-entered order, e.g. phone or walk-in)
    if (p === '/api/admin/orders' && m === 'POST') {
      const body = await readBody(req);
      let o; try { o = buildOrder(body, menu, true); } catch (e) { return send(res, 400, { error: e.message }); }
      o.source = 'admin';
      for (let i = 0; i < 3 && !(await store.addOrder(o)); i++) o.id = newOrderId();
      return send(res, 201, o);
    }
    // DELETE many at once
    if (p === '/api/admin/orders/delete' && m === 'POST') {
      const { ids } = await readBody(req);
      if (!Array.isArray(ids) || !ids.length) return send(res, 400, { error: 'Select at least one order.' });
      const clean = ids.filter(x => typeof x === 'string' && /^[A-Z0-9-]{4,40}$/.test(x)).slice(0, 500);
      await store.deleteOrders(clean);
      return send(res, 200, { ok: true, deleted: clean.length });
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
        await store.saveOrder(o);
        return send(res, 200, o);
      }
      // UPDATE everything (customer, delivery, items, status, notes) — prices re-calculated from the menu
      if (m === 'PUT') {
        const body = await readBody(req);
        let n; try { n = buildOrder(body, menu, true); } catch (e) { return send(res, 400, { error: e.message }); }
        const updated = { ...o, customer: n.customer, delivery: n.delivery, payment: n.payment, notes: n.notes, items: n.items,
          subtotal: n.subtotal, deliveryFee: n.deliveryFee, total: n.total, adminNote: n.adminNote, updatedAt: new Date().toISOString() };
        if (n.status !== o.status) { updated.status = n.status; updated.history = [...o.history, { status: n.status, at: new Date().toISOString() }]; }
        await store.saveOrder(updated);
        return send(res, 200, updated);
      }
      if (m === 'DELETE') { await store.deleteOrder(o.id); return send(res, 200, { ok: true }); }
    }
    if (p === '/api/admin/menu' && m === 'GET') return send(res, 200, menu);
    if (p === '/api/admin/menu' && m === 'PUT') {
      const body = await readBody(req);
      let next; try { next = validateMenu(body, menu); } catch (e) { return send(res, 400, { error: e.message }); }
      await store.saveMenu(next); return send(res, 200, next);
    }
    if (p === '/api/admin/upload' && m === 'POST') {
      const type = (req.headers['content-type'] || '').split(';')[0];
      if (!IMG_TYPES[type]) return send(res, 415, { error: 'Please upload a JPG, PNG or WebP image.' });
      const buf = await readRaw(req, 4 * 1024 * 1024);
      const ext = sniffImage(buf); if (!ext) return send(res, 415, { error: 'That file is not a valid image.' });
      const name = `bowl-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}${ext}`;
      await store.putImage(name, buf, { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[ext]);
      return send(res, 201, { url: '/api/img/' + name });
    }
  }
  return send(res, 404, { error: 'Not found' });
}

function validateMenu(b, menu) {
  const FRUIT_IDS = () => menu.custom.fruits.map(f => f.id);
  const num = (v, name) => { const n = Number(v); if (!(n >= 0 && n < 100000)) throw new Error(`Invalid ${name}.`); return Math.round(n * 100) / 100; };
  if (!Array.isArray(b.bowls)) throw new Error('Invalid menu.');
  const cats = Array.isArray(menu.categories) ? menu.categories : [];
  const ids = new Set();
  const bowls = b.bowls.map(x => {
    const id = str(x.id, 40).toLowerCase().replace(/[^a-z0-9-]/g, '-') || ('bowl-' + crypto.randomBytes(2).toString('hex'));
    if (ids.has(id)) throw new Error(`Two items have the same id "${id}" — rename one.`);
    ids.add(id);
    const name = str(x.name, 60); if (!name) throw new Error('Every item needs a name.');
    const category = cats.some(c => c.id === x.category) ? x.category : cats[0]?.id || '';
    return {
      id, name, category, portion: str(x.portion, 30), description: str(x.description, 300), price: num(x.price, 'price for ' + name),
      includes: (Array.isArray(x.includes) ? x.includes : []).map(t => str(t, 80)).filter(Boolean).slice(0, 15),
      calories: Math.floor(num(x.calories || 0, 'calories')), tag: str(x.tag, 20),
      fruits: (Array.isArray(x.fruits) ? x.fruits : []).filter(f => FRUIT_IDS().includes(f)).slice(0, 8),
      available: !!x.available,
      image: typeof x.image === 'string' && /^\/api\/img\/[A-Za-z0-9._-]+$/.test(x.image) ? x.image : '',
    };
  });
  const custom = { ...menu.custom, basePrice: num(b.custom?.basePrice ?? menu.custom.basePrice, 'base price') };
  if (Array.isArray(b.custom?.fruits)) custom.fruits = menu.custom.fruits.map(f => { const u = b.custom.fruits.find(x => x.id === f.id); return u ? { ...f, price: num(u.price, f.name + ' price') } : f; });
  if (Array.isArray(b.custom?.toppings)) custom.toppings = menu.custom.toppings.map(t => { const u = b.custom.toppings.find(x => x.id === t.id); return u ? { ...t, price: num(u.price, t.name + ' price') } : t; });
  return {
    currency: str(b.currency, 4) || menu.currency,
    deliveryFee: num(b.deliveryFee, 'delivery fee'),
    freeDeliveryAbove: num(b.freeDeliveryAbove, 'free delivery threshold'),
    menuVersion: menu.menuVersion || DEFAULT_MENU.menuVersion, categories: cats, bowls, custom,
  };
}


function csvCell(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function ordersCsv(orders) {
  const head = ['Order ID', 'Placed', 'Status', 'Name', 'Phone', 'Email', 'Address', 'Delivery date', 'Slot', 'Payment', 'Items', 'Subtotal', 'Delivery fee', 'Total', 'Customer notes', 'Admin note'];
  const rows = orders.map(o => [o.id, o.createdAt, o.status, o.customer.name, o.customer.phone, o.customer.email, o.customer.address,
    o.delivery.date, o.delivery.slot, o.payment, o.items.map(i => `${i.qty}x ${i.name}${i.details ? ' (' + i.details + ')' : ''}`).join('; '),
    o.subtotal, o.deliveryFee, o.total, o.notes, o.adminNote]);
  return [head, ...rows].map(r => r.map(csvCell).join(',')).join('\n');
}

// Main entry: (req, res) for both Vercel and the local server
async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  // Vercel rewrite /api/(.*) → /api/index?__p=$1 — restore the original path
  const fwd = url.searchParams.get('__p');
  if (fwd !== null) { url.pathname = '/api/' + fwd; url.searchParams.delete('__p'); }
  try {
    return await handleApi(req, res, url);
  } catch (e) {
    if (e.code !== 'NO_STORAGE') console.error(e);
    if (!res.headersSent) send(res, e.code === 'NO_STORAGE' ? 503 : e.message === 'Invalid JSON' || e.message === 'Body too large' ? 400 : 500, { error: e.message || 'Server error' });
  }
}
module.exports = { handler, store };
