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
const SKIP = new Set(["node_modules", ".next", "upload", ".git", "package-lock.json", "games.json", ".DS_Store"]);
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
for (const dep of ["express", "next", "react", "react-dom", "motion", "three", "@react-three/fiber", "dexie", "peerjs", "tailwindcss", "@tailwindcss/postcss", "typescript"]) ok("runtime or build dependency present: " + dep, !!pkg.dependencies[dep], null);
ok("no surprise dependencies were added", Object.keys(pkg.dependencies).every(d => ["@phosphor-icons/react", "@react-three/fiber", "@tailwindcss/postcss", "@types/node", "@types/react", "@types/react-dom", "@types/three", "clsx", "dexie", "express", "motion", "next", "peerjs", "react", "react-dom", "recharts", "tailwindcss", "three", "typescript", "zustand"].includes(d)), Object.keys(pkg.dependencies));
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
ok("the Front Office hub kept both of its games", hub.includes('href="/gm"') && hub.includes('href="/games/hardwood-legends.html"') && hub.includes("AppearancePicker"), null);
ok("links that used to point at the old hub now point at /front-office", read("src/app/gm/page.tsx").includes('href="/front-office"') && read("public/games/hardwood-legends.html").includes('location.href="/front-office"'), null);
if (fs.existsSync(path.join(root, "..", "front-office"))) {
  // every original Front Office source file is still present in the combined app
  const orig = walk(path.join(root, "..", "front-office", "src"), new Set([".DS_Store"]), []).map(f => path.relative(path.join(root, "..", "front-office"), f));
  const gone = orig.filter(f => f !== "src/app/page.tsx" && !has(f));
  ok("no Front Office source file went missing", gone.length === 0, gone);
}

// ---------- landing page: what can be read from the source ----------
const landing = read("src/landing/Landing.tsx");
const css = read("src/landing/landing.css");
const scene = read("src/landing/Backdrop3D.tsx");
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
ok("Game Night uses the site palette: black ground, volt accent", gcss.includes("--bg: #000000") && gcss.includes("--accent: #d0e85c") && themeFile.includes('"#d0e85c"') && themeFile.includes('"--bg": "#000000"'), null);
ok("Game Night panels have cut corners and hairlines", gcss.includes("clip-path: polygon(0 0, calc(100% - var(--cut)) 0") && gcss.includes("--line: #222422"), null);
ok("Game Night has the glow button and the liquid glass button", gcss.includes(".btn-glow") && gcss.includes(".btn-glass") && gcss.includes("#eef7b0 1px, #e8f59a 2px"), null);
ok("Game Night keeps light mode and the plain style", gcss.includes(':root[data-mode="light"]') && gcss.includes('[data-style="plain"]') && themeFile.includes("plain"), null);
ok("the page entrance does not trap the full screen game", /\.page-enter \{\s*animation: page-in [^;]*backwards;/.test(gcss), null);
ok("Hardwood Legends uses the site fonts and the volt accent", hl.includes("url(/floodlights/fonts/inter.woff2)") && hl.includes("url(/floodlights/fonts/chakra-petch-700.woff2)") && hl.includes("--accent:#d0e85c") && !hl.includes("fonts.googleapis.com"), null);
ok("Hardwood Legends has the glow button and cut corner panels", hl.includes(".btn.primary{color:#ffffff;border:0;border-radius:11px") && hl.includes(".panel,.tcard{border-radius:0"), null);
ok("the headline, the credit and both games are in the landing source", landing.includes("Be-A-Manager") && landing.includes("By Avir &amp; Ayanssh") && landing.includes("ORDER.map"), null);
ok("the 3D scene is lazy loaded, not part of the first bundle", landing.includes('lazy(() => import("./Backdrop3D"))') && !/from "three"/.test(landing) && !landing.includes("@react-three/fiber"), null);
ok("the scene is built with three.js and React Three Fiber", scene.includes('from "@react-three/fiber"') && scene.includes('from "three"') && scene.includes("<Canvas"), null);
ok("3D has a fallback for weak devices and reduced motion", landing.includes("prefers-reduced-motion") && landing.includes("weakDevice()") && landing.includes("hasWebGL()") && scene.includes("onSlow"), null);
ok("pointer parallax uses motion values, not React state", landing.includes("useMotionValue") && landing.includes("useSpring") && landing.includes("pointermove"), null);
ok("warm on intent and idle warmup are wired", landing.includes("onPointerEnter={() => warm(") && landing.includes("onFocus={() => warm(") && landing.includes("requestIdleCallback"), null);
ok("entrance robustness: animationend adds is-in, with a two frame fallback", landing.includes('"animationend"') && landing.includes('classList.add("is-in")') && (landing.match(/requestAnimationFrame/g) || []).length >= 2, null);
ok("black is forced in three places", css.includes("html:has(.bam)") && landing.includes('style={{ background: "#000", color: "#fff" }}') && landing.includes("html,body{background:#000000 !important"), null);
const glow = css.slice(css.indexOf(".bam-glowbtn {"), css.indexOf("/* ---------- liquid glass buttons"));
ok("glow button contract: clipped by its own rounded rect", glow.includes("overflow: hidden") && glow.includes("linear-gradient(to top"), null);
ok("glow button contract: masked edge light and top streak", glow.includes(".bam-glowbtn::after") && glow.includes("mask: linear-gradient(to top") && glow.includes(".bam-glowbtn::before"), null);
ok("glow button contract: no halo, the largest resting outer blur is 8px", !/drop-shadow/.test(glow) && !/0 0 (9|[1-9][0-9])px/.test(glow.slice(0, glow.indexOf(".bam-glowbtn:hover"))), null);
ok("the entrance animates translate and scale, never transform", (() => { const k = css.slice(css.indexOf("@keyframes bam-drawx")); const frames = k.slice(0, k.indexOf("@media")); return !/transform\s*:/.test(frames) && /translate:/.test(frames) && /scale:/.test(frames); })(), null);
ok("liquid metal pills and both glass buttons use the reference recipes", css.includes("linear-gradient(105deg, #050505 0%, #2a2a2a 48%, #4a4a4a 100%)") && css.includes("linear-gradient(180deg, #ffffff 0%, #e7e7e7 48%, #cfcfcf 100%)") && css.includes("linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(0, 0, 0, 0.5) 46%, rgba(150, 170, 200, 0.1))"), null);
ok("the frame has chamfered corners and hairlines", css.includes(".bam .cn-tl") && css.includes("--line: rgba(255, 255, 255, 0.13)"), null);
ok("reduced motion switches every animation and transition off", css.includes("@media (prefers-reduced-motion: reduce)") && css.includes("animation: none !important"), null);
ok("the side preview card is gone from the landing", !css.includes(".bam-side") && !css.includes("bam-mock") && !has("public/landing"), null);

// ---------- Floodlights page: restyle did not drop the pieces the game needs ----------
const fl = read("floodlights/index.html");
ok("Floodlights loads no fonts from other sites", !fl.includes("fonts.googleapis.com") && !fl.includes("fonts.gstatic.com") && fl.includes("url(fonts/inter.woff2)"), null);
for (const f of ["inter.woff2", "chakra-petch-600.woff2", "chakra-petch-700.woff2", "instrument-serif-italic.woff2", "geist-mono.woff2"]) ok("font file present: " + f, has("floodlights/fonts/" + f), null);
ok("Floodlights shares the look: frame, starfield, glow button, glass buttons", fl.includes("lobbyframe") && fl.includes('id="bamStars"') && fl.includes("button.gold,.card #createBtn") && fl.includes("button.ghost{background:linear-gradient(135deg"), null);
ok("Floodlights has a way back to the landing page", fl.includes('class="homelink" href="/"') && fl.includes('class="chip homechip" href="/"'), null);
for (const id of ["lobby", "app", "createBtn", "joinBtn", "nameIn", "codeIn", "startBtn", "simBtn", "simToWrap", "simToW", "simToGo", "ffBtn18", "ffBtn37", "tabs", "matchWrap", "matchCanvas", "matchPanel", "playStatus", "ctModal", "tickerBar", "leaveBtn"]) ok("Floodlights element still there: #" + id, fl.includes('id="' + id + '"'), null);
for (const tab of ["squad", "lineup", "market", "offers", "romano", "matches", "calendar", "cups", "table", "cabinet", "academy", "nations", "feed"]) ok("Floodlights tab still there: " + tab, fl.includes('data-t="' + tab + '"') && fl.includes('id="tab-' + tab + '"'), null);
if (fs.existsSync(path.join(root, "..", "floodlights", "index.html"))) {
  // the game code inside the page must be the original, byte for byte. Only styles and the lobby shell changed.
  const origPage = fs.readFileSync(path.join(root, "..", "floodlights", "index.html"), "utf8");
  const mainScript = s => { const m = /<script>([\s\S]*?)<\/script>/.exec(s); return m ? m[1] : ""; };
  ok("the Floodlights game script is untouched", mainScript(fl) === mainScript(origPage) && mainScript(fl).length > 50000, mainScript(fl).length);
  const origServer = fs.readFileSync(path.join(root, "..", "floodlights", "server.js"), "utf8");
  const body = s => s.slice(s.indexOf("const SAVE_FILE"), s.lastIndexOf("app.get(\"/api/market\""));
  ok("the Floodlights game rules on the server are untouched", body(flServer) === body(origServer) && body(flServer).length > 100000, body(flServer).length);
  for (const f of ["players.js", "world_pack.js", "extra_clubs.js", "league_fill.js"]) ok("world data untouched: " + f, read("floodlights/" + f) === fs.readFileSync(path.join(root, "..", "floodlights", f), "utf8"), null);
  // the sim part of the match engine is the original too
  const origEngine = fs.readFileSync(path.join(root, "..", "floodlights", "match.js"), "utf8");
  const simPart = s => s.slice(s.indexOf("function createSim"), s.indexOf("// LOOK"));
  ok("the match sim (rules, AI, controls) is untouched", simPart(read("floodlights/match.js")) === simPart(origEngine) && simPart(origEngine).length > 30000, null);
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
  for (const f of ["package.json", "package-lock.json", "server.js", "next.config.ts", "tsconfig.json", "tsconfig.build.json", "postcss.config.mjs", ".gitignore", ".node-version", "render.yaml", "README.md", "DEPLOY.md", "floodlights/server.js", "floodlights/index.html", "floodlights/match.js", "floodlights/match3d.mjs", "floodlights/players.js", "floodlights/world_pack.js", "floodlights/extra_clubs.js", "floodlights/league_fill.js", "floodlights/fonts/inter.woff2", "floodlights/test_sept.js", "floodlights/test_dom_sept.js", "src/app/page.tsx", "src/app/layout.tsx", "src/landing/Landing.tsx", "src/landing/Backdrop3D.tsx", "src/landing/landing.css", "public/games/hardwood-legends.html", "data/players.json", "tests/landing.test.tsx", "tests-site/test_boot.js"]) ok("upload has " + f, upFiles.includes(f), null);
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
