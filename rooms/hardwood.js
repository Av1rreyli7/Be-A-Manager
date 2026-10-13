// Hardwood Legends rooms: a code friends join, the room before the game, and the live game passed between the
// players. The host's browser plays the game; this server only passes messages (each player's moves to the
// host, pictures of the court from the host to everyone else) and keeps the room and its results. Rooms are
// saved to disk the same way Floodlights saves its games (a side file swapped in, written at once on a stop),
// and a browser can hand back its copy of a room the server lost.
//
// HTTP:  POST /api/hl/create {name}          -> {code, token, room}
//        POST /api/hl/join   {code, name}    -> {code, token, room}   (404 "Game not found." when it is gone)
//        GET  /api/hl/room?code&name&token   -> {room}
//        POST /api/hl/restore {name, token, room} -> {code, token, room}
// Live:  WebSocket /api/hl/live?code&name&token
//        from a player: pick {side, team}, opts {qLen}, start, leave, input {..} (to the host),
//                       and from the host: snap {..} (to everyone), over {result}, back, abandon
//        to a player:   room {room}, start {game}, snap {..}, input {from, ..}, over {result}, gone
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const { WebSocketServer } = require("ws");

const MAX_PLAYERS = 4;
const QLENS = [2, 5, 8, 12];
const FILE = process.env.HL_ROOMS_FILE || path.join(process.env.FL_SAVE_FILE ? path.dirname(process.env.FL_SAVE_FILE) : path.join(__dirname, "..", "floodlights"), "hardwood_rooms.json");

let rooms = {};
try { rooms = JSON.parse(fs.readFileSync(FILE, "utf8")) || {}; } catch (e) { rooms = {}; }
// a game in progress lives in the host's browser: after a restart every room starts in the lobby again
for (const r of Object.values(rooms)) { r.phase = "lobby"; r.game = null; }
// every "Create a game" opens a room, most of them only ever for one player: rooms nobody has used for two
// days go (a fortnight when they hold results)
const DAY = 86400000;
function prune() {
  const now = Date.now();
  let gone = 0;
  for (const [code, r] of Object.entries(rooms)) {
    const last = r.touched || r.created || 0;
    if (now - last > (r.results && r.results.length ? 14 : 2) * DAY && !(sockets.get(code) && sockets.get(code).size)) { delete rooms[code]; gone++; }
  }
  if (gone) save();
}

let timer = null, dirty = false;
function writeNow() {
  clearTimeout(timer);
  timer = null;
  if (!dirty) return;
  dirty = false;
  try { fs.writeFileSync(FILE + ".tmp", JSON.stringify(rooms)); fs.renameSync(FILE + ".tmp", FILE); } catch (e) { console.error("Could not save the Hardwood rooms:", e.message); }
}
function save() { dirty = true; if (!timer) timer = setTimeout(writeNow, 250); }
for (const sig of ["SIGTERM", "SIGINT"]) process.prependOnceListener(sig, writeNow);
process.once("beforeExit", writeNow);

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newCode() {
  for (;;) {
    let c = "";
    for (const b of crypto.randomBytes(4)) c += ALPHABET[b % ALPHABET.length];
    if (!rooms[c]) return c;
  }
}
const newToken = () => crypto.randomBytes(12).toString("hex");
const cleanName = n => String(n || "").trim().slice(0, 20);

// what a player sees of a room (no tokens)
function view(r) {
  return {
    code: r.code, uid: r.uid, host: r.host, phase: r.phase, opts: r.opts,
    members: Object.values(r.members).sort((a, b) => a.joined - b.joined).map(m => ({ name: m.name, side: m.side, team: m.team, online: live(r.code, m.name) })),
    game: r.game, results: r.results.slice(-10),
  };
}
// the copy a browser keeps: the room as the server has it, its own token included
function copyOf(r) { return JSON.parse(JSON.stringify(r)); }

// ---------- sockets ----------
const sockets = new Map(); // code -> Map(name -> ws)
function live(code, name) { const m = sockets.get(code); const ws = m && m.get(name); return !!(ws && ws.readyState === 1); }
function send(ws, msg) { if (ws && ws.readyState === 1) ws.send(typeof msg === "string" ? msg : JSON.stringify(msg)); }
function toAll(code, msg, except) {
  const m = sockets.get(code);
  if (!m) return;
  const s = typeof msg === "string" ? msg : JSON.stringify(msg);
  for (const [name, ws] of m) if (name !== except) send(ws, s);
}
function roomChanged(r) { r.touched = Date.now(); save(); toAll(r.code, { t: "room", room: view(r) }); }

// the sides: each side's team is the one its first player picked; at most two people a side
function sideOf(r, side) { return Object.values(r.members).filter(m => m.side === side).sort((a, b) => a.joined - b.joined); }
function canStart(r) {
  const a = sideOf(r, 0), b = sideOf(r, 1);
  const ta = a.length ? a[0].team : null, tb = b.length ? b[0].team : null;
  return a.length > 0 && b.length > 0 && Number.isInteger(ta) && Number.isInteger(tb) && ta !== tb;
}

function onMessage(r, me, msg) {
  const host = r.host === me.name;
  if (msg.t === "input") {
    // a player's keys go to the host, who plays the game
    if (r.phase !== "game" || host) return;
    const m = sockets.get(r.code), hws = m && m.get(r.host);
    msg.from = me.name;
    send(hws, msg);
    return;
  }
  if (msg.t === "snap") {
    if (r.phase !== "game" || !host) return;
    toAll(r.code, msg, me.name);
    return;
  }
  if (msg.t === "pick") {
    if (r.phase !== "lobby") return;
    const side = msg.side === 0 || msg.side === 1 ? msg.side : null;
    const team = Number.isInteger(msg.team) && msg.team >= 0 && msg.team < 30 ? msg.team : null;
    if (side !== null && side !== me.side && sideOf(r, side).length >= 2) return;
    me.side = side;
    // the side's first player picks its team; a second player on the side plays for that team too
    const first = side === null ? null : sideOf(r, side)[0];
    if (side !== null && first && first !== me) me.team = first.team;
    else me.team = team;
    if (side !== null && first === me) for (const o of sideOf(r, side)) o.team = me.team;
    roomChanged(r);
    return;
  }
  if (msg.t === "opts") {
    if (!host || r.phase !== "lobby") return;
    if (QLENS.includes(msg.qLen)) r.opts.qLen = msg.qLen;
    roomChanged(r);
    return;
  }
  if (msg.t === "start") {
    if (!host || r.phase !== "lobby" || !canStart(r)) return;
    const a = sideOf(r, 0), b = sideOf(r, 1);
    r.phase = "game";
    r.game = { id: newToken().slice(0, 8), at: Date.now(), teams: [a[0].team, b[0].team], seats: [a.map(m => m.name), b.map(m => m.name)], qLen: r.opts.qLen };
    save();
    toAll(r.code, { t: "start", game: r.game });
    toAll(r.code, { t: "room", room: view(r) });
    return;
  }
  if (msg.t === "over") {
    // the final buzzer: the host sends the result, the room keeps it
    if (!host || r.phase !== "game" || !r.game) return;
    const res = msg.result || {};
    const score = v => Math.max(0, Math.min(400, Math.round(Number(v) || 0)));
    const line = (side, k) => ({ team: r.game.teams[side], names: r.game.seats[side], score: score(k.score), box: Array.isArray(k.box) ? k.box.slice(0, 15) : [] });
    r.results.push({ id: r.game.id, at: Date.now(), qLen: r.game.qLen, ot: Math.max(0, Math.round(Number(res.ot) || 0)), home: line(0, res.home || {}), away: line(1, res.away || {}) });
    if (r.results.length > 50) r.results.splice(0, r.results.length - 50);
    r.phase = "lobby";
    r.game = null;
    save();
    toAll(r.code, { t: "over", result: r.results[r.results.length - 1] });
    toAll(r.code, { t: "room", room: view(r) });
    return;
  }
  if (msg.t === "abandon") {
    // the host left the game (a reload, Leave): it does not count
    if (!host || r.phase !== "game") return;
    r.phase = "lobby";
    r.game = null;
    roomChanged(r);
    toAll(r.code, { t: "abandoned" });
    return;
  }
  if (msg.t === "leave") {
    leave(r, me.name);
    return;
  }
}

function leave(r, name) {
  if (!r.members[name]) return;
  delete r.members[name];
  const m = sockets.get(r.code);
  if (m && m.get(name)) { try { m.get(name).close(); } catch (e) { /* gone */ } m.delete(name); }
  const left = Object.values(r.members).sort((a, b) => a.joined - b.joined);
  if (!left.length) { delete rooms[r.code]; save(); return; }
  seat(r);
  if (r.host === name) {
    // the next player in becomes the host; a game in progress was the old host's and does not count
    r.host = left[0].name;
    if (r.phase === "game") { r.phase = "lobby"; r.game = null; toAll(r.code, { t: "abandoned" }); }
  }
  roomChanged(r);
}

function attach(server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 512 * 1024 });
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname !== "/api/hl/live") return;
    const code = String(url.searchParams.get("code") || "").toUpperCase();
    const name = cleanName(url.searchParams.get("name"));
    const token = String(url.searchParams.get("token") || "");
    const r = rooms[code];
    const me = r && r.members[name];
    wss.handleUpgrade(req, socket, head, ws => {
      if (!r) { send(ws, { t: "gone" }); ws.close(4404, "Game not found."); return; }
      if (!me || me.token !== token) { send(ws, { t: "denied" }); ws.close(4403, "You are not in this room."); return; }
      if (!sockets.has(code)) sockets.set(code, new Map());
      const map = sockets.get(code);
      const old = map.get(name);
      if (old && old !== ws) { try { old.close(4409, "Opened somewhere else."); } catch (e) { /* gone */ } }
      map.set(name, ws);
      r.touched = Date.now();
      ws.alive = true;
      ws.on("pong", () => { ws.alive = true; });
      ws.on("message", data => {
        let msg = null;
        try { msg = JSON.parse(String(data)); } catch (e) { return; }
        const room = rooms[code], who = room && room.members[name];
        if (!room || !who || !msg || typeof msg.t !== "string") return;
        onMessage(room, who, msg);
      });
      ws.on("close", () => {
        const m = sockets.get(code);
        if (m && m.get(name) === ws) m.delete(name);
        const room = rooms[code];
        if (room) toAll(code, { t: "room", room: view(room) });
      });
      send(ws, { t: "room", room: view(r) });
      if (r.phase === "game" && r.game) send(ws, { t: "start", game: r.game, rejoin: true });
      toAll(code, { t: "room", room: view(r) }, name);
    });
  });
  prune();
  const tidy = setInterval(prune, 3600000);
  tidy.unref();
  // keep the line open through the host's proxy, and drop players who went away without a word
  const beat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) { try { ws.terminate(); } catch (e) { /* gone */ } continue; }
      ws.alive = false;
      try { ws.ping(); } catch (e) { /* gone */ }
    }
  }, 25000);
  beat.unref();
  return wss;
}

// ---------- HTTP ----------
const router = express.Router();
const json = express.json({ limit: "200kb" });
function newRoom(name) {
  const r = { code: newCode(), uid: newToken(), created: Date.now(), host: name, members: {}, opts: { qLen: 5 }, phase: "lobby", game: null, results: [] };
  rooms[r.code] = r;
  return r;
}
function addMember(r, name, pref) {
  if (!r.members[name]) r.members[name] = { name, token: newToken(), side: null, team: null, joined: Date.now(), pref: Number.isInteger(pref) && pref >= 0 && pref < 30 ? pref : null };
  seat(r);
  return r.members[name];
}
// with friends in the room every player gets a side (the host home, then whichever side has fewer) and every
// side a team (its first player's favourite, never the other side's), so nobody has to sort it out by hand
function seat(r) {
  const list = Object.values(r.members).sort((a, b) => a.joined - b.joined);
  if (list.length < 2 || r.phase !== "lobby") return;
  for (const m of list) {
    if (m.side === 0 || m.side === 1) continue;
    const n0 = list.filter(x => x.side === 0).length, n1 = list.filter(x => x.side === 1).length;
    if (Math.min(n0, n1) >= 2) break;
    m.side = n0 <= n1 ? 0 : 1;
  }
  for (const side of [0, 1]) {
    const on = sideOf(r, side);
    if (!on.length) continue;
    const other = sideOf(r, 1 - side)[0];
    const taken = other && Number.isInteger(other.team) ? other.team : -1;
    let t = on[0].team;
    if (!Number.isInteger(t) || t === taken) {
      t = Number.isInteger(on[0].pref) && on[0].pref !== taken ? on[0].pref : (taken + 1 + side * 7) % 30;
      if (t === taken) t = (t + 1) % 30;
    }
    for (const m of on) m.team = t;
  }
}
router.post("/api/hl/create", json, (req, res) => {
  const name = cleanName(req.body.name);
  if (!name) return res.status(400).json({ error: "Enter a manager name." });
  const r = newRoom(name);
  const me = addMember(r, name, req.body.team);
  save();
  res.json({ code: r.code, token: me.token, room: view(r), copy: copyOf(r) });
});
router.post("/api/hl/join", json, (req, res) => {
  const name = cleanName(req.body.name);
  const r = rooms[String(req.body.code || "").toUpperCase()];
  if (!r) return res.status(404).json({ error: "Game not found." });
  if (!name) return res.status(400).json({ error: "Enter a manager name." });
  if (!r.members[name] && Object.keys(r.members).length >= MAX_PLAYERS) return res.status(400).json({ error: "This room is full. Four players at most." });
  const me = addMember(r, name, req.body.team);
  roomChanged(r);
  res.json({ code: r.code, token: me.token, room: view(r), copy: copyOf(r) });
});
router.get("/api/hl/room", (req, res) => {
  const r = rooms[String(req.query.code || "").toUpperCase()];
  if (!r) return res.status(404).json({ error: "Game not found." });
  const me = r.members[cleanName(req.query.name)];
  if (!me || me.token !== String(req.query.token || "")) return res.status(403).json({ error: "You are not in this room." });
  res.set("Cache-Control", "no-store");
  res.json({ room: view(r), copy: copyOf(r) });
});
// a room the server lost, handed back by a browser that kept a copy of it
router.post("/api/hl/restore", json, (req, res) => {
  const name = cleanName(req.body.name);
  const c = req.body.room;
  const okRoom = c && typeof c === "object" && typeof c.code === "string" && c.members && typeof c.members === "object" && c.members[name] && c.members[name].token === String(req.body.token || "");
  if (!okRoom) return res.status(400).json({ error: "This copy of the room could not be read." });
  const code = c.code.toUpperCase();
  const liveRoom = rooms[code];
  if (liveRoom && liveRoom.uid === c.uid) {
    const me = addMember(liveRoom, name);
    return res.json({ code, token: me.token, room: view(liveRoom), copy: copyOf(liveRoom), restored: false });
  }
  const r = {
    code: liveRoom ? newCode() : code, uid: String(c.uid || newToken()), created: Number(c.created) || Date.now(), host: name,
    members: {}, opts: { qLen: QLENS.includes(c.opts && c.opts.qLen) ? c.opts.qLen : 5 }, phase: "lobby", game: null,
    results: Array.isArray(c.results) ? c.results.slice(-50) : [],
  };
  for (const m of Object.values(c.members).slice(0, MAX_PLAYERS)) {
    const n = cleanName(m && m.name);
    if (!n) continue;
    // a friend whose key this browser does not have gets a new one; they come back in by name, like Floodlights
    r.members[n] = { name: n, token: typeof m.token === "string" && m.token.length >= 16 ? m.token : newToken(), side: m.side === 0 || m.side === 1 ? m.side : null, team: Number.isInteger(m.team) ? m.team : null, joined: Number(m.joined) || Date.now() };
  }
  rooms[r.code] = r;
  save();
  res.json({ code: r.code, token: r.members[name].token, room: view(r), copy: copyOf(r), restored: true });
});

module.exports = { router, attach, rooms: () => rooms };
