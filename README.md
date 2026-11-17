# Navrasa — Fresh Bowls & More (3D shop)

A complete fruit-bowl ordering website with an interactive 3D storefront, real checkout, order tracking, and a private admin dashboard. **No dependencies** — just Node.js 18+.

## Run it

```bash
cd fruit-bowl
ADMIN_PASSWORD="choose-a-strong-password" npm start
```

Then open:

| Page | URL | Who |
|---|---|---|
| Shop | http://localhost:3000 | Customers |
| Track an order | http://localhost:3000/track | Customers |
| Admin dashboard | http://localhost:3000/admin | You (password protected) |

Optional: `PORT=8080` to change the port. The local server is `dev-server.js` (`npm start`). If `ADMIN_PASSWORD` is not set the default is `admin123` — **always set it before going live.**

## Where orders are stored

| File | What it is |
|---|---|
| `data/orders.json` | (file mode) Source of truth — every order with customer, items, totals, status history. |
| `data/orders.md` | Human-readable Markdown log, rewritten automatically after every new order or status change. |
| `data/menu.json` | Bowls, prices, custom-bowl fruit/topping prices, delivery fee. Editable from the admin panel. |

Back up the `data/` folder regularly. You can also download orders as **CSV** (opens in Excel/Google Sheets) or **orders.md** from the admin sidebar.

## Features

**Customer site**
- Photographic 3D hero: your real Navrasa product photo, wrapped onto a depth model of the cup so it turns and tilts in 3D (drag to turn) at full photo quality (`public/img/hero-cup.webp` + `public/img/hero-depth.png`)
- Build-your-own uses a live 3D cup so customers see their picked fruit and toppings land in it
- **Real photos on menu cards:** Admin → Menu & prices → *Upload photo* on any bowl. Cards without a photo show a 3D render of that bowl's fruit
- Menu card photos are rendered from the same 3D models, so they always match each bowl's fruit list
- Menu of signature bowls (3D tilt cards, sold-out handling)
- **Build-your-own bowl in 3D** — pick 2–8 fruits and they drop into the bowl live; toppings; live price
- Cart (saved in the browser), free-delivery threshold, quantity controls
- Checkout: name, phone, email, address, delivery date (up to 14 days) + 2-hour slot, payment on delivery (cash/UPI/card), notes
- Order confirmation with an order ID, and a tracking page with a live status timeline

**Admin panel (`/admin`)**
- Password login (HttpOnly session cookie, rate-limited)
- Dashboard: revenue, orders, today's numbers, open orders, average order, 14-day revenue chart, status breakdown, best sellers, most-loved fruits, delivery-slot demand, recent orders
- Orders: filter by status / delivery day, search, click for full details; one-click status changes (pending → preparing → out for delivery → delivered / cancelled), internal notes, call/WhatsApp/map links, print slip, delete
- Auto-refresh every 15 s with a sound + toast when a new order arrives
- Customers list with order count and total spend
- Menu editor: prices, descriptions, tags, in-stock toggle, add/remove bowls, custom-bowl prices, delivery fee, currency

**Safety built in:** prices are always recalculated on the server (customers can't tamper with totals), input validation, rate limiting on orders/login/tracking, atomic file writes, path-traversal protection.

## Customising

- **Business name:** search for `Navrasa` in `public/*.html`; the cup label image is `public/img/navrasa-label.png`.
- **Currency, prices, bowls:** admin panel → *Menu & prices* (or edit `data/menu.json`).
- **Delivery slots / payment methods:** `SLOTS` and `PAYMENTS` at the top of `server.js`.
- **Colours & fonts:** CSS variables at the top of `public/css/styles.css`.

## Deploy on Vercel

Orders are stored as **files** in a private Vercel Blob store (Vercel's own disk is read-only):

| File in Blob store | What it is |
|---|---|
| `navrasa/orders.json` | The order database — every order, read and updated on each change |
| `navrasa/orders.md` | Human-readable log of all orders, rewritten after every change |
| `navrasa/menu.json` | Menu and prices (edited from the admin panel) |
| `navrasa/images/…` | Bowl photos uploaded in the admin panel |

Writes are conditional on the file's version (ETag), so simultaneous orders never overwrite each other.
You can browse and download these files in Vercel → **Storage → your Blob store → Browser**, or from the admin panel (**⬇ orders.md**, **⬇ Orders CSV**).

Setup:
1. Import the GitHub repo in Vercel (framework preset **Other**). `vercel.json` serves `public/` and routes `/api/*` to `api/index.js`.
2. **Settings → Environment Variables:** add `ADMIN_PASSWORD`.
3. **Storage → Create → Blob**, access **Private**, connect it to this project (this adds `BLOB_READ_WRITE_TOKEN`).
4. **Redeploy.**

(Upstash Redis is still supported as an alternative: if `KV_REST_API_URL`/`KV_REST_API_TOKEN` are set and no Blob token is, Redis is used.)

## Deploy elsewhere (Render, Railway, VPS)

Any host that runs Node and keeps files on disk works (a VPS, Railway/Render with a persistent disk, etc.). Put it behind HTTPS (e.g. Caddy or Nginx). Serverless hosts with read-only/ephemeral filesystems will lose `data/` — use a persistent volume there.

Three.js (MIT) is bundled in `public/vendor/three`, so the site needs no CDN.

## Changing the hero photo

`tools/make-hero-3d.py` (Python + Pillow + NumPy) rebuilds the hero cut-out and depth map from `tools/source-photo.webp`. Its cup-outline numbers are tuned to the current photo, so a new photo with different framing needs them adjusted.

Uploaded menu photos are stored in `data/uploads/`; back them up with the rest of `data/`.
