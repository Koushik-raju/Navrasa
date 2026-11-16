/* ─────────────────────────────────────────────
   NAVRASA — orders dashboard
   Reads data/orders.json through the local API.
   ───────────────────────────────────────────── */
(function () {
  const NAV = window.NAV;
  const $ = (s) => document.querySelector(s);

  const LABELS = {
    confirmed: "Confirmed",
    packed: "Packed",
    out_for_delivery: "Out for delivery",
    delivered: "Delivered",
    cancelled: "Cancelled"
  };
  const NEXT = ["confirmed", "packed", "out_for_delivery", "delivered", "cancelled"];

  let orders = [];
  let summary = {};
  let filter = "all";
  let query = "";
  const openCards = new Set();

  const money = (n) => NAV.money(n);
  const when = (iso) =>
    new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  function statCard(label, value, dark) {
    return `<div class="stat${dark ? " stat--dark" : ""}"><span>${label}</span><b>${value}</b></div>`;
  }

  function renderStats() {
    const s = summary;
    $("#stats").innerHTML = [
      statCard("Revenue (all live orders)", money(s.revenue || 0), true),
      statCard("Online revenue", money(s.online || 0)),
      statCard("Cash on delivery", money(s.cod || 0)),
      statCard("Orders", s.orders || 0),
      statCard("Average order", money(s.averageOrder || 0))
    ].join("");
  }

  function renderFilters() {
    const counts = summary.byStatus || {};
    const entries = [["all", orders.length], ...NEXT.map((s) => [s, counts[s] || 0])];
    $("#filters").innerHTML = entries
      .map(
        ([key, n]) => `<button class="filter${filter === key ? " is-active" : ""}" data-filter="${key}" type="button">
          ${key === "all" ? "All" : LABELS[key]}<span>${n}</span></button>`
      )
      .join("");
  }

  function lineBits(l) {
    const bits = [];
    (l.custom?.ingredients || []).forEach((i) => {
      if (i.count === 0) bits.push(`no ${i.name.toLowerCase()}`);
      else if (i.count > 1) bits.push(`${i.count}× ${i.name.toLowerCase()}`);
    });
    (l.custom?.addons || []).forEach((a) => bits.push(`+ ${a.name.toLowerCase()}`));
    return bits.join(" · ");
  }

  function orderCard(order) {
    const open = openCards.has(order.code);
    const placed = when(order.createdAt);
    const slotDate = new Date(`${order.date}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    return `<article class="order-card${open ? " is-open" : ""}" data-code="${order.code}">
      <div class="order-card__top">
        <button class="order-card__toggle" type="button" data-toggle="${order.code}">
          <span class="order-card__code">${order.code}</span>
          <span class="pill pill--${order.payment}">${order.payment === "cod" ? "COD" : "Online"}</span>
          <span class="order-card__when">${order.name} · ${order.phone}</span>
          <span class="order-card__spacer"></span>
          <span class="order-card__when">${slotDate} · ${order.slot}</span>
          <span class="order-card__total">${money(order.total)}</span>
          <span class="pill pill--${order.status}">${LABELS[order.status]}</span>
        </button>
        <button class="copy-btn" type="button" data-copy="${order.code}" title="Copy order ID" aria-label="Copy order ID ${order.code}">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M15 5.5A1.5 1.5 0 0 0 13.5 4h-8A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15" stroke="currentColor" stroke-width="1.6"/></svg>
          Copy ID
        </button>
      </div>
      <div class="order-card__body">
        <div class="details">
          <div><span>Placed</span><b>${placed}</b></div>
          <div><span>Deliver to</span><b>${order.address}</b></div>
          <div><span>Phone</span><b>${order.phone}</b></div>
          <div><span>Payment</span><b>${order.payment === "cod" ? `Cash on delivery · ${order.paymentStatus}` : "Online / UPI · awaiting scan"}</b></div>
          ${order.notes ? `<div><span>Notes</span><b>${order.notes}</b></div>` : ""}
        </div>
        <div class="order-card__items">
          ${order.items
            .map(
              (l) => `<div class="order-line">
                <span>${l.qty}× ${l.name}${lineBits(l) ? `<small>${lineBits(l)}</small>` : ""}</span>
                <b>${money(l.unitPrice * l.qty)}</b>
              </div>`
            )
            .join("")}
          <div class="summary__row"><span>Subtotal</span><b>${money(order.subtotal)}</b></div>
          <div class="summary__row"><span>Delivery</span><b>${order.delivery ? money(order.delivery) : "Free"}</b></div>
          <div class="summary__total"><span>Total</span><b>${money(order.total)}</b></div>
        </div>
        <div class="order-card__status">
          <label for="status-${order.code}">Update status</label>
          <select class="status-select" id="status-${order.code}" data-status="${order.code}">
            ${NEXT.map((s) => `<option value="${s}" ${s === order.status ? "selected" : ""}>${LABELS[s]}</option>`).join("")}
          </select>
          <span class="order-card__when">Last change ${when(order.updatedAt)}</span>
        </div>
        <div class="timeline">
          ${(order.statusHistory || []).map((h) => `<span>${LABELS[h.status]} · ${when(h.at)}</span>`).join("")}
        </div>
      </div>
    </article>`;
  }

  function visible() {
    return orders.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      if (!query) return true;
      const hay = `${o.code} ${o.name} ${o.phone} ${o.address} ${o.payment} ${o.status} ${o.date}`.toLowerCase();
      return hay.includes(query);
    });
  }

  function renderList() {
    const list = visible();
    const box = $("#orderList");
    if (!orders.length) {
      box.innerHTML = `<div class="panel empty"><h2>No orders yet</h2><p>Place a test order from the storefront and it will appear here.</p></div>`;
      return;
    }
    if (!list.length) {
      box.innerHTML = `<div class="panel empty"><h2>Nothing matches</h2><p>Try a different status or search term.</p></div>`;
      return;
    }
    box.innerHTML = list.map(orderCard).join("");
  }

  async function load() {
    try {
      const [o, s] = await Promise.all([
        fetch("/api/orders", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/summary", { cache: "no-store" }).then((r) => r.json())
      ]);
      orders = Array.isArray(o) ? o : [];
      summary = s || {};
      $("#lastUpdated").textContent = `data/orders.json · ${orders.length} orders · refreshed ${new Date().toLocaleTimeString("en-IN")}`;
      renderStats();
      renderFilters();
      renderList();
    } catch {
      $("#lastUpdated").textContent = "Could not read orders. Is the server running?";
    }
  }

  $("#filters").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter]");
    if (!btn) return;
    filter = btn.dataset.filter;
    renderFilters();
    renderList();
  });

  $("#search").addEventListener("input", (e) => {
    query = e.target.value.trim().toLowerCase();
    renderList();
  });

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    flash(`Copied ${text}`);
  }

  let flashTimer = null;
  function flash(message) {
    let el = document.querySelector(".admin-flash");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast admin-flash";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("is-visible");
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => el.classList.remove("is-visible"), 1800);
  }

  $("#orderList").addEventListener("click", (e) => {
    const copy = e.target.closest("[data-copy]");
    if (copy) {
      copyText(copy.dataset.copy);
      return;
    }
    const toggle = e.target.closest("[data-toggle]");
    if (toggle) {
      const code = toggle.dataset.toggle;
      if (openCards.has(code)) openCards.delete(code);
      else openCards.add(code);
      renderList();
    }
  });

  $("#orderList").addEventListener("change", async (e) => {
    const select = e.target.closest("[data-status]");
    if (!select) return;
    const code = select.dataset.status;
    select.disabled = true;
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(code)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: select.value })
      });
      if (!res.ok) throw new Error("failed");
      window.NAVSHOP?.toast?.(`${code} → ${LABELS[select.value]}`);
      await load();
    } catch {
      select.disabled = false;
      alert("Could not update the status. Is the server running?");
    }
  });

  $("#refreshBtn").addEventListener("click", load);

  load();
  setInterval(load, 30000);
})();
