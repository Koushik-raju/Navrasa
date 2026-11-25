
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let MENU = null;
const fmt = n => (MENU?.currency || '₹') + Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

// ---------------- toast ----------------
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400);
}

// ---------------- cart state ----------------
const CART_KEY = 'bowlful.cart.v1';
let cart = [];
try { cart = JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { cart = []; }
const saveCart = () => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {} };

function itemInfo(it) {
  if (it.type === 'custom') {
    const fr = it.fruits.map(id => MENU.custom.fruits.find(f => f.id === id)).filter(Boolean);
    const tp = it.toppings.map(id => MENU.custom.toppings.find(t => t.id === id)).filter(Boolean);
    const unit = MENU.custom.basePrice + fr.reduce((s, f) => s + f.price, 0) + tp.reduce((s, t) => s + t.price, 0);
    return { name: 'Custom Bowl', details: fr.map(f => f.name).join(', ') + (tp.length ? ' + ' + tp.map(t => t.name).join(', ') : ''), unit, fruits: it.fruits, ok: fr.length >= 2 };
  }
  const b = MENU.bowls.find(x => x.id === it.id);
  if (!b) return null;
  return { name: b.name, details: b.available ? '' : 'Sold out — please remove', unit: b.price, fruits: b.fruits, ok: b.available };
}
function totals() {
  const subtotal = cart.reduce((s, it) => { const i = itemInfo(it); return s + (i ? i.unit * it.qty : 0); }, 0);
  const delivery = subtotal === 0 || subtotal >= MENU.freeDeliveryAbove ? 0 : MENU.deliveryFee;
  return { subtotal, delivery, total: subtotal + delivery };
}

function addToCart(entry) {
  const key = entry.type === 'custom' ? 'custom:' + [...entry.fruits].sort().join('+') + '|' + [...entry.toppings].sort().join('+') : 'bowl:' + entry.id;
  const existing = cart.find(c => c.key === key);
  if (existing) existing.qty = Math.min(20, existing.qty + entry.qty);
  else cart.push({ ...entry, key });
  saveCart(); renderCart();
}

function renderCart() {
  cart = cart.filter(it => itemInfo(it));
  $('#cartCount').textContent = cart.reduce((s, i) => s + i.qty, 0);
  const box = $('#cartItems');
  if (!cart.length) {
    box.innerHTML = `<div class="empty"><div>🥣</div><p>Your cart is empty.<br>Add a bowl to get started!</p></div>`;
  } else {
    box.innerHTML = cart.map((it, idx) => {
      const i = itemInfo(it);
      return `<div class="cart-item">
        <div><h5>${esc(i.name)}</h5>${i.details ? `<div class="det">${esc(i.details)}</div>` : ''}<div class="det">${fmt(i.unit)} each</div></div>
        <div class="r"><b>${fmt(i.unit * it.qty)}</b>
          <div class="qty"><button data-i="${idx}" data-d="-1" aria-label="Fewer">−</button><span>${it.qty}</span><button data-i="${idx}" data-d="1" aria-label="More">+</button></div>
          <button class="rm" data-rm="${idx}">Remove</button></div>
      </div>`;
    }).join('');
  }
  const t = totals();
  $('#cartSubtotal').textContent = fmt(t.subtotal);
  $('#cartDelivery').textContent = t.delivery ? fmt(t.delivery) : (t.subtotal ? 'Free' : '—');
  $('#cartTotal').textContent = fmt(t.total);
  $('#freeHint').textContent = t.subtotal && t.subtotal < MENU.freeDeliveryAbove ? `Add ${fmt(MENU.freeDeliveryAbove - t.subtotal)} more for free delivery 🚚` : (t.subtotal ? 'You get free delivery 🎉' : '');
  $('#checkoutBtn').disabled = !cart.length || cart.some(it => !itemInfo(it).ok);
}

$('#cartItems').addEventListener('click', e => {
  const d = e.target.closest('[data-d]'), rm = e.target.closest('[data-rm]');
  if (d) {
    const it = cart[+d.dataset.i]; it.qty += +d.dataset.d;
    if (it.qty < 1) cart.splice(+d.dataset.i, 1); else it.qty = Math.min(20, it.qty);
  } else if (rm) cart.splice(+rm.dataset.rm, 1);
  else return;
  saveCart(); renderCart();
});

// ---------------- drawer / modals ----------------
const openDrawer = () => { $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden', 'false'); $('#overlay').classList.add('show'); };
const closeDrawer = () => { $('#drawer').classList.remove('open'); $('#drawer').setAttribute('aria-hidden', 'true'); $('#overlay').classList.remove('show'); };
$('#cartBtn').onclick = openDrawer;
$('#overlay').onclick = closeDrawer;
$$('[data-close]').forEach(b => b.addEventListener('click', () => { closeDrawer(); $$('.modal').forEach(m => (m.hidden = true)); }));
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeDrawer(); $$('.modal').forEach(m => (m.hidden = true)); } });
$$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.hidden = true; }));

// nav background
const onScroll = () => $('#nav').classList.toggle('scrolled', scrollY > 20);
addEventListener('scroll', onScroll, { passive: true }); onScroll();
$('#year').textContent = new Date().getFullYear();

// ---------------- menu ----------------
let activeCat = 'all';
function cardHtml(b, cat) {
  const inc = Array.isArray(b.includes) ? b.includes : [];
  const incHtml = inc.length ? `<details class="incl"><summary>What's inside <span class="chev" aria-hidden="true">▾</span></summary>
      <ul>${inc.map(t => `<li>${esc(t)}</li>`).join('')}</ul></details>` : '';
  if (b.category === 'addons') {
    return `<article class="addon-card" data-id="${esc(b.id)}">
      <div><h4>${esc(b.name)}</h4><span class="portion">${esc(b.portion)}</span></div>
      <span class="price">${fmt(b.price)}</span>
      <button class="btn btn-primary add-btn sm" data-add="${esc(b.id)}" ${b.available ? '' : 'disabled'} aria-label="Add ${esc(b.name)}">${b.available ? '+' : 'Sold out'}</button>
    </article>`;
  }
  return `<article class="bowl-card" data-id="${esc(b.id)}">
    <div class="card-top">
      <span class="portion">${esc(b.portion || '')}</span>
      ${b.available ? (b.tag ? `<span class="tag">${esc(b.tag)}</span>` : '') : '<span class="tag soldout">Sold out</span>'}
    </div>
    <h3>${esc(b.name)}</h3>
    ${b.description ? `<p>${esc(b.description)}</p>` : '<p></p>'}
    ${incHtml}
    <div class="bowl-meta">
      <span class="price">${fmt(b.price)}</span>
      <button class="btn btn-primary add-btn" data-add="${esc(b.id)}" ${b.available ? '' : 'disabled'}>Add +</button>
    </div>
  </article>`;
}
function renderMenu() {
  const cats = (MENU.categories && MENU.categories.length ? MENU.categories : [{ id: '', name: 'Menu', icon: '🍓' }])
    .map(c => ({ ...c, items: MENU.bowls.filter(b => (b.category || '') === c.id) }))
    .filter(c => c.items.length);
  if (activeCat !== 'all' && !cats.some(c => c.id === activeCat)) activeCat = 'all';
  $('#menuTabs').innerHTML = [`<button data-cat="all" class="${activeCat === 'all' ? 'on' : ''}">All <b>${MENU.bowls.length}</b></button>`]
    .concat(cats.map(c => `<button data-cat="${esc(c.id)}" class="${activeCat === c.id ? 'on' : ''}">${esc(c.name)} <b>${c.items.length}</b></button>`)).join('');
  $('#menuGrid').innerHTML = cats.filter(c => activeCat === 'all' || c.id === activeCat).map(c => `
    <section class="menu-cat" id="cat-${esc(c.id)}">
      <h3 class="cat-title">${esc(c.name)} <small>${c.items.length} item${c.items.length > 1 ? 's' : ''}</small></h3>
      <div class="${c.id === 'addons' ? 'addon-grid' : 'cat-grid'}">${c.items.map(b => cardHtml(b, c)).join('')}</div>
    </section>`).join('');
}
$('#menuTabs').addEventListener('click', e => {
  const t = e.target.closest('[data-cat]'); if (!t) return;
  activeCat = t.dataset.cat; renderMenu();
  $('#menu').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('#menuGrid').addEventListener('click', e => {
  const btn = e.target.closest('[data-add]'); if (!btn) return;
  const b = MENU.bowls.find(x => x.id === btn.dataset.add);
  addToCart({ type: 'bowl', id: b.id, qty: 1 });
  toast(`${b.name} added to cart`);
});

// ---------------- builder ----------------
const builder = { fruits: [], toppings: [], qty: 1 };

function renderBuilder() {
  $('#fruitChips').innerHTML = MENU.custom.fruits.map(f => {
    const on = builder.fruits.includes(f.id);
    const dis = !on && builder.fruits.length >= 8;
    return `<button type="button" class="chip ${on ? 'on' : ''}" data-fruit="${f.id}" ${dis ? 'disabled' : ''} aria-pressed="${on}">${esc(f.name)} <small>+${fmt(f.price)}</small></button>`;
  }).join('');
  $('#toppingChips').innerHTML = MENU.custom.toppings.map(t => {
    const on = builder.toppings.includes(t.id);
    return `<button type="button" class="chip ${on ? 'on' : ''}" data-top="${t.id}" aria-pressed="${on}">${esc(t.name)} <small>+${fmt(t.price)}</small></button>`;
  }).join('');
  $('#fruitCount').textContent = `${builder.fruits.length} / 8`;
  const ok = builder.fruits.length >= 2;
  const unit = itemInfo({ type: 'custom', fruits: builder.fruits, toppings: builder.toppings }).unit;
  $('#builderPrice').textContent = builder.fruits.length ? fmt(unit * builder.qty) : fmt(MENU.custom.basePrice) + '+';
  $('#builderQty').textContent = builder.qty;
  const add = $('#addCustom');
  add.disabled = !ok;
  add.textContent = ok ? `Add custom bowl · ${fmt(unit * builder.qty)}` : builder.fruits.length === 1 ? 'Pick at least one more fruit' : 'Pick at least 2 fruits';
}
$('#fruitChips').addEventListener('click', e => {
  const c = e.target.closest('[data-fruit]'); if (!c) return;
  const id = c.dataset.fruit;
  builder.fruits = builder.fruits.includes(id) ? builder.fruits.filter(f => f !== id) : [...builder.fruits, id].slice(0, 8);
  renderBuilder();
});
$('#toppingChips').addEventListener('click', e => {
  const c = e.target.closest('[data-top]'); if (!c) return;
  const id = c.dataset.top;
  builder.toppings = builder.toppings.includes(id) ? builder.toppings.filter(f => f !== id) : [...builder.toppings, id];
  renderBuilder();
});
$('[data-qty="builder"]').addEventListener('click', e => {
  const b = e.target.closest('[data-d]'); if (!b) return;
  builder.qty = Math.max(1, Math.min(20, builder.qty + +b.dataset.d)); renderBuilder();
});
$('#clearCustom').onclick = () => { builder.fruits = []; builder.toppings = []; builder.qty = 1; renderBuilder(); };
$('#addCustom').onclick = () => {
  addToCart({ type: 'custom', fruits: [...builder.fruits], toppings: [...builder.toppings], qty: builder.qty });
  toast('Custom bowl added to cart');
  openDrawer();
};

// ---------------- checkout ----------------
function localISO(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function refreshSlots() {
  const form = $('#checkoutForm');
  const sel = $('#slotSelect');
  const isToday = form.date.value === localISO(new Date());
  const hourNow = new Date().getHours();
  const prev = sel.value;
  sel.innerHTML = '<option value="">Select…</option>' + MENU.slots.map(s => {
    const start = parseInt(s, 10);
    const past = isToday && start <= hourNow;
    return `<option value="${s}" ${past ? 'disabled' : ''}>${s}${past ? ' (unavailable)' : ''}</option>`;
  }).join('');
  if ([...sel.options].some(o => o.value === prev && !o.disabled)) sel.value = prev;
}
$('#checkoutBtn').onclick = () => {
  if (!cart.length) return;
  closeDrawer();
  const form = $('#checkoutForm');
  const today = new Date(), max = new Date(); max.setDate(max.getDate() + 14);
  form.date.min = localISO(today); form.date.max = localISO(max);
  if (!form.date.value || form.date.value < form.date.min) {
    // default: today if a slot is still open, else tomorrow
    const lastStart = Math.max(...MENU.slots.map(s => parseInt(s, 10)));
    const d = new Date(); if (d.getHours() >= lastStart) d.setDate(d.getDate() + 1);
    form.date.value = localISO(d);
  }
  try { const saved = JSON.parse(localStorage.getItem('bowlful.customer') || '{}'); ['name', 'phone', 'email', 'address'].forEach(k => { if (saved[k] && !form[k].value) form[k].value = saved[k]; }); } catch {}
  refreshSlots();
  const t = totals();
  $('#coSummary').innerHTML = cart.map(it => { const i = itemInfo(it); return `<div class="row"><span>${it.qty} × ${esc(i.name)}</span><span>${fmt(i.unit * it.qty)}</span></div>`; }).join('') +
    `<div class="row muted"><span>Delivery</span><span>${t.delivery ? fmt(t.delivery) : 'Free'}</span></div><div class="row total" style="margin-bottom:0"><span>Total</span><b>${fmt(t.total)}</b></div>`;
  $('#coError').textContent = '';
  $('#checkoutModal').hidden = false;
  setTimeout(() => form.name.focus(), 50);
};
$('#checkoutForm').date.addEventListener('change', refreshSlots);

$('#checkoutForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const err = $('#coError');
  $$('.invalid', f).forEach(x => x.classList.remove('invalid'));
  const checks = [
    [f.name, f.name.value.trim().length >= 2, 'Please enter your name.'],
    [f.phone, /^[+\d][\d\s-]{6,18}$/.test(f.phone.value.trim()), 'Please enter a valid phone number.'],
    [f.email, !f.email.value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim()), 'Please enter a valid email or leave it blank.'],
    [f.address, f.address.value.trim().length >= 8, 'Please enter your full delivery address.'],
    [f.date, !!f.date.value, 'Please choose a delivery date.'],
    [f.slot, !!f.slot.value, 'Please choose a time slot.'],
  ];
  const bad = checks.find(c => !c[1]);
  if (bad) { bad[0].classList.add('invalid'); bad[0].focus(); err.textContent = bad[2]; return; }

  const payload = {
    customer: { name: f.name.value, phone: f.phone.value, email: f.email.value, address: f.address.value },
    delivery: { date: f.date.value, slot: f.slot.value },
    payment: f.payment.value, notes: f.notes.value,
    items: cart.map(it => (it.type === 'custom' ? { type: 'custom', fruits: it.fruits, toppings: it.toppings, qty: it.qty } : { type: 'bowl', id: it.id, qty: it.qty })),
  };
  const btn = $('#placeOrder'); btn.disabled = true; btn.textContent = 'Placing order…'; err.textContent = '';
  try {
    const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not place your order. Please try again.');
    try { localStorage.setItem('bowlful.customer', JSON.stringify(payload.customer)); localStorage.setItem('bowlful.lastOrder', JSON.stringify({ id: data.id, phone: payload.customer.phone })); } catch {}
    cart = []; saveCart(); renderCart();
    f.notes.value = '';
    $('#checkoutModal').hidden = true;
    $('#successId').textContent = data.id;
    $('#successInfo').textContent = `Total ${fmt(data.total)} · Delivery on ${new Date(data.delivery.date + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}, ${data.delivery.slot}`;
    $('#successTrack').href = `/track?id=${encodeURIComponent(data.id)}`;
    showPayment(data, payload.payment, payload.customer);
    $('#successModal').hidden = false;
    // refresh menu in case availability changed
  } catch (ex) {
    err.textContent = ex.message;
    if (/sold out|no longer exists/i.test(ex.message)) loadMenu();
  } finally {
    btn.disabled = false; btn.textContent = 'Place order';
  }
});

// ---------------- WhatsApp & contact ----------------
const SHOP = () => MENU?.shop || {};
const waLink = (text = '') => SHOP().whatsapp ? `https://wa.me/${SHOP().whatsapp}${text ? '?text=' + encodeURIComponent(text) : ''}` : '';
const canPayNow = () => !!(SHOP().upiQr || SHOP().upiId);
function renderContact() {
  const sh = SHOP();
  const fl = $('#waFloat');
  if (sh.whatsapp) { fl.href = waLink('Hi Navrasa! I would like to order.'); fl.hidden = false; } else fl.hidden = true;
  const bits = [];
  if (sh.hours) bits.push(`<p class="muted">${esc(sh.hours)}</p>`);
  if (sh.area) bits.push(`<p class="muted">Delivering to ${esc(sh.area)}</p>`);
  if (sh.whatsapp) bits.push(`<a href="${waLink('Hi Navrasa!')}" target="_blank" rel="noopener">Chat on WhatsApp</a>`);
  if (sh.whatsappGroup) bits.push(`<a href="${esc(sh.whatsappGroup)}" target="_blank" rel="noopener">Join our WhatsApp group</a>`);
  if (sh.phone) bits.push(`<a href="tel:${esc(sh.phone.replace(/[^\d+]/g, ''))}">Call ${esc(sh.phone)}</a>`);
  $('#contact').innerHTML = bits.length ? `<b>Contact</b>${bits.join('')}` : '';
  $('#payNowOpt').hidden = !canPayNow();
}
function showPayment(order, payment, customer) {
  const sh = SHOP(), amt = fmt(order.total);
  const box = $('#payBox'), wa = $('#waShare');
  const payNow = payment === 'upi-now' && canPayNow();
  box.hidden = !payNow;
  if (payNow) {
    $('#payAmt').textContent = amt;
    const qr = $('#payQr'); if (sh.upiQr) { qr.src = sh.upiQr; qr.hidden = false; } else qr.hidden = true;
    $('#payUpiLine').innerHTML = sh.upiId ? `UPI ID: <b class="sel">${esc(sh.upiId)}</b>${sh.upiName ? ' · ' + esc(sh.upiName) : ''}` : 'Scan the QR code with any UPI app.';
    const app = $('#payUpiApp');
    if (sh.upiId) {
      app.href = `upi://pay?pa=${encodeURIComponent(sh.upiId)}&pn=${encodeURIComponent(sh.upiName || 'Navrasa')}&am=${order.total}&cu=INR&tn=${encodeURIComponent('Navrasa ' + order.id)}`;
      app.hidden = !/Android|iPhone|iPad/i.test(navigator.userAgent);
    } else app.hidden = true;
  }
  if (sh.whatsapp) {
    const msg = payNow
      ? `Hi Navrasa! I've paid ${amt} for order ${order.id} (${customer.name}). Payment screenshot attached.`
      : `Hi Navrasa! I just placed order ${order.id} (${customer.name}) — ${amt}, delivery ${order.delivery.date} ${order.delivery.slot}.`;
    wa.href = waLink(msg); wa.textContent = payNow ? 'Send payment screenshot on WhatsApp' : 'Send order on WhatsApp'; wa.hidden = false;
  } else wa.hidden = true;
}

// ---------------- boot ----------------
async function loadMenu() {
  try {
    const res = await fetch('/api/menu');
    MENU = await res.json();
    renderMenu(); renderBuilder(); renderCart(); renderContact();
  } catch {
    $('#menuGrid').innerHTML = '<p class="muted">Could not load the menu. Please refresh.</p>';
  }
}
loadMenu();
