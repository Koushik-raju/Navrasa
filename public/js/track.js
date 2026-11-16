(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const form = $('#trackForm');
  const STEPS = [['pending', 'Order received', 'We have your order'], ['preparing', 'Preparing', 'Cutting your fruit fresh'], ['out-for-delivery', 'Out for delivery', 'On its way to you'], ['delivered', 'Delivered', 'Enjoy your bowl!']];
  const fmtTime = iso => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  let currency = '₹';
  fetch('/api/menu').then(r => r.json()).then(m => { currency = m.currency; }).catch(() => {});
  let timer;

  async function track(id, phone, quiet) {
    const err = $('#trackError');
    if (!quiet) err.textContent = '';
    try {
      const res = await fetch(`/api/orders/track?id=${encodeURIComponent(id)}&phone=${encodeURIComponent(phone)}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Not found');
      render(d);
      clearTimeout(timer);
      if (!['delivered', 'cancelled'].includes(d.status)) timer = setTimeout(() => track(id, phone, true), 30000);
    } catch (e) { if (!quiet) { err.textContent = e.message; $('#result').innerHTML = ''; } }
  }

  function render(o) {
    const at = s => o.history.filter(h => h.status === s).pop()?.at;
    let html = `<hr style="border:0;border-top:1px dashed rgba(0,0,0,.15);margin:1.4rem 0">
      <h3 style="font-size:1.3rem">${esc(o.id)}</h3>
      <p class="muted" style="margin:0">Delivery: ${new Date(o.delivery.date + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}, ${esc(o.delivery.slot)}</p>`;
    if (o.status === 'cancelled') {
      html += `<p style="color:#e8432a;font-weight:700;margin-top:1rem">This order was cancelled${at('cancelled') ? ' on ' + fmtTime(at('cancelled')) : ''}. Please contact us if this is unexpected.</p>`;
    } else {
      const idx = STEPS.findIndex(s => s[0] === o.status);
      html += '<ul class="timeline">' + STEPS.map((s, i) => `<li class="${i <= idx ? 'done' : ''} ${i === idx ? 'current' : ''}">${s[1]}<small>${i <= idx && at(s[0]) ? fmtTime(at(s[0])) : s[2]}</small></li>`).join('') + '</ul>';
    }
    html += '<div class="co-summary" style="margin:0">' + o.items.map(i => `<div class="row"><span>${i.qty} × ${esc(i.name)}${i.details ? `<br><small class="muted">${esc(i.details)}</small>` : ''}</span><span>${currency}${i.lineTotal}</span></div>`).join('') +
      `<div class="row total" style="margin-bottom:0"><span>Total</span><b>${currency}${o.total}</b></div></div>`;
    $('#result').innerHTML = html;
  }

  form.addEventListener('submit', e => { e.preventDefault(); track(form.id.value.trim().toUpperCase(), form.phone.value.trim()); });

  const params = new URLSearchParams(location.search);
  let last = {}; try { last = JSON.parse(localStorage.getItem('bowlful.lastOrder') || '{}'); } catch {}
  const id = params.get('id') || last.id;
  if (id) form.id.value = id;
  if (last.phone && (!params.get('id') || params.get('id') === last.id)) form.phone.value = last.phone;
  if (form.id.value && form.phone.value) track(form.id.value.toUpperCase(), form.phone.value);
})();
