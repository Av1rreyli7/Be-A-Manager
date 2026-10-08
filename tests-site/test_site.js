// Whole site checks. Run: node tests-site/test_site.js
// Static checks only: files that must exist, the wording rules, the pieces of the landing page
// contract that can be read from the source, and the upload folder.
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
const has = f => fs.existsSync(path.join(root, f));
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) passed++;
  else { failed++; console.log("FAIL: " + name, detail === undefined ? "" : JSON.stringify(detail).slice(0, 400)); }
}
const EM = String.fromCharCode(8212), EN = String.fromCharCode(8211);
const TEXT = /\.(js|mjs|cjs|ts|tsx|jsx|css|html|md|json|yaml|yml|txt|svg)$/;
function walk(dir, skip, out) {
  for (const name of fs.readdirSync(dir)) {
    if (skip.has(name)) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, skip, out); else out.push(p);
  }
  return out;
}

// ---------- no em dashes or en dashes anywhere ----------
// .work holds the build checklists of parallel workers; it is local only and never uploaded
const SKIP = new Set(["node_modules", ".next", "upload", ".git", ".work", ".impeccable", "package-lock.json", "games.json", ".DS_Store"]);
const all = walk(root, SKIP, []);
const dashy = [];
for (const f of all) {
  if (!TEXT.test(f) && !/(^|\/)\.[a-z-]+$/.test(f)) continue;
  const s = fs.readFileSync(f, "utf8");
  if (s.includes(EM) || s.includes(EN)) dashy.push(path.relative(root, f));
}
ok("no em or en dashes in any site file", dashy.length === 0, dashy.slice(0, 12));
for (const ref of ["stratum_reference.md", "vesper_reference.md", "vertex_spaceedu_reference.md"]) {
  const p = path.join(root, "..", ref);
  // the references sit next to site/ on the build machine. They are not part of the site, so skip quietly elsewhere.
  if (fs.existsSync(path.join(root, "..", "front-office"))) ok("reference saved: " + ref, fs.existsSync(p) && fs.statSync(p).size > 10000, null);
}

// ---------- the combined app ----------
const pkg = JSON.parse(read("package.json"));
ok("start runs the combined server in production mode", pkg.scripts.start === "NODE_ENV=production node server.js", pkg.scripts.start);
ok("build is next build", pkg.scripts.build === "next build", pkg.scripts.build);
for (const dep of ["express", "next", "react", "react-dom", "motion", "three", "@react-three/fiber", "dexie", "peerjs", "tailwindcss", "@tailwindcss/postcss", "typescript", "gsap", "@gsap/react"]) ok("runtime or build dependency present: " + dep, !!pkg.dependencies[dep], null);
ok("no surprise dependencies were added", Object.keys(pkg.dependencies).every(d => ["@phosphor-icons/react", "@react-three/fiber", "@tailwindcss/postcss", "@types/node", "@types/react", "@types/react-dom", "@types/three", "clsx", "dexie", "express", "gsap", "@gsap/react", "motion", "next", "peerjs", "react", "react-dom", "recharts", "tailwindcss", "three", "typescript", "zustand"].includes(d)), Object.keys(pkg.dependencies));
const server = read("server.js");
ok("server.js mounts Floodlights before Next", server.indexOf('require("./floodlights/server")') > 0 && server.indexOf('require("./floodlights/server")') < server.indexOf('server.all("*"'), null);
ok("server.js listens on the port Render hands it", server.includes("process.env.PORT"), null);
const flServer = read("floodlights/server.js");
ok("Floodlights is a router that can also run by itself", flServer.includes("express.Router()") && flServer.includes("module.exports = app") && flServer.includes("require.main === module"), null);
ok("Floodlights only reads JSON bodies on its own API paths", flServer.includes("ownApi.has(req.path)") && !flServer.includes('app.use(express.json())'), null);
ok("the Floodlights page moved under /floodlights/", flServer.includes('app.get("/floodlights/"') && flServer.includes('app.get("/floodlights/match.js"') && !flServer.includes('app.get("/",'), null);

ok("the production build does not need the test tools", read("next.config.ts").includes('tsconfigPath: "tsconfig.build.json"') && JSON.parse(read("tsconfig.build.json")).exclude.includes("tests") && !pkg.dependencies.vitest && !!pkg.devDependencies.vitest, null);

// ---------- Front Office is still all there ----------
for (const f of ["src/app/gm/page.tsx", "src/app/game/layout.tsx", "src/app/game/page.tsx", "src/app/online/page.tsx", "src/app/api/refresh-data/route.ts", "src/app/front-office/page.tsx", "src/worker/sim.worker.ts", "src/engine/sim/game.ts", "src/lib/db.ts", "src/lib/online/net.ts", "public/games/hardwood-legends.html", "data/players.json"]) ok("Front Office file kept: " + f, has(f), null);
const hub = read("src/app/front-office/page.tsx");
ok("the Front Office hub kept both of its games", hub.includes('href="/gm"') && hub.includes('href="/games/hardwood-legends.html"') && !hub.includes("AppearancePicker"), null);
ok("links that used to point at the old hub now point at /front-office", read("src/app/gm/page.tsx").includes('href="/front-office"') && read("public/games/hardwood-legends.html").includes('location.href="/front-office"'), null);
if (fs.existsSync(path.join(root, "..", "front-office"))) {
  // every original Front Office source file is still present in the combined app
  const orig = walk(path.join(root, "..", "front-office", "src"), new Set([".DS_Store"]), []).map(f => path.relative(path.join(root, "..", "front-office"), f));
  // the theme picker files were deleted on purpose: Game Night is one dark theme now
  const removed = new Set(["src/app/page.tsx", "src/components/AppearancePicker.tsx", "src/lib/appearance.ts", "src/lib/appearanceBoot.ts"]);
  const gone = orig.filter(f => !removed.has(f) && !has(f));
  ok("no Front Office source file went missing", gone.length === 0, gone);
}

// ---------- landing page: what can be read from the source ----------
const landing = read("src/landing/Landing.tsx");
const css = read("src/landing/landing.css");
const page = read("src/app/page.tsx");
ok("the page title is Be-A-Manager", page.includes('title: { absolute: "Be-A-Manager" }'), null);
const fontsFile = read("src/lib/fonts.ts");
ok("fonts are self hosted: Inter, Chakra Petch, Instrument Serif italic", fontsFile.includes("next/font/local") && fontsFile.includes("inter.woff2") && fontsFile.includes("chakra-petch-700.woff2") && fontsFile.includes("instrument-serif-italic.woff2") && page.includes("@/lib/fonts") && !page.includes("next/font/google"), null);
// ---------- Game Night shares the site look ----------
const rootLayout = read("src/app/layout.tsx");
const gcss = read("src/app/globals.css");
const themeFile = read("src/lib/theme.ts");
const hl = read("public/games/hardwood-legends.html");
ok("Game Night uses the shared self hosted fonts, nothing from Google", rootLayout.includes("@/lib/fonts") && !rootLayout.includes("next/font/google") && !gcss.includes("fonts.googleapis.com"), null);
const gnRoots = ["src/app/game/layout.tsx", "src/app/gm/page.tsx", "src/app/front-office/page.tsx", "src/app/online/page.tsx"].map(read);
ok("Game Night reads the kit palette (night ground, accent from the mode)", gcss.includes("--bg: var(--k-bg)") && gcss.includes("--accent: var(--k-accent)") && gcss.includes("[data-kmode] {") && !themeFile.includes('"--bg"') && !themeFile.includes('"--accent"'), null);
ok("every Game Night screen runs in court mode (warm orange), the landing is not forced into it", gnRoots.every(f => f.includes('data-kmode="court"') && f.includes("useCourtMode()")) && !rootLayout.includes("data-kmode"), null);
ok("Game Night panels have cut corners and hairlines", gcss.includes("clip-path: polygon(0 0, calc(100% - var(--cut)) 0") && gcss.includes("--line: var(--k-line)"), null);
ok("Game Night uses the kit glass primary button and the liquid glass button", gcss.includes(".btn-glow") && gcss.includes(".btn-glass") && !gcss.includes("--k-glow-bank") && !gcss.includes("--k-glow-shadow"), null);
{
  const kit = read("public/kit.css");
  const sel = ":is(.k-btn-glow, .k-btn-primary, .btn-glow, .btn.primary, button.gold)";
  ok("one primary button for the whole site: a tinted glass recipe in the kit, the old glow light bank gone", kit.includes(sel) && kit.includes("--k-tint") && !kit.includes("--k-glow-bank") && !kit.includes("--k-glow-shadow") && kit.includes("translateY(-1px)") && kit.includes("scale(0.97)"), null);
  const flHtml = read("floodlights/index.html"), hlHtml = read("public/games/hardwood-legends.html"), gl = read("src/app/globals.css");
  const oldGlow = ["#eef7b0", "--k-glow-bank", "--k-glow-shadow"].filter(t => flHtml.includes(t) || hlHtml.includes(t) || gl.includes(t) || kit.includes(t));
  ok("no surface keeps the old glow button", oldGlow.length === 0, oldGlow);
}
const uiFile = read("src/components/ui.tsx"), motionFile = read("src/lib/motion.ts");
ok("Game Night screens animate with the shared motion kit", gnRoots[0].includes("useEnterScreen(page, path)") && motionFile.includes("export function enterScreen") && uiFile.includes("km.tabIndicator") && uiFile.includes("km.pop(box.current)") && uiFile.includes("km.count(") && read("src/components/Toasts.tsx").includes("km.slideIn") && uiFile.includes("km.press("), null);
ok("old CSS entrances are gone from Game Night screens (GSAP owns them)", !walk(path.join(root, "src", "app"), new Set(), []).concat(walk(path.join(root, "src", "components"), new Set(), [])).some(f => /className="[^"]*\b(anim-rise|stagger|page-enter)\b/.test(fs.readFileSync(f, "utf8"))), null);
ok("Game Night is dark only: no light mode, no plain style, no theme picker, no boot script", !gcss.includes('data-mode="light"') && !gcss.includes('[data-style="plain"]') && !has("src/components/AppearancePicker.tsx") && !has("src/lib/appearance.ts") && !has("src/lib/appearanceBoot.ts") && !rootLayout.includes("BOOT_SCRIPT") && !rootLayout.includes("data-mode"), null);
ok("every surface links the shared kit", rootLayout.includes('href="/kit.css"') && read("floodlights/index.html").includes('href="/kit.css"') && hl.includes('href="/kit.css"') && has("public/kit.css"), null);
ok("the page entrance does not trap the full screen game: every tween clears its transform", read("public/kit-motion.js").includes('var CLEAR = "transform,opacity,visibility"') && !gcss.includes(".page-enter"), null);
ok("Hardwood Legends uses the site fonts and the court accent from the kit", hl.includes("url(/floodlights/fonts/inter.woff2)") && hl.includes("url(/floodlights/fonts/chakra-petch-700.woff2)") && hl.includes('<html data-kmode="court">') && hl.includes("--accent:var(--k-accent)") && !hl.includes("#d0e85c") && !hl.includes("fonts.googleapis.com"), null);
ok("Hardwood Legends menus animate with GSAP and the motion kit", hl.includes('<script src="/floodlights/vendor/gsap.min.js"></script><script src="/kit-motion.js"></script>') && hl.includes("function hlEnter()") && hl.includes("KitMotion.pulse(sc"), null);
ok("Hardwood Legends uses the kit glass primary button and cut corner panels", !hl.includes(".btn.primary{") && hl.includes('class="btn primary') && hl.includes(".panel,.tcard{border-radius:0"), null);
ok("the headline and both games are in the landing source", landing.includes("Be-A-Manager") && landing.includes("ORDER.map"), null);
ok("the landing is light: no 3D scene, no three.js, no stats fetch", !has("src/landing/Backdrop3D.tsx") && !/from "three"/.test(landing) && !landing.includes("@react-three/fiber") && !landing.includes("Backdrop3D") && !landing.includes("stats.json"), null);
ok("each game shows only its title, one short line and the enter button", landing.includes('className="bam-line">{g.line}') && !/bam-(lede|kind|blurb|inside|chips|foot|stats|mini|credit|pill|card-bg|card-art|btnflash|glowbtn)/.test(landing + css) && read("src/landing/games.ts").includes("line: "), null);
ok("the credit line sits under the two games, small and quiet, and fades in after the cards", landing.includes('<p className="bam-by">by avir and ayanssh</p>') && landing.indexOf('className="bam-by"') > landing.indexOf('className="bam-games"') && /\.bam-by \{[^}]*font: 600 11px/.test(css) && landing.includes('q(".bam-by")') && page.includes(".bam-by,"), null);
ok("reduced motion gets the calm page", landing.includes("prefers-reduced-motion") && css.includes("@media (prefers-reduced-motion: reduce)"), null);
ok("warm on intent and idle warmup are wired", landing.includes("onPointerEnter={() => warm(id)}") && landing.includes("onFocus={() => warm(id)}") && landing.includes("requestIdleCallback") && !landing.includes("motion/react"), null);
ok("the intro is one GSAP timeline with the welcome flight and the two ball moments", landing.includes('from "gsap"') && landing.includes('from "@gsap/react"') && landing.includes("useGSAP(") && landing.includes("gsap.matchMedia()") && /addLabel\("lights"/.test(landing) && /addLabel\("fly"/.test(landing) && /addLabel\("cards"/.test(landing) && landing.includes("function kick(") && landing.includes("function bounce(") && landing.includes('"bounce.out"'), null);
ok("the intro never blocks input and can be skipped at once", css.includes(".bam-intro {") && /\.bam-intro \{[^}]*pointer-events: none/.test(css) && landing.includes("tl.progress(1)") && landing.includes('e.key === "Escape"') && landing.includes('"wheel"'), null);
ok("a second visit in the same tab gets the short version", landing.includes("sessionStorage") && landing.includes('tl.seek("cards")'), null);
ok("the first paint is guarded so the end state never flashes, and the guard lifts itself", page.includes('s.id="bam-prehide"') && page.includes("4500") && page.includes("prefers-reduced-motion: reduce") && landing.includes('getElementById("bam-prehide")?.remove()'), null);
ok("the intro moves only transform and opacity: no layout properties in the timeline", !/(width|height|top|left|margin|padding)\s*:\s*[^,}]*[,}]/.test(landing.slice(landing.indexOf("function buildIntro"), landing.indexOf("export default function Landing"))), null);
ok("black is forced in three places", css.includes("html:has(.bam)") && landing.includes('style={{ background: "#000", color: "#fff" }}') && landing.includes("html,body{background:#000000 !important"), null);
ok("the landing reads the shared kit: glass enter buttons tinted by pitch and court modes", landing.includes("k-btn k-btn-primary") && !landing.includes("k-btn-glow") && read("src/landing/games.ts").includes('mode: "pitch"') && read("src/landing/games.ts").includes('mode: "court"') && landing.includes("data-kmode={g.mode}") && css.includes("var(--k-grad)") && css.includes("var(--k-accent-rgb)"), null);
{
  // performance: the beams are cone images drawn once (beams.ts), never blended, masked or filtered at run time
  const beamsTs = read("src/landing/beams.ts");
  ok("the floodlight beams are cone images drawn once, with no blend mode, mask or filter", /export const BEAM_L = beamImage/.test(beamsTs) && !/\.bam-beam[^{]*\{[^}]*(mix-blend-mode|mask-image|filter:)/.test(css), null);
  ok("the static sky sits in one layer of its own", /\.bam-sky \{[^}]*will-change: transform/.test(css), null);
  ok("animated pieces get their own layers only while the intro plays", /\.bam\[data-anim\] :is\([^)]*\.bam-big \.L/.test(css) && /setAttribute\("data-anim", "1"\)/.test(landing) && /removeAttribute\("data-anim"\)/.test(landing), null);
}
ok("the frame has chamfered corners and hairlines", css.includes(".bam-frame .cn-tl") && css.includes("--line: rgba(255, 255, 255, 0.13)"), null);
ok("reduced motion switches every animation and transition off", css.includes("@media (prefers-reduced-motion: reduce)") && css.includes("animation: none !important"), null);
ok("the side preview card is gone from the landing", !css.includes(".bam-side") && !css.includes("bam-mock") && !has("public/landing"), null);

// ---------- Floodlights page: restyle did not drop the pieces the game needs ----------
const fl = read("floodlights/index.html");
ok("Floodlights loads no fonts from other sites", !fl.includes("fonts.googleapis.com") && !fl.includes("fonts.gstatic.com") && fl.includes("url(fonts/inter.woff2)"), null);
for (const f of ["inter.woff2", "chakra-petch-600.woff2", "chakra-petch-700.woff2", "instrument-serif-italic.woff2", "geist-mono.woff2"]) ok("font file present: " + f, has("floodlights/fonts/" + f), null);
ok("Floodlights shares the look: frame, starfield, glass primary button, glass buttons", fl.includes("lobbyframe") && fl.includes('id="bamStars"') && fl.includes('<button id="createBtn" class="gold">') && fl.includes("button.ghost{background:linear-gradient(135deg"), null);
ok("Floodlights tints the glass buttons with the club colours once a save is loaded, and clears it in the lobby", fl.includes("function clubTint(kit)") && fl.includes('root.setProperty("--k-tint"') && fl.includes("clubTint(kit);") && fl.includes("clubTint(null);"), null);
ok("Floodlights has a way back to the landing page", fl.includes('class="homelink" href="/"') && fl.includes('class="chip homechip" href="/"'), null);
for (const id of ["lobby", "app", "createBtn", "joinBtn", "nameIn", "codeIn", "startBtn", "simBtn", "tabs", "simSeasonBtn", "tab-travel", "travelModal", "matchWrap", "matchCanvas", "matchPanel", "playStatus", "ctModal", "tickerBar", "leaveBtn"]) ok("Floodlights element still there: #" + id, fl.includes('id="' + id + '"'), null);
for (const tab of ["squad", "lineup", "market", "offers", "romano", "matches", "calendar", "cups", "table", "cabinet", "academy", "nations", "feed"]) ok("Floodlights tab still there: " + tab, fl.includes('data-t="' + tab + '"') && fl.includes('id="tab-' + tab + '"'), null);
if (fs.existsSync(path.join(root, "..", "floodlights", "index.html"))) {
  // The page script and the server rules now differ from the originals on purpose (dynamic OVR, events, travel,
  // sim season, loan cap). The world data and the Classic match sim still have to be the originals.
  // The October 2026 squads replace the old squads on purpose (squads_2026.js, applied in players.js). The other
  // world packs are still the originals; league_fill.js only swaps Mazatlan (dissolved in 2026) for Atlante.
  for (const f of ["world_pack.js", "extra_clubs.js"]) ok("world data untouched: " + f, read("floodlights/" + f) === fs.readFileSync(path.join(root, "..", "floodlights", f), "utf8"), null);
  ok("league_fill.js only swaps Mazatlan for Atlante", read("floodlights/league_fill.js") === fs.readFileSync(path.join(root, "..", "floodlights", "league_fill.js"), "utf8").replace('"Mazatlan": { league', '"Atlante": { league'), null);
  // the sim part of the match engine is the original too
  const origEngine = fs.readFileSync(path.join(root, "..", "floodlights", "match.js"), "utf8");
  const simPart = s => s.slice(s.indexOf("function createSim"), s.indexOf("// LOOK"));
  ok("the match sim (rules, AI, controls) is untouched", simPart(read("floodlights/match.js")) === simPart(origEngine) && simPart(origEngine).length > 30000, null);
  // the 3D look has its own deep sim next to it, so Classic can stay exactly as it was
  ok("the deep sim for 3D is a separate file and Classic does not use it", has("floodlights/match_sim3d.mjs") && !simPart(read("floodlights/match.js")).includes("match_sim3d"), null);
}

// ---------- the October 2026 squads ----------
{
  const { SQUADS_2026 } = require(path.join(root, "floodlights", "squads_2026.js"));
  const { buildDatabase } = require(path.join(root, "floodlights", "players.js"));
  const db = buildDatabase();
  const ROLES = new Set(["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"]);
  const GROUP = { GK: "GK", CB: "DF", LB: "DF", RB: "DF", CDM: "MF", CM: "MF", CAM: "MF", LW: "FW", RW: "FW", ST: "FW" };
  const clubs = Object.keys(SQUADS_2026);
  ok("every club in the game has an October 2026 squad", clubs.length === 320 && clubs.every(c => db.clubs[c]) && Object.keys(db.clubs).length === 320, clubs.length);
  const rows = clubs.flatMap(c => SQUADS_2026[c].map(r => [c].concat(r)));
  const badRow = rows.filter(([c, n, pos, age, r, num, role]) => !n || !/^[A-Za-z0-9 .'-]+$/.test(n) || !(age >= 15 && age <= 46) || !(r >= 50 && r <= 91) || !ROLES.has(role) || GROUP[role] !== pos || (num !== null && !(num >= 1 && num <= 99)));
  ok("every squad row is a plain name, an age, a rating on the scale, a role that fits the position", badRow.length === 0, badRow.slice(0, 5));
  const dupNum = clubs.filter(c => { const n = SQUADS_2026[c].map(r => r[4]).filter(Boolean); return new Set(n).size !== n.length; });
  ok("shirt numbers are unique inside every club", dupNum.length === 0, dupNum);
  ok("every squad has at least 17 players and a keeper", clubs.every(c => SQUADS_2026[c].length >= 17 && SQUADS_2026[c].some(r => r[1] === "GK")), null);
  const at = n => (db.players.find(p => p.name === n) || {}).club;
  ok("the big summer 2026 moves are in (Salah, Rodri, Gordon, Bruno Guimaraes, Konate, Rashford)", at("Mohamed Salah") === "Trabzonspor" && at("Rodri") === "Barcelona" && at("Anthony Gordon") === "Barcelona" && at("Bruno Guimaraes") === "Arsenal" && at("Ibrahima Konate") === "Real Madrid" && at("Marcus Rashford") === "Man United", null);
  ok("players who left the clubs in the game are gone (Lewandowski to Chicago Fire, Benzema without a club)", !at("Robert Lewandowski") && !at("Karim Benzema"), null);
  ok("real shirt numbers and loans reach the database", db.players.find(p => p.name === "Marcus Rashford").num === 9 && db.players.find(p => p.name === "Ronald Araujo").loanFrom === "Barcelona", null);
  ok("Mazatlan (dissolved in 2026) is Atlante now, with its own travel row", !!db.clubs.Atlante && !db.clubs.Mazatlan && read("floodlights/travel_data.js").includes('"Atlante": ["Mexico City"'), null);
}

// ---------- docs ----------
ok("PROGRESS.md exists", has("PROGRESS.md"), null);
const dep = has("DEPLOY.md") ? read("DEPLOY.md") : "";
ok("DEPLOY.md has the exact build and start commands", dep.includes("`npm install && npm run build`") && dep.includes("`npm start`") && dep.includes("NODE_VERSION") && dep.includes("/healthz"), null);

// ---------- upload folder ----------
const up = path.join(root, "upload");
ok("the upload folder exists", fs.existsSync(up), null);
if (fs.existsSync(up)) {
  const upFiles = walk(up, new Set(), []).map(f => path.relative(up, f));
  const bad = upFiles.filter(f => /(^|\/)(node_modules|\.next)\//.test(f) || /games\.json$/.test(f) || /\.DS_Store$/.test(f) || /\.tsbuildinfo$/.test(f));
  ok("the upload folder has no node_modules, .next, games.json or junk", bad.length === 0, bad.slice(0, 8));
  for (const f of ["package.json", "package-lock.json", "server.js", "next.config.ts", "tsconfig.json", "tsconfig.build.json", "postcss.config.mjs", ".gitignore", ".node-version", "render.yaml", "README.md", "DEPLOY.md", "floodlights/server.js", "floodlights/index.html", "floodlights/match.js", "floodlights/match3d.mjs", "floodlights/match_sim3d.mjs", "floodlights/m3d/sim.mjs", "floodlights/m3d/ball.mjs", "floodlights/m3d/view/index.mjs", "floodlights/m3d/view/anim.mjs", "floodlights/squads_2026.js", "floodlights/condition.js", "floodlights/events_data.js", "floodlights/travel_data.js", "floodlights/test_condition.js", "floodlights/players.js", "floodlights/world_pack.js", "floodlights/extra_clubs.js", "floodlights/league_fill.js", "floodlights/fonts/inter.woff2", "floodlights/test_sept.js", "floodlights/test_dom_sept.js", "src/app/page.tsx", "src/app/layout.tsx", "src/landing/Landing.tsx", "src/landing/Balls.tsx", "src/landing/beams.ts", "src/landing/landing.css", "public/games/hardwood-legends.html", "data/players.json", "tests/landing.test.tsx", "tests-site/test_boot.js", "floodlights/career/core.js", "floodlights/career/pro.js", "floodlights/career/data.js", "floodlights/m3d/view/hero.mjs", "floodlights/m3d/view/hairshells.mjs", "src/app/floodlights/career/page.tsx", "src/career/CareerApp.tsx", "src/career/Hub.tsx", "src/career/Creator.tsx", "src/career/Stage.tsx", "src/career/body.ts", "src/career/career.css", "tests-site/test_career.js"]) ok("upload has " + f, upFiles.includes(f), null);
  // the copy must match the working tree
  const stale = upFiles.filter(f => { const src = path.join(root, f); return !fs.existsSync(src) || !fs.readFileSync(src).equals(fs.readFileSync(path.join(up, f))); });
  ok("every file in upload matches the working tree", stale.length === 0, stale.slice(0, 8));
  const missing = all.map(f => path.relative(root, f)).filter(f => !upFiles.includes(f) && !/^(next-env\.d\.ts|\.vercelignore)$/.test(f) && !/\.tsbuildinfo$/.test(f));
  ok("nothing from the working tree is missing in upload", missing.length === 0, missing.slice(0, 8));
  const upDashy = upFiles.filter(f => TEXT.test(f) && f !== "package-lock.json").filter(f => { const s = fs.readFileSync(path.join(up, f), "utf8"); return s.includes(EM) || s.includes(EN); });
  ok("no em or en dashes in the upload folder", upDashy.length === 0, upDashy.slice(0, 8));
}

console.log(passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
