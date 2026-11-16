(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let CUR = '₹';
  const fmt = n => CUR + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const STATUSES = ['pending', 'preparing', 'out-for-delivery', 'delivered', 'cancelled'];
  const label = s => s.replace(/-/g, ' ');
  const dt = iso => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const dLabel = d => new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const localISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  let orders = [], stats = null, menu = null, view = 'dashboard', filter = { status: 'all', q: '', date: '' };
  let knownIds = null, freshIds = new Set(), openId = null, menuDirty = false;

  function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); }

  async function api(path, opts = {}) {
    const res = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    if (res.status === 401 && !path.endsWith('/login')) { showLogin(); throw new Error('Signed out'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  // ---------- auth ----------
  function showLogin() { $('#app').hidden = true; $('#login').hidden = false; stopPolling(); setTimeout(() => $('#loginForm').password.focus(), 30); }
  function showApp() { $('#login').hidden = true; $('#app').hidden = false; refresh(); startPolling(); }
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('#loginErr').textContent = '';
    try { await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: e.target.password.value }) }); e.target.reset(); showApp(); }
    catch (ex) { $('#loginErr').textContent = ex.message; }
  });
  $('#logout').onclick = async () => { await fetch('/api/admin/logout', { method: 'POST' }); knownIds = null; showLogin(); };

  // ---------- nav ----------
  const TITLES = { dashboard: 'Dashboard', orders: 'Orders', customers: 'Customers', menu: 'Menu & prices' };
  function go(v) {
    if (view === 'menu' && v !== 'menu' && menuDirty && !confirm('You have unsaved menu changes. Leave anyway?')) return;
    if (v !== 'menu') menuDirty = false;
    view = v;
    $$('.side nav button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    $$('[data-panel]').forEach(p => (p.hidden = p.dataset.panel !== v));
    $('#viewTitle').textContent = TITLES[v];
    if (v === 'menu') loadMenu();
    render();
  }
  $$('.side nav button').forEach(b => (b.onclick = () => go(b.dataset.view)));
  document.addEventListener('click', e => { const g = e.target.closest('[data-goto]'); if (g) go(g.dataset.goto); });
  $('#refresh').onclick = () => refresh(true);

  // ---------- data ----------
  async function refresh(manual) {
    try {
      const [o, s] = await Promise.all([api('/api/admin/orders'), api('/api/admin/stats')]);
      CUR = o.currency || CUR;
      const ids = new Set(o.orders.map(x => x.id));
      if (knownIds) {
        const added = o.orders.filter(x => !knownIds.has(x.id));
        if (added.length) {
          added.forEach(a => freshIds.add(a.id));
          toast(`🔔 ${added.length} new order${added.length > 1 ? 's' : ''}: ${added.map(a => a.customer.name).join(', ')}`);
          ding();
        }
      }
      knownIds = ids;
      orders = o.orders; stats = s;
      const warn = $('#storageWarn');
      if (warn) warn.hidden = s.storage !== 'unconfigured';
      $('#lastSync').textContent = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
      render();
      if (openId) { const ord = orders.find(x => x.id === openId); if (ord) renderDetail(ord); }
      if (manual) toast('Up to date');
    } catch (e) { if (e.message !== 'Signed out') console.error(e); }
  }
  let poll;
  function startPolling() { stopPolling(); poll = setInterval(() => { if (!document.hidden) refresh(); }, 15000); }
  function stopPolling() { clearInterval(poll); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('#app').hidden) refresh(); });

  function ding() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [880, 1320].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.15);
        g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.15 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.15 + 0.3);
        o.start(ctx.currentTime + i * 0.15); o.stop(ctx.currentTime + i * 0.15 + 0.32);
      });
    } catch {}
  }

  function render() {
    if (!stats) return;
    const open = stats.totals.open;
    $('#openBadge').hidden = !open; $('#openBadge').textContent = open;
    document.title = (open ? `(${open}) ` : '') + 'Navrasa Admin';
    if (view === 'dashboard') renderDashboard();
    if (view === 'orders') renderOrders();
    if (view === 'customers') renderCustomers();
  }

  // ---------- dashboard ----------
  function hbars(el, rows, color) {
    if (!rows.length || rows.every(r => !r.v)) { el.innerHTML = '<p class="nodata">No data yet.</p>'; return; }
    const max = Math.max(...rows.map(r => r.v), 1);
    el.innerHTML = rows.map(r => `<div class="hbar"><span class="name" title="${esc(r.k)}">${esc(r.k)}</span><div class="track"><div class="fill" style="width:${(r.v / max) * 100}%;background:${r.c || color || ''}"></div></div><span class="n">${esc(r.label ?? r.v)}</span></div>`).join('');
  }
  function renderDashboard() {
    const t = stats.totals;
    $('#kpis').innerHTML = [
      ['Total revenue', fmt(t.revenue), 'excl. cancelled', 'accent'],
      ['Total orders', t.orders, `${t.customers} customers`],
      ['Today', fmt(t.todayRevenue), `${t.todayOrders} order${t.todayOrders === 1 ? '' : 's'} placed today`],
      ['Open orders', t.open, `${t.deliveriesToday} to deliver today`],
    ].map(([l, v, s, c]) => `<div class="kpi ${c || ''}"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('') +
      `<div class="kpi"><div class="l">Avg. order</div><div class="v">${fmt(t.avgOrder)}</div><div class="s">per order</div></div>
       <div class="kpi"><div class="l">Pending</div><div class="v">${stats.byStatus.pending}</div><div class="s">need confirming</div></div>
       <div class="kpi"><div class="l">Out for delivery</div><div class="v">${stats.byStatus['out-for-delivery']}</div><div class="s">on the road</div></div>
       <div class="kpi"><div class="l">Delivered</div><div class="v">${stats.byStatus.delivered}</div><div class="s">${stats.byStatus.cancelled} cancelled</div></div>`;

    // revenue chart (SVG)
    const days = stats.days, W = 700, H = 220, P = { l: 48, r: 8, t: 10, b: 26 };
    const max = Math.max(...days.map(d => d.revenue), 1);
    const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))); return Math.ceil(max / p) * p; })();
    const bw = (W - P.l - P.r) / days.length;
    const y = v => H - P.b - (v / nice) * (H - P.t - P.b);
    const today = localISO(new Date());
    let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Revenue per day">`;
    for (let i = 0; i <= 4; i++) { const v = (nice / 4) * i; svg += `<line class="grid" x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${P.l - 6}" y="${y(v) + 4}" text-anchor="end">${CUR}${Math.round(v).toLocaleString()}</text>`; }
    days.forEach((d, i) => {
      const x = P.l + i * bw + bw * 0.18, w = bw * 0.64, h = Math.max(d.revenue ? 2 : 0, H - P.b - y(d.revenue));
      svg += `<rect class="bar ${d.date === today ? 'today' : ''}" x="${x}" y="${H - P.b - h}" width="${w}" height="${h}" rx="4" data-i="${i}"/>`;
      if (i % 2 === 0 || days.length < 10) svg += `<text x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${new Date(d.date + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</text>`;
    });
    svg += '</svg><div class="tip" id="tip"></div>';
    const chart = $('#revChart'); chart.innerHTML = svg;
    chart.onmousemove = e => {
      const b = e.target.closest('.bar'), tip = $('#tip');
      if (!b) { tip.style.opacity = 0; return; }
      const d = days[+b.dataset.i], r = chart.getBoundingClientRect();
      tip.innerHTML = `<b>${dLabel(d.date)}</b><br>${fmt(d.revenue)} · ${d.orders} order${d.orders === 1 ? '' : 's'}`;
      tip.style.left = e.clientX - r.left + 'px'; tip.style.top = e.clientY - r.top + 'px'; tip.style.opacity = 1;
    };
    chart.onmouseleave = () => { $('#tip').style.opacity = 0; };
    const sum = days.reduce((s, d) => s + d.revenue, 0), cnt = days.reduce((s, d) => s + d.orders, 0);
    $('#revSum').textContent = `${fmt(sum)} · ${cnt} orders`;

    const sc = getComputedStyle(document.documentElement);
    hbars($('#statusBars'), STATUSES.map(s => ({ k: label(s), v: stats.byStatus[s], c: sc.getPropertyValue('--s-' + s) })));
    hbars($('#topProducts'), stats.topProducts.map(p => ({ k: p.name, v: p.qty, label: p.qty + ' sold' })), 'var(--coral)');
    hbars($('#fruitBars'), stats.fruits.slice(0, 8).map(f => ({ k: f.name, v: f.qty })), 'var(--mango)');
    hbars($('#slotBars'), Object.entries(stats.slots).map(([k, v]) => ({ k, v })));
    $('#recent').innerHTML = stats.recent.length ? `<div class="table-wrap"><table class="tbl"><tbody>${stats.recent.map(rowHtml).join('')}</tbody></table></div>` : '<p class="nodata">No orders yet — they will show up here the moment a customer checks out.</p>';
  }

  // ---------- orders ----------
  function rowHtml(o) {
    const n = o.items.reduce((s, i) => s + i.qty, 0);
    return `<tr data-id="${o.id}" class="${freshIds.has(o.id) ? 'new' : ''}">
      <td class="mono">${o.id}</td>
      <td>${dt(o.createdAt)}</td>
      <td>${esc(o.customer.name)}<small>${esc(o.customer.phone)}</small></td>
      <td>${dLabel(o.delivery.date)}<small>${o.delivery.slot}</small></td>
      <td>${n} item${n > 1 ? 's' : ''}<small>${esc(o.items.map(i => i.name).join(', ').slice(0, 40))}</small></td>
      <td class="r"><b>${fmt(o.total)}</b><small>${esc(o.payment.replace(/-/g, ' '))}</small></td>
      <td><span class="st ${o.status}">${label(o.status)}</span></td></tr>`;
  }
  function filtered() {
    const today = localISO(new Date()), tm = new Date(); tm.setDate(tm.getDate() + 1); const tomorrow = localISO(tm);
    const q = filter.q.toLowerCase();
    return orders.filter(o => {
      if (filter.status !== 'all' && filter.status !== 'open' && o.status !== filter.status) return false;
      if (filter.status === 'open' && !['pending', 'preparing', 'out-for-delivery'].includes(o.status)) return false;
      const d = o.delivery.date;
      if (filter.date === 'today' && d !== today) return false;
      if (filter.date === 'tomorrow' && d !== tomorrow) return false;
      if (filter.date === 'upcoming' && d < today) return false;
      if (filter.date === 'past' && d >= today) return false;
      if (q && ![o.id, o.customer.name, o.customer.phone, o.customer.email, o.customer.address, o.notes].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
  }
  function renderOrders() {
    const counts = { all: orders.length, open: orders.filter(o => ['pending', 'preparing', 'out-for-delivery'].includes(o.status)).length };
    STATUSES.forEach(s => (counts[s] = orders.filter(o => o.status === s).length));
    $('#statusTabs').innerHTML = ['all', 'open', ...STATUSES].map(s => `<button data-s="${s}" class="${filter.status === s ? 'on' : ''}">${label(s)}<b>${counts[s]}</b></button>`).join('');
    const list = filtered();
    $('#ordersTable tbody').innerHTML = list.map(rowHtml).join('');
    $('#ordersEmpty').hidden = !!list.length;
  }
  $('#statusTabs').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b) { filter.status = b.dataset.s; renderOrders(); } });
  $('#search').addEventListener('input', e => { filter.q = e.target.value; renderOrders(); });
  $('#dateFilter').addEventListener('change', e => { filter.date = e.target.value; renderOrders(); });
  document.addEventListener('click', e => {
    const tr = e.target.closest('tr[data-id]'); if (!tr) return;
    const o = orders.find(x => x.id === tr.dataset.id); if (o) openDetail(o);
  });

  // ---------- detail ----------
  function openDetail(o) {
    openId = o.id; freshIds.delete(o.id);
    renderDetail(o);
    $('#detail').classList.add('open'); $('#detail').setAttribute('aria-hidden', 'false'); $('#scrim').hidden = false;
  }
  function closeDetail() { openId = null; $('#detail').classList.remove('open'); $('#detail').setAttribute('aria-hidden', 'true'); $('#scrim').hidden = true; render(); }
  $('#scrim').onclick = closeDetail;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && openId) closeDetail(); });

  function renderDetail(o) {
    const tel = o.customer.phone.replace(/[^\d+]/g, '');
    const noteFocused = document.activeElement?.id === 'adminNote';
    if (noteFocused) return; // don't clobber typing during a background refresh
    $('#detail').innerHTML = `
      <div class="d-head"><div><h2>${o.id}</h2><span class="muted">Placed ${dt(o.createdAt)}</span></div><button class="btn sm" id="dClose" aria-label="Close">✕</button></div>
      <div class="d-body">
        <div class="d-sec"><h4>Status</h4>
          <div class="status-btns">${STATUSES.map(s => `<button data-status="${s}" class="st ${s} ${o.status === s ? 'on' : ''}">${label(s)}</button>`).join('')}</div>
        </div>
        <div class="d-sec"><h4>Customer</h4>
          <div class="kv">
            <span>Name</span><span><b>${esc(o.customer.name)}</b></span>
            <span>Phone</span><span><a href="tel:${esc(tel)}">${esc(o.customer.phone)}</a> · <a href="https://wa.me/${esc(tel.replace('+', ''))}" target="_blank" rel="noopener">WhatsApp</a></span>
            ${o.customer.email ? `<span>Email</span><span><a href="mailto:${esc(o.customer.email)}">${esc(o.customer.email)}</a></span>` : ''}
            <span>Address</span><span>${esc(o.customer.address)} · <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.customer.address)}" target="_blank" rel="noopener">Map</a></span>
          </div>
        </div>
        <div class="d-sec"><h4>Delivery</h4>
          <div class="kv"><span>When</span><span><b>${dLabel(o.delivery.date)}</b>, ${o.delivery.slot}</span><span>Payment</span><span style="text-transform:capitalize">${esc(o.payment.replace(/-/g, ' '))}</span>
          ${o.notes ? `<span>Notes</span><span style="background:#fff6dc;padding:4px 8px;border-radius:8px">${esc(o.notes)}</span>` : ''}</div>
        </div>
        <div class="d-sec"><h4>Items</h4>
          <table class="items-t"><tbody>${o.items.map(i => `<tr><td><b>${i.qty} ×</b> ${esc(i.name)}${i.details ? `<br><small class="muted">${esc(i.details)}</small>` : ''}</td><td>${fmt(i.lineTotal)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td class="muted">Subtotal</td><td>${fmt(o.subtotal)}</td></tr><tr><td class="muted">Delivery</td><td>${o.deliveryFee ? fmt(o.deliveryFee) : 'Free'}</td></tr><tr><td><b>Total</b></td><td><b>${fmt(o.total)}</b></td></tr></tfoot></table>
        </div>
        <div class="d-sec"><h4>Internal note</h4>
          <textarea id="adminNote" rows="2" maxlength="500" placeholder="Only visible to staff (e.g. rider name, paid via UPI)">${esc(o.adminNote)}</textarea>
          <button class="btn sm" id="saveNote" style="margin-top:6px">Save note</button>
        </div>
        <div class="d-sec"><h4>History</h4><ul class="hist">${o.history.map(h => `<li><span class="st ${h.status}">${label(h.status)}</span><span class="muted">${dt(h.at)}</span></li>`).join('')}</ul></div>
        <div class="d-actions"><button class="btn sm" id="dPrint">🖨 Print slip</button><button class="btn sm danger" id="dDelete">Delete order</button></div>
      </div>`;
    $('#dClose').onclick = closeDetail;
    $$('[data-status]', $('#detail')).forEach(b => (b.onclick = () => patch(o.id, { status: b.dataset.status }, `Marked ${label(b.dataset.status)}`)));
    $('#saveNote').onclick = () => patch(o.id, { adminNote: $('#adminNote').value }, 'Note saved', true);
    $('#dPrint').onclick = () => window.print();
    $('#dDelete').onclick = async () => {
      if (!confirm(`Permanently delete order ${o.id}? This cannot be undone. (Tip: use "cancelled" to keep a record.)`)) return;
      try { await api('/api/admin/orders/' + o.id, { method: 'DELETE' }); toast('Order deleted'); closeDetail(); refresh(); } catch (e) { toast(e.message); }
    };
  }
  async function patch(id, body, msg, blurNote) {
    try {
      if (body.status === 'cancelled' && !confirm('Cancel this order?')) return;
      await api('/api/admin/orders/' + id, { method: 'PATCH', body: JSON.stringify(body) });
      if (blurNote) document.activeElement?.blur();
      toast(msg); await refresh();
    } catch (e) { toast(e.message); }
  }

  // ---------- customers ----------
  function renderCustomers() {
    const c = stats.customers;
    $('#custTable tbody').innerHTML = c.map(x => `<tr class="nohover"><td><b>${esc(x.name)}</b></td><td><a href="tel:${esc(x.phone)}">${esc(x.phone)}</a></td><td>${x.email ? `<a href="mailto:${esc(x.email)}">${esc(x.email)}</a>` : '<span class="muted">—</span>'}</td><td class="r">${x.orders}</td><td class="r"><b>${fmt(x.spent)}</b></td><td>${dt(x.last)}</td></tr>`).join('');
    $('#custEmpty').hidden = !!c.length;
  }

  // ---------- menu editor ----------
  async function loadMenu() {
    if (menuDirty) return;
    try { menu = await api('/api/admin/menu'); renderMenuEditor(); } catch (e) { toast(e.message); }
  }
  function renderMenuEditor() {
    $('#mCurrency').value = menu.currency; $('#mFee').value = menu.deliveryFee; $('#mFree').value = menu.freeDeliveryAbove; $('#mBase').value = menu.custom.basePrice;
    const fruitOpts = menu.custom.fruits;
    $('#bowlEditor').innerHTML = menu.bowls.map((b, i) => `
      <div class="bowl-row" data-i="${i}" data-image="${esc(b.image || '')}">
        <div class="photo-cell">
          <div class="photo-thumb">${b.image ? `<img src="${esc(b.image)}" alt="" />` : '<span>No photo</span>'}</div>
          <label class="btn sm upl">📷 ${b.image ? 'Change' : 'Upload'} photo<input type="file" accept="image/jpeg,image/png,image/webp" data-upload hidden /></label>
          ${b.image ? '<button type="button" class="link" data-rmphoto>Remove</button>' : ''}
        </div>
        <label>Name<input data-k="name" value="${esc(b.name)}" maxlength="60" /></label>
        <label>Price<input data-k="price" type="number" min="0" step="1" value="${b.price}" /></label>
        <label>Calories<input data-k="calories" type="number" min="0" value="${b.calories || 0}" /></label>
        <label>Tag<input data-k="tag" value="${esc(b.tag)}" maxlength="20" /></label>
        <div style="display:flex;gap:8px;align-items:center">
          <label class="toggle"><input type="checkbox" data-k="available" ${b.available ? 'checked' : ''}/> In stock</label>
          <button class="btn sm danger" data-del="${i}" title="Remove bowl">🗑</button>
        </div>
        <label class="desc">Description<input data-k="description" value="${esc(b.description)}" maxlength="300" /></label>
        <div class="fr">${fruitOpts.map(f => `<label><input type="checkbox" data-fruit="${f.id}" ${b.fruits.includes(f.id) ? 'checked' : ''}/> ${esc(f.name)}</label>`).join('')}</div>
      </div>`).join('') || '<p class="nodata">No bowls. Add one!</p>';
    $('#fruitPrices').innerHTML = menu.custom.fruits.map(f => `<label>${esc(f.name)}<input type="number" min="0" data-fp="${f.id}" value="${f.price}" /></label>`).join('');
    $('#topPrices').innerHTML = menu.custom.toppings.map(t => `<label>${esc(t.name)}<input type="number" min="0" data-tp="${t.id}" value="${t.price}" /></label>`).join('');
    menuDirty = false; $('#menuMsg').textContent = 'Changes go live on the shop as soon as you save.';
  }
  function collectMenu() {
    return {
      currency: $('#mCurrency').value, deliveryFee: $('#mFee').value, freeDeliveryAbove: $('#mFree').value,
      bowls: $$('.bowl-row').map(row => {
        const orig = menu.bowls[+row.dataset.i] || {};
        const v = k => $(`[data-k="${k}"]`, row);
        return { id: orig.id || v('name').value, name: v('name').value, price: v('price').value, calories: v('calories').value, tag: v('tag').value,
          description: v('description').value, available: v('available').checked, image: row.dataset.image || '', fruits: $$('[data-fruit]:checked', row).map(c => c.dataset.fruit) };
      }),
      custom: {
        basePrice: $('#mBase').value,
        fruits: $$('[data-fp]').map(i => ({ id: i.dataset.fp, price: i.value })),
        toppings: $$('[data-tp]').map(i => ({ id: i.dataset.tp, price: i.value })),
      },
    };
  }
  $('[data-panel="menu"]').addEventListener('input', () => { menuDirty = true; $('#menuMsg').textContent = '● Unsaved changes'; });
  $('#addBowl').onclick = () => {
    menu = { ...menu, ...collectMenu(), custom: menu.custom };
    menu.bowls.push({ id: '', name: 'New bowl', description: '', price: 199, calories: 0, tag: 'New', fruits: [], available: false });
    const keep = collectMenu().custom;
    renderMenuEditor(); restoreCustom(keep);
    menuDirty = true; $('#menuMsg').textContent = '● Unsaved changes — new bowls start out of stock';
  };
  function restoreCustom(c) { c.fruits.forEach(f => { const el = $(`[data-fp="${f.id}"]`); if (el) el.value = f.price; }); c.toppings.forEach(t => { const el = $(`[data-tp="${t.id}"]`); if (el) el.value = t.price; }); $('#mBase').value = c.basePrice; }
  // resize photos in the browser (max 1600px) so uploads are small and fast, whatever the host
  async function shrinkImage(file, max = 1600) {
    const bmp = await createImageBitmap(file).catch(() => null);
    if (!bmp) return file;
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const out = await new Promise(r => c.toBlob(r, 'image/webp', 0.86));
    if (out && out.type === 'image/webp') return out;
    return await new Promise(r => c.toBlob(r, 'image/jpeg', 0.86));
  }
  $('#bowlEditor').addEventListener('change', async e => {
    const inp = e.target.closest('[data-upload]'); if (!inp || !inp.files[0]) return;
    const row = inp.closest('.bowl-row'), f = inp.files[0];
    if (f.size > 25 * 1024 * 1024) { toast('Image too large (max 25 MB)'); return; }
    $('.photo-thumb', row).innerHTML = '<span>Uploading…</span>';
    try {
      const blob = await shrinkImage(f);
      const res = await fetch('/api/admin/upload', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob });
      const d = await res.json(); if (!res.ok) throw new Error(d.error || 'Upload failed');
      row.dataset.image = d.url; $('.photo-thumb', row).innerHTML = `<img src="${d.url}" alt="" />`;
      menuDirty = true; $('#menuMsg').textContent = '● Photo uploaded — click Save menu to publish it';
    } catch (ex) { toast(ex.message); $('.photo-thumb', row).innerHTML = '<span>No photo</span>'; }
  });
  $('#bowlEditor').addEventListener('click', e => {
    const rm = e.target.closest('[data-rmphoto]');
    if (rm) { const row = rm.closest('.bowl-row'); row.dataset.image = ''; $('.photo-thumb', row).innerHTML = '<span>No photo</span>'; rm.remove(); menuDirty = true; $('#menuMsg').textContent = '● Unsaved changes'; return; }
    const d = e.target.closest('[data-del]'); if (!d) return;
    const name = menu.bowls[+d.dataset.del]?.name;
    if (!confirm(`Remove "${name}" from the menu? (Past orders are not affected.)`)) return;
    const snapshot = collectMenu();
    snapshot.bowls.splice(+d.dataset.del, 1);
    const ids = menu.bowls.map(b => b.id); ids.splice(+d.dataset.del, 1);
    menu = { ...menu, currency: snapshot.currency, deliveryFee: snapshot.deliveryFee, freeDeliveryAbove: snapshot.freeDeliveryAbove, bowls: snapshot.bowls.map((b, i) => ({ ...b, id: ids[i] })) };
    renderMenuEditor(); restoreCustom(snapshot.custom);
    menuDirty = true; $('#menuMsg').textContent = '● Unsaved changes';
  });
  $('#saveMenu').onclick = async () => {
    const btn = $('#saveMenu'); btn.disabled = true;
    try {
      menu = await api('/api/admin/menu', { method: 'PUT', body: JSON.stringify(collectMenu()) });
      CUR = menu.currency; menuDirty = false; renderMenuEditor(); toast('Menu saved — live on the shop'); refresh();
    } catch (e) { toast(e.message); $('#menuMsg').textContent = '⚠ ' + e.message; }
    finally { btn.disabled = false; }
  };
  addEventListener('beforeunload', e => { if (menuDirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- boot ----------
  fetch('/api/admin/me').then(r => (r.ok ? showApp() : showLogin())).catch(showLogin);
})();
