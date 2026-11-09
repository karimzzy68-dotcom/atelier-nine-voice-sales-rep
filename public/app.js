const { Conversation } = window.ElevenLabsClient;
const $ = (id) => document.getElementById(id);

let catalog = { store: {}, products: [] };
let byId = new Map();
let conversation = null;
let mode = "idle"; // idle | connecting | listening | speaking
let micMuted = false;
const bag = []; // { id, size, color, qty }

// ---------- catalog + rendering ----------

const money = (n) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const ICONS = {
  dress: '<path d="M9 3h6l-1 4 4 13H6l4-13-1-4Z"/>',
  top: '<path d="M8 4 4 7l2 3 2-1v11h8V9l2 1 2-3-4-3c-1 1.5-2.5 2-4 2S9 5.5 8 4Z"/>',
  jacket: '<path d="M8 3 4 6v15h5V9l3 4 3-4v12h5V6l-4-3-4 6-4-6Z"/>',
  pants: '<path d="M7 3h10l1 18h-4l-2-11-2 11H6L7 3Z"/>',
  skirt: '<path d="M8 4h8l4 15H4L8 4Z"/>',
  shoes: '<path d="M3 15c3 0 5-2 6-6l3 1c1 3 4 4 9 5v3H3v-3Z"/>',
  bag: '<path d="M5 9h14l-1 11H6L5 9Z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/>',
  accessory: '<path d="M7 3h4v12l-2 6-2-6V3Zm6 0h4v9l-2 5-2-5V3Z"/>',
};

function icon(category, color) {
  const fill = isLight(color) ? "#2a241f" : "#fbf6ef";
  return `<svg viewBox="0 0 24 24" fill="${fill}" fill-opacity=".9" stroke="${fill}" stroke-width=".6" stroke-linejoin="round">${ICONS[category] || ICONS.top}</svg>`;
}

function isLight(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 160;
}

function swatchBg(hex) {
  return `radial-gradient(120% 90% at 30% 20%, ${hex}ee, ${hex})`;
}

function renderCards(ids, headline) {
  const items = ids.map((id) => byId.get(id)).filter(Boolean);
  if (!items.length) return [];
  $("picks-title").textContent = headline || "Picked for you";
  $("cards").innerHTML = items
    .map((p, i) => {
      const hex = p.colorHex[0];
      return `<article class="card ${i === 0 && items.length > 1 ? "top" : ""}">
        <div class="swatch" style="background:${swatchBg(hex)}">
          ${i === 0 && items.length > 1 ? '<span class="badge">Top pick</span>' : ""}
          ${icon(p.category, hex)}
        </div>
        <div class="card-body">
          <h3>${p.name}</h3>
          <span class="price">${money(p.price)}</span>
          <span class="meta">${p.fabric} · ${p.fit}</span>
          <div class="dots">${p.colorHex.map((c, j) => `<span class="dot" title="${p.colors[j]}" style="background:${c}"></span>`).join("")}</div>
        </div>
      </article>`;
    })
    .join("");
  $("picks").classList.remove("hidden");
  $("picks").scrollIntoView({ behavior: "smooth", block: "nearest" });
  return items;
}

function bagTotal() {
  return bag.reduce((sum, item) => sum + byId.get(item.id).price * item.qty, 0);
}

function renderBag() {
  const count = bag.reduce((n, i) => n + i.qty, 0);
  $("bag-count").textContent = count;
  $("bag-items").innerHTML = bag.length
    ? bag
        .map((item) => {
          const p = byId.get(item.id);
          const hex = p.colorHex[Math.max(0, p.colors.indexOf(item.color))];
          return `<div class="bag-item"><span class="mini" style="background:${swatchBg(hex)}"></span>
            <div>${p.name}<small>${item.color} · ${item.size}${item.qty > 1 ? ` · ×${item.qty}` : ""}</small></div>
            <strong>${money(p.price * item.qty)}</strong></div>`;
        })
        .join("")
    : '<p class="empty">Your bag is empty. Ask your stylist for ideas!</p>';
  const total = bagTotal();
  const freeAt = 100;
  $("bag-total").textContent = money(total);
  $("ship-fill").style.width = `${Math.min(100, (total / freeAt) * 100)}%`;
  $("ship-note").textContent = total >= freeAt ? "You've unlocked free shipping." : `${money(freeAt - total)} away from free shipping.`;
}

function bagSummary() {
  if (!bag.length) return "The bag is empty.";
  const lines = bag.map((i) => `${i.qty} x ${byId.get(i.id).name} (${i.color}, ${i.size})`);
  const total = bagTotal();
  return `Bag: ${lines.join("; ")}. Total $${total}.${total < 100 ? ` $${100 - total} more for free shipping.` : " Free shipping unlocked."}`;
}

const openDrawer = (open) => {
  $("drawer").classList.toggle("open", open);
  $("drawer").setAttribute("aria-hidden", String(!open));
};

function openCheckout() {
  openDrawer(false);
  $("checkout-items").innerHTML = $("bag-items").innerHTML;
  $("checkout-total").textContent = money(bagTotal());
  $("checkout").classList.remove("hidden");
}

// ---------- tools the voice agent can call ----------

const clientTools = {
  show_products: ({ product_ids, headline }) => {
    const ids = String(product_ids || "").split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 3);
    const shown = renderCards(ids, headline);
    if (!shown.length) return "None of those IDs exist. Use IDs from the catalog.";
    return `Now showing: ${shown.map((p) => p.name).join(", ")}.`;
  },
  add_to_cart: ({ product_id, size, color, quantity }) => {
    const p = byId.get(String(product_id).toUpperCase());
    if (!p) return "Unknown product ID.";
    const c = p.colors.find((x) => x.toLowerCase() === String(color || "").toLowerCase()) || p.colors[0];
    const existing = bag.find((i) => i.id === p.id && i.size === size && i.color === c);
    if (existing) existing.qty += Number(quantity) || 1;
    else bag.push({ id: p.id, size: String(size), color: c, qty: Number(quantity) || 1 });
    renderBag();
    $("bag-button").classList.remove("bump");
    void $("bag-button").offsetWidth;
    $("bag-button").classList.add("bump");
    return `Added ${p.name} in ${c}, size ${size}. ${bagSummary()}`;
  },
  remove_from_cart: ({ product_id }) => {
    const idx = bag.findIndex((i) => i.id === String(product_id).toUpperCase());
    if (idx < 0) return "That item isn't in the bag.";
    bag.splice(idx, 1);
    renderBag();
    return `Removed. ${bagSummary()}`;
  },
  view_cart: () => {
    openDrawer(true);
    return bagSummary();
  },
  open_checkout: () => {
    if (!bag.length) return "The bag is empty, so there is nothing to check out yet.";
    openCheckout();
    return `Checkout is open. ${bagSummary()}`;
  },
};

// ---------- conversation ----------

function setStatus(text) {
  $("status").textContent = text;
}

function caption(role, text) {
  if (!text) return;
  const box = $("captions");
  const line = document.createElement("div");
  line.className = `line ${role}`;
  line.textContent = text;
  box.appendChild(line);
  while (box.children.length > 3) box.firstChild.remove();
}

function showError(message) {
  $("error").textContent = message;
  $("error").classList.toggle("hidden", !message);
}

function setInCall(inCall) {
  $("start").classList.toggle("hidden", inCall);
  $("mute").classList.toggle("hidden", !inCall);
  $("end").classList.toggle("hidden", !inCall);
  $("typebar").classList.toggle("hidden", !inCall);
}

async function start() {
  showError("");
  $("start").disabled = true;
  mode = "connecting";
  setStatus("Connecting…");
  try {
    const res = await fetch("/api/session");
    const creds = await res.json();
    if (!res.ok) throw new Error(creds.message || "Could not start a session.");
    await navigator.mediaDevices.getUserMedia({ audio: true });

    conversation = await Conversation.startSession({
      ...creds,
      clientTools,
      onConnect: () => {
        setInCall(true);
        setStatus("Listening");
        mode = "listening";
        $("hero").classList.add("live");
      },
      onDisconnect: () => end(false),
      onModeChange: ({ mode: m }) => {
        mode = m;
        setStatus(m === "speaking" ? `${catalog.store.rep} is speaking` : "Listening");
      },
      onMessage: ({ role, source, message }) => caption((role || source) === "user" ? "user" : "agent", message),
      onError: (message) => showError(typeof message === "string" ? message : "Something went wrong with the call."),
    });
  } catch (err) {
    mode = "idle";
    setStatus("Ready when you are");
    const denied = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
    showError(denied ? "Microphone access is needed to talk. Allow it in your browser, then try again." : err.message || String(err));
  } finally {
    $("start").disabled = false;
  }
}

async function end(userInitiated = true) {
  const c = conversation;
  conversation = null;
  mode = "idle";
  micMuted = false;
  $("mute").setAttribute("aria-pressed", "false");
  $("mute").textContent = "Mute mic";
  setInCall(false);
  setStatus("Ready when you are");
  if (userInitiated && c) await c.endSession().catch(() => {});
}

$("start").addEventListener("click", start);
$("end").addEventListener("click", () => end(true));
$("mute").addEventListener("click", () => {
  if (!conversation) return;
  micMuted = !micMuted;
  conversation.setMicMuted(micMuted);
  $("mute").setAttribute("aria-pressed", String(micMuted));
  $("mute").textContent = micMuted ? "Unmute mic" : "Mute mic";
});
$("typebar").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("typed").value.trim();
  if (!text || !conversation) return;
  conversation.sendUserMessage(text);
  caption("user", text);
  $("typed").value = "";
});
$("bag-button").addEventListener("click", () => openDrawer(true));
$("close-drawer").addEventListener("click", () => openDrawer(false));
$("checkout-button").addEventListener("click", () => bag.length && openCheckout());
$("close-checkout").addEventListener("click", () => $("checkout").classList.add("hidden"));

// ---------- orb ----------

const canvas = $("orb");
const ctx = canvas.getContext("2d");
let level = 0;
let t = 0;

function drawOrb() {
  const target = !conversation ? 0.04 : mode === "speaking" ? conversation.getOutputVolume() : conversation.getInputVolume() * 0.7;
  level += (Math.min(1, target * 1.6) - level) * 0.15;
  t += 0.012 + level * 0.05;

  const { width: w, height: h } = canvas;
  const cx = w / 2;
  const cy = h / 2;
  const base = w * 0.3 * (1 + level * 0.18);
  ctx.clearRect(0, 0, w, h);

  // soft halo
  const halo = ctx.createRadialGradient(cx, cy, base * 0.6, cx, cy, base * 1.6);
  halo.addColorStop(0, `rgba(196, 120, 78, ${0.18 + level * 0.25})`);
  halo.addColorStop(1, "rgba(196, 120, 78, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);

  // living blob
  ctx.beginPath();
  const points = 90;
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const wobble = Math.sin(a * 3 + t * 2) * 0.03 + Math.sin(a * 5 - t * 1.4) * 0.02 + Math.sin(a * 2 + t) * level * 0.08;
    const r = base * (1 + wobble);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  const fill = ctx.createRadialGradient(cx - base * 0.35, cy - base * 0.4, base * 0.1, cx, cy, base * 1.1);
  const listening = conversation && mode === "listening";
  fill.addColorStop(0, listening ? "#e9d8c4" : "#efc9a8");
  fill.addColorStop(0.55, listening ? "#a88c74" : "#b56b44");
  fill.addColorStop(1, listening ? "#5c4a3c" : "#5a2f1c");
  ctx.fillStyle = fill;
  ctx.fill();

  // sheen
  const sheen = ctx.createRadialGradient(cx - base * 0.4, cy - base * 0.45, 0, cx - base * 0.4, cy - base * 0.45, base * 0.7);
  sheen.addColorStop(0, "rgba(255,255,255,0.45)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fill();

  requestAnimationFrame(drawOrb);
}

// ---------- boot ----------

(async () => {
  catalog = await fetch("/api/catalog").then((r) => r.json());
  byId = new Map(catalog.products.map((p) => [p.id, p]));
  document.title = `${catalog.store.name} · Personal Stylist`;
  $("store-name").textContent = catalog.store.name;
  document.querySelectorAll(".rep-name").forEach((el) => (el.textContent = catalog.store.rep));
  renderBag();
  drawOrb();
  // Exposed for quick UI testing from the console without a live call.
  window.salesRepTools = clientTools;
})();
