// Storage backends with one async API:
//   • Upstash Redis (used automatically when its env vars exist — e.g. on Vercel)
//   • local files in DATA_DIR (default for `npm start`, Render, Railway, VPS)
//   • read-only fallback (Vercel without a database): the shop works, saving shows a clear error
'use strict';
const fs = require('fs');
const path = require('path');
const DEFAULT_MENU = require('../data/menu.json');

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const P = process.env.STORE_PREFIX || 'navrasa';
const clone = o => JSON.parse(JSON.stringify(o));

class NotConfigured extends Error {
  constructor() { super('Storage is not set up yet: connect an Upstash Redis database to this Vercel project (see README → Deploy on Vercel).'); this.code = 'NO_STORAGE'; }
}

// ---------- Upstash Redis (REST, no dependencies) ----------
function redisStore() {
  async function cmd(...args) {
    const r = await fetch(REDIS_URL, { method: 'POST', headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error('Database error: ' + (j.error || r.status));
    return j.result;
  }
  return {
    mode: 'redis',
    async getMenu() { const v = await cmd('GET', `${P}:menu`); return v ? JSON.parse(v) : clone(DEFAULT_MENU); },
    async saveMenu(m) { await cmd('SET', `${P}:menu`, JSON.stringify(m)); },
    async listOrders() {
      const flat = (await cmd('HGETALL', `${P}:orders`)) || [];
      const out = []; for (let i = 1; i < flat.length; i += 2) { try { out.push(JSON.parse(flat[i])); } catch {} }
      return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async getOrder(id) { const v = await cmd('HGET', `${P}:orders`, id); return v ? JSON.parse(v) : null; },
    async saveOrder(o) { await cmd('HSET', `${P}:orders`, o.id, JSON.stringify(o)); },
    async addOrder(o) { const added = await cmd('HSETNX', `${P}:orders`, o.id, JSON.stringify(o)); return added === 1; },
    async deleteOrder(id) { await cmd('HDEL', `${P}:orders`, id); },
    async putImage(name, buf, type) { await cmd('SET', `${P}:img:${name}`, `${type};${buf.toString('base64')}`); },
    async getImage(name) {
      const v = await cmd('GET', `${P}:img:${name}`); if (!v) return null;
      const i = v.indexOf(';'); return { type: v.slice(0, i), buf: Buffer.from(v.slice(i + 1), 'base64') };
    },
  };
}

// ---------- local files ----------
function fileStore(dir, onOrdersChanged) {
  const ORDERS = path.join(dir, 'orders.json'), MENU = path.join(dir, 'menu.json'), UP = path.join(dir, 'uploads');
  fs.mkdirSync(UP, { recursive: true });
  if (!fs.existsSync(MENU)) fs.writeFileSync(MENU, JSON.stringify(DEFAULT_MENU, null, 2));
  if (!fs.existsSync(ORDERS)) fs.writeFileSync(ORDERS, '[]');
  const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
  const write = (f, s) => { const t = `${f}.${process.pid}.tmp`; fs.writeFileSync(t, s); fs.renameSync(t, f); };
  const all = () => read(ORDERS, []);
  const put = list => { write(ORDERS, JSON.stringify(list, null, 2)); if (onOrdersChanged) onOrdersChanged(list, dir); };
  const TYPES = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
  return {
    mode: 'files', dir,
    async getMenu() { return read(MENU, clone(DEFAULT_MENU)); },
    async saveMenu(m) { write(MENU, JSON.stringify(m, null, 2)); },
    async listOrders() { return all(); },
    async getOrder(id) { return all().find(o => o.id === id) || null; },
    async saveOrder(o) { const l = all(); const i = l.findIndex(x => x.id === o.id); if (i >= 0) l[i] = o; else l.push(o); put(l); },
    async addOrder(o) { const l = all(); if (l.some(x => x.id === o.id)) return false; l.push(o); put(l); return true; },
    async deleteOrder(id) { put(all().filter(o => o.id !== id)); },
    async putImage(name, buf) { fs.writeFileSync(path.join(UP, name), buf); },
    async getImage(name) { const f = path.join(UP, name); if (!f.startsWith(UP + path.sep) || !fs.existsSync(f)) return null; return { type: TYPES[path.extname(f)] || 'application/octet-stream', buf: fs.readFileSync(f) }; },
  };
}

// ---------- read-only (Vercel without a database) ----------
function readOnlyStore() {
  const no = async () => { throw new NotConfigured(); };
  return {
    mode: 'unconfigured',
    async getMenu() { return clone(DEFAULT_MENU); }, async listOrders() { return []; }, async getOrder() { return null; }, async getImage() { return null; },
    saveMenu: no, saveOrder: no, addOrder: no, deleteOrder: no, putImage: no,
  };
}

function createStore({ onOrdersChanged } = {}) {
  if (REDIS_URL && REDIS_TOKEN) return redisStore();
  const dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  if (process.env.VERCEL && !process.env.DATA_DIR) return readOnlyStore(); // Vercel's disk is read-only and wiped
  try { return fileStore(dir, onOrdersChanged); } catch (e) { console.error('File storage unavailable:', e.message); return readOnlyStore(); }
}
module.exports = { createStore, NotConfigured };
