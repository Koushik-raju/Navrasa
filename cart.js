/* ─────────────────────────────────────────────
   NAVRASA — cart page
   ───────────────────────────────────────────── */
(function () {
  const NAV = window.NAV;
  const $ = (s, r = document) => r.querySelector(s);
  const DELIVERY = 39;
  const FREE_OVER = 499;

  const panel = $("#cartPanel");
  const summary = $("#summaryPanel");
  const addonPanel = $("#addonPanel");
  if (!panel || !summary) return;

  function totals(cart) {
    const subtotal = cart.reduce((n, l) => n + l.unitPrice * l.qty, 0);
    const delivery = subtotal === 0 ? 0 : subtotal >= FREE_OVER ? 0 : DELIVERY;
    return { subtotal, delivery, total: subtotal + delivery };
  }

  function renderLines() {
    const cart = NAV.readCart();
    if (!cart.length) {
      panel.innerHTML = `<div class="empty">
        <h2>Your cart is empty</h2>
        <p>Fruit bowls, salads, smoothies — all customisable down to the ingredient.</p>
        <a class="btn" href="/#menu">Browse the menu</a>
      </div>`;
      summary.innerHTML = `
        <h2>Order summary</h2>
        <div class="summary__row"><span>Subtotal</span><b>${NAV.money(0)}</b></div>
        <div class="summary__row"><span>Delivery</span><b>${NAV.money(0)}</b></div>
        <div class="summary__row"><span>Items</span><b>0</b></div>
        <div class="summary__total"><span>Total</span><b>${NAV.money(0)}</b></div>
        <a class="btn btn--wide" href="/#menu">Browse the menu</a>
        <p class="summary__note">Nothing here yet — add a bowl to see delivery and total.</p>`;
      $("#addonPanel-wrap")?.setAttribute("hidden", "");
      return;
    }
    $("#addonPanel-wrap")?.removeAttribute("hidden");

    panel.innerHTML = cart
      .map((l) => {
        const item = NAV.findItem(l.name);
        const summaryText = NAV.customSummary(l);
        const editable = item && item.ingredients.length > 0;
        return `<div class="line" data-line="${l.key}">
          <div>
            <div class="line__name">${l.name}</div>
            ${summaryText ? `<div class="line__meta">${summaryText}</div>` : ""}
            <div class="line__meta">${NAV.money(l.unitPrice)} each</div>
          </div>
          <div class="line__price">${NAV.money(l.unitPrice * l.qty)}</div>
          <div class="line__controls">
            <div class="qty">
              <button class="qty__btn" data-dec="${l.key}" aria-label="One less">−</button>
              <span>${l.qty}</span>
              <button class="qty__btn" data-inc="${l.key}" aria-label="One more">+</button>
            </div>
            <span style="display:flex;gap:1rem;align-items:center">
              ${editable ? `<button class="linkbtn" data-edit="${l.key}">Edit ingredients</button>` : ""}
              <button class="linkbtn" data-del="${l.key}">Remove</button>
            </span>
          </div>
        </div>`;
      })
      .join("");

    const t = totals(cart);
    summary.innerHTML = `
      <h2>Order summary</h2>
      <div class="summary__row"><span>Subtotal</span><b>${NAV.money(t.subtotal)}</b></div>
      <div class="summary__row ${t.delivery === 0 ? "summary__row--free" : ""}">
        <span>Delivery</span><b>${t.delivery === 0 ? "Free" : NAV.money(t.delivery)}</b>
      </div>
      <div class="summary__row"><span>Items</span><b>${NAV.cartCount(cart)}</b></div>
      <div class="summary__total"><span>Total</span><b>${NAV.money(t.total)}</b></div>
      <a class="btn btn--wide" href="/checkout">Checkout <span aria-hidden="true">↗</span></a>
      <p class="summary__note">${t.delivery === 0
        ? "Free delivery applied."
        : `Add ${NAV.money(FREE_OVER - t.subtotal)} more for free delivery.`} Payment is chosen on the next step.</p>`;
  }

  function renderAddons() {
    if (!addonPanel) return;
    addonPanel.innerHTML = NAV.EXTRA_ADDONS.map(
      (a) => `<button class="chip" type="button" data-addon="${a.name}" data-price="${a.price}">${a.name}<b>+₹${a.price}</b></button>`
    ).join("");
  }

  panel.addEventListener("click", (e) => {
    const inc = e.target.closest("[data-inc]");
    if (inc) {
      const line = NAV.readCart().find((l) => l.key === inc.dataset.inc);
      if (line) NAV.updateLineQty(line.key, line.qty + 1);
      return;
    }
    const dec = e.target.closest("[data-dec]");
    if (dec) {
      const line = NAV.readCart().find((l) => l.key === dec.dataset.dec);
      if (line) NAV.updateLineQty(line.key, line.qty - 1);
      return;
    }
    const del = e.target.closest("[data-del]");
    if (del) {
      NAV.removeLine(del.dataset.del);
      window.NAVSHOP?.toast("Removed from cart");
      return;
    }
    const edit = e.target.closest("[data-edit]");
    if (edit) {
      const line = NAV.readCart().find((l) => l.key === edit.dataset.edit);
      const item = line && NAV.findItem(line.name);
      if (!line || !item) return;
      window.NAVSHOP.openCustomiser(item, line, (updated) => {
        NAV.replaceLine(line.key, { ...updated, key: line.key, signature: line.signature });
        window.NAVSHOP.toast("Bowl updated");
        renderLines();
      });
    }
  });

  addonPanel?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-addon]");
    if (!btn) return;
    NAV.addLine({
      name: btn.dataset.addon,
      id: `addon-${btn.dataset.addon.toLowerCase().replace(/\s+/g, "-")}`,
      qty: 1,
      unitPrice: Number(btn.dataset.price),
      custom: { ingredients: [], addons: [] },
      notes: ""
    });
    window.NAVSHOP?.toast(`${btn.dataset.addon} added`);
    renderLines();
    btn.setAttribute("aria-pressed", "true");
    setTimeout(() => btn.setAttribute("aria-pressed", "false"), 500);
  });

  document.addEventListener("cart:updated", renderLines);

  renderAddons();
  renderLines();
})();
