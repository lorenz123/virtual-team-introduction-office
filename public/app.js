/* Virtual Office — application.
   Runs two ways:
   • served by server.js  → home page at "/", each team's office at "/t/<team>", saved on the server
   • opened from disk     → a single office saved in this browser                                   */
(() => {
"use strict";
const A = window.VO_ART, TPL = window.VO_TEMPLATES;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const HEX = /^#[0-9a-f]{6}$/i;
const clone = (o) => JSON.parse(JSON.stringify(o));
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const snap = (v) => Math.round(v / 10) * 10;
const clean = (s, max) => String(s ?? "").trim().slice(0, max);
const SERVER = location.protocol.startsWith("http");
/* Read an uploaded picture, shrink it to fit `max` pixels and return a data URL (keeps transparency). */
async function readImage(file, max = 520) {
  if (!file || !/^image\//.test(file.type)) throw new Error("Choose an image file (PNG, JPG, SVG, WebP or GIF).");
  if (file.type === "image/svg+xml") {
    if (file.size > 300 * 1024) throw new Error("That SVG is too large. Use one under 300 KB.");
    return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error("Couldn't read that file.")); fr.readAsDataURL(file); });
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Couldn't open that image.")); i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    let out = c.toDataURL("image/webp", 0.86);
    if (!out.startsWith("data:image/webp")) out = c.toDataURL("image/png");
    if (out.length > 600 * 1024) out = c.toDataURL("image/jpeg", 0.8);
    return out;
  } finally { URL.revokeObjectURL(url); }
}
const safeImg = (src) => typeof src === "string" && /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(src) ? src : "";
let drag = null; // the current drag in edit mode; polling waits while it is set

const ROOM_COLORS = ["#A78BFA", "#FBBF24", "#60A5FA", "#22D3EE", "#F472B6", "#34D399", "#FB923C", "#F87171", "#A3E635", "#E879F9", "#38BDF8", "#7A86B8"];
const COUNTRY_COLORS = ["#F2545B", "#F59E0B", "#10B981", "#60A5FA", "#A78BFA", "#F472B6", "#22D3EE", "#84CC16", "#FB923C", "#E879F9"];
const STATUSES = { available: { label: "Available", c: "#34D399" }, busy: { label: "In a meeting", c: "#FBBF24" }, away: { label: "Away", c: "#A3AFDA" }, off: { label: "Out of office", c: "#F87171" } };
const KINDS = { desks: "Team room", client: "Client", meeting: "Meeting room", lounge: "Lounge", board: "Ticket board", open: "Open area" };
const KIND_SIZE = { desks: [340, 220], client: [360, 260], meeting: [220, 200], lounge: [300, 180], board: [240, 200], open: [260, 160] };
const MAX_CLIENT_FIELDS = 10, MAX_CLIENT_IMAGES = 6;
const DEFAULT_SETTINGS = { teamName: "Our team", tagline: "", standupTz: "America/New_York", standupTime: "09:00", standupMinutes: 15, workflowOn: false, floorW: 1000 };
const MAX_ITEMS = 6;
const DESK_SHOWN = 4; /* how many items fit on the desk drawing; the profile lists them all */
const MAX_FACTS = 5;
const MAX_NOTE = 80;

/* =================================================================
   Time helpers (daylight saving handled by Intl)
   ================================================================= */
function validTz(tz) { try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return !!tz; } catch (_) { return false; } }
function offsetMin(tz, date = new Date()) {
  if (!validTz(tz)) return 0;
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(date).map((x) => [x.type, x.value]));
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - date.getTime()) / 60000);
}
const fmtTime = (tz, d = new Date()) => validTz(tz) ? new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d) : "–";
const zoneAbbr = (tz) => { try { return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName").value; } catch (_) { return tz; } };
const SHORT = { "America/New_York": "ET", "America/Chicago": "CT", "America/Denver": "MT", "America/Phoenix": "MST", "America/Los_Angeles": "PT", "Asia/Kolkata": "IST", "Asia/Calcutta": "IST", "Asia/Manila": "PHT", "Europe/London": "UK", "Asia/Singapore": "SGT", "Australia/Sydney": "AET", "Asia/Tokyo": "JST" };
const tzLabel = (tz) => SHORT[tz] || zoneAbbr(tz);
const fmtOffset = (m) => `UTC${m < 0 ? "−" : "+"}${Math.floor(Math.abs(m) / 60)}${Math.abs(m) % 60 ? ":" + String(Math.abs(m) % 60).padStart(2, "0") : ""}`;
const ALL_TZ = (() => { try { return Intl.supportedValuesOf("timeZone"); } catch (_) { return Object.keys(SHORT).concat(["UTC", "Europe/Berlin", "Asia/Dubai", "Asia/Shanghai", "America/Sao_Paulo"]); } })();
const HERE_TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (_) { return "UTC"; } })();

/* =================================================================
   Toasts and modals (shared by home and office)
   ================================================================= */
function toast(msg, { err = false, undo = null, ms = 4000 } = {}) {
  const t = document.createElement("div");
  t.className = "toast" + (err ? " err" : "");
  t.textContent = msg;
  if (undo) { const b = document.createElement("button"); b.className = "btn"; b.textContent = "Undo"; b.onclick = () => { t.remove(); undo(); }; t.append(b); ms = 7000; }
  $("toasts").append(t);
  setTimeout(() => t.remove(), ms);
}
let lastFocus = null;
function openModal(html, onReady) {
  lastFocus = document.activeElement;
  $("modalRoot").innerHTML = `<div class="modal-back" data-modal-back><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">${html}</div></div>`;
  const box = $("modalRoot").querySelector(".modal");
  onReady?.(box);
  (box.querySelector("[autofocus]") || box.querySelector("input:not([type=hidden]), select, textarea, button.btn.primary, button.btn.danger"))?.focus();
}
function closeModal() { $("modalRoot").innerHTML = ""; lastFocus?.focus?.({ preventScroll: true }); }
const modalOpen = () => !!$("modalRoot").firstChild;
document.addEventListener("click", (e) => { if (e.target.closest("[data-modal-cancel]") || e.target.matches("[data-modal-back]")) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modalOpen()) { e.stopImmediatePropagation(); closeModal(); } }, true);

/* =================================================================
   Stores
   ================================================================= */
function applyOps(data, ops) {
  for (const o of ops) {
    if (o.op === "set") data[o.path] = clone(o.data);
    else if (o.op === "update") { if (data[o.path]) data[o.path] = { ...data[o.path], ...clone(o.data) }; }
    else if (o.op === "delete") delete data[o.path];
  }
}
async function api(method, url, body, code) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (code) headers["X-Edit-Code"] = code;
  let r;
  try { r = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" }); }
  catch (_) { throw { code: "network" }; }
  if (r.status === 204) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw { code: j.code || (r.status === 403 ? "locked" : r.status === 404 ? "not_found" : r.status === 413 ? "too_large" : "server"), message: j.error };
  return j;
}

function ServerStore(slug) {
  const listeners = new Set();
  const codeKey = "vo-code-" + slug;
  const st = {
    mode: "server", slug, data: {}, rev: 0, locked: false, code: "", canEdit: true, busy: 0,
    subscribe(fn) { listeners.add(fn); },
    emit() { listeners.forEach((f) => f()); },
    async load() {
      const r = await api("GET", `/api/teams/${slug}`);
      st.data = r.data; st.rev = r.rev; st.locked = r.locked;
      try { st.code = sessionStorage.getItem(codeKey) || ""; } catch (_) {}
      if (st.locked && st.code) { try { await api("POST", `/api/teams/${slug}/unlock`, { code: st.code }); } catch (_) { st.code = ""; } }
      st.canEdit = !st.locked || !!st.code;
      setInterval(st.poll, 3000);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) st.poll(); });
    },
    async poll() {
      if (document.hidden || st.busy || drag) return;
      try {
        const r = await api("GET", `/api/teams/${slug}?since=${st.rev}`);
        if (r && r.rev !== st.rev) { st.data = r.data; st.rev = r.rev; if (r.locked !== st.locked) { st.locked = r.locked; st.canEdit = !st.locked || !!st.code; } st.emit(); }
      } catch (e) { if (e.code === "not_found") location.href = "/"; }
    },
    async apply(ops) {
      if (!ops.length) return;
      const before = clone(st.data);
      applyOps(st.data, ops); st.emit();
      st.busy++;
      try {
        const r = await api("PATCH", `/api/teams/${slug}`, { ops }, st.code);
        const expected = st.rev + 1; st.rev = r.rev;
        if (r.rev !== expected) { st.busy--; await st.poll(); st.busy++; }
      } catch (e) {
        st.data = before; st.emit();
        if (e.code === "locked") { st.code = ""; st.canEdit = false; try { sessionStorage.removeItem(codeKey); } catch (_) {} st.emit(); }
        throw e;
      } finally { st.busy--; }
    },
    async unlock(code) {
      await api("POST", `/api/teams/${slug}/unlock`, { code });
      st.code = code; st.canEdit = true;
      try { sessionStorage.setItem(codeKey, code); } catch (_) {}
      st.emit();
    },
    async setCode(next) {
      await api("PUT", `/api/teams/${slug}/code`, { next }, st.code);
      st.locked = !!next; st.code = next;
      try { next ? sessionStorage.setItem(codeKey, next) : sessionStorage.removeItem(codeKey); } catch (_) {}
      st.canEdit = true; st.emit();
    },
    async replaceAll(data) {
      const r = await api("PUT", `/api/teams/${slug}/data`, { data }, st.code);
      st.data = data; st.rev = r.rev; st.emit();
    },
    async remove() { await api("DELETE", `/api/teams/${slug}`, undefined, st.code); },
  };
  return st;
}

function BrowserStore() {
  const KEY = "virtual-office-v2", OLD = "virtual-office-team";
  const listeners = new Set();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st.data)); } catch (_) { throw { code: "storage" }; } };
  const st = {
    mode: "browser", data: {}, locked: false, canEdit: true,
    subscribe(fn) { listeners.add(fn); },
    emit() { listeners.forEach((f) => f()); },
    async load() {
      let d = null;
      try { d = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) {}
      if (!d) { try { const old = JSON.parse(localStorage.getItem(OLD) || "null"); if (old && Object.keys(old).length) d = TPL.migrateV1(old); } catch (_) {} }
      st.data = d && Object.keys(d).length ? d : TPL.TEMPLATES.sample.build("Software Development Support Team");
      try { localStorage.setItem(KEY, JSON.stringify(st.data)); } catch (_) {}
    },
    async apply(ops) { const before = clone(st.data); applyOps(st.data, ops); try { save(); } catch (e) { st.data = before; st.emit(); throw e; } st.emit(); },
    async replaceAll(data) { st.data = clone(data); save(); st.emit(); },
  };
  return st;
}

/* =================================================================
   Boot / routing
   ================================================================= */
let store = null;
const route = () => {
  if (!SERVER) return { page: "team" };
  const m = location.pathname.match(/^\/t\/([a-z0-9-]{1,60})\/?$/);
  if (m) return { page: "team", slug: m[1] };
  return { page: "home" };
};
(async function boot() {
  const r = route();
  if (r.page === "home") { $("home").hidden = false; return home(); }
  store = r.slug ? ServerStore(r.slug) : BrowserStore();
  try { await store.load(); }
  catch (e) { if (e.code === "not_found") { $("lost").hidden = false; return; } $("lost").hidden = false; $("lost").querySelector("h1").textContent = "Couldn't load this office"; $("lost").querySelector("p").textContent = "The server didn't respond. Check that it's running and reload."; return; }
  $("app").hidden = false;
  $("allTeams").hidden = !r.slug;
  office();
})();

/* =================================================================
   HOME — list and create teams
   ================================================================= */
async function home() {
  document.title = "Virtual Office";
  const tpls = TPL.TEMPLATES;
  $("tplList").innerHTML = Object.entries(tpls).map(([k, t], i) => `<label class="tpl"><input type="radio" name="tpl" value="${k}"${i === 0 ? " checked" : ""}><b>${esc(t.label)}</b><small>${esc(t.hint)}</small></label>`).join("");
  let teams = [];
  const render = () => {
    const q = $("teamSearch").value.trim().toLowerCase();
    const list = teams.filter((t) => !q || (t.name + " " + (t.tagline || "")).toLowerCase().includes(q));
    $("teamList").innerHTML = list.length ? list.map((t) => `<a class="team-card" href="/t/${esc(t.slug)}"><b>${esc(t.name)}</b><small>${t.members} ${t.members === 1 ? "person" : "people"} · ${t.rooms} room${t.rooms === 1 ? "" : "s"}${t.locked ? " · edit code on" : ""}${t.tagline ? " · " + esc(t.tagline) : ""}</small><span class="faces">${(t.avatars || []).slice(0, 6).map((a, j) => `<span>${A.charSVG(a, j)}</span>`).join("")}</span></a>`).join("")
      : `<p class="empty-note">${teams.length ? "No team matches that search." : "No teams yet. Create the first office on the right."}</p>`;
  };
  $("teamSearch").addEventListener("input", render);
  try { teams = await api("GET", "/api/teams"); } catch (_) { $("teamList").innerHTML = `<p class="empty-note">Couldn't load teams. Check that the server is running.</p>`; }
  render();
  $("createForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = clean($("c-name").value, 80);
    $("e-cname").textContent = name ? "" : "Give the team a name.";
    if (!name) { $("c-name").focus(); return; }
    const template = (document.querySelector("input[name=tpl]:checked") || {}).value || "blank";
    const btn = e.target.querySelector("[type=submit]"); btn.disabled = true;
    try {
      const code = $("c-code").value;
      const r = await api("POST", "/api/teams", { name, template, code });
      if (code) { try { sessionStorage.setItem("vo-code-" + r.slug, code); } catch (_) {} }
      location.href = "/t/" + r.slug;
    } catch (err) { btn.disabled = false; toast(err.message || "Couldn't create the team. Try again.", { err: true }); }
  });
}

/* =================================================================
   OFFICE
   ================================================================= */
function office() {
  const vp = $("viewport"), wEl = $("world"), mon = $("monitor");
  const S = {};
  let editMode = false, current = null, currentRoom = null, view = "office", settingsDirty = false;
  const viewKey = "vo-view-" + (store.slug || "local");

  /* ---------- derived data ---------- */
  const list = (prefix) => Object.entries(store.data).filter(([k]) => k.startsWith(prefix + "/")).map(([k, v]) => ({ id: k.slice(prefix.length + 1), ...v }));
  function derive() {
    S.settings = { ...DEFAULT_SETTINGS, ...(store.data["settings/team"] || {}), workflowOn: false };
    S.floorW = clamp(+S.settings.floorW || 1000, 800, 2000);
    S.roles = list("roles").sort((a, b) => String(a.name).localeCompare(b.name));
    S.rooms = list("rooms").map((r) => ({ ...r, color: HEX.test(r.color) ? r.color : "#7A86B8", kind: KINDS[r.kind] ? r.kind : "open", x: +r.x || 0, y: +r.y || 0, w: Math.max(100, +r.w || 200), h: Math.max(100, +r.h || 200) }));
    S.members = list("members");
    S.decor = list("decor").filter((d) => A.DECOR[d.type]);
    S.roleById = Object.fromEntries(S.roles.map((r) => [r.id, r]));
    S.roomById = Object.fromEntries(S.rooms.map((r) => [r.id, r]));
    S.flowRooms = S.settings.workflowOn ? S.rooms.filter((r) => Number.isFinite(r.flowOrder)).sort((a, b) => a.flowOrder - b.flowOrder) : [];
    S.stageOf = Object.fromEntries(S.flowRooms.map((r, i) => [r.id, i + 1]));
    S.deskRooms = S.rooms.filter((r) => r.kind === "desks").sort((a, b) => (S.stageOf[a.id] || 999) - (S.stageOf[b.id] || 999) || a.y - b.y || a.x - b.x);
    const byCreated = (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || String(a.name).localeCompare(b.name);
    S.inRoom = {};
    for (const r of S.deskRooms) S.inRoom[r.id] = S.members.filter((m) => m.roomId === r.id).sort((a, b) => (a.seat ?? 999) - (b.seat ?? 999) || byCreated(a, b));
    S.unseated = S.members.filter((m) => !S.inRoom[m.roomId]).sort(byCreated);
    S.people = S.deskRooms.flatMap((r) => S.inRoom[r.id]).concat(S.unseated);
    const countries = [...new Set([...S.members].sort(byCreated).map((m) => (m.country || "").trim()).filter(Boolean))];
    S.countryColor = Object.fromEntries(countries.map((c, i) => [c, COUNTRY_COLORS[i % COUNTRY_COLORS.length]]));
  }
  const roleOf = (m) => S.roleById[m.roleId] || { name: "No role", color: "#7A86B8" };
  const roomOf = (m) => S.roomById[m.roomId];
  const countryColor = (m) => S.countryColor[(m.country || "").trim()] || "#7A86B8";
  const statusOf = (m) => STATUSES[m.status] || STATUSES.available;
  const avatarOf = (m) => m.avatar && typeof m.avatar === "object" ? m.avatar : Number.isInteger(m.avatar) ? m.avatar : [...String(m.id)].reduce((a, c) => a + c.charCodeAt(0), 0) % A.CAST.length;
  const canEdit = () => store.canEdit;
  const minY = () => (S.settings.workflowOn ? 66 : 10);

  /* ---------- writes ---------- */
  async function write(ops, okMsg, opts) {
    try { await store.apply(ops); if (okMsg) toast(okMsg, opts); return true; }
    catch (e) {
      const m = { locked: "This office has an edit code. Unlock editing to make changes.", network: "Couldn't reach the server. Check that it's running, then try again.", too_large: "That change is too large to save.", storage: "This browser blocked saving. Download a backup so you don't lose changes.", not_found: "This office no longer exists." }[e.code] || e.message || "Couldn't save that change. Try again.";
      toast(m, { err: true, ms: 6000 });
      if (e.code === "locked") renderAll();
      return false;
    }
  }

  /* ---------- geometry ---------- */
  const CELL_W = 84, CELL_H = 124, GRID_TOP = 48;
  /* Desks are drawn as large as the room allows: 1.35x, 1.15x, or normal size when the room is packed. */
  const DESK_SCALES = [1.35, 1.15, 1];
  function deskGrid(room, n) {
    const bottom = room.task ? 38 : 10;
    const fit = (k) => {
      const cw = Math.round(CELL_W * k), ch = Math.round(CELL_H * k);
      const cols = Math.max(1, Math.floor((room.w - 16) / cw));
      const rows = Math.max(1, Math.floor((room.h - GRID_TOP - bottom) / ch));
      return { k, cw, ch, cols, rows, cap: cols * rows };
    };
    const base = fit(1);
    const g = DESK_SCALES.map(fit).find((x) => x.cap >= n) || base;
    const used = Math.min(g.cols, Math.max(1, n));
    const x0 = Math.round((room.w - used * g.cw) / 2) + 2;
    return { ...g, capMax: base.cap, x0, slot: (i) => ({ x: x0 + (i % g.cols) * g.cw, y: GRID_TOP + Math.floor(i / g.cols) * g.ch }), neededH: (k) => GRID_TOP + Math.max(1, Math.ceil(k / base.cols)) * CELL_H + bottom };
  }
  const overlaps = (a, b, pad = 16) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
  function freeSpot(w, h) {
    const others = S.rooms.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h })).concat(S.decor.map((d) => ({ x: d.x, y: d.y, w: A.DECOR[d.type].w, h: A.DECOR[d.type].h })));
    for (let y = minY(); y < 3000; y += 20) for (let x = 20; x + w <= S.floorW - 20; x += 20) {
      const box = { x, y, w, h };
      if (!others.some((o) => overlaps(box, o))) return { x, y };
    }
    return { x: 20, y: Math.max(minY(), ...S.rooms.map((r) => r.y + r.h + 30)) };
  }

  /* ---------- rendering: floor ---------- */
  let deskPos = {}, worldH = 540;
  function roomInner(r) {
    const stage = S.stageOf[r.id];
    const ed = editMode && canEdit();
    const wide = r.w >= 300;
    const hb = ed ? `${r.kind === "desks" ? `<button class="hb" data-add-member="${esc(r.id)}" aria-label="Add someone to ${esc(r.name)}" title="Add someone">+</button>` : ""}<button class="hb" data-edit-room="${esc(r.id)}" aria-label="Edit ${esc(r.name)}" title="Edit room"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.2V21h3.8L17.8 10l-3.8-3.8zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.8 3.8z"/></svg></button>` : "";
    let h = `<div class="rm-hd">${stage ? `<span class="num">${stage}</span>` : ""}<span class="t">${esc(r.name)}</span>${stage && wide && r.stage ? `<span class="tagline">${esc(r.stage)}</span>` : ""}${hb}</div>`;
    const W = r.w - 16, H = r.h - 52;
    if (r.kind === "desks") {
      const ppl = S.inRoom[r.id] || [];
      const cap = deskGrid(r, 0).capMax;
      const g = deskGrid(r, ppl.length + (ed && ppl.length < cap ? 1 : 0));
      ppl.forEach((m, j) => {
        const p = g.slot(j);
        deskPos[m.id] = { x: r.x + p.x + 40 * g.k, y: r.y + p.y + 40 * g.k, k: g.k };
        const items = (m.items || []).slice(0, DESK_SHOWN);
        const slotsX = [0, 62, 17, 45];
        h += `<button class="desk" data-mid="${esc(m.id)}" style="left:${p.x}px;top:${p.y}px;--k:${g.k};--c:${r.color};--rc:${countryColor(m)};--sc:${statusOf(m).c}" aria-label="${esc(m.name)}, ${esc(roleOf(m).name)}. ${ed ? "Edit, or drag to move" : "Open profile"}">
          <span class="scr"><b></b><b></b><b></b></span><span class="who">${A.charSVG(avatarOf(m), j)}</span><span class="st-dot" title="${esc(statusOf(m).label)}"></span><span class="tbl"></span>
          ${items.map((it, k) => `<span class="it" style="left:${slotsX[k]}px">${A.itemSVG(it.type, it.color)}</span>`).join("")}
          <span class="name" title="${esc(m.name)}">${esc(tagName(m))}</span></button>`;
      });
      if (ed && ppl.length < g.cap) { const p = g.slot(ppl.length); h += `<button class="desk empty" data-add-member="${esc(r.id)}" style="left:${p.x}px;top:${p.y}px;--k:${g.k};--c:${r.color}" aria-label="Add someone to ${esc(r.name)}"><span class="ghost">+ Add<br>someone</span><span class="tbl"></span></button>`; }
      else if (!ppl.length) { const p = g.slot(0); h += `<div class="desk empty" style="left:${p.x}px;top:${p.y}px;--k:${g.k};--c:${r.color}"><span class="ghost">Empty desk</span><span class="tbl"></span></div>`; }
      if (r.task) h += `<div class="task">${esc(r.task)}</div>`;
      if (ppl.length > g.cap && ed) h += `<span class="full-badge">Room is full · drag the corner to enlarge</span>`;
    } else if (r.kind === "client") {
      const c = r.client || {}, logo = safeImg(c.logo), fields = (c.fields || []).filter((f) => f && (f.label || f.value));
      const imgs = (c.images || []).map((im) => ({ ...im, src: safeImg(im && im.src) })).filter((im) => im.src);
      h += `<div class="client-box"><div class="cl-top">${logo ? `<span class="cl-logo${c.logoBg === "none" ? "" : " plate"}"><img src="${logo}" alt=""></span>` : ""}<div class="cl-id"><b>${esc(c.name || "Client name")}</b>${c.tagline ? `<small>${esc(c.tagline)}</small>` : ""}</div></div>
        ${fields.length ? `<dl class="cl-fields">${fields.slice(0, 3).map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(String(f.value || "").replace(/\s+·\s+/g, ", "))}</dd></div>`).join("")}</dl>` : `<p class="cl-empty">${ed ? "Click the pencil to add client details and images." : "No client details yet."}</p>`}
        ${imgs.length ? `<div class="cl-imgs">${imgs.slice(0, 4).map((im) => `<img src="${im.src}" alt="${esc(im.caption || "")}">`).join("")}${imgs.length > 4 ? `<span class="more">+${imgs.length - 4}</span>` : ""}</div>` : ""}</div>
        ${ed ? "" : `<button class="cl-open" data-open-room="${esc(r.id)}" aria-label="Open ${esc(c.name || r.name)} details">View details</button>`}`;
    } else if (r.kind === "meeting") {
      const tw = Math.min(W * 0.55, 160), th = Math.min(H * 0.38, 70), cx = r.w / 2, cy = 44 + H * 0.45;
      const n = clamp(Math.round((tw + th) / 28), 4, 10);
      h += `<svg class="art-svg" style="position:absolute;left:0;top:0" width="${r.w}" height="${r.h}" aria-hidden="true">${Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2; return `<circle cx="${cx + Math.cos(t) * (tw / 2 + 16)}" cy="${cy + Math.sin(t) * (th / 2 + 14)}" r="8" fill="#7A86B8"/>`; }).join("")}<ellipse cx="${cx}" cy="${cy}" rx="${tw / 2}" ry="${th / 2}" fill="#8A5A3B" stroke="#6B4429" stroke-width="3"/></svg>`;
      h += `<div class="foot" data-huddle="${r.task ? "" : "1"}">${esc(r.task || "Daily stand-up")}</div>`;
    } else if (r.kind === "lounge") {
      const sofa = A.DECOR.sofa, bean = A.DECOR.beanbag, rug = A.DECOR.rug;
      const sc = Math.min(1, (W - 50) / sofa.w, (H - 30) / (sofa.h + 20));
      h += `<div class="art-x" style="position:absolute;left:${(r.w - rug.w * sc * 1.1) / 2}px;top:${44 + (H - rug.h * sc) / 2}px;transform:scale(${sc * 1.1});transform-origin:0 0;opacity:.8">${A.decorSVG("rug", r.color)}</div>`;
      h += `<div class="art-x" style="position:absolute;left:${(r.w - sofa.w * sc) / 2}px;top:${50}px;transform:scale(${sc});transform-origin:0 0">${A.decorSVG("sofa")}</div>`;
      if (W > 200) h += `<div class="art-x" style="position:absolute;right:16px;bottom:${r.task ? 42 : 14}px">${A.decorSVG("beanbag")}</div><div class="art-x" style="position:absolute;left:14px;bottom:${r.task ? 42 : 14}px">${A.decorSVG("bigplant")}</div>`;
      if (r.task) h += `<div class="task">${esc(r.task)}</div>`;
    } else if (r.kind === "board") {
      const cs = S.flowRooms.length ? S.flowRooms.map((x) => x.color) : ROOM_COLORS;
      const pick = (k) => cs[k % cs.length];
      h += `<div class="board-cols">${[["To do", [0, 1, 2]], ["Doing", [3, 4]], ["Done", [5, 6, 7]]].map(([t, ks]) => `<div><h4>${t}</h4>${ks.map((k) => `<div class="card" style="--c:${pick(k)}"></div>`).join("")}</div>`).join("")}</div>`;
      h += `<div class="foot">${esc(r.task || "Released work feeds the next sprint")}</div>`;
    } else if (r.task) h += `<div class="task">${esc(r.task)}</div>`;
    if (ed) h += `<span class="resize" data-resize="${esc(r.id)}" aria-hidden="true"></span>`;
    return h;
  }
  function renderWorld() {
    deskPos = {};
    const ed = editMode && canEdit();
    let h = "";
    if (S.settings.workflowOn) {
      h += `<div class="strip" style="width:${S.floorW - 40}px"><strong>WORKFLOW</strong>${S.flowRooms.length ? S.flowRooms.map((r, i) => `<span class="st"><i style="background:${r.color}">${i + 1}</i><span>${esc(r.stage || r.name)}</span></span>${i < S.flowRooms.length - 1 ? '<span class="chev">›</span>' : ""}`).join("") + '<span class="loop">↺ loop</span>' : '<span class="st" style="color:#6B77AB">Add rooms to the workflow in Manage team</span>'}</div>`;
    }
    for (const d of S.decor) {
      const def = A.DECOR[d.type];
      h += ed ? `<button class="decor" data-did="${esc(d.id)}" style="left:${d.x}px;top:${d.y}px" aria-label="${esc(def.label)}. Edit, or drag to move">${A.decorSVG(d.type, d.color)}</button>`
        : `<div class="decor" style="left:${d.x}px;top:${d.y}px">${A.decorSVG(d.type, d.color)}</div>`;
    }
    for (const r of S.rooms) {
      const plain = ["meeting", "board"].includes(r.kind);
      const full = r.kind === "desks" && (S.inRoom[r.id] || []).length > deskGrid(r, 0).capMax;
      h += `<div class="rm${plain ? " plain" : ""}${r.kind === "open" ? " open" : ""}${full ? " overfull" : ""}" data-rid="${esc(r.id)}" data-kind="${r.kind}" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;--c:${r.color}">${roomInner(r)}</div>`;
    }
    h += flowArrows();
    const bottom = Math.max(0, ...S.rooms.map((r) => r.y + r.h), ...S.decor.map((d) => d.y + A.DECOR[d.type].h));
    worldH = Math.max(Math.round(S.floorW * 0.5), bottom + (ed ? 70 : 30));
    wEl.style.width = S.floorW + "px";
    wEl.style.height = worldH + "px";
    vp.style.aspectRatio = `${S.floorW} / ${worldH}`;
    vp.classList.toggle("editing", ed);
    wEl.innerHTML = h;
    renderNotice();
    tick();
  }
  function flowArrows() {
    const R = S.flowRooms;
    if (R.length < 2) return "";
    let paths = "";
    for (let i = 0; i < R.length - 1; i++) {
      const a = R[i], b = R[i + 1];
      const acx = a.x + a.w / 2, acy = a.y + a.h / 2, bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
      const dx = bcx - acx, dy = bcy - acy;
      let p1, p2, c1, c2;
      if (Math.abs(dx) / (a.w + b.w) >= Math.abs(dy) / (a.h + b.h)) {
        const sx = Math.sign(dx) || 1;
        p1 = [sx > 0 ? a.x + a.w : a.x, acy]; p2 = [sx > 0 ? b.x : b.x + b.w, bcy];
        const k = Math.max(20, Math.abs(p2[0] - p1[0]) / 2);
        c1 = [p1[0] + sx * k, p1[1]]; c2 = [p2[0] - sx * k, p2[1]];
      } else {
        const sy = Math.sign(dy) || 1;
        p1 = [acx, sy > 0 ? a.y + a.h : a.y]; p2 = [bcx, sy > 0 ? b.y : b.y + b.h];
        const k = Math.max(20, Math.abs(p2[1] - p1[1]) / 2);
        c1 = [p1[0], p1[1] + sy * k]; c2 = [p2[0], p2[1] - sy * k];
      }
      paths += `<path d="M${p1} C${c1} ${c2} ${p2}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="7 6" marker-end="url(#ah)" opacity=".9"/>`;
    }
    return `<svg class="flow-arrows" width="${S.floorW}" height="${Math.max(...R.map((r) => r.y + r.h)) + 40}" aria-hidden="true"><defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#fff"/></marker><filter id="glow"><feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="#000"/></filter></defs><g filter="url(#glow)">${paths}</g></svg>`;
  }
  function renderNotice() {
    let n = "";
    if (!S.rooms.length) n = `<div><h3>An empty floor</h3><p>Add your first room to start building the office.</p>${canEdit() ? `<button class="btn primary" data-new-room="desks">+ Add a team room</button>` : ""}</div>`;
    $("notice").innerHTML = n; $("notice").hidden = !n;
  }

  /* ---------- camera ---------- */
  /* Overview: fit the whole floor in the viewport (centred). In edit mode the floor fills the width so dragging maps 1:1. */
  function overview() {
    if (editMode) return { s: vp.clientWidth / S.floorW, ox: 0, oy: 0 };
    const s = Math.min(vp.clientWidth / S.floorW, vp.clientHeight / worldH);
    return { s, ox: (vp.clientWidth - S.floorW * s) / 2, oy: 0 };
  }
  function applyCamera() {
    const { s, ox, oy } = overview();
    const zr = currentRoom && S.roomById[currentRoom];
    if (zr && !editMode) {
      const k = Math.min(vp.clientWidth / (zr.w + 60), vp.clientHeight / (zr.h + 60));
      wEl.style.transform = `translate(${vp.clientWidth / 2 - (zr.x + zr.w / 2) * k}px,${vp.clientHeight / 2 - (zr.y + zr.h / 2) * k}px) scale(${k})`;
      return;
    }
    if (current === null || !deskPos[current] || editMode) { wEl.style.transform = `translate(${ox}px,${oy}px) scale(${s})`; return; }
    const p = deskPos[current];
    const k = Math.min(vp.clientWidth / (190 * p.k), vp.clientHeight / (150 * p.k));
    wEl.style.transform = `translate(${vp.clientWidth / 2 - p.x * k}px,${vp.clientHeight / 2 - (p.y - 24) * k}px) scale(${k})`;
  }
  new ResizeObserver(applyCamera).observe(vp);

  /* ---------- profile monitor ---------- */
  /* Desk name tags show the first name, unless two people share it. */
  const tagName = (m) => { const f = String(m.name).trim().split(/\s+/)[0]; return S.members.filter((x) => String(x.name).trim().split(/\s+/)[0] === f).length > 1 ? m.name : f; };
  const factsOf = (m) => (Array.isArray(m.facts) ? m.facts : []).filter(Boolean).length ? m.facts.filter(Boolean) : m.fun ? [m.fun] : [];
  function profileHTML(m) {
    const room = roomOf(m), stage = room && S.stageOf[room.id], pos = S.people.indexOf(m), st = statusOf(m), role = roleOf(m);
    const prev = stage ? S.flowRooms[stage - 2] : null, next = stage ? S.flowRooms[stage] : null;
    const tools = canEdit() ? `<span class="tools"><button class="mini" data-edit-member="${esc(m.id)}">Edit</button><button class="mini danger" data-del-member="${esc(m.id)}">Delete</button></span>` : "";
    const dd = (v, ph) => v ? `<dd>${esc(v)}</dd>` : `<dd class="empty">${ph}</dd>`;
    const items = (m.items || []).filter((it) => A.ITEMS[it.type]);
    const f = factsOf(m);
    return `<div class="mon-in"><div class="mon-bar"><i style="background:#F2545B"></i><i style="background:#FBBF24"></i><i style="background:#34D399"></i><span class="crumb">${esc(room ? room.name : "Not seated")}${stage ? " · Stage " + stage : ""} · ${pos + 1} of ${S.people.length}</span>${listenBtn("member", m.id)}${tools}</div>
    <div class="mon-body" style="--cd:${role.color || "#334155"}">
      <div class="mon-left">
        <div class="who-row"><div class="pic">${A.charSVG(avatarOf(m))}</div>
          <div class="ident"><h2 id="monName">${esc(m.name)}</h2><div class="role-line"><span class="role">${esc(role.name)}</span><span class="pill" style="--sc:${st.c}">● ${esc(st.label)}</span></div></div></div>
        <div class="flowline">${stage ? `<b>Stage ${stage} · ${esc(room.stage || room.name)}</b><span>${prev ? "← from " + esc(prev.stage || prev.name) : "← new work"}</span><span>${next ? "→ to " + esc(next.stage || next.name) : "→ done"}</span>` : `<b>${esc(room ? room.name : "Not seated yet")}</b>${room && room.desc ? `<span>${esc(room.desc)}</span>` : ""}`}</div>
        <dl class="facts">
          <div><dt>Location</dt>${dd([m.city, m.country].filter(Boolean).join(", "), "Not set")}</div>
          <div><dt>Local time</dt><dd><span class="mono" data-clock="${esc(m.tz)}">${fmtTime(m.tz)}</span> · ${esc(tzLabel(m.tz))}</dd></div>
          ${items.length ? `<div class="wide"><dt>On my desk</dt><dd><ul class="desk-list${items.length > 4 ? " many" : ""}">${items.map((it) => `<li><span class="ic">${A.itemSVG(it.type, it.color)}</span><span><b>${esc(A.ITEMS[it.type].label)}</b>${it.note ? `<small>${esc(it.note)}</small>` : ""}</span></li>`).join("")}</ul></dd></div>` : ""}
        </dl>
      </div>
      <div class="mon-right"><dl class="facts one">
        <div><dt>${f.length > 1 ? "Fun facts" : "Fun fact"}</dt>${f.length ? `<dd><ul class="fact-list">${f.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></dd>` : `<dd class="empty">${canEdit() ? "Add some with Edit" : "Not added yet"}</dd>`}</div>
        ${m.about ? `<div><dt>About me</dt><dd class="about">${esc(m.about)}</dd></div>` : ""}
      </dl></div>
    </div></div>
    <div class="mon-nav"><button class="btn" data-step="-1">← Prev</button><span class="hint">Esc or click outside to zoom out · ← → to move</span><button class="btn primary" data-step="1">Next →</button></div>`;
  }
  /* A value written as "A · B · C" shows as chips. */
  const fieldValue = (v) => { const parts = String(v || "").split(/\s+·\s+/).filter(Boolean); return parts.length > 1 ? `<span class="chips">${parts.map((x) => `<span>${esc(x)}</span>`).join("")}</span>` : esc(v); };
  function clientHTML(r) {
    const c = r.client || {}, logo = safeImg(c.logo), fields = (c.fields || []).filter((f) => f && (f.label || f.value));
    const imgs = (c.images || []).map((im) => ({ ...im, src: safeImg(im && im.src) })).filter((im) => im.src);
    const tools = canEdit() ? `<span class="tools"><button class="mini" data-edit-room="${esc(r.id)}">Edit</button></span>` : "";
    return `<div class="mon-in"><div class="mon-bar"><i style="background:#F2545B"></i><i style="background:#FBBF24"></i><i style="background:#34D399"></i><span class="crumb">${esc(r.name)}</span>${listenBtn("room", r.id)}${tools}</div>
    <div class="cl-card">
      <div class="cl-head">${logo ? `<span class="cl-logo big${c.logoBg === "none" ? "" : " plate"}"><img src="${logo}" alt="${esc(c.name || "Client")} logo"></span>` : ""}<div><h2 id="monName">${esc(c.name || "Client name")}</h2>${c.tagline ? `<p>${esc(c.tagline)}</p>` : ""}</div></div>
      ${fields.length ? `<dl class="facts cl-facts">${fields.map((f) => `<div${String(f.value || "").length > 60 ? ' class="wide"' : ""}><dt>${esc(f.label)}</dt><dd>${fieldValue(f.value)}</dd></div>`).join("")}</dl>` : `<p class="hint" style="color:#5B6592">No details added yet.</p>`}
      ${imgs.length ? `<div class="cl-gallery">${imgs.map((im, i) => `<figure><button class="bare" data-view-img="${i}" aria-label="Enlarge ${esc(im.caption || "image " + (i + 1))}"><img src="${im.src}" alt="${esc(im.caption || "")}"></button>${im.caption ? `<figcaption>${esc(im.caption)}</figcaption>` : ""}</figure>`).join("")}</div>` : ""}
    </div></div>
    <div class="mon-nav"><span class="hint">Esc or click outside to zoom out</span><button class="btn primary" data-close>← Back to office</button></div>`;
  }
  function openRoom(id) {
    const r = S.roomById[id]; if (!r) return;
    if (P.on && !P.driving) stopPresenting();
    if (editMode) setEditMode(false);
    showView("office");
    current = null; currentRoom = id;
    mon.style.setProperty("--c", r.color);
    mon.innerHTML = clientHTML(r);
    vp.classList.add("zoomed"); vp.classList.remove("open");
    applyCamera();
    clearTimeout(openTimer);
    openTimer = setTimeout(() => { vp.classList.add("open"); mon.querySelector("[data-close]")?.focus({ preventScroll: true }); }, 650);
    renderSelected();
  }
  function viewImage(i) {
    const r = S.roomById[currentRoom]; if (!r) return;
    const im = ((r.client || {}).images || [])[i]; if (!im || !safeImg(im.src)) return;
    openModal(`<h3 id="modalTitle">${esc(im.caption || (r.client.name || "Client") + " image")}</h3><img class="lightbox" src="${safeImg(im.src)}" alt="${esc(im.caption || "")}"><div class="modal-acts"><button class="btn primary" data-modal-cancel>Close</button></div>`);
  }
  let openTimer;
  /* presenter state (see "audio presenter" below) */
  const TTS = typeof speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined" ? speechSynthesis : null;
  const pref = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (_) { return d; } };
  const setPref = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
  const P = { on: false, single: false, driving: false, paused: false, steps: [], i: 0, parts: [], k: 0, token: 0, done: null };
  function openMember(id) {
    const m = S.members.find((x) => x.id === id);
    if (!m) return;
    if (P.on && !P.driving) stopPresenting();
    if (editMode) setEditMode(false);
    showView("office");
    current = id; currentRoom = null;
    mon.style.setProperty("--c", roomOf(m)?.color || "#22D3EE");
    mon.innerHTML = profileHTML(m);
    vp.classList.add("zoomed"); vp.classList.remove("open");
    const rect = vp.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > innerHeight) vp.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    applyCamera();
    clearTimeout(openTimer);
    openTimer = setTimeout(() => { vp.classList.add("open"); mon.querySelector("[data-step='1']")?.focus({ preventScroll: true }); }, deskPos[id] ? 650 : 50);
    renderSelected();
  }
  function closeMember() {
    if (P.on && !P.driving) stopPresenting();
    if (currentRoom !== null) { const back = currentRoom; currentRoom = null; clearTimeout(openTimer); vp.classList.remove("open", "zoomed"); applyCamera(); renderSelected(); wEl.querySelector(`[data-open-room="${CSS.escape(back)}"]`)?.focus({ preventScroll: true }); return; }
    if (current === null) return;
    const back = current; current = null;
    clearTimeout(openTimer);
    vp.classList.remove("open", "zoomed");
    applyCamera(); renderSelected();
    wEl.querySelector(`.desk[data-mid="${CSS.escape(back)}"]`)?.focus({ preventScroll: true });
  }
  function step(dir) {
    if (P.on && !P.single) return presStep(dir);
    if (current === null || !S.people.length) return;
    const pos = S.people.findIndex((m) => m.id === current);
    openMember(S.people[(pos + dir + S.people.length) % S.people.length].id);
  }
  function renderSelected() {
    const el = $("selected");
    const m = current !== null && S.members.find((x) => x.id === current);
    const zr = currentRoom && S.roomById[currentRoom];
    if (zr) {
      el.style.borderColor = zr.color;
      el.innerHTML = `<span class="lab">Client</span><span class="msg">${esc((zr.client || {}).name || zr.name)}</span><span style="color:var(--muted)">${esc(zr.name)}</span><button class="btn" data-close style="margin-left:auto">← Back to office</button>`;
      return;
    }
    if (!m) {
      el.style.borderColor = "";
      const legend = Object.entries(S.countryColor).map(([c, col]) => `<span><span class="sq" style="background:${col}"></span>${esc(c)}</span>`).join("");
      el.innerHTML = `<span class="lab">${editMode ? "Editing the office" : "Selected teammate"}</span><span class="msg">${editMode ? "Drag rooms, people and decor. Click anything to edit it." : S.people.length ? "Click any teammate to zoom into their desk" : "No teammates yet"}</span><span class="legend">${S.flowRooms.length > 1 ? '<span><b style="color:var(--fg)">⇢</b> hand-off</span>' : ""}${legend}</span>`;
    } else {
      const st = statusOf(m);
      el.style.borderColor = roomOf(m)?.color || "";
      el.innerHTML = `<span class="lab">Selected teammate</span><span class="msg">${esc(m.name)}</span><span style="color:var(--muted)">${esc(roleOf(m).name)}${m.city ? " · " + esc(m.city) : ""}</span><span class="pill" style="--sc:${st.c}">${esc(st.label.toUpperCase())}</span><button class="btn" data-close style="margin-left:auto">← Back to office</button>`;
    }
  }

  /* ---------- header + sidebar ---------- */
  function renderHeader() {
    $("teamName").textContent = S.settings.teamName || "Our team";
    $("teamTag").textContent = S.settings.tagline || `${S.members.length} ${S.members.length === 1 ? "person" : "people"} · ${S.rooms.length} room${S.rooms.length === 1 ? "" : "s"}`;
    document.title = (S.settings.teamName || "Team") + " · Virtual Office";
    const logo = safeImg(S.settings.logo);
    $("brandLogo").className = "brand-logo" + (logo ? " has-img" + (S.settings.logoBg === "none" ? "" : " plate") : "");
    $("brandLogo").innerHTML = logo ? `<img src="${logo}" alt="${esc(S.settings.teamName || "Team")} logo">` : `<svg class="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3zm0 4.2 4 1.5v3.6c0 2.9-1.7 5.6-4 6.8V6.2z"/></svg>`;
    $("brandEdit").hidden = !canEdit();
    $("teamCount").textContent = S.members.length;
    $("teamWord").textContent = S.members.length === 1 ? "member" : "members";
    renderLocations();
  }
  /* Locations tile: each country with its head-count and the local time in each of its time zones. */
  function renderLocations() {
    const now = new Date(), byCountry = {};
    S.members.forEach((m) => { const c = (m.country || "").trim() || "Location not set"; (byCountry[c] = byCountry[c] || []).push(m); });
    const entries = Object.entries(byCountry).sort((a, b) => b[1].length - a[1].length);
    $("locs").innerHTML = entries.length ? entries.map(([c, ppl]) => {
      const seen = new Set();
      const zones = ppl.map((m) => m.tz).filter(validTz).sort((a, b) => offsetMin(b, now) - offsetMin(a, now)).filter((tz) => { const k = tzLabel(tz); if (seen.has(k)) return false; seen.add(k); return true; });
      return `<div class="loc"><span class="dot" style="background:${S.countryColor[c] || "#7A86B8"}"></span><span class="lh"><b>${esc(c)}</b><span class="n" title="${ppl.length} ${ppl.length === 1 ? "person" : "people"}">${ppl.length}</span></span>${zones.length ? `<span class="times">${zones.map((tz) => `<span><i>${esc(tzLabel(tz))}</i> ${fmtTime(tz, now)}</span>`).join("")}</span>` : ""}</div>`;
    }).join("") : `<span class="hint">Add teammates to see where everyone is.</span>`;
  }
  function brandForm() {
    const st = S.settings;
    let logo = safeImg(st.logo), logoBg = st.logoBg === "none" ? "none" : "plate";
    openModal(`<h3 id="modalTitle">Name and logo</h3><p>Shown at the top of the office. Use your client's or team's logo.</p>
    <form id="brandForm" novalidate><div class="form-grid">
      <div class="field full"><label for="b-name">Name</label><input id="b-name" maxlength="80" value="${esc(st.teamName)}" autocomplete="off" autofocus></div>
      <div class="field full"><label for="b-tag">Tagline</label><input id="b-tag" maxlength="80" value="${esc(st.tagline)}" placeholder="e.g. Software development support for Acme"></div>
      <div class="field full"><span class="lbl">Logo</span>
        <div class="logo-edit"><span class="logo-prev" id="bPrev"></span>
          <div class="logo-acts"><label class="btn" for="b-file">Upload logo…</label><input id="b-file" type="file" accept="image/*" hidden><button type="button" class="btn danger" id="b-remove">Remove</button>
          <label class="switch"><input type="checkbox" id="b-plate"${logoBg === "plate" ? " checked" : ""}> White background behind the logo</label><small>Turn this off for light-coloured logos with a transparent background.</small><span class="err" id="e-blogo"></span></div></div>
      </div>
    </div>
    <div class="modal-acts" style="margin-top:14px"><button type="button" class="btn" data-modal-cancel>Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`, (box) => {
      const prev = () => { box.querySelector("#bPrev").className = "logo-prev" + (logo && logoBg === "plate" ? " plate" : ""); box.querySelector("#bPrev").innerHTML = logo ? `<img src="${logo}" alt="Logo preview">` : `<span class="hint">No logo</span>`; box.querySelector("#b-remove").disabled = !logo; };
      prev();
      box.querySelector("#b-file").addEventListener("change", async (e) => { const f = e.target.files[0]; e.target.value = ""; try { logo = await readImage(f, 480); $("e-blogo").textContent = ""; prev(); } catch (err) { $("e-blogo").textContent = err.message; } });
      box.querySelector("#b-remove").addEventListener("click", () => { logo = ""; prev(); });
      box.querySelector("#b-plate").addEventListener("change", (e) => { logoBg = e.target.checked ? "plate" : "none"; prev(); });
      box.querySelector("#brandForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const patch = { teamName: clean($("b-name").value, 80) || "Our team", tagline: clean($("b-tag").value, 80), logo, logoBg };
        if (await setSetting(patch, "Saved name and logo")) closeModal();
      });
    });
  }
  function chipCh(m, j) { return `<span class="chip-ch">${A.charSVG(avatarOf(m), j)}</span>`; }
  /* Team mix: grouped by each role's category (e.g. Managers, BA, Developers), or by role when no categories are set. */
  function mixGroups() {
    const order = Array.isArray(S.settings.groupOrder) ? S.settings.groupOrder : [];
    const groups = new Map();
    for (const m of S.people) {
      const r = S.roleById[m.roleId];
      const key = (r && r.group && r.group.trim()) || (r ? r.name : "No role");
      if (!groups.has(key)) groups.set(key, { name: key, color: r && HEX.test(r.color) ? r.color : "#7A86B8", people: [], roles: new Set() });
      const g = groups.get(key); g.people.push(m); if (r) g.roles.add(r.name);
    }
    const rank = (n) => { const i = order.findIndex((x) => x.toLowerCase() === n.toLowerCase()); return i < 0 ? 999 : i; };
    return [...groups.values()].sort((a, b) => rank(a.name) - rank(b.name) || b.people.length - a.people.length);
  }
  function renderSide() {
    if (S.roles.some((r) => r.group && r.group.trim())) {
      const gs = mixGroups(), max = Math.max(1, ...gs.map((g) => g.people.length));
      $("mix").classList.add("grouped");
      $("mix").innerHTML = gs.map((g) => `<div class="mix-g" style="--c:${g.color}"><span class="gn" title="${esc([...g.roles].join(", "))}">${esc(g.name)}</span><span class="bar"><i style="width:${(g.people.length / max) * 100}%"></i></span><b>${g.people.length}</b><span class="faces">${g.people.map((m, j) => `<button class="bare face" data-open="${esc(m.id)}" title="${esc(m.name)} · ${esc(roleOf(m).name)}" aria-label="${esc(m.name)}">${A.charSVG(avatarOf(m), j)}</button>`).join("")}</span></div>`).join("") || `<p class="empty-note">No one yet.</p>`;
      renderRoster();
      return;
    }
    $("mix").classList.remove("grouped");
    const counts = S.roles.map((r) => [r, S.members.filter((m) => m.roleId === r.id).length]).filter(([, n]) => n > 0 || S.roles.length <= 8).sort((a, b) => b[1] - a[1]);
    const noRole = S.members.filter((m) => !S.roleById[m.roleId]).length;
    if (noRole) counts.push([{ name: "No role", color: "#7A86B8" }, noRole]);
    const max = Math.max(1, ...counts.map((c) => c[1]));
    $("mix").innerHTML = counts.length ? counts.map(([r, n]) => `<div style="--c:${HEX.test(r.color) ? r.color : "#7A86B8"}"><span title="${esc(r.name)}">${esc(r.name)}</span><span class="bar"><i style="width:${(n / max) * 100}%"></i></span><b>${n}</b></div>`).join("") : `<p class="empty-note">No roles yet.</p>`;
    renderRoster();
  }
  function renderRoster() {
    $("roster").innerHTML = S.people.map((m, j) => `<button class="chip" data-open="${esc(m.id)}" style="border-color:color-mix(in srgb, ${countryColor(m)} 45%, var(--edge))">${chipCh(m, j)}<span class="nm">${esc(m.name)}</span></button>`).join("")
      + (canEdit() ? `<button class="chip add" data-add-member="">+ Add member</button>` : "")
      + (!S.people.length && !canEdit() ? `<p class="empty-note">No teammates yet.</p>` : "");
  }

  /* ---------- other views ---------- */
  function renderWrap() {
    const P = S.people, half = Math.ceil(P.length / 2);
    const btn = (m, j) => `<button class="bare" data-open="${esc(m.id)}" aria-label="Open ${esc(m.name)}">${chipCh(m, j)}</button>`;
    $("view-wrap").innerHTML = `<h2>See you in the office!</h2><p class="sub">${P.length} of us, one table.</p>
    <div class="table-scene"><div class="row">${P.slice(0, half).map(btn).join("")}</div><div class="tbl">${"<i></i>".repeat(clamp(half, 3, 8))}</div><div class="row">${P.slice(half).map(btn).join("")}</div></div>`;
  }
  function standupParts() {
    const [h, mi] = String(S.settings.standupTime || "09:00").split(":").map(Number);
    return { tz: validTz(S.settings.standupTz) ? S.settings.standupTz : "UTC", h: h || 0, mi: mi || 0, len: Math.max(5, +S.settings.standupMinutes || 15) };
  }
  function nextStandup(now = new Date()) {
    const { tz, h, mi, len } = standupParts();
    const off = offsetMin(tz, now), local = new Date(now.getTime() + off * 60000);
    let t = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), h, mi) - off * 60000;
    if (t + len * 60000 <= now.getTime()) t += 86400000;
    return new Date(t);
  }
  function renderTZ() {
    const now = new Date();
    const zones = [...new Set(S.members.map((m) => m.tz).filter(validTz))].sort((a, b) => offsetMin(a, now) - offsetMin(b, now));
    const pct = (h) => (((h % 24) + 24) % 24) / 24 * 100;
    const nowUTC = now.getUTCHours() + now.getUTCMinutes() / 60;
    const su = nextStandup(now), suUTC = su.getUTCHours() + su.getUTCMinutes() / 60, { len } = standupParts();
    const rows = zones.map((tz) => {
      const off = offsetMin(tz, now) / 60, people = S.members.filter((m) => m.tz === tz), col = countryColor(people[0]);
      const a = (((9 - off) % 24) + 24) % 24, b = a + 9, segs = b <= 24 ? [[a, b]] : [[a, 24], [0, b - 24]];
      return `<div class="tz-row"><div class="who">${esc(tzLabel(tz))} · ${people.length}<small>${fmtTime(tz, now)} now</small></div><div class="track">${segs.map(([x, y]) => `<i style="left:${x / 24 * 100}%;width:${(y - x) / 24 * 100}%;background:${col};color:${col}"></i>`).join("")}</div></div>`;
    }).join("");
    const ticks = [0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => `<span style="left:${h / 24 * 100}%">${String(h).padStart(2, "0")}:00</span>`).join("");
    $("view-tz").innerHTML = `<h2>Who's online when</h2><p class="sub">Working hours (9 AM–6 PM local) on a 24-hour UTC clock. The white line is now; the shaded band is the daily stand-up. Daylight saving is handled automatically.</p>
    ${zones.length ? `<div class="tz-wrap"><div class="tz">${rows}</div><div class="axis">${ticks}</div><div style="position:absolute;inset:0 0 0 ${matchMedia("(max-width: 620px)").matches ? 110 : 164}px"><span class="overlay-band" style="left:${pct(suUTC)}%;width:${len / 60 / 24 * 100}%"></span><span class="overlay-line" style="left:${pct(nowUTC)}%"></span></div></div>
    <div class="callout"><b>Daily stand-up</b>${zones.map((tz) => `<span>${fmtTime(tz, su)} ${esc(tzLabel(tz))}</span>`).join("")}</div>` : `<p class="empty-note">Add teammates to see their working hours.</p>`}`;
  }

  /* ---------- manage view ---------- */
  const ICON = {
    up: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 6 5 13h4v5h6v-5h4z"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 18 5 11h4V6h6v5h4z"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 17.2V21h3.8L17.8 10l-3.8-3.8zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.8 3.8z"/></svg>',
    del: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4zm-3 6h12l-1 12H7z"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6z"/></svg>',
  };
  function tzOptions(selected) {
    const used = [...new Set(S.members.map((m) => m.tz).filter(validTz))], now = new Date();
    const opt = (tz) => `<option value="${esc(tz)}"${tz === selected ? " selected" : ""}>${esc(tz.replace(/_/g, " "))} · ${esc(fmtOffset(offsetMin(tz, now)))}</option>`;
    const extra = selected && !used.includes(selected) && !ALL_TZ.includes(selected) && validTz(selected) ? opt(selected) : "";
    return (used.length ? `<optgroup label="Used by the team">${used.map(opt).join("")}</optgroup>` : "") + `<optgroup label="All time zones">${extra}${ALL_TZ.filter((t) => !used.includes(t)).map(opt).join("")}</optgroup>`;
  }
  function renderManage() {
    const w = canEdit(), st = S.settings;
    const act = (attr, id, label, icon, cls = "") => `<button class="icon-btn ${cls}" ${attr}="${esc(id)}" aria-label="${esc(label)}">${icon}</button>`;
    const roomsRows = S.rooms.slice().sort((a, b) => a.y - b.y || a.x - b.x).map((r) => {
      const n = (S.inRoom[r.id] || []).length;
      return `<li class="mg-row" style="--c:${r.color}"><span class="sw"></span><div class="tt"><b>${esc(r.name)}</b><small>${esc(KINDS[r.kind])}${r.kind === "desks" ? ` · ${n} ${n === 1 ? "person" : "people"}` : ""}${r.kind === "client" && r.client && r.client.name ? " · " + esc(r.client.name) : ""}</small></div>${w ? `<div class="acts">${act("data-edit-room", r.id, "Edit " + r.name, ICON.edit)}${act("data-del-room", r.id, "Delete " + r.name, ICON.del, "danger")}</div>` : "<span></span>"}</li>`;
    }).join("");
    const flowRows = S.flowRooms.map((r, i) => `<li class="mg-row" style="--c:${r.color}"><span class="sw"></span><div class="tt"><b>${i + 1}. ${esc(r.stage || r.name)}</b><small>${esc(r.name)}</small></div>${w ? `<div class="acts">${act("data-flow-move", r.id, "Move earlier", ICON.up)}${act("data-flow-down", r.id, "Move later", ICON.down)}${act("data-flow-remove", r.id, "Remove " + r.name + " from the workflow", ICON.x)}</div>` : "<span></span>"}</li>`).join("");
    const notInFlow = S.rooms.filter((r) => !S.stageOf[r.id]);
    const rolesRows = S.roles.map((r) => { const n = S.members.filter((m) => m.roleId === r.id).length; return `<li class="mg-row" style="--c:${HEX.test(r.color) ? r.color : "#7A86B8"}"><span class="sw"></span><div class="tt"><b>${esc(r.name)}</b><small>${r.group ? esc(r.group) + " · " : ""}${n} ${n === 1 ? "person" : "people"}</small></div>${w ? `<div class="acts">${act("data-edit-role", r.id, "Edit " + r.name, ICON.edit)}${act("data-del-role", r.id, "Delete " + r.name, ICON.del, "danger")}</div>` : "<span></span>"}</li>`; }).join("");
    const keep = { q: $("mgSearch")?.value || "" };
    const settingsVals = settingsDirty && $("s-team") ? { teamName: $("s-team").value, tagline: $("s-tag").value, introScript: $("s-intro").value, outroScript: $("s-outro").value, standupTime: $("s-time").value, standupMinutes: $("s-len").value, standupTz: $("s-tz").value } : st;
    $("view-manage").innerHTML = `<h2>Manage team</h2>
    <p class="sub">${w ? "Change people, rooms, roles and settings here. Use Edit office on the floor plan to move things around." : store.locked ? "This office has an edit code. You can look around; unlock editing to make changes." : "View only."}</p>
    <div class="mg-grid">
      <section class="mg-card wide" aria-labelledby="hMembers">
        <div class="mg-head"><h3 id="hMembers">Members <span class="hint mono" id="mgCount"></span></h3><input class="search" id="mgSearch" type="search" placeholder="Search name, role, room or city" aria-label="Search members" value="${esc(keep.q)}">${w ? `<button class="btn primary" data-add-member="">+ Add member</button>` : ""}</div>
        <div class="tbl-wrap"><table class="mg"><thead><tr><th></th><th>Name</th><th>Role</th><th>Room</th><th class="hide-sm">Location</th><th class="hide-sm">Time zone</th><th class="hide-sm">Desk items</th><th></th></tr></thead><tbody id="mgMembers"></tbody></table></div>
      </section>
      <section class="mg-card" aria-labelledby="hRooms">
        <div class="mg-head"><h3 id="hRooms">Rooms</h3>${w ? `<button class="btn primary" data-new-room="desks">+ Add room</button>` : ""}</div>
        <ul class="mg-list">${roomsRows || `<li class="empty-note">No rooms yet.</li>`}</ul>
      </section>
      <section class="mg-card" aria-labelledby="hRoles">
        <div class="mg-head"><h3 id="hRoles">Roles</h3>${w ? `<button class="btn primary" data-add-role>+ Add role</button>` : ""}</div>
        <p class="hint" style="margin:0">Job titles. They colour the Team mix and appear on profiles.</p>
        <ul class="mg-list">${rolesRows || `<li class="empty-note">No roles yet.</li>`}</ul>
      </section>
      <section class="mg-card" aria-labelledby="hSettings">
        <div class="mg-head"><h3 id="hSettings">Team settings</h3>${w ? `<button class="btn" type="button" data-brand>Name &amp; logo…</button>` : ""}</div>
        <form id="settingsForm" class="form-row" novalidate>
          <div class="field" style="grid-column:1/-1"><label for="s-team">Team name</label><input id="s-team" maxlength="80" value="${esc(settingsVals.teamName)}"${w ? "" : " disabled"}></div>
          <div class="field" style="grid-column:1/-1"><label for="s-tag">Tagline</label><input id="s-tag" maxlength="80" value="${esc(settingsVals.tagline)}" placeholder="e.g. From ticket to release"${w ? "" : " disabled"}></div>
          <div class="field"><label for="s-time">Stand-up time</label><input id="s-time" type="time" value="${esc(settingsVals.standupTime)}"${w ? "" : " disabled"}></div>
          <div class="field"><label for="s-len">Length (min)</label><input id="s-len" type="number" min="5" max="240" step="5" value="${esc(settingsVals.standupMinutes)}"${w ? "" : " disabled"}></div>
          <div class="field" style="grid-column:1/-1"><label for="s-tz">Stand-up time zone</label><select id="s-tz"${w ? "" : " disabled"}>${tzOptions(settingsVals.standupTz)}</select></div>
          <div class="field" style="grid-column:1/-1"><label for="s-intro">Presenter: opening <span class="opt">(optional)</span></label><textarea id="s-intro" rows="3" maxlength="1500" placeholder="Leave blank for an automatic welcome."${w ? "" : " disabled"}>${esc(settingsVals.introScript || "")}</textarea></div>
          <div class="field" style="grid-column:1/-1"><label for="s-outro">Presenter: closing <span class="opt">(optional)</span></label><textarea id="s-outro" rows="2" maxlength="1500" placeholder="Leave blank for an automatic sign-off."${w ? "" : " disabled"}>${esc(settingsVals.outroScript || "")}</textarea></div>
          ${w ? `<div style="grid-column:1/-1;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn primary" type="submit">Save settings</button><span class="hint" id="settingsHint">${settingsDirty ? "Unsaved changes" : ""}</span></div>` : ""}
        </form>
      </section>
      <section class="mg-card" aria-labelledby="hBackup">
        <div class="mg-head"><h3 id="hBackup">Backup${store.mode === "server" ? " &amp; access" : ""}</h3></div>
        <p class="hint" style="margin:0">${store.mode === "server" ? "This office is saved on the server. Download a copy any time." : "This office is saved in this browser only. Download a backup to keep it safe or move it."}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="exportBtn" type="button">Download backup</button>${w ? `<label class="btn" for="importFile">Restore from backup…</label><input id="importFile" type="file" accept="application/json,.json" hidden>` : ""}</div>
        ${store.mode === "server" ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;border-top:1px solid var(--edge);padding-top:12px">
          ${w ? `<button class="btn" id="codeBtn" type="button">${store.locked ? "Change or remove edit code" : "Set an edit code"}</button>` : `<button class="btn" data-unlock type="button">Unlock editing</button>`}
          <span class="hint">${store.locked ? "Edit code on: everyone can view, only people with the code can edit." : "No edit code: anyone with the link can edit."}</span></div>
          ${w ? `<div style="border-top:1px solid var(--edge);padding-top:12px"><button class="btn danger" id="deleteTeamBtn" type="button">Delete this office…</button></div>` : ""}` : ""}
      </section>
    </div>`;
    renderMembersTable();
    $("mgSearch").addEventListener("input", renderMembersTable);
    const sf = $("settingsForm");
    sf.addEventListener("input", () => { settingsDirty = true; if ($("settingsHint")) $("settingsHint").textContent = "Unsaved changes"; });
    sf.addEventListener("submit", async (e) => {
      e.preventDefault();
      const next = {
        teamName: clean($("s-team").value, 80) || "Our team", tagline: clean($("s-tag").value, 80),
        introScript: clean($("s-intro").value, 1500), outroScript: clean($("s-outro").value, 1500),
        standupTime: /^\d{2}:\d{2}$/.test($("s-time").value) ? $("s-time").value : "09:00",
        standupMinutes: clamp(Math.round(+$("s-len").value || 15), 5, 240), standupTz: validTz($("s-tz").value) ? $("s-tz").value : "UTC",
      };
      settingsDirty = false;
      if (!(await write([{ op: store.data["settings/team"] ? "update" : "set", path: "settings/team", data: store.data["settings/team"] ? next : { ...DEFAULT_SETTINGS, ...next } }], "Saved team settings"))) settingsDirty = true;
    });
    $("exportBtn").addEventListener("click", exportBackup);
    $("importFile")?.addEventListener("change", importBackup);
    $("codeBtn")?.addEventListener("click", codeForm);
    $("deleteTeamBtn")?.addEventListener("click", deleteTeamForm);
  }
  function renderMembersTable() {
    const w = canEdit(), q = ($("mgSearch")?.value || "").trim().toLowerCase();
    const listP = S.people.filter((m) => !q || [m.name, roleOf(m).name, roomOf(m)?.name, m.city, m.country].join(" ").toLowerCase().includes(q));
    $("mgCount").textContent = `${listP.length}${q ? " of " + S.people.length : ""}`;
    $("mgMembers").innerHTML = listP.length ? listP.map((m, j) => {
      const r = roleOf(m), room = roomOf(m), items = (m.items || []).filter((it) => A.ITEMS[it.type]);
      return `<tr><td><button class="mg-ch bare" data-open="${esc(m.id)}" aria-label="Open ${esc(m.name)}">${A.charSVG(avatarOf(m), j)}</button></td><td class="nm">${esc(m.name)}</td><td><span class="rl" style="--c:${HEX.test(r.color) ? r.color : "#7A86B8"}"><i></i>${esc(r.name)}</span></td><td>${room ? `<span class="rl" style="--c:${room.color}"><i></i>${esc(room.name)}</span>` : '<span class="hint">Not seated</span>'}</td><td class="hide-sm">${esc([m.city, m.country].filter(Boolean).join(", "))}</td><td class="hide-sm mono">${esc(tzLabel(m.tz))}</td><td class="hide-sm"><span class="desk-items" style="flex-wrap:nowrap">${items.map((it) => `<span style="padding:1px" title="${esc(A.ITEMS[it.type].label)}">${A.itemSVG(it.type, it.color)}</span>`).join("")}</span></td><td class="acts">${w ? `<button class="icon-btn" data-edit-member="${esc(m.id)}" aria-label="Edit ${esc(m.name)}">${ICON.edit}</button> <button class="icon-btn danger" data-del-member="${esc(m.id)}" aria-label="Delete ${esc(m.name)}">${ICON.del}</button>` : ""}</td></tr>`;
    }).join("") : `<tr><td colspan="8" class="empty-note" style="padding:12px 8px">${S.people.length ? "No one matches that search." : "No teammates yet."}</td></tr>`;
  }
  function setSetting(patch, msg) {
    const exists = !!store.data["settings/team"];
    return write([{ op: exists ? "update" : "set", path: "settings/team", data: exists ? patch : { ...DEFAULT_SETTINGS, ...patch } }], msg);
  }
  function moveFlow(id, dir) {
    const R = S.flowRooms.slice(), i = R.findIndex((r) => r.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= R.length) return;
    [R[i], R[j]] = [R[j], R[i]];
    write(R.map((r, k) => ({ op: "update", path: "rooms/" + r.id, data: { flowOrder: k + 1 } })));
  }
  function removeFlow(id) {
    const R = S.flowRooms.filter((r) => r.id !== id);
    write([{ op: "update", path: "rooms/" + id, data: { flowOrder: null } }, ...R.map((r, k) => ({ op: "update", path: "rooms/" + r.id, data: { flowOrder: k + 1 } }))], "Removed from the workflow");
  }

  /* ---------- backup ---------- */
  function exportBackup() {
    const blob = new Blob([JSON.stringify({ app: "virtual-office", version: 2, exportedAt: new Date().toISOString(), data: store.data }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(S.settings.teamName || "team").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "team"}-office-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function importBackup(e) {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    let j; try { j = JSON.parse(await f.text()); } catch (_) { toast("That file isn't a valid backup.", { err: true }); return; }
    let data = j && j.app === "virtual-office" ? j.data : j;
    if (!data || typeof data !== "object" || !Object.keys(data).every((k) => /^[a-z]+\/[A-Za-z0-9_\-.~:@+]+$/.test(k))) { toast("That file isn't a Virtual Office backup.", { err: true }); return; }
    data = TPL.migrateV1(data);
    openModal(`<h3 id="modalTitle">Replace this office with the backup?</h3><p>Everything here (${S.members.length} people, ${S.rooms.length} rooms) will be replaced by the backup's contents.</p><div class="modal-acts"><button class="btn" data-modal-cancel>Cancel</button><button class="btn danger" id="doRestore">Replace office</button></div>`, (box) => {
      box.querySelector("#doRestore").onclick = async () => {
        closeModal();
        try { await store.replaceAll(data); toast("Restored the office from backup"); } catch (err) { toast(err.code === "locked" ? "Unlock editing first." : "Couldn't restore the backup.", { err: true }); }
      };
    });
  }

  /* ---------- edit code + delete team (server) ---------- */
  function unlockForm() {
    openModal(`<h3 id="modalTitle">Unlock editing</h3><p>Enter this office's edit code. You'll stay unlocked until you close this browser tab.</p>
    <form id="unlockForm" novalidate><div class="field"><label for="u-code">Edit code</label><input id="u-code" type="password" maxlength="64" autocomplete="current-password" autofocus><span class="err" id="e-ucode"></span></div>
    <div class="modal-acts" style="margin-top:14px"><button type="button" class="btn" data-modal-cancel>Cancel</button><button class="btn primary" type="submit">Unlock</button></div></form>`, (box) => {
      box.querySelector("#unlockForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        try { await store.unlock($("u-code").value); closeModal(); toast("Editing unlocked"); }
        catch (err) { $("e-ucode").textContent = err.code === "locked" ? "That code isn't right." : "Couldn't reach the server."; }
      });
    });
  }
  function codeForm() {
    openModal(`<h3 id="modalTitle">${store.locked ? "Change the edit code" : "Set an edit code"}</h3><p>With a code, anyone with the link can still view the office, but only people with the code can change it.</p>
    <form id="codeForm" novalidate><div class="field"><label for="n-code">${store.locked ? "New code" : "Edit code"}</label><input id="n-code" type="password" maxlength="64" autocomplete="new-password" autofocus><span class="err" id="e-ncode"></span></div>
    <div class="modal-acts" style="margin-top:14px">${store.locked ? `<button type="button" class="btn danger left" id="removeCode">Remove code</button>` : ""}<button type="button" class="btn" data-modal-cancel>Cancel</button><button class="btn primary" type="submit">Save code</button></div></form>`, (box) => {
      box.querySelector("#codeForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const v = $("n-code").value;
        if (v.length < 4) { $("e-ncode").textContent = "Use at least 4 characters."; return; }
        try { await store.setCode(v); closeModal(); toast("Edit code saved. Share it only with people who should edit."); } catch (_) { $("e-ncode").textContent = "Couldn't save the code."; }
      });
      box.querySelector("#removeCode")?.addEventListener("click", async () => { try { await store.setCode(""); closeModal(); toast("Edit code removed. Anyone with the link can edit."); } catch (_) { toast("Couldn't remove the code.", { err: true }); } });
    });
  }
  function deleteTeamForm() {
    const name = S.settings.teamName || "this office";
    openModal(`<h3 id="modalTitle">Delete ${esc(name)}?</h3><p>The office and everyone in it will be removed from this server. The server keeps a copy in its trash folder, but it won't appear in the list any more.</p>
    <form id="delTeam" novalidate><div class="field"><label for="d-name">Type the team name to confirm</label><input id="d-name" autocomplete="off" autofocus></div>
    <div class="modal-acts" style="margin-top:14px"><button type="button" class="btn" data-modal-cancel>Cancel</button><button class="btn danger" type="submit" id="delTeamBtn" disabled>Delete office</button></div></form>`, (box) => {
      box.querySelector("#d-name").addEventListener("input", (e) => { box.querySelector("#delTeamBtn").disabled = e.target.value.trim() !== name.trim(); });
      box.querySelector("#delTeam").addEventListener("submit", async (e) => {
        e.preventDefault();
        try { await store.remove(); location.href = "/"; } catch (_) { toast("Couldn't delete the office.", { err: true }); }
      });
    });
  }

  /* ---------- member form ---------- */
  function memberForm(m, presetRoom) {
    const isNew = !m;
    const usedAv = new Set(S.members.map(avatarOf));
    const freeAv = A.CAST.findIndex((_, i) => !usedAv.has(i));
    const roleCounts = {}; S.members.forEach((x) => { if (S.roleById[x.roleId]) roleCounts[x.roleId] = (roleCounts[x.roleId] || 0) + 1; });
    const defRole = Object.entries(roleCounts).sort((p, q) => q[1] - p[1])[0]?.[0] || list("roles")[0]?.id || "";
    const d = m ? clone(m) : { name: "", roleId: defRole, roomId: presetRoom || S.deskRooms[0]?.id || "", city: "", country: "", tz: HERE_TZ, status: "available", fun: "", facts: [], about: "", ask: "", avatar: freeAv >= 0 ? freeAv : S.members.length % A.CAST.length, items: [] };
    let items = (d.items || []).filter((it) => A.ITEMS[it.type]).slice(0, MAX_ITEMS);
    let avatar = d.avatar && typeof d.avatar === "object" ? A.normAvatar(d.avatar) : Number.isInteger(d.avatar) ? d.avatar : 0;
    const factsText = factsOf(d).join("\n");
    const O = A.AVATAR_OPTIONS;
    const selOpt = (k, lbl) => `<label class="cz"><span>${lbl}</span><select data-cz="${k}">${Object.entries(O[k]).map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join("")}</select></label>`;
    const colOpt = (k, lbl) => `<label class="cz col"><span>${lbl}</span><input type="color" data-cz="${k}"${k === "skin" ? ' list="skinTones"' : ""}></label>`;
    const chkOpt = (k, lbl) => `<label class="cz chk"><input type="checkbox" data-cz="${k}"> <span>${lbl}</span></label>`;
    const countries = [...new Set(S.members.map((x) => x.country).filter(Boolean))];
    openModal(`<h3 id="modalTitle">${isNew ? "Add a member" : "Edit " + esc(d.name)}</h3>
    <form id="memberForm" novalidate><div class="form-grid">
      <div class="field"><label for="f-name">Name</label><input id="f-name" maxlength="40" value="${esc(d.name)}" autocomplete="off" autofocus><span class="err" id="e-name"></span></div>
      <div class="field"><label for="f-role">Role</label><select id="f-role"><option value="">No role</option>${S.roles.map((r) => `<option value="${esc(r.id)}"${r.id === d.roleId ? " selected" : ""}>${esc(r.name)}</option>`).join("")}</select></div>
      <div class="field"><label for="f-room">Room</label><select id="f-room"><option value="">Not seated</option>${S.deskRooms.map((r) => `<option value="${esc(r.id)}"${r.id === d.roomId ? " selected" : ""}>${esc(r.name)}</option>`).join("")}</select></div>
      <div class="field"><label for="f-status">Status</label><select id="f-status">${Object.entries(STATUSES).map(([k, s]) => `<option value="${k}"${k === (d.status || "available") ? " selected" : ""}>${s.label}</option>`).join("")}</select></div>
      <div class="field"><label for="f-city">City</label><input id="f-city" maxlength="60" value="${esc(d.city)}" placeholder="e.g. Manila"></div>
      <div class="field"><label for="f-country">Country</label><input id="f-country" maxlength="40" value="${esc(d.country)}" list="countryList" placeholder="e.g. Philippines"><datalist id="countryList">${countries.map((c) => `<option value="${esc(c)}">`).join("")}</datalist><small>Name tags are coloured by country.</small></div>
      <div class="field full"><label for="f-tz">Time zone</label><select id="f-tz">${tzOptions(d.tz)}</select></div>
      <div class="field full"><label for="f-facts">Fun facts <span class="opt">(one per line, up to ${MAX_FACTS})</span></label><textarea id="f-facts" rows="4" maxlength="1600" placeholder="Something the team might not know&#10;Another one">${esc(factsText)}</textarea></div>
      <div class="field full"><label for="f-about">About me <span class="opt">(optional)</span></label><textarea id="f-about" rows="3" maxlength="800" placeholder="Career, years with the company, family, hobbies…">${esc(d.about || "")}</textarea></div>
      <div class="field full"><label for="f-script">Presenter script <span class="opt">(optional: what the audio presenter says)</span></label><textarea id="f-script" rows="4" maxlength="1500" placeholder="Leave blank and the presenter will write one from this profile.">${esc(d.script || "")}</textarea>
        <div class="script-acts"><button type="button" class="btn sm" id="f-script-auto">Write one from the profile</button>${TTS ? `<button type="button" class="btn sm" id="f-script-play">▶ Preview</button>` : ""}</div></div>
      <div class="field full"><span class="lbl" id="avLbl">Character</span>
        <div class="av-build"><div class="av-prev" id="avPrev"></div><div>
          <div class="av-grid" role="radiogroup" aria-labelledby="avLbl">${A.CAST.map((_, i) => `<button type="button" class="av-opt" role="radio" aria-checked="${i === avatar}" data-av="${i}" aria-label="Starting look ${i + 1}">${A.charSVG(i)}</button>`).join("")}</div>
          <small>Pick a starting look, then customise it below.</small></div></div>
        <details class="av-custom" id="avCustom"${typeof avatar === "object" ? " open" : ""}><summary>Customise character</summary>
          <div class="cz-grid">${selOpt("hair", "Hair")}${colOpt("hairColor", "Hair colour")}${selOpt("beard", "Beard")}${colOpt("beardColor", "Beard colour")}${selOpt("head", "On their head")}${colOpt("headColor", "Hat colour")}${selOpt("outfit", "Outfit")}${colOpt("outfitColor", "Outfit colour")}${selOpt("eyes", "Eyewear")}${colOpt("skin", "Skin tone")}${colOpt("pants", "Trousers")}${colOpt("accent", "Accent")}</div>
          <div class="cz-checks">${chkOpt("backpack", "Backpack")}${chkOpt("pitchfork", "Pitchfork")}${chkOpt("lipstick", "Lipstick")}${chkOpt("tired", "Tired eyes")}${chkOpt("extraArms", "Extra arms (multitasker)")}</div>
          <datalist id="skinTones">${A.SKIN.map((c) => `<option value="${c}">`).join("")}</datalist>
        </details></div>
      <div class="field full"><span class="lbl" id="itLbl">On their desk <span class="opt">(up to ${MAX_ITEMS})</span></span>
        <div class="item-rows" id="itemRows" aria-labelledby="itLbl"></div>
        <small>Pick from the shelf below to add. Change the colour with the swatch and add a short note if you like.</small>
        <div class="item-lib" id="itemLib">${Object.entries(A.ITEMS).map(([k, v]) => `<button type="button" data-add-item="${k}" title="${esc(v.label)}" aria-label="Add ${esc(v.label)}">${A.itemSVG(k)}</button>`).join("")}</div>
      </div>
    </div>
    <div class="modal-acts" style="margin-top:14px">${!isNew ? `<button type="button" class="btn danger left" data-del-member="${esc(m.id)}">Delete</button>` : ""}<button type="button" class="btn" data-modal-cancel>Cancel</button><button type="submit" class="btn primary">${isNew ? "Add member" : "Save changes"}</button></div>
    </form>`, (box) => {
      const drawItems = () => {
        box.querySelector("#itemRows").innerHTML = items.length ? items.map((it, i) => {
          const def = A.ITEMS[it.type], colorable = !!def.def;
          return `<div class="item-row"><span class="prev">${A.itemSVG(it.type, it.color)}</span><select data-item-type="${i}" aria-label="Item ${i + 1}">${Object.entries(A.ITEMS).map(([k, v]) => `<option value="${k}"${k === it.type ? " selected" : ""}>${esc(v.label)}</option>`).join("")}</select><input type="color" data-item-color="${i}" value="${HEX.test(it.color) ? it.color : def.def || "#000000"}" aria-label="Colour of item ${i + 1}"${colorable ? "" : " disabled title=\"This item has fixed colours\""}><button type="button" class="icon-btn danger" data-item-remove="${i}" aria-label="Remove ${esc(def.label)}">${ICON.x}</button><input class="note" data-item-note="${i}" maxlength="${MAX_NOTE}" value="${esc(it.note || "")}" placeholder="Note (optional), e.g. hot apple cider, never coffee" aria-label="Note for item ${i + 1}"></div>`;
        }).join("") : `<p class="empty-note">Nothing on the desk yet.</p>`;
        box.querySelectorAll("#itemLib button").forEach((b) => (b.disabled = items.length >= MAX_ITEMS));
      };
      drawItems();
      const drawAv = () => {
        const spec = A.normAvatar(avatar);
        box.querySelector("#avPrev").innerHTML = A.charSVG(avatar);
        box.querySelectorAll("[data-cz]").forEach((el) => { const k = el.dataset.cz; if (el.type === "checkbox") el.checked = !!spec[k]; else el.value = spec[k]; });
        box.querySelectorAll("[data-av]").forEach((x) => x.setAttribute("aria-checked", avatar === +x.dataset.av));
      };
      drawAv();
      const formMember = () => ({ ...d, id: m ? m.id : "new", name: clean($("f-name").value, 40) || "this person", roleId: $("f-role").value, city: $("f-city").value, country: $("f-country").value, tz: $("f-tz").value,
        facts: $("f-facts").value.split(/\n+/).map((x) => x.trim()).filter(Boolean), about: $("f-about").value, items });
      box.querySelector("#f-script-auto").onclick = () => { $("f-script").value = autoMemberScript(formMember()).slice(0, 1500); $("f-script").focus(); };
      const pv = box.querySelector("#f-script-play");
      if (pv) pv.onclick = () => { if (pv.dataset.on) { TTS.cancel(); P.token++; delete pv.dataset.on; pv.textContent = "▶ Preview"; return; } pv.dataset.on = "1"; pv.textContent = "■ Stop"; say($("f-script").value.trim() || autoMemberScript(formMember()), () => { delete pv.dataset.on; pv.textContent = "▶ Preview"; }); };
      const czChange = (el) => { const spec = A.normAvatar(avatar); spec[el.dataset.cz] = el.type === "checkbox" ? el.checked : el.value; if (el.dataset.cz === "hairColor" && spec.beard === "none") spec.beardColor = el.value; avatar = spec; drawAv(); };
      box.addEventListener("click", (e) => {
        const av = e.target.closest("[data-av]");
        if (av) { avatar = +av.dataset.av; drawAv(); return; }
        const add = e.target.closest("[data-add-item]");
        if (add && items.length < MAX_ITEMS) { items.push({ type: add.dataset.addItem, color: A.ITEMS[add.dataset.addItem].def || "" }); drawItems(); return; }
        const rm = e.target.closest("[data-item-remove]");
        if (rm) { items.splice(+rm.dataset.itemRemove, 1); drawItems(); }
      });
      box.addEventListener("change", (e) => {
        const t = e.target;
        if (t.matches("[data-item-type]")) { const i = +t.dataset.itemType; items[i] = { type: t.value, color: A.ITEMS[t.value].def || "", note: items[i].note || "" }; drawItems(); }
        if (t.matches("[data-cz]")) czChange(t);
      });
      box.addEventListener("input", (e) => {
        const t = e.target;
        if (t.matches("[data-item-note]")) { items[+t.dataset.itemNote].note = t.value; return; }
        if (t.matches("input[type=color][data-cz]")) { czChange(t); return; }
        if (t.matches("[data-item-color]")) { const i = +t.dataset.itemColor; items[i].color = t.value; t.closest(".item-row").querySelector(".prev").innerHTML = A.itemSVG(items[i].type, t.value); }
      });
      box.querySelector("#memberForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = clean($("f-name").value, 40);
        $("e-name").textContent = name ? "" : "Enter a name.";
        if (!name) { $("f-name").focus(); return; }
        const roomId = S.roomById[$("f-room").value] ? $("f-room").value : "";
        const body = {
          name, roleId: S.roleById[$("f-role").value] ? $("f-role").value : "", roomId,
          city: clean($("f-city").value, 60), country: clean($("f-country").value, 40),
          tz: validTz($("f-tz").value) ? $("f-tz").value : "UTC", status: STATUSES[$("f-status").value] ? $("f-status").value : "available",
          facts: $("f-facts").value.split(/\n+/).map((x) => clean(x, 300)).filter(Boolean).slice(0, MAX_FACTS), fun: "",
          about: clean($("f-about").value, 800), script: clean($("f-script").value, 1500), ask: d.ask || "", avatar: typeof avatar === "object" ? A.normAvatar(avatar) : avatar,
          items: items.map((it) => ({ type: it.type, color: HEX.test(it.color) ? it.color : "", note: clean(it.note || "", MAX_NOTE) })),
          createdAt: m?.createdAt ?? Date.now(),
        };
        const id = m ? m.id : uid("m");
        const ops = [];
        if (!m || m.roomId !== roomId) {
          body.seat = roomId ? (S.inRoom[roomId] || []).filter((x) => x.id !== id).length : 0;
          const room = S.roomById[roomId];
          if (room) { const g = deskGrid(room, body.seat + 1); if (body.seat + 1 > g.cap) ops.push({ op: "update", path: "rooms/" + roomId, data: { h: g.neededH(body.seat + 1) } }); }
        } else body.seat = m.seat ?? 0;
        ops.unshift({ op: "set", path: "members/" + id, data: body });
        const btn = box.querySelector("[type=submit]"); btn.disabled = true;
        const ok = await write(ops, isNew ? `Added ${name}` : `Saved ${name}`);
        btn.disabled = false;
        if (ok) { closeModal(); if (current === id) setTimeout(() => openMember(id), 30); }
      });
    });
  }
  function confirmDeleteMember(id) {
    const m = S.members.find((x) => x.id === id); if (!m) return;
    openModal(`<h3 id="modalTitle">Delete ${esc(m.name)}?</h3><p>They'll be removed from the office for everyone. You can undo this for a few seconds afterwards.</p>
    <div class="modal-acts"><button class="btn" data-modal-cancel>Cancel</button><button class="btn danger" id="confirmDel">Delete ${esc(m.name)}</button></div>`, (box) => {
      box.querySelector("#confirmDel").onclick = async () => {
        const { id: _i, ...body } = m;
        closeModal();
        if (current === id) closeMember();
        await write([{ op: "delete", path: "members/" + id }], `Deleted ${m.name}`, { undo: () => write([{ op: "set", path: "members/" + id, data: body }], `Restored ${m.name}`) });
      };
    });
  }

  /* ---------- room form ---------- */
  async function newRoom(kind) {
    const [w, h] = KIND_SIZE[kind] || KIND_SIZE.open;
    const spot = freeSpot(w, h);
    const id = uid("room");
    const used = new Set(S.rooms.map((r) => r.color));
    const color = kind === "desks" || kind === "open" || kind === "client" ? ROOM_COLORS.find((c) => !used.has(c)) || ROOM_COLORS[S.rooms.length % ROOM_COLORS.length] : kind === "lounge" ? "#34D399" : "#7A86B8";
    const names = { desks: "New team room", client: "Our client", meeting: "Meeting room", lounge: "Lounge", board: "Ticket board", open: "Open area" };
    const body = { name: names[kind], kind, color, x: spot.x, y: spot.y, w, h, task: "", desc: "" };
    if (kind === "client") body.client = { name: "", tagline: "", logo: "", logoBg: "plate", fields: [], images: [] };
    if (!(await write([{ op: "set", path: "rooms/" + id, data: body }], `Added ${body.name}`))) return;
    if (!editMode) { showView("office"); setEditMode(true); }
    setTimeout(() => roomForm(S.roomById[id], true), 60);
  }
  function roomForm(r, justAdded) {
    if (!r) return;
    const c0 = r.client || {};
    let cLogo = safeImg(c0.logo), cLogoBg = c0.logoBg === "none" ? "none" : "plate";
    let cFields = (c0.fields || []).map((f) => ({ label: f.label || "", value: f.value || "" }));
    let cImages = (c0.images || []).filter((im) => im && safeImg(im.src)).map((im) => ({ src: im.src, caption: im.caption || "" }));
    if (!cFields.length && !c0.name) cFields = [{ label: "Industry", value: "" }, { label: "What we support", value: "" }, { label: "Working with them since", value: "" }, { label: "Main contact", value: "" }];
    openModal(`<h3 id="modalTitle">${justAdded ? "Set up your new room" : "Edit " + esc(r.name)}</h3>
    <form id="roomForm" novalidate><div class="form-grid">
      <div class="field"><label for="r-name">Room name</label><input id="r-name" maxlength="40" value="${esc(r.name)}" autocomplete="off" autofocus><span class="err" id="e-rname"></span></div>
      <div class="field"><label for="r-kind">Type</label><select id="r-kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}"${k === r.kind ? " selected" : ""}>${v}</option>`).join("")}</select>${r.kind === "desks" && (S.inRoom[r.id] || []).length ? `<small>People here move to "Not seated" if this stops being a team room.</small>` : ""}</div>
      <div class="field not-client"><label for="r-task">Sign at the bottom</label><input id="r-task" maxlength="40" value="${esc(r.task)}" placeholder="e.g. Code, review & merge"></div>
      <div class="field not-client"><label for="r-desc">What happens here</label><input id="r-desc" maxlength="90" value="${esc(r.desc)}" placeholder="Shown on profiles"></div>
      <fieldset class="field full client-only cl-editor"><legend>Client details</legend>
        <div class="form-grid">
          <div class="field"><label for="c-cname">Client name</label><input id="c-cname" maxlength="60" value="${esc(c0.name)}" placeholder="e.g. Acme Corporation"></div>
          <div class="field"><label for="c-ctag">Tagline</label><input id="c-ctag" maxlength="90" value="${esc(c0.tagline)}" placeholder="e.g. Global retail, 40 countries"></div>
          <div class="field full"><span class="lbl">Client logo</span><div class="logo-edit"><span class="logo-prev" id="cPrev"></span><div class="logo-acts"><label class="btn" for="c-logo">Upload logo…</label><input id="c-logo" type="file" accept="image/*" hidden><button type="button" class="btn danger" id="c-logo-rm">Remove</button><label class="switch"><input type="checkbox" id="c-plate"${cLogoBg === "plate" ? " checked" : ""}> White background behind the logo</label><span class="err" id="e-clogo"></span></div></div></div>
          <div class="field full"><span class="lbl">Text fields <span class="opt">(up to ${MAX_CLIENT_FIELDS})</span></span><div id="cFields" class="cf-rows"></div><button type="button" class="btn sm" id="cAddField">+ Add a field</button></div>
          <div class="field full"><label for="c-script">Presenter script <span class="opt">(optional: what the audio presenter says about the client)</span></label><textarea id="c-script" rows="3" maxlength="1500" placeholder="Leave blank to read the name, tagline and fields.">${esc(c0.script || "")}</textarea></div>
          <div class="field full"><span class="lbl">Images <span class="opt">(up to ${MAX_CLIENT_IMAGES}: product shots, office, team photos, diagrams)</span></span><div id="cImgs" class="ci-grid"></div><label class="btn sm" for="c-img" id="cAddImgLbl">+ Add images…</label><input id="c-img" type="file" accept="image/*" multiple hidden><span class="err" id="e-cimg"></span></div>
        </div>
      </fieldset>
      <div class="field"><label for="r-w">Width</label><input id="r-w" type="number" min="120" max="2000" step="10" value="${r.w}"></div>
      <div class="field"><label for="r-h">Height</label><input id="r-h" type="number" min="120" max="2000" step="10" value="${r.h}"></div>
      <div class="field full"><span class="lbl" id="swLbl">Colour</span><div class="swatches" role="radiogroup" aria-labelledby="swLbl">${ROOM_COLORS.map((c) => `<button type="button" class="swatch" role="radio" style="--c:${c}" data-sw="${c}" aria-checked="${c === r.color}" aria-label="Colour ${c}"></button>`).join("")}</div></div>
    </div>
    <div class="modal-acts" style="margin-top:14px"><button type="button" class="btn danger left" data-del-room="${esc(r.id)}">Delete room</button><button type="button" class="btn" data-modal-cancel>${justAdded ? "Keep defaults" : "Cancel"}</button><button type="submit" class="btn primary">Save room</button></div></form>`, (box) => {
      let color = r.color;
      const kindSel = box.querySelector("#r-kind");
      const syncKind = () => { const cl = kindSel.value === "client"; box.querySelectorAll(".client-only").forEach((x) => (x.hidden = !cl)); box.querySelectorAll(".not-client").forEach((x) => (x.hidden = cl)); };
      kindSel.addEventListener("change", syncKind); syncKind();
      box.querySelector(".swatches").addEventListener("click", (e) => { const b = e.target.closest("[data-sw]"); if (!b) return; color = b.dataset.sw; box.querySelectorAll("[data-sw]").forEach((x) => x.setAttribute("aria-checked", x.dataset.sw === color)); });
      const drawLogo = () => { const pv = box.querySelector("#cPrev"); pv.className = "logo-prev" + (cLogo && cLogoBg === "plate" ? " plate" : ""); pv.innerHTML = cLogo ? `<img src="${cLogo}" alt="Client logo preview">` : `<span class="hint">No logo</span>`; box.querySelector("#c-logo-rm").disabled = !cLogo; };
      const drawFields = () => {
        box.querySelector("#cFields").innerHTML = cFields.map((f, i) => `<div class="cf-row"><input data-cf-label="${i}" maxlength="40" value="${esc(f.label)}" placeholder="Label" aria-label="Field ${i + 1} label"><input data-cf-value="${i}" maxlength="200" value="${esc(f.value)}" placeholder="Value" aria-label="Field ${i + 1} value"><button type="button" class="icon-btn" data-cf-up="${i}" aria-label="Move field up"${i ? "" : " disabled"}>${ICON.up}</button><button type="button" class="icon-btn danger" data-cf-rm="${i}" aria-label="Remove field">${ICON.x}</button></div>`).join("") || `<p class="empty-note">No fields yet.</p>`;
        box.querySelector("#cAddField").disabled = cFields.length >= MAX_CLIENT_FIELDS;
      };
      const drawImgs = () => {
        box.querySelector("#cImgs").innerHTML = cImages.map((im, i) => `<div class="ci"><img src="${im.src}" alt=""><input data-ci-cap="${i}" maxlength="60" value="${esc(im.caption)}" placeholder="Caption (optional)" aria-label="Caption for image ${i + 1}"><button type="button" class="icon-btn danger" data-ci-rm="${i}" aria-label="Remove image ${i + 1}">${ICON.x}</button></div>`).join("");
        box.querySelector("#cAddImgLbl").hidden = cImages.length >= MAX_CLIENT_IMAGES;
      };
      drawLogo(); drawFields(); drawImgs();
      box.querySelector("#c-logo").addEventListener("change", async (e) => { const f = e.target.files[0]; e.target.value = ""; try { cLogo = await readImage(f, 480); $("e-clogo").textContent = ""; drawLogo(); } catch (err) { $("e-clogo").textContent = err.message; } });
      box.querySelector("#c-logo-rm").addEventListener("click", () => { cLogo = ""; drawLogo(); });
      box.querySelector("#c-plate").addEventListener("change", (e) => { cLogoBg = e.target.checked ? "plate" : "none"; drawLogo(); });
      box.querySelector("#cAddField").addEventListener("click", () => { if (cFields.length < MAX_CLIENT_FIELDS) { cFields.push({ label: "", value: "" }); drawFields(); box.querySelector(`[data-cf-label="${cFields.length - 1}"]`).focus(); } });
      box.querySelector("#c-img").addEventListener("change", async (e) => {
        const files = [...e.target.files].slice(0, MAX_CLIENT_IMAGES - cImages.length); e.target.value = "";
        $("e-cimg").textContent = "";
        for (const f of files) { try { cImages.push({ src: await readImage(f, 720), caption: "" }); } catch (err) { $("e-cimg").textContent = err.message; } }
        drawImgs();
      });
      box.addEventListener("input", (e) => {
        const t = e.target;
        if (t.dataset.cfLabel !== undefined) cFields[+t.dataset.cfLabel].label = t.value;
        if (t.dataset.cfValue !== undefined) cFields[+t.dataset.cfValue].value = t.value;
        if (t.dataset.ciCap !== undefined) cImages[+t.dataset.ciCap].caption = t.value;
      });
      box.addEventListener("click", (e) => {
        const t = e.target;
        let b;
        if ((b = t.closest("[data-cf-rm]"))) { cFields.splice(+b.dataset.cfRm, 1); drawFields(); }
        else if ((b = t.closest("[data-cf-up]"))) { const i = +b.dataset.cfUp; [cFields[i - 1], cFields[i]] = [cFields[i], cFields[i - 1]]; drawFields(); }
        else if ((b = t.closest("[data-ci-rm]"))) { cImages.splice(+b.dataset.ciRm, 1); drawImgs(); }
      });
      box.querySelector("#roomForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = clean($("r-name").value, 40);
        $("e-rname").textContent = name ? "" : "Enter a room name.";
        if (!name) { $("r-name").focus(); return; }
        const kind = KINDS[kindSel.value] ? kindSel.value : "open";
        const w = clamp(snap(+$("r-w").value || r.w), 120, 2000), h = clamp(snap(+$("r-h").value || r.h), 120, 2000);
        const body = { name, kind, color, w, h, task: clean($("r-task").value, 40), desc: clean($("r-desc").value, 90), x: clamp(r.x, 0, Math.max(0, S.floorW - w)), y: r.y };
        if (kind === "client") body.client = {
          name: clean($("c-cname").value, 60), tagline: clean($("c-ctag").value, 90), logo: cLogo, logoBg: cLogoBg,
          fields: cFields.map((f) => ({ label: clean(f.label, 40), value: clean(f.value, 200) })).filter((f) => f.label || f.value),
          images: cImages.map((im) => ({ src: im.src, caption: clean(im.caption, 60) })), script: clean($("c-script").value, 1500),
        };
        const ops = [{ op: "update", path: "rooms/" + r.id, data: body }];
        if (r.kind === "desks" && kind !== "desks") for (const m of S.inRoom[r.id] || []) ops.push({ op: "update", path: "members/" + m.id, data: { roomId: "" } });
        const btn = box.querySelector("[type=submit]"); btn.disabled = true;
        const ok = await write(ops, `Saved ${name}`);
        btn.disabled = false;
        if (ok) { closeModal(); if (currentRoom === r.id) setTimeout(() => openRoom(r.id), 30); }
      });
    });
  }
  function confirmDeleteRoom(id) {
    const r = S.roomById[id]; if (!r) return;
    const ppl = S.inRoom[id] || [], others = S.deskRooms.filter((x) => x.id !== id);
    openModal(`<h3 id="modalTitle">Delete ${esc(r.name)}?</h3>
    ${ppl.length ? `<p>${ppl.length} ${ppl.length === 1 ? "person sits" : "people sit"} here: ${esc(ppl.map((m) => m.name).join(", "))}.</p><div class="field"><label for="moveTo">Move them to</label><select id="moveTo">${others.map((o) => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join("")}<option value="">Not seated (keep them in the team)</option></select></div>` : `<p>The room will be removed from the floor plan.</p>`}
    <div class="modal-acts"><button class="btn" data-modal-cancel>Cancel</button><button class="btn danger" id="confirmDelRoom">Delete room</button></div>`, (box) => {
      box.querySelector("#confirmDelRoom").onclick = async () => {
        const to = box.querySelector("#moveTo")?.value || "";
        const ops = [{ op: "delete", path: "rooms/" + id }];
        if (ppl.length) {
          const start = to ? (S.inRoom[to] || []).length : 0;
          ppl.forEach((m, i) => ops.push({ op: "update", path: "members/" + m.id, data: { roomId: to, seat: start + i } }));
          if (to) { const tr = S.roomById[to], g = deskGrid(tr, start + ppl.length); if (start + ppl.length > g.cap) ops.push({ op: "update", path: "rooms/" + to, data: { h: g.neededH(start + ppl.length) } }); }
        }
        if (await write(ops, `Deleted ${r.name}`)) closeModal();
      };
    });
  }

  /* ---------- role form ---------- */
  function roleForm(r) {
    const isNew = !r;
    const used = new Set(S.roles.map((x) => x.color));
    const d = r || { name: "", color: ROOM_COLORS.find((c) => !used.has(c)) || ROOM_COLORS[0] };
    openModal(`<h3 id="modalTitle">${isNew ? "Add a role" : "Edit " + esc(d.name)}</h3><p>A role is a job title, like Developer or Designer.</p>
    <form id="roleForm" novalidate><div class="form-grid">
      <div class="field full"><label for="ro-name">Role name</label><input id="ro-name" maxlength="40" value="${esc(d.name)}" placeholder="e.g. DevOps Engineer" autocomplete="off" autofocus><span class="err" id="e-roname"></span></div>
      <div class="field full"><label for="ro-group">Team mix category <span class="opt">(optional)</span></label><input id="ro-group" maxlength="30" value="${esc(d.group || "")}" list="groupList" placeholder="e.g. Managers, Developers, QA" autocomplete="off"><datalist id="groupList">${[...new Set(S.roles.map((x) => x.group).filter(Boolean))].map((g) => `<option value="${esc(g)}">`).join("")}</datalist><small>Roles with the same category are counted together in Team mix.</small></div>
      <div class="field full"><span class="lbl" id="rswLbl">Colour</span><div class="swatches" role="radiogroup" aria-labelledby="rswLbl">${ROOM_COLORS.map((c) => `<button type="button" class="swatch" role="radio" style="--c:${c}" data-sw="${c}" aria-checked="${c === d.color}" aria-label="Colour ${c}"></button>`).join("")}</div></div>
    </div>
    <div class="modal-acts" style="margin-top:14px">${!isNew ? `<button type="button" class="btn danger left" data-del-role="${esc(r.id)}">Delete role</button>` : ""}<button type="button" class="btn" data-modal-cancel>Cancel</button><button type="submit" class="btn primary">${isNew ? "Add role" : "Save role"}</button></div></form>`, (box) => {
      let color = d.color;
      box.querySelector(".swatches").addEventListener("click", (e) => { const b = e.target.closest("[data-sw]"); if (!b) return; color = b.dataset.sw; box.querySelectorAll("[data-sw]").forEach((x) => x.setAttribute("aria-checked", x.dataset.sw === color)); });
      box.querySelector("#roleForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = clean($("ro-name").value, 40);
        $("e-roname").textContent = name ? "" : "Enter a role name.";
        if (!name) return;
        if (await write([{ op: "set", path: "roles/" + (r ? r.id : uid("r")), data: { name, color, group: clean($("ro-group").value, 30) } }], isNew ? `Added the ${name} role` : `Saved ${name}`)) closeModal();
      });
    });
  }
  function confirmDeleteRole(id) {
    const r = S.roleById[id]; if (!r) return;
    const ppl = S.members.filter((m) => m.roleId === id), others = S.roles.filter((x) => x.id !== id);
    openModal(`<h3 id="modalTitle">Delete the ${esc(r.name)} role?</h3>
    ${ppl.length ? `<p>${ppl.length} ${ppl.length === 1 ? "person has" : "people have"} this role.</p><div class="field"><label for="roleTo">Give them this role instead</label><select id="roleTo">${others.map((o) => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join("")}<option value="">No role</option></select></div>` : "<p>No one has this role.</p>"}
    <div class="modal-acts"><button class="btn" data-modal-cancel>Cancel</button><button class="btn danger" id="confirmDelRole">Delete role</button></div>`, (box) => {
      box.querySelector("#confirmDelRole").onclick = async () => {
        const to = box.querySelector("#roleTo")?.value || "";
        if (await write([{ op: "delete", path: "roles/" + id }, ...ppl.map((m) => ({ op: "update", path: "members/" + m.id, data: { roleId: to } }))], `Deleted the ${r.name} role`)) closeModal();
      };
    });
  }

  /* ---------- decor ---------- */
  function addDecor(type) {
    const def = A.DECOR[type];
    let spot = null;
    for (let y = minY(); y < worldH + 200 && !spot; y += 10) for (let x = 10; x + def.w <= S.floorW - 10; x += 10) {
      const box = { x, y, w: def.w, h: def.h };
      if (!S.rooms.some((o) => overlaps(box, o, 6)) && !S.decor.some((o) => overlaps(box, { x: o.x, y: o.y, w: A.DECOR[o.type].w, h: A.DECOR[o.type].h }, 4))) { spot = { x, y }; break; }
    }
    spot = spot || { x: 20, y: worldH };
    write([{ op: "set", path: "decor/" + uid("d"), data: { type, x: spot.x, y: spot.y, color: "" } }], `Added a ${def.label.toLowerCase()}. Drag it where you like.`);
  }
  function decorForm(id) {
    const d = S.decor.find((x) => x.id === id); if (!d) return;
    const def = A.DECOR[d.type];
    openModal(`<h3 id="modalTitle">${esc(def.label)}</h3><div class="decor-prev" id="dPrev">${A.decorSVG(d.type, d.color)}</div>
    <form id="decorForm" novalidate>${def.def ? `<div class="field"><label for="d-color">Colour</label><input id="d-color" type="color" value="${HEX.test(d.color) ? d.color : def.def}"></div>` : `<p>This one has fixed colours. Drag it on the floor plan to move it.</p>`}
    <div class="modal-acts" style="margin-top:14px"><button type="button" class="btn danger left" id="delDecor">Remove</button><button type="button" class="btn" data-modal-cancel>Cancel</button>${def.def ? `<button class="btn primary" type="submit">Save</button>` : ""}</div></form>`, (box) => {
      box.querySelector("#d-color")?.addEventListener("input", (e) => { box.querySelector("#dPrev").innerHTML = A.decorSVG(d.type, e.target.value); });
      box.querySelector("#decorForm").addEventListener("submit", async (e) => { e.preventDefault(); if (await write([{ op: "update", path: "decor/" + id, data: { color: $("d-color").value } }])) closeModal(); });
      box.querySelector("#delDecor").onclick = async () => { const { id: _i, ...body } = d; closeModal(); await write([{ op: "delete", path: "decor/" + id }], `Removed the ${def.label.toLowerCase()}`, { undo: () => write([{ op: "set", path: "decor/" + id, data: body }]) }); };
    });
  }

  /* ---------- drag and drop (edit mode) ---------- */
  let suppressClick = 0;
  const worldPoint = (e) => { const rc = vp.getBoundingClientRect(), { s, ox, oy } = overview(); return { x: (e.clientX - rc.left - ox) / s, y: (e.clientY - rc.top - oy) / s }; };
  wEl.addEventListener("pointerdown", (e) => {
    if (!editMode || !canEdit() || e.button !== 0) return;
    const t = e.target;
    let kind = null, id = null, el = null;
    if ((el = t.closest("[data-resize]"))) { kind = "resize"; id = el.dataset.resize; el = el.closest(".rm"); }
    else if ((el = t.closest(".desk[data-mid]"))) { kind = "desk"; id = el.dataset.mid; }
    else if ((el = t.closest(".decor[data-did]"))) { kind = "decor"; id = el.dataset.did; }
    else if (t.closest(".rm-hd") && !t.closest("button")) { el = t.closest(".rm"); kind = "room"; id = el.dataset.rid; }
    if (!kind) return;
    const p = worldPoint(e);
    drag = { kind, id, el, start: p, moved: false, pointerId: e.pointerId };
    if (kind === "room" || kind === "resize") { const r = S.roomById[id]; drag.orig = { x: r.x, y: r.y, w: r.w, h: r.h }; }
    if (kind === "decor") { const d = S.decor.find((x) => x.id === id); drag.orig = { x: d.x, y: d.y }; }
    if (kind === "desk") { const rc = el.getBoundingClientRect(), { s } = overview(); drag.off = { x: (e.clientX - rc.left) / s, y: (e.clientY - rc.top) / s }; }
    e.preventDefault();
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const p = worldPoint(e), dx = p.x - drag.start.x, dy = p.y - drag.start.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    if (!drag.moved) {
      drag.moved = true;
      wEl.classList.add("no-anim");
      if (drag.kind === "room") drag.el.classList.add("dragging");
      if (drag.kind === "desk") {
        drag.float = drag.el.cloneNode(true);
        drag.float.classList.add("floating"); drag.float.removeAttribute("data-mid");
        wEl.append(drag.float); drag.el.classList.add("ghosted");
      }
    }
    if (drag.kind === "room") {
      const o = drag.orig;
      drag.x = clamp(snap(o.x + dx), 0, Math.max(0, S.floorW - o.w)); drag.y = Math.max(minY(), snap(o.y + dy));
      drag.el.style.left = drag.x + "px"; drag.el.style.top = drag.y + "px";
    } else if (drag.kind === "resize") {
      const o = drag.orig;
      drag.w = clamp(snap(o.w + dx), 140, S.floorW - o.x); drag.h = clamp(snap(o.h + dy), 140, 3000);
      drag.el.style.width = drag.w + "px"; drag.el.style.height = drag.h + "px";
    } else if (drag.kind === "decor") {
      const def = A.DECOR[S.decor.find((x) => x.id === drag.id).type];
      drag.x = clamp(Math.round(drag.orig.x + dx), 0, S.floorW - def.w); drag.y = Math.max(0, Math.round(drag.orig.y + dy));
      drag.el.style.left = drag.x + "px"; drag.el.style.top = drag.y + "px";
    } else if (drag.kind === "desk") {
      drag.float.style.left = (p.x - drag.off.x) + "px"; drag.float.style.top = (p.y - drag.off.y) + "px";
      const target = S.deskRooms.find((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
      wEl.querySelectorAll(".rm.drop-target").forEach((x) => x.classList.remove("drop-target"));
      if (target) wEl.querySelector(`.rm[data-rid="${CSS.escape(target.id)}"]`)?.classList.add("drop-target");
      drag.target = target; drag.point = p;
    }
  });
  window.addEventListener("pointerup", async (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag; drag = null;
    wEl.classList.remove("no-anim");
    if (!d.moved) return; // a plain click: the click handler opens the right form
    suppressClick = Date.now();
    if (d.kind === "room" && (d.x !== d.orig.x || d.y !== d.orig.y)) await write([{ op: "update", path: "rooms/" + d.id, data: { x: d.x, y: d.y } }]);
    else if (d.kind === "resize" && (d.w !== d.orig.w || d.h !== d.orig.h)) await write([{ op: "update", path: "rooms/" + d.id, data: { w: d.w, h: d.h } }]);
    else if (d.kind === "decor") await write([{ op: "update", path: "decor/" + d.id, data: { x: d.x, y: d.y } }]);
    else if (d.kind === "desk" && d.target) await dropDesk(d.id, d.target, d.point);
    renderAll();
  });
  async function dropDesk(memberId, target, p) {
    const m = S.members.find((x) => x.id === memberId); if (!m) return;
    const from = m.roomId;
    const dest = (S.inRoom[target.id] || []).filter((x) => x.id !== memberId);
    const g = deskGrid(target, dest.length + 1);
    const lx = p.x - target.x - g.x0, ly = p.y - target.y - GRID_TOP;
    const col = clamp(Math.floor(lx / g.cw), 0, g.cols - 1), row = Math.max(0, Math.floor(ly / g.ch));
    const idx = clamp(row * g.cols + col, 0, dest.length);
    dest.splice(idx, 0, m);
    const ops = [];
    dest.forEach((x, i) => { if (x.seat !== i || x.roomId !== target.id) ops.push({ op: "update", path: "members/" + x.id, data: { roomId: target.id, seat: i } }); });
    if (from !== target.id && S.inRoom[from]) S.inRoom[from].filter((x) => x.id !== memberId).forEach((x, i) => { if (x.seat !== i) ops.push({ op: "update", path: "members/" + x.id, data: { seat: i } }); });
    if (dest.length > g.cap) ops.push({ op: "update", path: "rooms/" + target.id, data: { h: g.neededH(dest.length) } });
    if (ops.length) await write(ops, from !== target.id ? `Moved ${m.name} to ${target.name}` : "");
  }

  /* ---------- edit mode ---------- */
  function setEditMode(on) {
    editMode = !!on && canEdit();
    if (editMode && (current !== null || currentRoom !== null)) { current = null; currentRoom = null; vp.classList.remove("open", "zoomed"); }
    $("editMode").setAttribute("aria-pressed", editMode);
    $("editMode").querySelector("span").textContent = editMode ? "Done editing" : "Edit office";
    $("editBar").hidden = !editMode;
    if (editMode) $("floorW").value = String([1000, 1300, 1600].reduce((a, b) => Math.abs(b - S.floorW) < Math.abs(a - S.floorW) ? b : a));
    renderWorld(); renderSelected(); applyCamera();
  }
  $("decorPal").innerHTML = Object.entries(A.DECOR).map(([k, v]) => `<button class="decor-btn" data-new-decor="${k}" title="${esc(v.label)}" aria-label="Add ${esc(v.label)}">${A.decorSVG(k)}</button>`).join("");
  $("floorW").addEventListener("change", (e) => setSetting({ floorW: +e.target.value }, "Floor width changed"));
  $("editMode").addEventListener("click", () => { if (!editMode) showView("office"); setEditMode(!editMode); });
  $("unlockBtn").addEventListener("click", unlockForm);
  $("brandEdit").addEventListener("click", brandForm);

  /* ---------- clicks ---------- */
  document.addEventListener("click", (e) => {
    if (modalOpen() && !e.target.closest(".modal")) return;
    if (Date.now() - suppressClick < 60 && e.target.closest("#world")) { e.stopPropagation(); return; }
    const t = e.target, g = (sel) => t.closest(sel);
    let el;
    if ((el = g("[data-unlock]"))) return unlockForm();
    if ((el = g("[data-brand]"))) { if (canEdit()) brandForm(); return; }
    if ((el = g("[data-view-img]"))) return viewImage(+el.dataset.viewImg);
    if ((el = g("[data-edit-member]"))) { const m = S.members.find((x) => x.id === el.dataset.editMember); if (m) memberForm(m); return; }
    if ((el = g("[data-del-member]"))) return confirmDeleteMember(el.dataset.delMember);
    if ((el = g("[data-add-member]"))) { if (!canEdit()) return; return memberForm(null, el.dataset.addMember || ""); }
    if ((el = g("[data-new-room]"))) { if (!canEdit()) return; return newRoom(el.dataset.newRoom); }
    if ((el = g("[data-edit-room]"))) return roomForm(S.roomById[el.dataset.editRoom]);
    if ((el = g("[data-del-room]"))) return confirmDeleteRoom(el.dataset.delRoom);
    if ((el = g("[data-add-role]"))) return roleForm(null);
    if ((el = g("[data-edit-role]"))) { const r = S.roleById[el.dataset.editRole]; if (r) roleForm(r); return; }
    if ((el = g("[data-del-role]"))) return confirmDeleteRole(el.dataset.delRole);
    if ((el = g("[data-flow-move]"))) return moveFlow(el.dataset.flowMove, -1);
    if ((el = g("[data-flow-down]"))) return moveFlow(el.dataset.flowDown, 1);
    if ((el = g("[data-flow-remove]"))) return removeFlow(el.dataset.flowRemove);
    if ((el = g("[data-new-decor]"))) return addDecor(el.dataset.newDecor);
    if (modalOpen()) return;
    if (editMode) {
      if ((el = g(".desk[data-mid]"))) { const m = S.members.find((x) => x.id === el.dataset.mid); if (m) memberForm(m); return; }
      if ((el = g(".decor[data-did]"))) return decorForm(el.dataset.did);
      if ((el = g(".rm-hd"))) return roomForm(S.roomById[el.closest(".rm").dataset.rid]);
      return;
    }
    if ((el = g(".desk[data-mid]"))) return openMember(el.dataset.mid);
    if ((el = g("[data-open-room]"))) return openRoom(el.dataset.openRoom);
    if ((el = g(".rm")) && S.roomById[el.dataset.rid]?.kind === "client" && current === null && currentRoom === null) return openRoom(el.dataset.rid);
    if ((el = g("[data-open]"))) return openMember(el.dataset.open);
    if ((el = g("[data-step]"))) return step(+el.dataset.step);
    if ((el = g("[data-listen]"))) return listen(el.dataset.listen, el.dataset.id);
    if (g("[data-close]") || t === $("dim")) closeMember();
  });
  document.addEventListener("keydown", (e) => {
    if (modalOpen()) return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) return;
    if (P.on && e.key === "Escape") { stopPresenting(); closeMember(); return; }
    if (P.on && !P.single && (e.key === "ArrowRight" || e.key === "ArrowLeft")) { presStep(e.key === "ArrowRight" ? 1 : -1); return; }
    if (P.on && e.key === " ") { e.preventDefault(); togglePause(); return; }
    if (e.key === "Escape" && editMode) { setEditMode(false); return; }
    if (currentRoom !== null) { if (e.key === "Escape") closeMember(); return; }
    if (current === null) return;
    if (e.key === "Escape") closeMember();
    if (e.key === "ArrowRight") step(1);
    if (e.key === "ArrowLeft") step(-1);
  });


  /* ---------- audio presenter ----------
     Uses the browser's built-in voices (Web Speech API): no account, no cloud service.
     Each person, the client room and the intro/closing can have a hand-written script; without one, a script is written from the profile. */
  let voices = [];
  const VOICE_RANK = [/natural/i, /neural/i, /premium|enhanced/i, /online/i, /google us english/i, /google uk english/i, /samantha|aria|jenny|guy|ava|allison|karen|daniel|moira/i];
  function loadVoices() {
    if (!TTS) return;
    const rank = (v) => { const i = VOICE_RANK.findIndex((re) => re.test(v.name)); return (i < 0 ? 50 : i) + (/en[-_]US/i.test(v.lang) ? 0 : 0.5); };
    voices = TTS.getVoices().filter((v) => /^en/i.test(v.lang)).sort((a, b) => rank(a) - rank(b));
    renderPresenterBar();
  }
  if (TTS) { loadVoices(); TTS.onvoiceschanged = loadVoices; }
  const pickVoice = () => voices.find((v) => v.name === pref("vo-voice", "")) || voices[0] || null;

  const US_STATES = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "D.C." };
  /* Tidy text so it sounds natural when read aloud. */
  const speechText = (t) => String(t || "").replace(/\s+·\s+/g, ", ").replace(/\s*\/\s*/g, " and ").replace(/&/g, " and ").replace(/,\s*([A-Z]{2})\b(?![a-z])/g, (x, st) => US_STATES[st] ? ", " + US_STATES[st] : x).replace(/\s+/g, " ").trim();
  function sentences(t) {
    const raw = String(t || "").replace(/\s+/g, " ").trim().split(/(?<=[.!?]["'”’)\]]?)\s+(?=["'“(]?[A-Z0-9])/);
    const out = [];
    for (const x of raw) { if (out.length && /(\b[A-Z]\.|\b(?:Mr|Mrs|Ms|Dr|St|vs|No)\.)$/.test(out[out.length - 1])) out[out.length - 1] += " " + x; else if (x) out.push(x); }
    return out;
  }
  const listJoin = (a) => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  const firstOf = (m) => String(m.name || "").trim().split(/\s+/)[0] || "they";
  const placeOf = (m) => { const c = String(m.city || "").trim(), k = String(m.country || "").trim(); if (!c) return k; if (/united states|usa|^us$/i.test(k) || c.includes(k)) return c; return c + ", " + k; };
  const noNum = (x) => String(x).replace(/^\s*(\d+[.)]|[-•*])\s*/, "");
  const withA = (s) => /^(a|an|the|some|my|his|her|their)\b/i.test(s) ? s : (/^[aeiou]/i.test(s) ? "an " : "a ") + s;
  function autoMemberScript(m) {
    const first = firstOf(m), role = S.roleById[m.roleId]?.name || "", place = placeOf(m);
    const pick = [...String(m.id || m.name)].reduce((a, c) => a + c.charCodeAt(0), 0) % 3;
    const out = [[
      `Meet ${m.name}${role ? `, our ${role}` : ""}${place ? `, joining us from ${place}` : ""}.`,
      `Say hello to ${m.name}!${role || place ? ` ${first} is ${role ? `our ${role}` : "here"}${place ? `, based in ${place}` : ""}.` : ""}`,
      `This is ${m.name}${role ? `, our ${role}` : ""}${place ? `, calling in from ${place}` : ""}.`,
    ][pick]];
    if (m.tz && validTz(m.tz)) out.push(`It's ${fmtTime(m.tz)} there right now.`);
    const about = sentences(m.about)[0];
    if (about) out.push(`In ${first}'s words: ${about}`);
    factsOf(m).slice(0, 2).forEach((f, i) => out.push(`${i ? "And another one:" : `Here's a fun fact, straight from ${first}:`} ${noNum(f)}`));
    const items = (m.items || []).filter((it) => A.ITEMS[it.type]).map((it) => withA(A.ITEMS[it.type].label.replace(/\s*\(.*?\)/g, "").toLowerCase()));
    if (items.length) out.push(`On ${first}'s desk, you'll find ${listJoin(items)}.`);
    return out.join(" ");
  }
  const memberScript = (m) => (m.script && m.script.trim()) || autoMemberScript(m);
  function roomScript(r) {
    const c = r.client || {};
    if (c.script && c.script.trim()) return c.script;
    const out = [c.name ? `Our client is ${c.name}${c.tagline ? `: ${c.tagline}` : ""}.` : `This is ${r.name}.`];
    (c.fields || []).filter((f) => f.label && f.value).slice(0, 6).forEach((f) => out.push(`${f.label}: ${f.value}.`));
    return out.join(" ");
  }
  function introScript() {
    const st = S.settings;
    if (st.introScript && st.introScript.trim()) return st.introScript;
    const n = S.people.length, countries = [...new Set(S.people.map((m) => m.country).filter(Boolean))];
    const name = st.teamName || "our team", the = /^the\s/i.test(name) ? "" : "the ";
    const client = S.rooms.some((r) => r.kind === "client");
    const theC = (c) => /^(united\s|philippines|netherlands|bahamas|maldives|czech republic|dominican republic|uae$|uk$|us$|usa$)/i.test(c) ? "the " + c : c;
    return `Welcome to ${the}${name} virtual office! ${n ? `We're a team of ${n}${countries.length ? `, spread across ${listJoin(countries.map(theC))}` : ""}.` : ""} ${client ? "Let's start with who we work for, and then meet everyone." : "Let's meet everyone."}`;
  }
  const outroScript = () => (S.settings.outroScript && S.settings.outroScript.trim()) || `And that's the team! Click on anyone in the office to see their full profile. Thanks for listening.`;

  function speakFrom(k) {
    const tok = ++P.token;
    P.k = k;
    const next = () => {
      if (tok !== P.token || P.paused) return;
      if (P.k >= P.parts.length) { caption(""); const d = P.done; P.done = null; d && d(); return; }
      const u = new SpeechSynthesisUtterance(P.parts[P.k]);
      const v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = +pref("vo-rate", "1") || 1;
      caption(P.parts[P.k]);
      P.k++;
      u.onend = () => setTimeout(next, 180);
      u.onerror = (e) => { if (e.error !== "interrupted" && e.error !== "canceled") setTimeout(next, 60); };
      TTS.speak(u);
    };
    TTS.cancel();
    setTimeout(next, 80);
  }
  function say(text, done) { P.parts = sentences(speechText(text)); P.done = done; P.paused = false; speakFrom(0); }
  function caption(t) { const el = $("prCap"); if (el) el.textContent = t; }

  function tourSteps() {
    const st = [{ t: "intro" }];
    const client = S.rooms.filter((r) => r.kind === "client").sort((a, b) => a.y - b.y || a.x - b.x)[0];
    if (client) st.push({ t: "room", id: client.id });
    S.people.forEach((m) => st.push({ t: "member", id: m.id }));
    st.push({ t: "outro" });
    return st;
  }
  function stepText(s) {
    if (s.t === "intro") return introScript();
    if (s.t === "outro") return outroScript();
    if (s.t === "room") return S.roomById[s.id] ? roomScript(S.roomById[s.id]) : "";
    const m = S.members.find((x) => x.id === s.id); if (!m) return "";
    const lastMember = !P.single && P.steps.filter((x) => x.t === "member").length > 1 && P.steps.slice(P.i + 1).every((x) => x.t !== "member");
    return (lastMember ? "And finally. " : "") + memberScript(m);
  }
  function runStep() {
    const s = P.steps[P.i];
    if (!s) { stopPresenting(); return; }
    P.driving = true;
    let wait = 900;
    if (s.t === "member") { if (current !== s.id) openMember(s.id); else wait = 150; }
    else if (s.t === "room") { if (currentRoom !== s.id) openRoom(s.id); else wait = 150; }
    else { if (current !== null || currentRoom !== null) closeMember(); else wait = 250; }
    P.driving = false;
    renderPresenterBar();
    const tok = ++P.token;
    setTimeout(() => { if (tok !== P.token || !P.on) return; say(stepText(s), () => { if (!P.on) return; if (P.single) { stopPresenting(); return; } P.i++; setTimeout(() => P.on && runStep(), 700); }); }, wait);
  }
  function startPresenting(steps, single) {
    if (!TTS) { toast("This browser can't read aloud. Try Chrome, Edge or Safari.", { err: true }); return; }
    if (editMode) setEditMode(false);
    showView("office");
    Object.assign(P, { on: true, single: !!single, paused: false, steps, i: 0 });
    renderPresenterBar();
    runStep();
  }
  function stopPresenting() {
    if (!P.on) return;
    P.on = false; P.paused = false; P.token++; P.done = null;
    TTS && TTS.cancel();
    caption("");
    renderPresenterBar();
  }
  function togglePause() {
    if (!P.on) return;
    if (P.paused) { P.paused = false; speakFrom(Math.max(0, P.k - 1)); }
    else { P.paused = true; P.token++; TTS.cancel(); }
    renderPresenterBar();
  }
  function presStep(dir) {
    if (!P.on) return;
    P.i = clamp(P.i + dir, 0, P.steps.length - 1);
    P.paused = false; TTS.cancel();
    runStep();
  }
  function listen(kind, id) {
    if (P.on && P.single && P.steps[0]?.id === id) { stopPresenting(); return; }
    startPresenting([{ t: kind === "room" ? "room" : "member", id }], true);
  }
  function listenBtn(kind, id) {
    if (!TTS) return "";
    const on = P.on && P.single && P.steps[0]?.id === id;
    return `<button class="mini listen${on ? " on" : ""}" data-listen="${kind}" data-id="${esc(id)}" aria-pressed="${on}">${on ? "■ Stop" : "▶ Listen"}</button>`;
  }
  function renderPresenterBar() {
    const bar = $("presenter"); if (!bar) return;
    $("presentBtn").hidden = !TTS;
    if (!$("presentBtn").hidden) $("presentBtn").querySelector("span").textContent = P.on && !P.single ? "Stop presenting" : "Present the team";
    $("presentBtn").setAttribute("aria-pressed", P.on && !P.single);
    mon.querySelectorAll("[data-listen]").forEach((b) => { const on = P.on && P.single && P.steps[0]?.id === b.dataset.id; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); b.textContent = on ? "■ Stop" : "▶ Listen"; });
    bar.hidden = !P.on;
    document.body.classList.toggle("presenting", P.on);
    if (!P.on) return;
    const s = P.steps[P.i] || {}, m = s.t === "member" && S.members.find((x) => x.id === s.id);
    const what = s.t === "intro" ? "Welcome" : s.t === "outro" ? "Wrapping up" : s.t === "room" ? (S.roomById[s.id]?.client?.name || S.roomById[s.id]?.name || "Client") : m ? m.name : "";
    $("prPos").innerHTML = `<b>${esc(what)}</b>${P.single ? "" : ` <span>${P.i + 1} of ${P.steps.length}</span>`}`;
    $("prPrev").hidden = $("prNext").hidden = P.single;
    $("prPrev").disabled = P.i === 0; $("prNext").disabled = P.i >= P.steps.length - 1;
    $("prPause").textContent = P.paused ? "▶ Resume" : "❚❚ Pause";
    const sel = $("prVoice"), cur = pickVoice();
    sel.innerHTML = voices.length ? voices.map((v) => `<option value="${esc(v.name)}"${cur && v.name === cur.name ? " selected" : ""}>${esc(v.name.replace(/^Microsoft\s+|\s*-\s*English.*$/g, ""))} (${esc(v.lang)})</option>`).join("") : `<option>Default voice</option>`;
    $("prRate").value = pref("vo-rate", "1");
  }
  $("presentBtn").addEventListener("click", () => { if (P.on && !P.single) { stopPresenting(); closeMember(); } else startPresenting(tourSteps(), false); });
  $("prPrev").addEventListener("click", () => presStep(-1));
  $("prNext").addEventListener("click", () => presStep(1));
  $("prPause").addEventListener("click", togglePause);
  $("prStop").addEventListener("click", () => { stopPresenting(); closeMember(); });
  $("prVoice").addEventListener("change", (e) => { setPref("vo-voice", e.target.value); if (P.on && !P.paused) speakFrom(Math.max(0, P.k - 1)); });
  $("prRate").addEventListener("change", (e) => { setPref("vo-rate", e.target.value); if (P.on && !P.paused) speakFrom(Math.max(0, P.k - 1)); });
  renderPresenterBar();

  /* ---------- views ---------- */
  const VIEWS = ["office", "tz", "wrap", "manage"];
  function showView(v) {
    view = v;
    document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", t.dataset.view === v));
    VIEWS.forEach((k) => ($("view-" + k).hidden = k !== v));
    if (v !== "office") { if (current !== null || currentRoom !== null) closeMember(); if (editMode) setEditMode(false); }
    if (v === "office") requestAnimationFrame(applyCamera);
    if (v === "tz") renderTZ();
    try { localStorage.setItem(viewKey, v); } catch (_) {}
  }
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => showView(t.dataset.view)));

  /* ---------- render all ---------- */
  let pending = false;
  function renderAll() {
    if (drag) { pending = true; return; }
    pending = false;
    derive();
    if (current !== null && !S.members.some((m) => m.id === current)) { current = null; vp.classList.remove("open", "zoomed"); }
    if (currentRoom !== null && S.roomById[currentRoom]?.kind !== "client") { currentRoom = null; vp.classList.remove("open", "zoomed"); }
    if (editMode && !canEdit()) editMode = false;
    $("editMode").hidden = !canEdit();
    $("editBar").hidden = !editMode;
    $("unlockBtn").hidden = canEdit() || store.mode !== "server";
    $("roBadge").hidden = canEdit();
    renderHeader(); renderWorld(); renderSide(); renderWrap();
    if (!modalOpen() || !$("view-manage").hidden) { const a = document.activeElement, id = a?.id; renderManage(); if (id && $(id) && $("view-manage").contains($(id))) $(id).focus(); }
    if (view === "tz") renderTZ();
    if (current !== null) { const m = S.members.find((x) => x.id === current); mon.style.setProperty("--c", roomOf(m)?.color || "#22D3EE"); mon.innerHTML = profileHTML(m); }
    if (currentRoom !== null) { const r = S.roomById[currentRoom]; mon.style.setProperty("--c", r.color); mon.innerHTML = clientHTML(r); }
    renderSelected();
    applyCamera();
  }
  store.subscribe(renderAll);

  /* ---------- clocks ---------- */
  function tick() {
    if (!S.settings) return;
    const now = new Date();
    renderLocations();
    const { tz } = standupParts(), su = nextStandup(now), diff = su - now;
    const here = HERE_TZ !== tz && fmtTime(HERE_TZ, su) !== fmtTime(tz, su) ? ` · ${fmtTime(HERE_TZ, su)} your time` : "";
    $("standup").innerHTML = `${fmtTime(tz, su)} <span>${esc(tzLabel(tz))}</span>`;
    const txt = diff <= 0 ? "live now" : `in ${Math.floor(diff / 3600000)}h ${String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0")}m`;
    $("countdown").textContent = `Starts ${txt}${here}`;
    document.querySelectorAll('[data-huddle="1"]').forEach((el) => (el.textContent = `Stand-up ${txt}`));
    document.querySelectorAll("[data-clock]").forEach((el) => (el.textContent = fmtTime(el.dataset.clock, now)));
  }
  setInterval(tick, 20000);

  /* ---------- start ---------- */
  renderAll();
  let start = "office";
  try { start = localStorage.getItem(viewKey) || "office"; } catch (_) {}
  if (VIEWS.includes(location.hash.slice(1))) start = location.hash.slice(1);
  showView(VIEWS.includes(start) ? start : "office");
}

})();
