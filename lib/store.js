// Storage backends with one async API:
//   • Vercel Blob files: navrasa/orders.json (database) + orders.md + menu.json — used when BLOB_READ_WRITE_TOKEN is set
//   • Upstash Redis (optional alternative, used when its env vars exist)
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
  constructor() { super('Storage is not set up yet: connect a Vercel Blob store to this project (Vercel → Storage → Blob), then redeploy.'); this.code = 'NO_STORAGE'; }
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
    async deleteOrders(ids) { if (ids.length) await cmd('HDEL', `${P}:orders`, ...ids); },
    async putImage(name, buf, type) { await cmd('SET', `${P}:img:${name}`, `${type};${buf.toString('base64')}`); },
    async getImage(name) {
      const v = await cmd('GET', `${P}:img:${name}`); if (!v) return null;
      const i = v.indexOf(';'); return { type: v.slice(0, i), buf: Buffer.from(v.slice(i + 1), 'base64') };
    },
  };
}

// ---------- Vercel Blob: real files (orders.json is the database, orders.md the readable copy) ----------
// Files live in a PRIVATE Blob store under navrasa/. Writes are conditional on the file's ETag, so two
// orders arriving at the same moment can never overwrite each other: the loser re-reads and retries.
function blobStore(onOrdersChanged) {
  const blob = require('@vercel/blob');
  const DIR = (process.env.BLOB_DIR || 'navrasa').replace(/\/+$/, '');
  const F = { orders: `${DIR}/orders.json`, md: `${DIR}/orders.md`, menu: `${DIR}/menu.json`, img: n => `${DIR}/images/${n}` };
  const opts = { access: 'private' };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const conflict = e => e instanceof blob.BlobPreconditionFailedError || /precondition|already exists/i.test(`${e && e.name} ${e && e.message}`);
  const notFound = e => e instanceof blob.BlobNotFoundError || /not.?found/i.test(`${e && e.name} ${e && e.message}`);
  // The version tag (ETag) must come from the Blob API (head), not from the file download's HTTP header:
  // the two use different formats, and ifMatch only accepts the API's.
  async function read(path) {
    let etag;
    try { etag = (await blob.head(path)).etag; } catch (e) { if (notFound(e)) return { data: null, etag: null }; throw e; }
    const r = await blob.get(path, { ...opts, useCache: false });
    if (!r || r.statusCode !== 200) return { data: null, etag };
    return { data: JSON.parse(await new Response(r.stream).text()), etag };
  }
  async function write(path, data, etag, force = false) {
    await blob.put(path, JSON.stringify(data, null, 2), {
      ...opts, contentType: 'application/json', addRandomSuffix: false, cacheControlMaxAge: 60,
      ...(force ? { allowOverwrite: true } : etag ? { ifMatch: etag } : { allowOverwrite: false }),
    });
  }
  async function writeText(path, text, type) {
    await blob.put(path, text, { ...opts, contentType: type, addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 });
  }
  // read → change → write-if-unchanged, retrying on a clash
  async function updateOrders(fn) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const { data, etag } = await read(F.orders);
      const list = data || [];
      const result = fn(list);
      if (result === false) return false;
      // after repeated clashes, save on top of the freshest copy so a change is never lost or stuck
      const force = attempt >= 5;
      try {
        await write(F.orders, list, etag, force);
        if (onOrdersChanged) { const md = onOrdersChanged(list); if (md) await writeText(F.md, md, 'text/markdown; charset=utf-8').catch(e => console.error('orders.md not updated:', e.message)); }
        return true;
      } catch (e) {
        if (!conflict(e)) throw e;
        console.warn(`orders.json changed while saving (attempt ${attempt + 1}): ${e.message}`);
        await sleep(40 + Math.random() * 160 * (attempt + 1));
      }
    }
    throw new Error('Could not save the order file — please try again in a moment.');
  }
  return {
    mode: 'blob', dir: DIR,
    async getMenu() { return (await read(F.menu)).data || clone(DEFAULT_MENU); },
    async saveMenu(m) {
      for (let i = 0; i < 5; i++) {
        const { etag } = await read(F.menu);
        try { return await write(F.menu, m, etag, i >= 3); } catch (e) { if (!conflict(e)) throw e; await sleep(100); }
      }
      throw new Error('Could not save the menu — please try again.');
    },
    async listOrders() { return ((await read(F.orders)).data || []).sort((a, b) => a.createdAt.localeCompare(b.createdAt)); },
    async getOrder(id) { return ((await read(F.orders)).data || []).find(o => o.id === id) || null; },
    async saveOrder(o) { await updateOrders(l => { const i = l.findIndex(x => x.id === o.id); if (i >= 0) l[i] = o; else l.push(o); }); },
    async addOrder(o) { return updateOrders(l => { if (l.some(x => x.id === o.id)) return false; l.push(o); }); },
    async deleteOrder(id) { await updateOrders(l => { const i = l.findIndex(x => x.id === id); if (i >= 0) l.splice(i, 1); }); },
    async deleteOrders(ids) { const set = new Set(ids); await updateOrders(l => { for (let i = l.length - 1; i >= 0; i--) if (set.has(l[i].id)) l.splice(i, 1); }); },
    async putImage(name, buf, type) { await blob.put(F.img(name), buf, { ...opts, contentType: type, addRandomSuffix: false, allowOverwrite: true }); },
    async getImage(name) {
      const r = await blob.get(F.img(name), opts);
      if (!r || r.statusCode !== 200) return null;
      return { type: r.blob.contentType, buf: Buffer.from(await new Response(r.stream).arrayBuffer()) };
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
    async deleteOrders(ids) { const set = new Set(ids); put(all().filter(o => !set.has(o.id))); },
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
    saveMenu: no, saveOrder: no, addOrder: no, deleteOrder: no, deleteOrders: no, putImage: no,
  };
}

function createStore({ onOrdersChanged } = {}) {
  if (process.env.BLOB_READ_WRITE_TOKEN) return blobStore(onOrdersChanged && (list => onOrdersChanged(list)));
  if (REDIS_URL && REDIS_TOKEN) return redisStore();
  const dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  if (process.env.VERCEL && !process.env.DATA_DIR) return readOnlyStore(); // Vercel's disk is read-only and wiped
  try { return fileStore(dir, onOrdersChanged); } catch (e) { console.error('File storage unavailable:', e.message); return readOnlyStore(); }
}
module.exports = { createStore, NotConfigured };
