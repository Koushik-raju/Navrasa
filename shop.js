/* ─────────────────────────────────────────────
   NAVRASA — storefront behaviour
   Menu + add to cart, bowl customiser, cart drawer.
   Loaded on every page; each part only runs when
   its markup exists.
   ───────────────────────────────────────────── */
(function () {
  const NAV = window.NAV;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ── toast ─────────────────────────────────── */
  let toastEl = null;
  let toastTimer = null;
  function toast(message) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 2200);
  }

  /* ── cart badge ────────────────────────────── */
  function syncBadges() {
    const count = NAV.cartCount();
    $$("[data-cart-count]").forEach((el) => {
      el.textContent = count;
      el.dataset.empty = count === 0 ? "true" : "false";
    });
    $$("[data-subtotal]").forEach((el) => (el.textContent = NAV.money(NAV.cartSubtotal())));
  }

  /* ── lock background while a panel is open ─── */
  function lock(on) {
    document.body.classList.toggle("is-locked", on);
    const scrim = $("#scrim");
    if (scrim) scrim.hidden = !on;
  }

  /* ── scrim ─────────────────────────────────── */
  function ensureScrim() {
    if ($("#scrim")) return;
    const s = document.createElement("div");
    s.className = "scrim";
    s.id = "scrim";
    s.hidden = true;
    s.addEventListener("click", closeAll);
    document.body.appendChild(s);
  }

  function closeAll() {
    $("#cartDrawer")?.classList.remove("is-open");
    $("#cartDrawer")?.setAttribute("aria-hidden", "true");
    $("#customModal")?.classList.remove("is-open");
    $("#customModal")?.setAttribute("aria-hidden", "true");
    lock(false);
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll();
  });

  /* ── customiser ────────────────────────────── */
  let state = null;
  let customModal = null;

  function buildCustomiser() {
    if (customModal) return customModal;
    customModal = document.createElement("div");
    customModal.className = "modal";
    customModal.id = "customModal";
    customModal.setAttribute("role", "dialog");
    customModal.setAttribute("aria-modal", "true");
    customModal.setAttribute("aria-hidden", "true");
    customModal.innerHTML = `
      <div class="modal__panel">
        <header class="modal__head">
          <div>
            <p class="eyebrow"><span class="dot"></span> Build it your way</p>
            <h2 id="customTitle">Bowl</h2>
            <p class="modal__sub" id="customSub"></p>
          </div>
          <button class="icon-btn" data-close-modal aria-label="Close">✕</button>
        </header>
        <div class="modal__body">
          <section class="modal__section">
            <h3 class="modal__label">Ingredients <span class="muted">− removes it, + doubles it</span></h3>
            <ul class="ing-list" id="customIngredients"></ul>
          </section>
          <section class="modal__section">
            <h3 class="modal__label">Add-ons <span class="muted">optional, priced per item</span></h3>
            <div class="chips" id="customAddons"></div>
          </section>
          <label class="field-block">
            <span>Notes for the kitchen</span>
            <input type="text" class="input" id="customNotes" maxlength="120" placeholder="e.g. no chilli, extra mint" />
          </label>
        </div>
        <footer class="modal__foot">
          <div class="qty qty--lg">
            <button class="qty__btn" data-custom-minus type="button" aria-label="One less">−</button>
            <span id="customQty">1</span>
            <button class="qty__btn" data-custom-plus type="button" aria-label="One more">+</button>
          </div>
          <button class="btn btn--wide" id="customAdd" type="button">Add to cart · <b id="customPrice">₹0</b></button>
        </footer>
      </div>`;
    document.body.appendChild(customModal);

    customModal.addEventListener("click", (e) => {
      if (e.target === customModal) return closeAll();
      if (e.target.closest("[data-close-modal]")) return closeAll();

      const stepBtn = e.target.closest("[data-ing]");
      if (stepBtn) {
        const idx = Number(stepBtn.dataset.ing);
        const dir = Number(stepBtn.dataset.dir);
        const ing = state.ingredients[idx];
        ing.count = Math.max(0, Math.min(3, ing.count + dir));
        renderIngredients();
        updateCustomPrice();
        return;
      }
      const addonBtn = e.target.closest("[data-addon]");
      if (addonBtn) {
        const name = addonBtn.dataset.addon;
        const price = Number(addonBtn.dataset.price);
        const existing = state.addons.findIndex((a) => a.name === name);
        if (existing >= 0) state.addons.splice(existing, 1);
        else state.addons.push({ name, price });
        renderAddons();
        updateCustomPrice();
        return;
      }
      if (e.target.closest("[data-custom-plus]")) {
        state.qty = Math.min(20, state.qty + 1);
        $("#customQty").textContent = state.qty;
        updateCustomPrice();
        return;
      }
      if (e.target.closest("[data-custom-minus]")) {
        state.qty = Math.max(1, state.qty - 1);
        $("#customQty").textContent = state.qty;
        updateCustomPrice();
        return;
      }
      if (e.target.closest("#customAdd")) {
        state.notes = $("#customNotes").value.trim();
        const unitPrice = NAV.unitPriceFor(state.item, {
          ingredients: state.ingredients,
          addons: state.addons
        });
        const line = {
          name: state.item.name,
          id: state.item.id,
          qty: state.qty,
          unitPrice,
          custom: {
            ingredients: state.ingredients.map((i) => ({ name: i.name, count: i.count })),
            addons: state.addons.slice()
          },
          notes: state.notes
        };
        const save = state.onSave;
        closeAll();
        save(line);
      }
    });
    return customModal;
  }

  function renderIngredients() {
    const list = $("#customIngredients");
    list.innerHTML = state.ingredients
      .map((ing, i) => {
        const delta = state.item.ingredients[i] ? NAV.ingredientPrice(state.item.ingredients[i].name) : 0;
        const note =
          ing.count === 0 ? `<span class="ing-row__price">−₹${delta}</span>`
          : ing.count > 1 ? `<span class="ing-row__price">+₹${delta * (ing.count - 1)}</span>`
          : `<span class="ing-row__price"></span>`;
        return `<li class="ing-row${ing.count === 0 ? " is-off" : ""}">
          <span class="ing-row__name"><span>${ing.name}</span></span>
          <span class="ing-row__qty">${ing.label}</span>
          ${note}
          <span class="qty">
            <button class="qty__btn" type="button" data-ing="${i}" data-dir="-1" aria-label="Less ${ing.name}">−</button>
            <span>${ing.count}</span>
            <button class="qty__btn" type="button" data-ing="${i}" data-dir="1" aria-label="More ${ing.name}">+</button>
          </span>
        </li>`;
      })
      .join("");
  }

  function renderAddons() {
    const box = $("#customAddons");
    box.innerHTML = NAV.EXTRA_ADDONS.map(
      (a) => `<button class="chip" type="button" data-addon="${a.name}" data-price="${a.price}"
        aria-pressed="${state.addons.some((x) => x.name === a.name)}">${a.name}<b>+₹${a.price}</b></button>`
    ).join("");
  }

  function updateCustomPrice() {
    const unit = NAV.unitPriceFor(state.item, { ingredients: state.ingredients, addons: state.addons });
    $("#customPrice").textContent = NAV.money(unit * state.qty);
    $("#customQty").textContent = state.qty;
  }

  function openCustomiser(item, line, onSave) {
    buildCustomiser();
    const base = line?.custom?.ingredients;
    state = {
      item,
      qty: line?.qty || 1,
      notes: line?.notes || "",
      addons: line?.custom?.addons ? [...line.custom.addons] : [],
      ingredients: item.ingredients.map((ing) => {
        const found = base?.find((b) => b.name === ing.name);
        return { name: ing.name, label: ing.label, count: found ? found.count : 1 };
      }),
      onSave
    };
    $("#customTitle").textContent = item.name;
    $("#customSub").textContent = `${NAV.money(item.price)} base · ${item.ingredients.length} ingredients · any changes re-price it live`;
    $("#customNotes").value = state.notes;
    renderIngredients();
    renderAddons();
    updateCustomPrice();
    ensureScrim();
    customModal.classList.add("is-open");
    customModal.setAttribute("aria-hidden", "false");
    lock(true);
  }

  /* ── cart drawer ───────────────────────────── */
  let drawer = null;
  function buildDrawer() {
    if (drawer) return drawer;
    drawer = document.createElement("aside");
    drawer.className = "drawer";
    drawer.id = "cartDrawer";
    drawer.setAttribute("aria-label", "Your cart");
    drawer.setAttribute("aria-hidden", "true");
    drawer.innerHTML = `
      <div class="drawer__head">
        <h2>Your cart</h2>
        <button class="icon-btn" data-close-drawer aria-label="Close cart">✕</button>
      </div>
      <div class="drawer__body" id="drawerBody"></div>
      <div class="drawer__foot">
        <div class="drawer__total"><span>Subtotal</span><b data-subtotal>₹0</b></div>
        <p class="drawer__hint">Delivery ₹39 · free over ₹499</p>
        <a class="btn btn--wide" href="/cart">View cart &amp; add-ons</a>
      </div>`;
    document.body.appendChild(drawer);
    drawer.addEventListener("click", (e) => {
      if (e.target.closest("[data-close-drawer]")) return closeAll();
      const inc = e.target.closest("[data-inc]");
      if (inc) {
        const key = inc.dataset.inc;
        const line = NAV.readCart().find((l) => l.key === key);
        if (line) NAV.updateLineQty(key, line.qty + 1);
        return;
      }
      const dec = e.target.closest("[data-dec]");
      if (dec) {
        const key = dec.dataset.dec;
        const line = NAV.readCart().find((l) => l.key === key);
        if (line) NAV.updateLineQty(key, line.qty - 1);
        return;
      }
      const del = e.target.closest("[data-del]");
      if (del) {
        NAV.removeLine(del.dataset.del);
        toast("Removed from cart");
      }
    });
    return drawer;
  }

  function renderDrawer() {
    if (!drawer) return;
    const cart = NAV.readCart();
    const body = $("#drawerBody", drawer);
    if (!cart.length) {
      body.innerHTML = `<div class="empty">
        <h2>Nothing in here yet</h2>
        <p>Pick a bowl and customise it — every ingredient is editable.</p>
        <a class="btn" href="/#menu">Browse the menu</a>
      </div>`;
      return;
    }
    body.innerHTML = cart
      .map((l) => {
        const summary = NAV.customSummary(l);
        return `<div class="line">
          <div>
            <div class="line__name">${l.name}</div>
            ${summary ? `<div class="line__meta">${summary}</div>` : ""}
          </div>
          <div class="line__price">${NAV.money(l.unitPrice * l.qty)}</div>
          <div class="line__controls">
            <div class="qty">
              <button class="qty__btn" data-dec="${l.key}" aria-label="Less">−</button>
              <span>${l.qty}</span>
              <button class="qty__btn" data-inc="${l.key}" aria-label="More">+</button>
            </div>
            <button class="linkbtn" data-del="${l.key}">Remove</button>
          </div>
        </div>`;
      })
      .join("");
  }

  function openDrawer() {
    buildDrawer();
    renderDrawer();
    ensureScrim();
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    lock(true);
  }

  /* ── menu ──────────────────────────────────── */
  let activeCat = NAV.MENU[0].id;

  function dishMarkup(item) {
    const customisable = item.ingredients.length > 0;
    return `<article class="dish">
      <div class="dish__row">
        <h3>${item.name}</h3><span class="dish__leader"></span><span class="price">${NAV.money(item.price)}</span>
      </div>
      <p>${item.desc}</p>
      ${item.tag ? `<span class="dish__badge">${item.tag}</span>` : ""}
      <div class="dish__actions">
        ${customisable ? `<button class="btn btn--tiny" data-customise="${item.id}">Customise</button>` : ""}
        <button class="btn ${customisable ? "btn--ghost" : ""} btn--tiny" data-add="${item.id}">
          ${customisable ? "Add as is" : "Add to cart"}
        </button>
      </div>
    </article>`;
  }

  function renderMenu() {
    const cat = NAV.MENU.find((c) => c.id === activeCat);
    const panel = $("#menuPanel");
    if (!panel) return;
    panel.innerHTML =
      cat.items
        .map((item) => dishMarkup(NAV.findItem(item.n)))
        .join("") +
      `<div class="menu__foot">
        <span>${cat.kicker} · ${cat.items.length} items</span>
        <span>Prices inclusive of packaging · add-ons priced per item</span>
      </div>`;
    if (window.attachTilt) window.attachTilt(panel.querySelectorAll(".dish"), 5);
  }

  function buildTabs() {
    const tabs = $("#menuTabs");
    if (!tabs) return;
    tabs.innerHTML = NAV.MENU.map(
      (cat) => `<button class="tab" role="tab" id="tab-${cat.id}" aria-controls="menuPanel"
        aria-selected="${cat.id === activeCat}" data-cat="${cat.id}" type="button">
        ${cat.label} <span>${cat.items.length}</span></button>`
    ).join("");
    tabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".tab");
      if (!btn || btn.dataset.cat === activeCat) return;
      activeCat = btn.dataset.cat;
      $$(".tab", tabs).forEach((t) => t.setAttribute("aria-selected", String(t.dataset.cat === activeCat)));
      renderMenu();
    });
  }

  function wireStorefront() {
    document.addEventListener("click", (e) => {
      const addBtn = e.target.closest("[data-add]");
      if (addBtn) {
        const item = NAV.CATALOG.find((i) => i.id === addBtn.dataset.add);
        if (!item) return;
        NAV.addLine({
          name: item.name,
          id: item.id,
          qty: 1,
          unitPrice: item.price,
          custom: item.ingredients.length
            ? { ingredients: item.ingredients.map((i) => ({ name: i.name, count: 1 })), addons: [] }
            : { ingredients: [], addons: [] },
          notes: ""
        });
        toast(`${item.name} added`);
        openDrawer();
        return;
      }

      const cusBtn = e.target.closest("[data-customise]");
      if (cusBtn) {
        const item = NAV.CATALOG.find((i) => i.id === cusBtn.dataset.customise);
        if (!item) return;
        openCustomiser(item, null, (line) => {
          NAV.addLine(line);
          toast(`${item.name} added`);
          openDrawer();
        });
      }
    });

    document.addEventListener("cart:updated", () => {
      syncBadges();
      renderDrawer();
    });

    syncBadges();
  }

  /* ── boot ──────────────────────────────────── */
  function boot() {
    ensureScrim();
    if ($("#menuPanel")) {
      buildTabs();
      renderMenu();
    }
    wireStorefront();
    syncBadges();
    window.NAVSHOP = { openDrawer, openCustomiser, toast, syncBadges, renderDrawer, closeAll };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
