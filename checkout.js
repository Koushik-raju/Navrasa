/* ─────────────────────────────────────────────
   NAVRASA — checkout
   Dates from today to +7 days; today's passed
   slots disappear as the day goes on.
   ───────────────────────────────────────────── */
(function () {
  const NAV = window.NAV;
  const $ = (s) => document.querySelector(s);
  const form = $("#checkoutForm");
  if (!form) return;

  const DELIVERY = 39;
  const FREE_OVER = 499;
  const LEAD_MINUTES = 75;
  const lastSlot = 21; // 9 pm
  const firstSlot = 8; // 8 am

  const cart = NAV.readCart();
  if (!cart.length) {
    location.replace("/cart");
    return;
  }

  /* ── summary ───────────────────────────────── */
  const subtotal = cart.reduce((n, l) => n + l.unitPrice * l.qty, 0);
  const delivery = subtotal >= FREE_OVER ? 0 : DELIVERY;
  const total = subtotal + delivery;

  $("#checkoutSummary").innerHTML = `
    <h2>Your order · ${NAV.cartCount(cart)} items</h2>
    <div class="order-line"><span>Subtotal</span><b>${NAV.money(subtotal)}</b></div>
    <div class="order-line"><span>Delivery</span><b>${delivery ? NAV.money(delivery) : "Free"}</b></div>
    <div class="summary__total"><span>Total</span><b>${NAV.money(total)}</b></div>
    <div style="margin-top:1rem">
      ${cart
        .map(
          (l) => `<div class="order-line">
            <span>${l.qty}× ${l.name}${NAV.customSummary(l) ? `<small>${NAV.customSummary(l)}</small>` : ""}</span>
            <b>${NAV.money(l.unitPrice * l.qty)}</b>
          </div>`
        )
        .join("")}
    </div>
    <a class="btn btn--ghost btn--wide" href="/cart">Edit cart</a>`;

  /* ── dates + slots ─────────────────────────── */
  const dateSelect = $("#date");
  const slotSelect = $("#slot");
  const slotNote = $("#slotNote");

  function startOfDay(d) {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
  }

  const today = startOfDay(new Date());
  const days = [];
  for (let i = 0; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  function slotsFor(date) {
    const now = new Date();
    const isToday = startOfDay(date).getTime() === today.getTime();
    const cutoff = new Date(now.getTime() + LEAD_MINUTES * 60000);
    const out = [];
    for (let h = firstSlot; h <= lastSlot; h++) {
      const slotTime = new Date(date);
      slotTime.setHours(h, 0, 0, 0);
      if (isToday && slotTime <= cutoff) continue;
      out.push({
        value: `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? "am" : "pm"}`,
        label: `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? "am" : "pm"}`
      });
    }
    return out;
  }

  function renderDates() {
    dateSelect.innerHTML = days
      .map((d, i) => {
        const slots = slotsFor(d);
        const disabled = slots.length === 0;
        const label = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
        const prefix = i === 0 ? "Today · " : i === 1 ? "Tomorrow · " : "";
        return `<option value="${d.toISOString().slice(0, 10)}" ${disabled ? "disabled" : ""}>
          ${prefix}${label}${disabled ? " — no slots left" : ""}</option>`;
      })
      .join("");
    const firstOpen = days.find((d) => slotsFor(d).length);
    if (firstOpen) dateSelect.value = firstOpen.toISOString().slice(0, 10);
    renderSlots();
  }

  function renderSlots() {
    const chosen = days.find((d) => d.toISOString().slice(0, 10) === dateSelect.value) || days[0];
    const slots = slotsFor(chosen);
    slotSelect.innerHTML = slots.length
      ? slots.map((s) => `<option value="${s.value}">${s.label}</option>`).join("")
      : `<option value="">No slots left today — pick another date</option>`;
    slotSelect.disabled = slots.length === 0;
    const isToday = startOfDay(chosen).getTime() === today.getTime();
    slotNote.textContent = slots.length
      ? isToday
        ? "Today's earlier slots are hidden — we need about an hour to cut and pack."
        : "Slots run 8 am to 9 pm. We'll WhatsApp you any changes."
      : "That day is fully closed. Choose another date.";
  }

  dateSelect.addEventListener("change", renderSlots);
  renderDates();

  /* ── payment choice ────────────────────────── */
  form.querySelectorAll(".choice").forEach((choice) => {
    const input = choice.querySelector("input");
    const sync = () => {
      form.querySelectorAll(".choice").forEach((c) => c.classList.toggle("is-selected", c.querySelector("input").checked));
    };
    choice.addEventListener("click", () => {
      input.checked = true;
      sync();
    });
    input.addEventListener("change", sync);
    sync();
  });

  phoneGuard();

  function phoneGuard() {
    const phone = $("#phone");
    phone.addEventListener("input", () => {
      phone.value = phone.value.replace(/\D/g, "").slice(0, 10);
    });
  }

  /* ── submit ────────────────────────────────── */
  const errorBox = $("#formError");
  const button = $("#placeOrder");

  function fail(message) {
    errorBox.hidden = false;
    errorBox.textContent = message;
    errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
    button.disabled = false;
    button.textContent = "Place order";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.hidden = true;

    const payload = {
      name: $("#name").value.trim(),
      phone: $("#phone").value.trim(),
      address: $("#address").value.trim(),
      date: dateSelect.value,
      slot: slotSelect.value,
      payment: form.querySelector('input[name="payment"]:checked').value,
      notes: $("#notes").value.trim(),
      items: NAV.readCart().map((l) => ({
        name: l.name,
        qty: l.qty,
        unitPrice: l.unitPrice,
        custom: l.custom,
        notes: l.notes
      }))
    };

    if (payload.name.length < 2) return fail("Please enter your name.");
    if (!/^[6-9]\d{9}$/.test(payload.phone)) return fail("Enter a 10-digit mobile number starting with 6–9.");
    if (payload.address.length < 10) return fail("Please enter a full delivery address.");
    if (!payload.slot) return fail("Pick a delivery slot.");

    button.disabled = true;
    button.textContent = "Placing order…";

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not place the order.");
      NAV.writeCart([]);
      location.href = `/confirm?code=${encodeURIComponent(data.code)}`;
    } catch (err) {
      fail(err.message);
    }
  });
})();
