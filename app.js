/* ─────────────────────────────────────────────
   NAVRASA — page visuals
   (cart, customiser and checkout live in shop.js)
   ───────────────────────────────────────────── */
document.documentElement.classList.add("js");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canHover = window.matchMedia("(hover: hover)").matches;

/* ── 3D tilt ──────────────────────────────────── */
function attachTilt(nodes, max = 7) {
  if (!canHover || reduceMotion) return;
  nodes.forEach((el) => {
    if (el.dataset.tiltReady) return;
    el.dataset.tiltReady = "1";
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--ry", `${(px * max * 2).toFixed(2)}deg`);
      el.style.setProperty("--rx", `${(-py * max * 2).toFixed(2)}deg`);
    });
    el.addEventListener("pointerleave", () => {
      el.style.setProperty("--ry", "0deg");
      el.style.setProperty("--rx", "0deg");
    });
  });
}

window.attachTilt = attachTilt;

/* ── hero parallax ────────────────────────────── */
function heroParallax() {
  if (reduceMotion || !canHover) return;
  const scene = document.querySelector("[data-scene]");
  if (!scene) return;
  const layers = scene.querySelectorAll("[data-depth]");
  if (!layers.length) return;
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;

  const loop = () => {
    cx += (tx - cx) * 0.08;
    cy += (ty - cy) * 0.08;
    layers.forEach((l) => {
      const d = Number(l.dataset.depth) || 1;
      l.style.transform = `translate3d(${(cx * d * 14).toFixed(2)}px, ${(cy * d * 14).toFixed(2)}px, 0)`;
    });
    if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) raf = requestAnimationFrame(loop);
    else raf = null;
  };

  scene.addEventListener("pointermove", (e) => {
    const r = scene.getBoundingClientRect();
    tx = (e.clientX - r.left) / r.width - 0.5;
    ty = (e.clientY - r.top) / r.height - 0.5;
    if (!raf) raf = requestAnimationFrame(loop);
  });
  scene.addEventListener("pointerleave", () => {
    tx = 0; ty = 0;
    if (!raf) raf = requestAnimationFrame(loop);
  });
}

/* ── nav + progress ───────────────────────────── */
function scrollChrome() {
  const nav = document.getElementById("nav");
  const bar = document.getElementById("progressBar");
  if (!nav || !bar) return;
  const onScroll = () => {
    nav.classList.toggle("is-stuck", window.scrollY > 24);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = `${max > 0 ? (window.scrollY / max) * 100 : 0}%`;
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
}

/* ── reveal on scroll ─────────────────────────── */
function reveal() {
  const targets = document.querySelectorAll(
    ".section__head, .sig-card, .plan, .menu, .story__lead, .story__big, .story__facts, .story__shot, .visit__card, .visit > div:first-child"
  );
  if (reduceMotion || !("IntersectionObserver" in window)) return;
  targets.forEach((el, i) => {
    el.setAttribute("data-reveal", "");
    el.style.transitionDelay = `${(i % 4) * 70}ms`;
  });
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );
  targets.forEach((el) => io.observe(el));
}

function init() {
  attachTilt(document.querySelectorAll("[data-tilt]"));
  heroParallax();
  scrollChrome();
  reveal();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
