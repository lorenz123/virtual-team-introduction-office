// Virtual Office — local server. No dependencies, no internet needed.
//
//   node server.js            → http://localhost:3000 (this computer only)
//   node server.js --share    → also reachable by others on the same network
//   PORT=8080 node server.js  → use a different port
//
// Each team's office is saved as data/teams/<team>.json.
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { TEMPLATES, migrateV1 } = require("./public/templates.js");

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const TEAMS = path.join(ROOT, "data", "teams");
const TRASH = path.join(ROOT, "data", "trash");
const PORT = Number(process.env.PORT) || 3000;
const SHARE = process.argv.includes("--share");
const HOST = SHARE ? "0.0.0.0" : "127.0.0.1";
const MAX_BODY = 16 * 1024 * 1024; // logos and client images are stored inside the team file
const MAX_DOC = 1536 * 1024;
const COLLECTIONS = new Set(["settings", "roles", "rooms", "members", "decor"]);
const ID = /^[A-Za-z0-9_\-.~:@+]{1,80}$/;
const SLUG = /^[a-z0-9-]{1,60}$/;
const STATIC = { "index.html": "text/html", "app.js": "text/javascript", "app.css": "text/css", "art.js": "text/javascript", "templates.js": "text/javascript" };

fs.mkdirSync(TEAMS, { recursive: true });
fs.mkdirSync(TRASH, { recursive: true });

/* ---------- storage ---------- */
const cache = new Map(); // slug → team record
const fileOf = (slug) => path.join(TEAMS, slug + ".json");
function load(slug) {
  if (!SLUG.test(slug)) return null;
  if (cache.has(slug)) return cache.get(slug);
  try { const t = JSON.parse(fs.readFileSync(fileOf(slug), "utf8")); cache.set(slug, t); return t; } catch { return null; }
}
function save(slug, team) {
  team.updatedAt = new Date().toISOString();
  const file = fileOf(slug), tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(team, null, 2));
  if (fs.existsSync(file)) fs.copyFileSync(file, path.join(TEAMS, slug + ".prev.json.bak"));
  fs.renameSync(tmp, file);
  cache.set(slug, team);
}
const allSlugs = () => fs.readdirSync(TEAMS).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).filter((s) => SLUG.test(s));
function slugify(name) {
  let base = String(name).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "team";
  let s = base, i = 2;
  while (fs.existsSync(fileOf(s))) s = `${base}-${i++}`;
  return s;
}

/* ---------- edit codes ---------- */
function hashCode(code, salt) { return crypto.scryptSync(String(code), salt, 32).toString("hex"); }
function codeOk(team, code) {
  if (!team.codeHash) return true;
  if (!code) return false;
  const a = Buffer.from(hashCode(code, team.codeSalt), "hex"), b = Buffer.from(team.codeHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function setCode(team, code) {
  if (!code) { delete team.codeHash; delete team.codeSalt; return; }
  team.codeSalt = crypto.randomBytes(16).toString("hex");
  team.codeHash = hashCode(code, team.codeSalt);
}

/* ---------- validation ---------- */
function validKey(k) {
  const [c, id, extra] = String(k).split("/");
  return extra === undefined && COLLECTIONS.has(c) && ID.test(id || "");
}
function validData(data) {
  return data && typeof data === "object" && !Array.isArray(data) && Object.entries(data).every(([k, v]) => validKey(k) && v && typeof v === "object" && !Array.isArray(v) && JSON.stringify(v).length <= MAX_DOC);
}
function applyOps(data, ops) {
  if (!Array.isArray(ops) || !ops.length || ops.length > 400) throw { status: 400, error: "Expected 1–400 changes" };
  for (const o of ops) {
    if (!o || !validKey(o.path) || !["set", "update", "delete"].includes(o.op)) throw { status: 400, error: "Bad change" };
    if (o.op !== "delete" && (!o.data || typeof o.data !== "object" || Array.isArray(o.data) || JSON.stringify(o.data).length > MAX_DOC)) throw { status: 400, error: "Bad document" };
  }
  for (const o of ops) {
    if (o.op === "set") data[o.path] = o.data;
    else if (o.op === "update") { if (data[o.path]) data[o.path] = { ...data[o.path], ...o.data }; }
    else delete data[o.path];
  }
}
function summary(slug, t) {
  const d = t.data, s = d["settings/team"] || {};
  const members = Object.entries(d).filter(([k]) => k.startsWith("members/")).map(([, v]) => v).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  return { slug, name: s.teamName || slug, tagline: s.tagline || "", members: members.length, rooms: Object.keys(d).filter((k) => k.startsWith("rooms/")).length, locked: !!t.codeHash, updatedAt: t.updatedAt, avatars: members.slice(0, 8).map((m) => m.avatar ?? 0) };
}

/* ---------- http ---------- */
function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > MAX_BODY) { reject({ status: 413, error: "Too large" }); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); } catch { reject({ status: 400, error: "Invalid JSON" }); } });
    req.on("error", reject);
  });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);

  // ---- API ----
  if (parts[0] === "api" && parts[1] === "teams") {
    const slug = parts[2], sub = parts[3];
    if (!slug) {
      if (req.method === "GET") return send(res, 200, allSlugs().map((s) => { const t = load(s); return t ? summary(s, t) : null; }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)));
      if (req.method === "POST") {
        const b = await readBody(req);
        const name = String(b.name || "").trim().slice(0, 80);
        if (!name) return send(res, 400, { error: "Give the team a name" });
        const tpl = TEMPLATES[b.template] || TEMPLATES.blank;
        const s = slugify(name);
        const team = { rev: 1, data: tpl.build(name) };
        if (b.code) setCode(team, String(b.code).slice(0, 64));
        save(s, team);
        return send(res, 201, { slug: s });
      }
      return send(res, 405, { error: "Method not allowed" });
    }
    const team = load(slug);
    if (!team) return send(res, 404, { error: "Team not found" });
    const code = req.headers["x-edit-code"] || "";

    if (!sub) {
      if (req.method === "GET") {
        if (url.searchParams.get("since") === String(team.rev)) return send(res, 204, "");
        return send(res, 200, { rev: team.rev, locked: !!team.codeHash, data: team.data });
      }
      if (req.method === "PATCH") {
        if (!codeOk(team, code)) { await wait(300); return send(res, 403, { code: "locked", error: "Edit code required" }); }
        const b = await readBody(req);
        const next = JSON.parse(JSON.stringify(team.data));
        applyOps(next, b.ops);
        if (JSON.stringify(next).length > MAX_BODY) return send(res, 413, { error: "This office has grown too large to save" });
        team.data = next; team.rev++;
        save(slug, team);
        return send(res, 200, { rev: team.rev });
      }
      if (req.method === "DELETE") {
        if (!codeOk(team, code)) { await wait(300); return send(res, 403, { code: "locked", error: "Edit code required" }); }
        fs.renameSync(fileOf(slug), path.join(TRASH, `${slug}-${Date.now()}.json`));
        cache.delete(slug);
        return send(res, 204, "");
      }
      return send(res, 405, { error: "Method not allowed" });
    }
    if (sub === "unlock" && req.method === "POST") {
      const b = await readBody(req);
      if (codeOk(team, b.code)) return send(res, 204, "");
      await wait(400);
      return send(res, 403, { code: "locked", error: "That code isn't right" });
    }
    if (sub === "code" && req.method === "PUT") {
      if (!codeOk(team, code)) { await wait(300); return send(res, 403, { code: "locked", error: "Edit code required" }); }
      const b = await readBody(req);
      const next = String(b.next || "").slice(0, 64);
      if (next && next.length < 4) return send(res, 400, { error: "Use at least 4 characters" });
      setCode(team, next); team.rev++;
      save(slug, team);
      return send(res, 204, "");
    }
    if (sub === "data" && req.method === "PUT") {
      if (!codeOk(team, code)) { await wait(300); return send(res, 403, { code: "locked", error: "Edit code required" }); }
      const b = await readBody(req);
      const data = migrateV1(b.data);
      if (!validData(data)) return send(res, 400, { error: "That isn't a Virtual Office backup" });
      team.data = data; team.rev++;
      save(slug, team);
      return send(res, 200, { rev: team.rev });
    }
    return send(res, 404, { error: "Not found" });
  }

  // ---- pages and assets ----
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed", "text/plain");
  const base = parts.length ? parts[parts.length - 1] : "index.html";
  if (STATIC[base]) return serveFile(res, base);
  if (parts.length === 0 || (parts[0] === "t" && parts.length === 2)) return serveFile(res, "index.html");
  return send(res, 404, "Not found", "text/plain; charset=utf-8");
}
function serveFile(res, name) {
  fs.readFile(path.join(PUBLIC, name), (err, buf) => err ? send(res, 500, "Missing " + name, "text/plain") : send(res, 200, buf, STATIC[name] + "; charset=utf-8"));
}

/* ---------- first run: bring in the original single-team file, or start with the sample team ---------- */
(function firstRun() {
  if (allSlugs().length) return;
  const v1 = path.join(ROOT, "data", "team.json");
  if (fs.existsSync(v1)) {
    try {
      const old = JSON.parse(fs.readFileSync(v1, "utf8"));
      const data = migrateV1(old);
      const name = (data["settings/team"] && data["settings/team"].teamName) || "My team";
      save(slugify(name), { rev: 1, data });
      fs.renameSync(v1, v1 + ".imported");
      console.log(`  Imported your existing team from data/team.json`);
      return;
    } catch (e) { console.error("  Couldn't import data/team.json:", e.message); }
  }
  const name = "Software Development Support Team";
  save(slugify(name), { rev: 1, data: TEMPLATES.sample.build(name) });
})();

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    if (e && e.status) return send(res, e.status, { error: e.error });
    console.error(e);
    send(res, 500, { error: "Something went wrong on the server" });
  });
});
server.listen(PORT, HOST, () => {
  console.log(`\n  Virtual Office is running.`);
  console.log(`  Open:   http://localhost:${PORT}`);
  if (SHARE) Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === "IPv4" && !i.internal).forEach((i) => console.log(`  Share:  http://${i.address}:${PORT}`));
  else console.log(`  (Only this computer can open it. Run "node server.js --share" to let others on your network in.)`);
  console.log(`  Data:   ${TEAMS}`);
  console.log(`\n  Press Ctrl+C to stop.\n`);
});
server.on("error", (e) => {
  if (e.code === "EADDRINUSE") console.error(`\n  Port ${PORT} is busy. Try:  PORT=3001 node server.js\n`);
  else console.error(e);
  process.exit(1);
});
