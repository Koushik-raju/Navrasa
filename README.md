# Navrasa — Fresh Bowls & More


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
- Simple, text-first design (no images or animations)
- Full Navrasa menu: 67 items in 9 categories (fruit bowls, smoothies, smoothie bowls, juices, salads, breakfast, add-ons, combos, 5-day plans) with portions and prices, category tabs, sold-out handling
- Cart (saved in the browser), free-delivery threshold, quantity controls
- Checkout: name, phone, email, address, delivery date (up to 14 days) + 2-hour slot, payment on delivery (cash/UPI/card), notes
- Order confirmation with an order ID, and a tracking page with a live status timeline

**Admin panel (`/admin`)**
- Password login (HttpOnly session cookie, rate-limited)
- Dashboard: revenue, orders, today's numbers, open orders, average order, 14-day revenue chart, status breakdown, best sellers, most-loved fruits, delivery-slot demand, recent orders
- Orders: filter by status / delivery day, search, click for full details; one-click status changes (pending → preparing → out for delivery → delivered / cancelled), internal notes, call/WhatsApp/map links, print slip, delete
- Auto-refresh every 15 s with a sound + toast when a new order arrives
- Customers list with order count and total spend
- Menu editor: category, portion, price, description, "what's inside", tag and in-stock for every item; filter by category or search; add/remove items; build-your-own prices, delivery fee, currency

**Safety built in:** prices are always recalculated on the server (customers can't tamper with totals), input validation, rate limiting on orders/login/tracking, atomic file writes, path-traversal protection.

## Customising

- **Business name:** search for `Navrasa` in `public/*.html`.
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





## Changing the menu file

`data/menu.json` holds the full menu. If you edit it by hand, raise `menuVersion` by 1 — the live site then replaces any older menu saved from the admin panel with this file. (Edits made in the admin panel are kept until then.)
