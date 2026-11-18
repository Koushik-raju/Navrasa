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

  const menuFilter = { cat: '', q: '' };
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
    $('#recent').innerHTML = stats.recent.length ? `<div class="table-wrap"><table class="tbl"><tbody>${stats.recent.map(o => rowHtml(o)).join('')}</tbody></table></div>` : '<p class="nodata">No orders yet — they will show up here the moment a customer checks out.</p>';
  }

  // ---------- orders ----------
  const selected = new Set();
  function rowHtml(o, controls = false) {
    const n = o.items.reduce((s, i) => s + i.qty, 0);
    return `<tr data-id="${o.id}" class="${freshIds.has(o.id) ? 'new' : ''} ${selected.has(o.id) ? 'sel' : ''}">
      ${controls ? `<td class="chk"><input type="checkbox" data-sel="${o.id}" ${selected.has(o.id) ? 'checked' : ''} aria-label="Select ${o.id}" /></td>` : ''}
      <td class="mono">${o.id}</td>
      <td>${dt(o.createdAt)}</td>
      <td>${esc(o.customer.name)}<small>${esc(o.customer.phone)}</small></td>
      <td>${dLabel(o.delivery.date)}<small>${o.delivery.slot}</small></td>
      <td>${n} item${n > 1 ? 's' : ''}<small>${esc(o.items.map(i => i.name).join(', ').slice(0, 40))}</small></td>
      <td class="r"><b>${fmt(o.total)}</b><small>${esc(o.payment.replace(/-/g, ' '))}</small></td>
      <td>${controls
        ? `<select class="st-select st ${o.status}" data-status-for="${o.id}" aria-label="Change status of ${o.id}">${STATUSES.map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${label(s)}</option>`).join('')}</select>`
        : `<span class="st ${o.status}">${label(o.status)}</span>`}</td>
      ${controls ? `<td class="r acts">${stepButtons(o)}<button class="icon-act" data-edit="${o.id}" title="Edit order">✏️</button><button class="icon-act del" data-del-order="${o.id}" title="Delete order">🗑</button></td>` : ''}</tr>`;
  }
  // quick status controls: ◀ back to the previous status, Next ▶ to the next step in the flow
  const FLOW = ['pending', 'preparing', 'out-for-delivery', 'delivered'];
  function prevStatus(o) {
    if (o.status === 'cancelled') { // undo a cancel: back to what it was before
      for (let i = o.history.length - 1; i >= 0; i--) if (o.history[i].status !== 'cancelled') return o.history[i].status;
      return 'pending';
    }
    const k = FLOW.indexOf(o.status); return k > 0 ? FLOW[k - 1] : null;
  }
  function nextStatus(o) { const k = FLOW.indexOf(o.status); return k >= 0 && k < FLOW.length - 1 ? FLOW[k + 1] : null; }
  function stepButtons(o) {
    const p = prevStatus(o), n = nextStatus(o);
    return `<span class="steps">
      <button class="step-btn" data-step="${o.id}" data-to="${p || ''}" ${p ? '' : 'disabled'} title="${p ? 'Back to ' + label(p) : 'No previous status'}">◀</button>
      <button class="step-btn next" data-step="${o.id}" data-to="${n || ''}" ${n ? '' : 'disabled'} title="${n ? 'Move to ' + label(n) : 'Already ' + label(o.status)}">${n ? label(n) + ' ▶' : '✓ ' + label(o.status)}</button>
    </span>`;
  }
  async function setStatus(id, status, btn) {
    if (!status) return;
    if (status === 'cancelled' && !confirm(`Cancel order ${id}?`)) return;
    if (btn) btn.disabled = true;
    try { await api('/api/admin/orders/' + id, { method: 'PATCH', body: JSON.stringify({ status }) }); toast(`${id} → ${label(status)}`); await refresh(); }
    catch (ex) { toast('Not saved: ' + ex.message); if (btn) btn.disabled = false; }
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
    // forget selections for orders that no longer exist
    [...selected].forEach(id => { if (!orders.some(o => o.id === id)) selected.delete(id); });
    $('#ordersTable tbody').innerHTML = list.map(o => rowHtml(o, true)).join('');
    $('#ordersEmpty').hidden = !!list.length;
    $('#selAll').checked = list.length > 0 && list.every(o => selected.has(o.id));
    $('#bulkDelete').hidden = !selected.size; $('#bulkDelete').textContent = `🗑 Delete selected (${selected.size})`;
  }
  $('#ordersTable').addEventListener('change', async e => {
    const sel = e.target.closest('[data-status-for]');
    if (sel) {
      const id = sel.dataset.statusFor, status = sel.value, o = orders.find(x => x.id === id);
      if (status === 'cancelled' && !confirm(`Cancel order ${id}?`)) { sel.value = o.status; return; }
      sel.disabled = true;
      try { await api('/api/admin/orders/' + id, { method: 'PATCH', body: JSON.stringify({ status }) }); toast(`${id} → ${label(status)}`); await refresh(); }
      catch (ex) { toast('Not saved: ' + ex.message); sel.value = o.status; } finally { sel.disabled = false; }
      return;
    }
    if (e.target.id === 'selAll') { filtered().forEach(o => (e.target.checked ? selected.add(o.id) : selected.delete(o.id))); renderOrders(); return; }
    const id = e.target.dataset.sel; if (!id) return;
    e.target.checked ? selected.add(id) : selected.delete(id); renderOrders();
  });
  $('#bulkDelete').onclick = async () => {
    const ids = [...selected];
    if (!ids.length || !confirm(`Permanently delete ${ids.length} order${ids.length > 1 ? 's' : ''}? This removes ${ids.length > 1 ? 'them' : 'it'} from the orders file and cannot be undone.`)) return;
    try { await api('/api/admin/orders/delete', { method: 'POST', body: JSON.stringify({ ids }) }); selected.clear(); toast(`Deleted ${ids.length} order${ids.length > 1 ? 's' : ''}`); refresh(); }
    catch (e) { toast(e.message); }
  };
  async function deleteOne(id) {
    if (!confirm(`Permanently delete order ${id}? This removes it from the orders file and cannot be undone. (Tip: mark it "cancelled" to keep a record.)`)) return false;
    try { await api('/api/admin/orders/' + id, { method: 'DELETE' }); selected.delete(id); toast('Order deleted'); refresh(); return true; } catch (e) { toast(e.message); return false; }
  }
  $('#newOrder').onclick = () => openEditor(null);
  $('#statusTabs').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b) { filter.status = b.dataset.s; renderOrders(); } });
  $('#search').addEventListener('input', e => { filter.q = e.target.value; renderOrders(); });
  $('#dateFilter').addEventListener('change', e => { filter.date = e.target.value; renderOrders(); });
  document.addEventListener('click', e => {
    const st = e.target.closest('[data-step]'); if (st) { setStatus(st.dataset.step, st.dataset.to, st); return; }
    const ed = e.target.closest('[data-edit]'); if (ed) { const o = orders.find(x => x.id === ed.dataset.edit); if (o) openEditor(o); return; }
    const dl = e.target.closest('[data-del-order]'); if (dl) { deleteOne(dl.dataset.delOrder); return; }
    if (e.target.closest('.chk') || e.target.closest('.st-select')) return;
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
        <div class="d-actions"><button class="btn sm primary" id="dEdit">✏️ Edit order</button><button class="btn sm" id="dPrint">🖨 Print slip</button><button class="btn sm danger" id="dDelete">🗑 Delete order</button></div>
      </div>`;
    $('#dClose').onclick = closeDetail;
    $$('[data-status]', $('#detail')).forEach(b => (b.onclick = () => patch(o.id, { status: b.dataset.status }, `Marked ${label(b.dataset.status)}`)));
    $('#saveNote').onclick = () => patch(o.id, { adminNote: $('#adminNote').value }, 'Note saved', true);
    $('#dPrint').onclick = () => window.print();
    $('#dDelete').onclick = async () => { if (await deleteOne(o.id)) closeDetail(); };
    $('#dEdit').onclick = () => openEditor(o);
  }

  // ---------- order editor (create + update) ----------
  const SLOTS = ['08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00', '18:00-20:00'];
  const PAYMENTS = [['cash', 'Cash'], ['upi-on-delivery', 'UPI'], ['card-on-delivery', 'Card']];
  let edMenu = null, edItems = [], editingId = null;
  function unitPrice(it) {
    if (it.type === 'custom') {
      const f = it.fruits.reduce((s, id) => s + (edMenu.custom.fruits.find(x => x.id === id)?.price || 0), 0);
      const t = it.toppings.reduce((s, id) => s + (edMenu.custom.toppings.find(x => x.id === id)?.price || 0), 0);
      return edMenu.custom.basePrice + f + t;
    }
    return edMenu.bowls.find(b => b.id === it.id)?.price || 0;
  }
  async function openEditor(o) {
    try { edMenu = await api('/api/admin/menu'); } catch (e) { return toast(e.message); }
    editingId = o ? o.id : null;
    edItems = o ? o.items.map(i => ({ type: i.type, id: i.id, qty: i.qty, fruits: [...(i.fruits || [])], toppings: [...(i.toppings || [])] }))
                : [{ type: 'bowl', id: edMenu.bowls[0]?.id, qty: 1, fruits: [], toppings: [] }];
    const c = o?.customer || {}, d = o?.delivery || { date: localISO(new Date()), slot: SLOTS[2] };
    openId = null;
    $('#detail').innerHTML = `
      <div class="d-head"><div><h2>${o ? 'Edit ' + o.id : 'New order'}</h2><span class="muted">${o ? 'Changes are saved to the orders file' : 'Add a phone or walk-in order'}</span></div><button class="btn sm" id="edClose" aria-label="Close">✕</button></div>
      <form class="d-body ed" id="edForm" novalidate>
        <div class="d-sec"><h4>Customer</h4>
          <div class="ed-grid">
            <label>Name*<input name="name" required maxlength="80" value="${esc(c.name || '')}" /></label>
            <label>Phone*<input name="phone" required maxlength="20" value="${esc(c.phone || '')}" /></label>
            <label class="span2">Email<input name="email" type="email" maxlength="120" value="${esc(c.email || '')}" /></label>
            <label class="span2">Address*<textarea name="address" rows="2" maxlength="300">${esc(c.address || '')}</textarea></label>
          </div>
        </div>
        <div class="d-sec"><h4>Delivery & payment</h4>
          <div class="ed-grid">
            <label>Date*<input name="date" type="date" value="${esc(d.date)}" /></label>
            <label>Slot*<select name="slot">${SLOTS.map(x => `<option ${x === d.slot ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
            <label>Payment<select name="payment">${PAYMENTS.map(([v, t]) => `<option value="${v}" ${o?.payment === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
            <label>Status<select name="status">${STATUSES.map(x => `<option value="${x}" ${(o?.status || 'pending') === x ? 'selected' : ''}>${label(x)}</option>`).join('')}</select></label>
          </div>
        </div>
        <div class="d-sec"><h4>Items</h4><div id="edItems"></div>
          <button type="button" class="btn sm" id="edAdd">＋ Add item</button>
          <div class="ed-total" id="edTotal"></div>
        </div>
        <div class="d-sec"><h4>Notes</h4>
          <div class="ed-grid">
            <label class="span2">Customer notes<textarea name="notes" rows="2" maxlength="500">${esc(o?.notes || '')}</textarea></label>
            <label class="span2">Internal note (staff only)<textarea name="adminNote" rows="2" maxlength="500">${esc(o?.adminNote || '')}</textarea></label>
          </div>
        </div>
        <p class="err" id="edErr"></p>
        <div class="d-actions"><button class="btn primary" type="submit" id="edSave">${o ? 'Save changes' : 'Create order'}</button><button class="btn" type="button" id="edCancel">Cancel</button>
          ${o ? '<button class="btn danger" type="button" id="edDelete" style="margin-left:auto">🗑 Delete</button>' : ''}</div>
      </form>`;
    renderEdItems();
    $('#detail').classList.add('open'); $('#detail').setAttribute('aria-hidden', 'false'); $('#scrim').hidden = false;
    const close = () => { $('#detail').classList.remove('open'); $('#scrim').hidden = true; };
    $('#edClose').onclick = close; $('#edCancel').onclick = close;
    if (o) $('#edDelete').onclick = async () => { if (await deleteOne(o.id)) close(); };
    $('#edAdd').onclick = () => { edItems.push({ type: 'bowl', id: edMenu.bowls[0]?.id, qty: 1, fruits: [], toppings: [] }); renderEdItems(); };
    $('#edForm').onsubmit = async e => {
      e.preventDefault();
      const f = e.target, err = $('#edErr'); err.textContent = '';
      if (!edItems.length) { err.textContent = 'Add at least one item.'; return; }
      const body = {
        customer: { name: f.name.value, phone: f.phone.value, email: f.email.value, address: f.address.value },
        delivery: { date: f.date.value, slot: f.slot.value }, payment: f.payment.value, status: f.status.value,
        notes: f.notes.value, adminNote: f.adminNote.value,
        items: edItems.map(i => (i.type === 'custom' ? { type: 'custom', fruits: i.fruits, toppings: i.toppings, qty: i.qty } : { type: 'bowl', id: i.id, qty: i.qty })),
      };
      const btn = $('#edSave'); btn.disabled = true;
      try {
        const saved = await api(editingId ? '/api/admin/orders/' + editingId : '/api/admin/orders', { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(body) });
        toast(editingId ? `Order ${saved.id} updated` : `Order ${saved.id} created`); close(); await refresh();
      } catch (ex) { err.textContent = ex.message; } finally { btn.disabled = false; }
    };
  }
  function renderEdItems() {
    const opt = (b, it) => `<option value="${b.id}" ${it.type === 'bowl' && it.id === b.id ? 'selected' : ''}>${esc(b.name)}${b.portion ? ' · ' + esc(b.portion) : ''} — ${fmt(b.price)}${b.available ? '' : ' (sold out)'}</option>`;
    const cats = edMenu.categories || [];
    const opts = it => (cats.length
      ? cats.map(c => { const list = edMenu.bowls.filter(b => b.category === c.id); return list.length ? `<optgroup label="${esc(c.name)}">${list.map(b => opt(b, it)).join('')}</optgroup>` : ''; }).join('')
        + edMenu.bowls.filter(b => !cats.some(c => c.id === b.category)).map(b => opt(b, it)).join('')
      : edMenu.bowls.map(b => opt(b, it)).join('')) +
      `<option value="__custom" ${it.type === 'custom' ? 'selected' : ''}>Custom bowl</option>`;
    $('#edItems').innerHTML = edItems.map((it, i) => `
      <div class="ed-item" data-i="${i}">
        <div class="ed-row">
          <select data-f="kind">${opts(it)}</select>
          <input data-f="qty" type="number" min="1" max="20" value="${it.qty}" aria-label="Quantity" />
          <b class="ed-line">${fmt(unitPrice(it) * it.qty)}</b>
          <button type="button" class="icon-act del" data-f="rm" title="Remove item">✕</button>
        </div>
        ${it.type === 'custom' ? `<div class="ed-pick"><small>Fruits (2–8)</small>${edMenu.custom.fruits.map(f => `<label><input type="checkbox" data-fruit="${f.id}" ${it.fruits.includes(f.id) ? 'checked' : ''}/> ${esc(f.name)}</label>`).join('')}</div>
          <div class="ed-pick"><small>Toppings</small>${edMenu.custom.toppings.map(t => `<label><input type="checkbox" data-top="${t.id}" ${it.toppings.includes(t.id) ? 'checked' : ''}/> ${esc(t.name)}</label>`).join('')}</div>` : ''}
      </div>`).join('') || '<p class="nodata">No items.</p>';
    const sub = edItems.reduce((s, it) => s + unitPrice(it) * it.qty, 0);
    const fee = sub >= edMenu.freeDeliveryAbove ? 0 : edMenu.deliveryFee;
    $('#edTotal').innerHTML = `<span>Subtotal ${fmt(sub)} · Delivery ${fee ? fmt(fee) : 'Free'}</span><b>Total ${fmt(sub + fee)}</b>`;
  }
  document.addEventListener('input', e => {
    const row = e.target.closest('.ed-item'); if (!row) return;
    const it = edItems[+row.dataset.i];
    if (e.target.dataset.f === 'qty') { it.qty = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)); }
    else if (e.target.dataset.f === 'kind') { if (e.target.value === '__custom') { it.type = 'custom'; it.id = 'custom'; } else { it.type = 'bowl'; it.id = e.target.value; } return renderEdItems(); }
    else if (e.target.dataset.fruit) { const id = e.target.dataset.fruit; it.fruits = e.target.checked ? [...it.fruits, id] : it.fruits.filter(x => x !== id); }
    else if (e.target.dataset.top) { const id = e.target.dataset.top; it.toppings = e.target.checked ? [...it.toppings, id] : it.toppings.filter(x => x !== id); }
    const sub = edItems.reduce((s, x) => s + unitPrice(x) * x.qty, 0), fee = sub >= edMenu.freeDeliveryAbove ? 0 : edMenu.deliveryFee;
    row.querySelector('.ed-line').textContent = fmt(unitPrice(it) * it.qty);
    $('#edTotal').innerHTML = `<span>Subtotal ${fmt(sub)} · Delivery ${fee ? fmt(fee) : 'Free'}</span><b>Total ${fmt(sub + fee)}</b>`;
  });
  document.addEventListener('click', e => {
    const rm = e.target.closest('.ed-item [data-f="rm"]'); if (!rm) return;
    edItems.splice(+rm.closest('.ed-item').dataset.i, 1); renderEdItems();
  });
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
    const cats = menu.categories || [];
    $('#bowlEditor').innerHTML = menu.bowls.map((b, i) => `
      <div class="bowl-row" data-i="${i}" data-image="${esc(b.image || '')}">
        <div class="photo-cell">
          <div class="photo-thumb">${b.image ? `<img src="${esc(b.image)}" alt="" />` : '<span>No photo</span>'}</div>
          <label class="btn sm upl">📷 ${b.image ? 'Change' : 'Upload'} photo<input type="file" accept="image/jpeg,image/png,image/webp" data-upload hidden /></label>
          ${b.image ? '<button type="button" class="link" data-rmphoto>Remove</button>' : ''}
        </div>
        <label>Name<input data-k="name" value="${esc(b.name)}" maxlength="60" /></label>
        <label>Category<select data-k="category">${cats.map(c => `<option value="${esc(c.id)}" ${c.id === b.category ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
        <label>Portion<input data-k="portion" value="${esc(b.portion || '')}" maxlength="30" placeholder="e.g. 250 ml" /></label>
        <label>Price<input data-k="price" type="number" min="0" step="1" value="${b.price}" /></label>
        <div style="display:flex;gap:8px;align-items:center">
          <label class="toggle"><input type="checkbox" data-k="available" ${b.available ? 'checked' : ''}/> In stock</label>
          <button class="btn sm danger" data-del="${i}" title="Remove item">🗑</button>
        </div>
        <label class="desc">Description<input data-k="description" value="${esc(b.description)}" maxlength="300" /></label>
        <label class="tagf">Tag<input data-k="tag" value="${esc(b.tag)}" maxlength="20" placeholder="e.g. Popular" /></label>
      </div>`).join('') || '<p class="nodata">No items. Add one!</p>';
    $('#menuCat').innerHTML = `<option value="">All categories (${menu.bowls.length})</option>` + cats.map(c => `<option value="${esc(c.id)}">${esc(c.icon || '')} ${esc(c.name)} (${menu.bowls.filter(b => b.category === c.id).length})</option>`).join('');
    $('#menuCat').value = menuFilter.cat; filterMenuRows();
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
        return { id: orig.id || v('name').value, name: v('name').value, category: v('category').value, portion: v('portion').value, price: v('price').value, tag: v('tag').value,
          description: v('description').value, available: v('available').checked, image: row.dataset.image || '', fruits: orig.fruits || [] };
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
    const cat = menuFilter.cat || menu.categories?.[0]?.id || '';
    menu.bowls.push({ id: '', name: 'New item', category: cat, portion: '', description: '', price: 99, tag: 'New', fruits: [], available: false });
    const keep = collectMenu().custom;
    menuFilter.q = ''; $('#menuSearch').value = '';
    renderMenuEditor(); restoreCustom(keep);
    $('#bowlEditor .bowl-row:last-child')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    menuDirty = true; $('#menuMsg').textContent = '● Unsaved changes — new items start out of stock';
  };
  // filter the editor by category / search (rows are only hidden, so Save still includes every item)
  function filterMenuRows() {
    const q = menuFilter.q.trim().toLowerCase(); let shown = 0;
    $$('#bowlEditor .bowl-row').forEach(row => {
      const cat = $('[data-k="category"]', row).value, name = $('[data-k="name"]', row).value.toLowerCase();
      const ok = (!menuFilter.cat || cat === menuFilter.cat) && (!q || name.includes(q));
      row.hidden = !ok; if (ok) shown++;
    });
    $('#menuCount').textContent = `${shown} shown`;
  }
  $('#menuCat').addEventListener('change', e => { menuFilter.cat = e.target.value; filterMenuRows(); });
  $('#menuSearch').addEventListener('input', e => { menuFilter.q = e.target.value; filterMenuRows(); });
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
