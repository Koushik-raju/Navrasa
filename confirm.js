/* ─────────────────────────────────────────────
   NAVRASA — order confirmation
   ───────────────────────────────────────────── */
(function () {
  const NAV = window.NAV;
  const root = document.getElementById("confirmRoot");
  if (!root) return;
  const code = new URLSearchParams(location.search).get("code");

  const fmt = (iso) =>
    new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  function paymentLine(order) {
    if (order.payment === "online") {
      const wa = NAV.shop.whatsapp
        ? `<a class="btn btn--sm" href="https://wa.me/${NAV.shop.whatsapp}?text=${encodeURIComponent(
            `Hi ${NAV.shop.name}, my order ${order.code} is placed. Please send the payment scanner for ₹${order.total}.`
          )}" target="_blank" rel="noopener">Open WhatsApp</a>`
        : "";
      return `<div class="whatsapp">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3Z" stroke="#1f7a4d" stroke-width="1.6"/><path d="M8.6 8.9c.3 2.6 2 4.3 4.6 4.7.6.1 1.2-.4 1.2-1v-.6l-1.6-.6-.7.7c-.9-.4-1.5-1-1.9-1.9l.7-.7-.6-1.6h-.6c-.6 0-1.1.5-1.1 1Z" fill="#1f7a4d"/></svg>
        <span><b>Online payment — scanner incoming.</b> We'll send the UPI scanner to <b>${order.phone}</b> on WhatsApp. ${wa}</span>
      </div>`;
    }
    return `<div class="whatsapp" style="background:rgba(22,64,52,.06);border-color:var(--line)">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 7h18v10H3z" stroke="#164034" stroke-width="1.5"/><path d="M3 10h18" stroke="#164034" stroke-width="1.5"/></svg>
      <span><b>Cash on delivery.</b> Keep ${NAV.money(order.total)} ready — the rider carries change.</span>
    </div>`;
  }

  function render(order) {
    const slotDate = new Date(`${order.date}T12:00:00`);
    const niceDate = slotDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

    root.innerHTML = `
      <div class="confirm__badge">
        <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 17.5 13 23l12-13" /></svg>
      </div>
      <h1>Order <em>confirmed.</em></h1>
      <p style="margin-top:.9rem;color:rgba(17,39,29,.62)">
        Thanks ${order.name.split(" ")[0]} — the kitchen has it. We'll pack it fresh for ${niceDate}, ${order.slot}.
      </p>
      <div class="confirm__code">Order <b>${order.code}</b></div>

      <div class="panel confirm__card">
        <div class="details">
          <div><span>Name</span><b>${order.name}</b></div>
          <div><span>Phone</span><b>${order.phone}</b></div>
          <div><span>Delivering to</span><b>${order.address}</b></div>
          <div><span>Slot</span><b>${niceDate} · ${order.slot}</b></div>
          <div><span>Placed</span><b>${fmt(order.createdAt)}</b></div>
          <div><span>Payment</span><b>${order.payment === "cod" ? "Cash on delivery" : "Online / UPI"}</b></div>
          ${order.notes ? `<div class="field-block--full"><span>Kitchen notes</span><b>${order.notes}</b></div>` : ""}
        </div>

        <div style="margin-top:1.4rem">
          ${order.items
            .map((l) => {
              const bits = [];
              (l.custom?.ingredients || []).forEach((i) => {
                if (i.count === 0) bits.push(`no ${i.name.toLowerCase()}`);
                else if (i.count > 1) bits.push(`${i.count}× ${i.name.toLowerCase()}`);
              });
              (l.custom?.addons || []).forEach((a) => bits.push(`+ ${a.name.toLowerCase()}`));
              return `<div class="order-line">
                <span>${l.qty}× ${l.name}${bits.length ? `<small>${bits.join(" · ")}</small>` : ""}</span>
                <b>${NAV.money(l.unitPrice * l.qty)}</b>
              </div>`;
            })
            .join("")}
        </div>

        <div class="summary__row" style="margin-top:1rem"><span>Subtotal</span><b>${NAV.money(order.subtotal)}</b></div>
        <div class="summary__row"><span>Delivery</span><b>${order.delivery ? NAV.money(order.delivery) : "Free"}</b></div>
        <div class="summary__total"><span>Total paid</span><b>${NAV.money(order.total)}</b></div>

        ${paymentLine(order)}
      </div>

      <div style="display:flex;gap:.6rem;justify-content:center;margin-top:1.8rem;flex-wrap:wrap">
        <a class="btn" href="/#menu">Order something else</a>
        <a class="btn btn--ghost" href="/">Back home</a>
      </div>`;
  }

  async function boot() {
    if (!code) {
      root.innerHTML = `<h1>No order found</h1><p style="margin-top:1rem">That link is missing its order code.</p>
        <a class="btn" href="/#menu" style="margin-top:1.5rem">Back to the menu</a>`;
      return;
    }
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(code)}`);
      if (!res.ok) throw new Error("not found");
      render(await res.json());
    } catch {
      root.innerHTML = `<h1>Order not found</h1>
        <p style="margin-top:1rem">We couldn't load <b>${code}</b>. Check the link, or call the counter.</p>
        <a class="btn" href="/#menu" style="margin-top:1.5rem">Back to the menu</a>`;
    }
  }

  boot();
})();
