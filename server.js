/* ─────────────────────────────────────────────
   NAVRASA — zero-dependency server
   Serves the site, stores orders on disk (no DB),
   and exposes a small admin API.
   Run:  node server.js
   ───────────────────────────────────────────── */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const fsp = fs.promises;

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8123;
const DATA_DIR = path.join(ROOT, "data");
const ORDERS_JSON = path.join(DATA_DIR, "orders.json");
const ORDERS_MD = path.join(DATA_DIR, "orders.md");

const DELIVERY_FEE = 39;
const FREE_DELIVERY_OVER = 499;
const STATUSES = ["confirmed", "packed", "out_for_delivery", "delivered", "cancelled"];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2"
};

/* ── order store ─────────────────────────────── */
let queue = Promise.resolve();

function withStore(fn) {
  const run = queue.then(async () => {
    await fsp.mkdir(DATA_DIR, { recursive: true });
    let orders = [];
    try {
      orders = JSON.parse(await fsp.readFile(ORDERS_JSON, "utf8"));
      if (!Array.isArray(orders)) orders = [];
    } catch {
      orders = [];
    }
    const result = await fn(orders);
    return result;
  });
  queue = run.catch(() => {});
  return run;
}

async function saveOrders(orders) {
  const tmp = `${ORDERS_JSON}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(orders, null, 2), "utf8");
  await fsp.rename(tmp, ORDERS_JSON);
}

function lineTotal(line) {
  return Number(line.unitPrice) * Number(line.qty);
}

function mdBlock(order) {
  const items = order.items
    .map((l) => {
      const extras = (l.custom?.ingredients || [])
        .filter((i) => i.count !== 1)
        .map((i) => (i.count === 0 ? `no ${i.name}` : `${i.count}× ${i.name}`))
        .concat((l.custom?.addons || []).map((a) => `+${a.name}`))
        .join(", ");
      return `| ${l.qty}× ${l.name} | ${extras || "—"} | ₹${lineTotal(l)} |`;
    })
    .join("\n");

  return `
---

## ${order.code} · ₹${order.total} · ${order.payment === "cod" ? "Cash on delivery" : "Online"}

- **Placed:** ${new Date(order.createdAt).toLocaleString("en-IN")}
- **Status:** ${order.status}
- **Customer:** ${order.name} · ${order.phone}
- **Address:** ${order.address}
- **Delivery:** ${order.date} at ${order.slot}
${order.notes ? `- **Notes:** ${order.notes}\n` : ""}
| Item | Customisation | Price |
| --- | --- | --- |
${items}

Subtotal ₹${order.subtotal}${order.delivery ? ` · Delivery ₹${order.delivery}` : " · Delivery free"}
`;
}

async function appendMarkdown(order) {
  const header = "# NAVRASA — order log\n\nEvery order placed on the site is appended here.\n";
  await fsp.mkdir(DATA_DIR, { recursive: true });
  const exists = fs.existsSync(ORDERS_MD);
  await fsp.appendFile(ORDERS_MD, exists ? mdBlock(order) : `${header}${mdBlock(order)}`, "utf8");
}

/* ── helpers ─────────────────────────────────── */
const DATE_HINT = "Use a date from tomorrow up to 7 days ahead, between 8 am and 9 pm.";

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) reject(new Error("Payload too large"));
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function send(res, code, body, type = "application/json; charset=utf-8") {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(payload);
}

function orderCode() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `NR-${yy}${mm}${dd}-${rand}`;
}

function validateOrder(body) {
  const errors = [];
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").replace(/\D/g, "");
  const address = String(body.address || "").trim();
  const date = String(body.date || "");
  const slot = String(body.slot || "");
  const payment = String(body.payment || "");
  const items = Array.isArray(body.items) ? body.items : [];

  if (name.length < 2) errors.push("A name is required.");
  if (!/^[6-9]\d{9}$/.test(phone)) errors.push("Enter a 10-digit Indian mobile number.");
  if (address.length < 10) errors.push("Enter a full delivery address.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push("Choose a delivery date.");
  if (!/^\d{1,2}:\d{2} (am|pm)$/.test(slot)) errors.push("Choose a delivery slot.");
  if (!["cod", "online"].includes(payment)) errors.push("Choose a payment method.");
  if (!items.length) errors.push("The cart is empty.");

  items.forEach((l) => {
    if (!l || typeof l.name !== "string" || !(Number(l.qty) > 0) || !(Number(l.unitPrice) >= 0)) {
      errors.push("An item in the cart is invalid.");
    }
  });

  return { errors, clean: { name, phone, address, date, slot, payment, items, notes: String(body.notes || "").trim().slice(0, 400) } };
}

/* ── API ─────────────────────────────────────── */
async function handleApi(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);

  if (req.method === "POST" && url.pathname === "/api/orders") {
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      return send(res, 400, { error: e.message });
    }
    const { errors, clean } = validateOrder(body);
    if (errors.length) return send(res, 400, { error: errors.join(" "), errors });

    const order = await withStore(async (orders) => {
      const subtotal = clean.items.reduce((n, l) => n + lineTotal(l), 0);
      const delivery = subtotal >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE;
      let code = orderCode();
      while (orders.some((o) => o.code === code)) code = orderCode();

      const record = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        code,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "confirmed",
        statusHistory: [{ status: "confirmed", at: new Date().toISOString() }],
        payment: clean.payment,
        paymentStatus: clean.payment === "cod" ? "due" : "awaiting_scan",
        name: clean.name,
        phone: clean.phone,
        address: clean.address,
        date: clean.date,
        slot: clean.slot,
        notes: clean.notes,
        items: clean.items.map((l) => ({
          name: String(l.name).slice(0, 120),
          qty: Math.min(50, Number(l.qty)),
          unitPrice: Number(l.unitPrice),
          custom: l.custom || null,
          notes: l.notes || ""
        })),
        subtotal,
        delivery,
        total: subtotal + delivery,
        currency: "INR"
      };
      orders.unshift(record);
      await saveOrders(orders);
      return record;
    });

    await appendMarkdown(order);
    return send(res, 201, order);
  }

  if (req.method === "GET" && url.pathname === "/api/orders") {
    const orders = await withStore(async (o) => o);
    return send(res, 200, orders);
  }

  if (req.method === "GET" && parts[1] === "orders" && parts[2]) {
    const orders = await withStore(async (o) => o);
    const order = orders.find((o) => o.code === parts[2] || o.id === parts[2]);
    return order ? send(res, 200, order) : send(res, 404, { error: "Order not found" });
  }

  if (req.method === "PATCH" && parts[1] === "orders" && parts[2] && parts[3] === "status") {
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      return send(res, 400, { error: e.message });
    }
    if (!STATUSES.includes(body.status)) return send(res, 400, { error: "Unknown status" });

    const updated = await withStore(async (orders) => {
      const order = orders.find((o) => o.code === parts[2] || o.id === parts[2]);
      if (!order) return null;
      order.status = body.status;
      order.updatedAt = new Date().toISOString();
      order.statusHistory = order.statusHistory || [];
      order.statusHistory.push({ status: body.status, at: order.updatedAt });
      if (body.status === "delivered" && order.payment === "cod") order.paymentStatus = "paid";
      await saveOrders(orders);
      return order;
    });
    return updated ? send(res, 200, updated) : send(res, 404, { error: "Order not found" });
  }

  if (req.method === "GET" && url.pathname === "/api/summary") {
    const orders = await withStore(async (o) => o);
    const live = orders.filter((o) => o.status !== "cancelled");
    const sum = (list) => list.reduce((n, o) => n + o.total, 0);
    return send(res, 200, {
      orders: orders.length,
      revenue: sum(live),
      cod: sum(live.filter((o) => o.payment === "cod")),
      online: sum(live.filter((o) => o.payment === "online")),
      byStatus: STATUSES.reduce((acc, s) => ({ ...acc, [s]: orders.filter((o) => o.status === s).length }), {}),
      averageOrder: live.length ? Math.round(sum(live) / live.length) : 0
    });
  }

  if (url.pathname === "/api/meta") {
    return send(res, 200, { deliveryFee: DELIVERY_FEE, freeDeliveryOver: FREE_DELIVERY_OVER, statuses: STATUSES });
  }

  return send(res, 404, { error: "Not found" });
}

/* ── static files ────────────────────────────── */
const PAGES = {
  "/": "index.html",
  "/menu": "index.html",
  "/cart": "cart.html",
  "/checkout": "checkout.html",
  "/confirm": "confirm.html",
  "/admin": "admin.html"
};

async function serveStatic(req, res, url) {
  let rel = PAGES[url.pathname] || decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!rel) rel = "index.html";
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) return send(res, 403, "Forbidden", "text/plain");

  try {
    const stat = await fsp.stat(file);
    if (stat.isDirectory()) return send(res, 404, "Not found", "text/plain");
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": "no-cache"
    });
    fs.createReadStream(file).pipe(res);
  } catch {
    send(res, 404, "Not found", "text/plain");
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url).catch((err) => {
      console.error(err);
      send(res, 500, { error: "Something went wrong" });
    });
    return;
  }
  serveStatic(req, res, url);
});

fs.mkdirSync(DATA_DIR, { recursive: true });
server.listen(PORT, () => {
  console.log(`NAVRASA running at http://localhost:${PORT}`);
  console.log(`Orders: ${ORDERS_JSON}`);
});
