// Floodlights 3D match: the broadcast HUD.
// A quiet TV package in the site kit look: black glass, hairlines, cut corners, Chakra Petch labels, Geist Mono
// numbers and one volt accent. What it shows:
//   top left      the score bug: short team names with a kit chip, the score, the minute, the half
//   over a head   the player you control: shirt number, surname, stamina, and the power meter while a kick charges
//   top centre    banners from events (goal, cards, offside, set pieces, half and full time); the goal is the
//                 one big moment, everything else is small and gone in two seconds
//   bottom left   one line of commentary at a time
//   bottom centre the radar, and above it the keys for a set piece that is yours to take
// Per frame it only writes to the DOM when a shown value changes, and it never builds new nodes per frame.
// With no document it returns no-ops, so the node tests can build it.

const STYLE_ID = "m3dHudStyle";
const ROOT_ID = "m3dHud";
const TAU = Math.PI * 2;
const RADAR_W = 150, RADAR_H = 96;
const YELLOW = "#ffd23f", RED = "#ff3b3b";
const SWEET_LO = 0.62, SWEET_HI = 0.82; // past 0.82 a shot starts to fly high (see kick.mjs)

// the keys for each restart the person takes (the order is the order they are most used)
const HINTS = {
  throwin: [["WASD", "Aim"], ["Q", "Short"], ["C", "Long"]],
  corner: [["WASD", "Aim"], ["C", "Cross"], ["Q", "Short"]],
  freekick: [["WASD", "Aim"], ["E", "Shoot"], ["R", "Curl"], ["C", "Cross"], ["Q", "Pass"]],
  freekickFar: [["WASD", "Aim"], ["C", "Cross"], ["Q", "Pass"]],
  penalty: [["WASD", "Aim"], ["E", "Hold to shoot"]],
  goalkick: [["WASD", "Aim"], ["Q", "Short"], ["C", "Long"]],
  kickoff: [["Q", "Pass"]]
};
const RESTART_NAME = { throwin: "Throw in", corner: "Corner", freekick: "Free kick", freekickFar: "Free kick", penalty: "Penalty", goalkick: "Goal kick", kickoff: "Kick off" };

const CSS = `
#m3dHud{--m3h-acc:var(--k-accent,#d0e85c);--m3h-glass:rgba(4,6,10,.72);--m3h-line:var(--k-line,rgba(255,255,255,.13));--m3h-cut:rgba(255,255,255,.2);--m3h-soft:var(--k-soft,#dbe1ea);--m3h-dim:var(--k-dim,#9aa3b2);--m3h-warn:var(--k-warn,#ffb547);--m3h-bad:var(--k-bad,#ff5d5d);--m3h-lbl:var(--k-f-lbl,"Chakra Petch",Inter,system-ui,sans-serif);--m3h-num:var(--k-f-num,"Geist Mono",ui-monospace,Menlo,monospace);--m3h-ui:var(--k-f-ui,Inter,system-ui,sans-serif);--m3h-ease:var(--k-ease,cubic-bezier(.22,1,.36,1));position:absolute;inset:0;z-index:4;pointer-events:none;overflow:hidden;contain:strict;color:#fff;font-family:var(--m3h-ui);-webkit-font-smoothing:antialiased;-webkit-user-select:none;user-select:none;transition:opacity .25s ease}
#matchPanel:not(.hidden)~#m3dHud{opacity:0;visibility:hidden;transition:opacity .2s ease,visibility 0s linear .2s}
#m3dHud .m3h-g{--c:8px;background:linear-gradient(to bottom left,transparent calc(50% - .6px),var(--m3h-cut) calc(50% - .6px),var(--m3h-cut) calc(50% + .6px),transparent calc(50% + .6px)) top right/var(--c) var(--c) no-repeat,linear-gradient(to bottom left,transparent calc(50% - .6px),var(--m3h-cut) calc(50% - .6px),var(--m3h-cut) calc(50% + .6px),transparent calc(50% + .6px)) bottom left/var(--c) var(--c) no-repeat,var(--m3h-glass);box-shadow:inset 0 0 0 1px var(--m3h-line);clip-path:polygon(0 0,calc(100% - var(--c)) 0,100% var(--c),100% 100%,var(--c) 100%,0 calc(100% - var(--c)))}
#m3dHud .m3h-blur{-webkit-backdrop-filter:blur(10px) saturate(1.25);backdrop-filter:blur(10px) saturate(1.25)}

#m3dHud .m3h-bug{position:absolute;top:18px;left:18px;display:flex;flex-direction:column;align-items:flex-start;gap:4px}
#m3dHud .m3h-bar{--c:9px;position:relative;display:flex;align-items:stretch;height:36px}
#m3dHud .m3h-hot{position:absolute;left:0;right:0;top:0;height:2px;background:var(--m3h-hotc,var(--m3h-acc));transform:scaleX(0);transform-origin:0 50%;opacity:0}
#m3dHud .m3h-tm{display:flex;align-items:center;gap:7px;padding:0 11px 0 12px}
#m3dHud .m3h-tm.r{padding:0 12px 0 11px}
#m3dHud .m3h-chip{flex:none;display:block;width:3px;height:16px;background:#888;box-shadow:0 0 0 1px rgba(255,255,255,.16)}
#m3dHud .m3h-code{position:relative;font:700 13px/1 var(--m3h-lbl);letter-spacing:.1em;margin-right:-.1em}
#m3dHud .m3h-tm.me .m3h-code::after{content:"";position:absolute;left:0;right:.1em;bottom:-6px;height:1.5px;background:var(--m3h-acc)}
#m3dHud .m3h-rc{display:flex;gap:2px}
#m3dHud .m3h-rc:empty{display:none}
#m3dHud .m3h-rc i{display:block;width:5px;height:8px;border-radius:1px;background:${RED}}
#m3dHud .m3h-sc{display:flex;align-items:center;padding:0 11px;background:rgba(255,255,255,.06);box-shadow:inset 1px 0 0 var(--m3h-line),inset -1px 0 0 var(--m3h-line)}
#m3dHud .m3h-dw{display:block;height:20px;overflow:hidden}
#m3dHud .m3h-d{display:block;min-width:11px;font:600 17px/20px var(--m3h-num);text-align:center;font-variant-numeric:tabular-nums}
#m3dHud .m3h-dash{display:block;width:6px;height:1.5px;margin:0 7px;background:rgba(255,255,255,.42)}
#m3dHud .m3h-clk{display:flex;align-items:center;justify-content:center;min-width:56px;padding:0 13px 0 12px;box-shadow:inset 1px 0 0 var(--m3h-line);font:500 13px/1 var(--m3h-num);color:var(--m3h-acc);font-variant-numeric:tabular-nums;white-space:nowrap}
#m3dHud .m3h-st{--c:5px;display:flex;align-items:center;height:18px;padding:0 10px;font:600 9.5px/1 var(--m3h-lbl);letter-spacing:.16em;text-transform:uppercase;color:var(--m3h-dim)}
#m3dHud .m3h-st.hot{color:var(--m3h-acc)}

#m3dHud .m3h-tag{position:absolute;left:0;top:0;width:0;height:0;opacity:0;visibility:hidden;transition:opacity .18s ease,visibility 0s linear .18s;will-change:transform}
#m3dHud .m3h-tag.on{opacity:1;visibility:visible;transition:opacity .18s ease}
#m3dHud .m3h-tagi{position:absolute;left:0;bottom:0;display:flex;flex-direction:column;align-items:center;gap:3px;transform:translateX(-50%)}
#m3dHud .m3h-pw{display:flex;align-items:center;gap:5px;height:10px;opacity:0;transition:opacity .12s ease}
#m3dHud .m3h-pw.on{opacity:1}
#m3dHud .m3h-pk{min-width:7px;font:600 9px/1 var(--m3h-num);color:var(--m3h-acc)}
#m3dHud .m3h-pk:empty{display:none}
#m3dHud .m3h-pt{position:relative;display:block;width:66px;height:6px;background:rgba(4,6,10,.8);box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)}
#m3dHud .m3h-pf{position:absolute;left:1px;top:1px;bottom:1px;right:1px;background:var(--m3h-acc);transform:scaleX(0);transform-origin:0 50%}
#m3dHud .m3h-pw.over .m3h-pf{background:var(--m3h-warn)}
#m3dHud .m3h-pb{position:absolute;top:-2px;bottom:-2px;left:${SWEET_LO * 100}%;width:${Math.round((SWEET_HI - SWEET_LO) * 100)}%;background:rgba(255,255,255,.12);box-shadow:inset 1px 0 0 rgba(255,255,255,.7),inset -1px 0 0 rgba(255,255,255,.7)}
#m3dHud .m3h-pw.nb .m3h-pb{display:none}
#m3dHud .m3h-pl{display:flex;flex-direction:column;gap:2px}
#m3dHud .m3h-plate{display:flex;align-items:stretch;height:19px;background:rgba(4,6,10,.8);box-shadow:inset 0 0 0 1px var(--m3h-line);clip-path:polygon(0 0,calc(100% - 5px) 0,100% 5px,100% 100%,5px 100%,0 calc(100% - 5px))}
#m3dHud .m3h-pn{display:grid;place-items:center;min-width:20px;padding:0 4px;font:600 10.5px/1 var(--m3h-num)}
#m3dHud .m3h-pn:empty{display:none}
#m3dHud .m3h-pnm{display:flex;align-items:center;padding:0 8px 0 7px;font:700 10.5px/1 var(--m3h-lbl);letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}
#m3dHud .m3h-stam{display:block;height:2px;background:rgba(255,255,255,.16)}
#m3dHud .m3h-stam i{display:block;height:100%;background:var(--m3h-acc);transform-origin:0 50%}
#m3dHud .m3h-stam.mid i{background:var(--m3h-warn)}
#m3dHud .m3h-stam.low i{background:var(--m3h-bad)}
#m3dHud .m3h-ptick{display:block;width:1px;height:6px;background:rgba(255,255,255,.5)}

#m3dHud .m3h-banw,#m3dHud .m3h-goalw,#m3dHud .m3h-hintw{position:absolute;left:0;right:0;display:flex;justify-content:center}
#m3dHud .m3h-banw{top:max(84px,11vh)}
#m3dHud .m3h-goalw{top:max(92px,14vh)}
#m3dHud .m3h-hintw{bottom:124px}
#m3dHud .m3h-ban{--c:10px;position:relative;display:flex;align-items:center;gap:12px;height:40px;padding:0 20px 0 16px;white-space:nowrap;opacity:0;visibility:hidden;transform:translateY(-6px)}
#m3dHud .m3h-bline{position:absolute;left:0;right:0;top:0;height:2px;background:var(--m3h-bc,var(--m3h-acc))}
#m3dHud .m3h-bk{flex:none;display:block;width:3px;height:18px;background:var(--m3h-acc)}
#m3dHud .m3h-bk.none{display:none}
#m3dHud .m3h-bk.card{width:11px;height:15px;border-radius:1.5px;transform:rotate(-8deg);box-shadow:0 2px 6px rgba(0,0,0,.45)}
#m3dHud .m3h-bk.card.y{background:${YELLOW}}
#m3dHud .m3h-bk.card.r{background:${RED}}
#m3dHud .m3h-bw{display:block;font:700 15px/1 var(--m3h-lbl);letter-spacing:.16em;margin-right:-.16em;text-transform:uppercase}
#m3dHud .m3h-bsub{display:flex;align-items:center;gap:8px;height:16px;padding-left:12px;box-shadow:inset 1px 0 0 var(--m3h-line);font:600 11px/1 var(--m3h-lbl);letter-spacing:.12em;color:var(--m3h-soft);text-transform:uppercase}
#m3dHud .m3h-bsub.none{display:none}
#m3dHud .m3h-bn{font:500 11px/1 var(--m3h-num);letter-spacing:0;color:var(--m3h-acc);font-variant-numeric:tabular-nums}
#m3dHud .m3h-bs:empty,#m3dHud .m3h-bn:empty{display:none}

#m3dHud .m3h-goal{--c:16px;position:relative;display:flex;flex-direction:column;align-items:center;padding:20px 52px 18px;overflow:hidden;opacity:0;visibility:hidden;transform:translateY(-6px)}
#m3dHud .m3h-gwash{position:absolute;inset:0;opacity:.45;background:radial-gradient(90% 120% at 50% 0%,var(--m3h-gcw,rgba(208,232,92,.2)),transparent 70%)}
#m3dHud .m3h-grule{position:absolute;left:0;right:0;top:0;height:3px;background:var(--m3h-gc,var(--m3h-acc))}
#m3dHud .m3h-gsw{position:absolute;top:0;bottom:0;left:0;width:42%;background:linear-gradient(100deg,transparent 20%,rgba(255,255,255,.07) 42%,rgba(255,255,255,.14) 50%,rgba(255,255,255,.07) 58%,transparent 80%);transform:translateX(-110%)}
#m3dHud .m3h-gw{position:relative;display:block;font:700 clamp(46px,6.4vw,84px)/.86 var(--m3h-lbl);letter-spacing:.12em;margin-right:-.12em;text-transform:uppercase;white-space:nowrap}
#m3dHud .m3h-gs{position:relative;display:flex;align-items:center;gap:10px;margin-top:14px;font:700 12px/1 var(--m3h-lbl);letter-spacing:.14em;color:var(--m3h-soft);text-transform:uppercase;white-space:nowrap}
#m3dHud .m3h-gs .m3h-chip{height:12px}
#m3dHud .m3h-gs .n{font:500 12px/1 var(--m3h-num);letter-spacing:0;color:var(--m3h-acc)}
#m3dHud .m3h-gs .n:empty{display:none}

#m3dHud .m3h-tick{position:absolute;left:18px;bottom:18px;width:min(520px,calc(50% - 114px));height:34px}
#m3dHud .m3h-tl{--c:7px;position:absolute;left:0;bottom:0;display:flex;align-items:center;gap:10px;max-width:100%;height:34px;padding:0 15px 0 12px;opacity:0;transform:translateY(-5px);transition:opacity .4s ease,transform .5s var(--m3h-ease)}
#m3dHud .m3h-tl.on{opacity:1;transform:none;animation:m3hUp .5s var(--m3h-ease)}
#m3dHud .m3h-tmin{flex:none;min-width:22px;font:500 11px/1 var(--m3h-num);color:var(--m3h-dim);font-variant-numeric:tabular-nums}
#m3dHud .m3h-tmin:empty{display:none}
#m3dHud .m3h-tt{min-width:0;font:500 13px/1.25 var(--m3h-ui);color:var(--m3h-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#m3dHud .m3h-tl.goal .m3h-tt{color:#fff;font-weight:600}
#m3dHud .m3h-tl.goal .m3h-tmin{color:var(--m3h-acc)}

#m3dHud .m3h-hint{--c:7px;display:flex;align-items:center;gap:10px;height:32px;padding:0 12px 0 13px;opacity:0;transform:translateY(6px);transition:opacity .3s ease,transform .45s var(--m3h-ease)}
#m3dHud .m3h-hint.on{opacity:1;transform:none}
#m3dHud .m3h-hn{display:flex;align-items:center;height:14px;padding-right:11px;box-shadow:inset -1px 0 0 var(--m3h-line);font:700 10px/1 var(--m3h-lbl);letter-spacing:.16em;text-transform:uppercase;white-space:nowrap}
#m3dHud .m3h-hks{display:flex;align-items:center;gap:10px}
#m3dHud .m3h-ck{display:inline-flex;align-items:center;gap:5px;font:700 10px/1 var(--m3h-lbl);letter-spacing:.08em;text-transform:uppercase;color:var(--m3h-soft);white-space:nowrap}
#m3dHud .m3h-ck kbd{display:inline-grid;place-items:center;min-width:17px;height:16px;padding:0 5px;border-radius:999px;background:rgba(208,232,92,.15);background:color-mix(in srgb,var(--m3h-acc) 15%,transparent);box-shadow:inset 0 0 0 1px rgba(208,232,92,.42);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--m3h-acc) 42%,transparent);color:var(--m3h-acc);font:600 10px/1 var(--m3h-num);letter-spacing:0}

#m3dHud .m3h-radar{--c:8px;--m3h-glass:rgba(4,6,10,.5);position:absolute;left:50%;bottom:16px;width:${RADAR_W}px;height:${RADAR_H}px;margin-left:-${RADAR_W / 2}px}
#m3dHud .m3h-radar canvas{display:block;width:${RADAR_W}px;height:${RADAR_H}px}

#m3dHud:not(.m3h-gsap) .m3h-ban,#m3dHud:not(.m3h-gsap) .m3h-goal{transition:opacity .3s ease,transform .3s ease,visibility 0s linear .3s}
#m3dHud .m3h-ban.on,#m3dHud .m3h-goal.on{opacity:1;visibility:visible;transform:none}
#m3dHud:not(.m3h-gsap) .m3h-ban.on,#m3dHud:not(.m3h-gsap) .m3h-goal.on{transition:opacity .2s ease}
#m3dHud:not(.m3h-gsap) .on.pA{animation:m3hDropA .5s var(--m3h-ease)}
#m3dHud:not(.m3h-gsap) .on.pB{animation:m3hDropB .5s var(--m3h-ease)}
#m3dHud:not(.m3h-gsap) .on.pA .m3h-rise{animation:m3hRiseA .55s .05s var(--m3h-ease) both}
#m3dHud:not(.m3h-gsap) .on.pB .m3h-rise{animation:m3hRiseB .55s .05s var(--m3h-ease) both}
#m3dHud:not(.m3h-gsap) .on.pA .m3h-rise2{animation:m3hRiseA .55s .18s var(--m3h-ease) both}
#m3dHud:not(.m3h-gsap) .on.pB .m3h-rise2{animation:m3hRiseB .55s .18s var(--m3h-ease) both}
#m3dHud:not(.m3h-gsap) .on.pA .m3h-draw{animation:m3hDrawA .75s var(--m3h-ease) both}
#m3dHud:not(.m3h-gsap) .on.pB .m3h-draw{animation:m3hDrawB .75s var(--m3h-ease) both}
#m3dHud:not(.m3h-gsap) .on.pA .m3h-gsw{animation:m3hSweepA 1s .2s ease-in-out both}
#m3dHud:not(.m3h-gsap) .on.pB .m3h-gsw{animation:m3hSweepB 1s .2s ease-in-out both}
#m3dHud:not(.m3h-gsap) .m3h-d.rA{animation:m3hRollA .6s var(--m3h-ease)}
#m3dHud:not(.m3h-gsap) .m3h-d.rB{animation:m3hRollB .6s var(--m3h-ease)}
#m3dHud:not(.m3h-gsap) .m3h-hot.hA{animation:m3hHotA 3.2s var(--m3h-ease)}
#m3dHud:not(.m3h-gsap) .m3h-hot.hB{animation:m3hHotB 3.2s var(--m3h-ease)}
@keyframes m3hUp{from{opacity:0;transform:translateY(6px)}}
@keyframes m3hDropA{from{opacity:0;transform:translateY(-12px)}}
@keyframes m3hDropB{from{opacity:0;transform:translateY(-12px)}}
@keyframes m3hRiseA{from{opacity:0;transform:translateY(9px)}}
@keyframes m3hRiseB{from{opacity:0;transform:translateY(9px)}}
@keyframes m3hDrawA{from{transform:scaleX(0)}}
@keyframes m3hDrawB{from{transform:scaleX(0)}}
@keyframes m3hSweepA{from{transform:translateX(-110%)}to{transform:translateX(260%)}}
@keyframes m3hSweepB{from{transform:translateX(-110%)}to{transform:translateX(260%)}}
@keyframes m3hRollA{from{opacity:0;transform:translateY(100%)}}
@keyframes m3hRollB{from{opacity:0;transform:translateY(100%)}}
@keyframes m3hHotA{0%{opacity:1;transform:scaleX(0)}20%{opacity:1;transform:scaleX(1)}70%{opacity:1;transform:scaleX(1)}100%{opacity:0;transform:scaleX(1)}}
@keyframes m3hHotB{0%{opacity:1;transform:scaleX(0)}20%{opacity:1;transform:scaleX(1)}70%{opacity:1;transform:scaleX(1)}100%{opacity:0;transform:scaleX(1)}}

@media (max-width:720px){#m3dHud .m3h-bug{top:12px;left:12px}#m3dHud .m3h-tick{left:12px;right:12px;width:auto;bottom:122px}#m3dHud .m3h-hintw{bottom:164px}#m3dHud .m3h-radar{bottom:12px}}
@media (prefers-reduced-motion:reduce){#m3dHud *{animation:none!important}#m3dHud .m3h-tl,#m3dHud .m3h-hint,#m3dHud .m3h-ban,#m3dHud .m3h-goal{transform:none!important}#m3dHud .m3h-gsw{display:none}}
`;

function noop() {
  const nothing = () => {};
  return { root: null, update: nothing, event: nothing, dispose: nothing };
}

// ---------- colours ----------
function hexRgb(h) {
  let s = String(h || "").trim().replace(/^#/, "");
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s.slice(0, 6), 16);
  if (s.length < 6 || !isFinite(n)) return [136, 136, 136];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lumOf(c) {
  const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}
const rgbDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const rgba = (c, a) => "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";
function paintKit(k) {
  k = Array.isArray(k) ? k : [];
  const r1 = hexRgb(k[0] || "#888888"), r2 = hexRgb(k[1] || "#ffffff");
  const l1 = lumOf(r1), l2 = lumOf(r2);
  // a near black shirt vanishes on black glass: lines and dots take the second colour then, or plain white
  const acc = l1 >= 0.035 ? r1 : l2 >= 0.035 ? r2 : [232, 236, 242];
  return { c1: rgba(r1, 1), ink: l1 > 0.4 ? "#05070b" : "#ffffff", accRgb: acc, acc: rgba(acc, 1), wash: rgba(acc, 0.22), alt: r2, radar: rgba(acc, 1), dark: lumOf(acc) < 0.06 };
}

// ---------- names ----------
const SKIP = /^(fc|afc|cf|sc|ac|as|ss|club|the|de|of|and)$/i;
function wordsOf(name) {
  let s = String(name || "");
  if (s.normalize) s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const w = s.replace(/[^A-Za-z0-9 ]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const keep = w.filter(x => !SKIP.test(x));
  return keep.length ? keep : w;
}
const first3 = w => (w.join("") + "XXX").slice(0, 3).toUpperCase();
const alt3 = w => (w.length > 1 ? (w[0][0] + w[1] + "XX").slice(0, 3).toUpperCase() : first3(w));
// the first three letters, like a TV bug; two clubs that share them (Manchester City and United) get MCI and MUN
function teamCodes(a, b) {
  const wa = wordsOf(a), wb = wordsOf(b);
  let ca = first3(wa), cb = first3(wb);
  if (ca === cb) { ca = alt3(wa); cb = alt3(wb); if (ca === cb) cb = cb.slice(0, 2) + "2"; }
  return [ca, cb];
}
// 47' in the first half's added time reads 45+2'
function minText(mi, half) {
  mi = mi | 0;
  if (half === 1 && mi > 45) return "45+" + (mi - 45) + "'";
  if (half === 2 && mi > 90) return "90+" + (mi - 90) + "'";
  return mi + "'";
}
const upper = s => String(s || "").toUpperCase();

export function createHud(doc, wrap, ctx) {
  if (!doc || !wrap || typeof doc.createElement !== "function" || typeof wrap.appendChild !== "function") return noop();
  ctx = ctx || {};
  const win = doc.defaultView || (typeof window !== "undefined" ? window : null);
  const FL = ctx.FL || {};
  const DIMS = FL.DIMS || {};
  const HL = DIMS.HALF_L || 52.5, HW = DIMS.HALF_W || 34, BOX_D = DIMS.BOX_D || 16.5, BOX_HALF = DIMS.BOX_HALF || 20.16;
  const SIX_D = DIMS.SIX_D || 5.5, SIX_HALF = DIMS.SIX_HALF || 9.16, CIRCLE_R = DIMS.CIRCLE_R || 9.15;
  let reduced = false;
  try { reduced = !!(win && win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { reduced = false; }

  // home on the left, as on TV; team 0 is always the person's team
  const L = ctx.side === "away" ? 1 : 0, R = 1 - L;
  const kitsIn = Array.isArray(ctx.kits) ? ctx.kits : [];
  const team = [paintKit(kitsIn[0] || ["#e8ecf2", "#0a0e14"]), paintKit(kitsIn[1] || ["#4fb3ff", "#0a0e14"])];
  // two kits close in colour: the other side's dots on the radar take their second colour, or white
  if (rgbDist(team[0].accRgb, team[1].accRgb) < 80) {
    const alt = rgbDist(team[1].alt, team[0].accRgb) >= 80 ? team[1].alt : [255, 255, 255];
    team[1].radar = rgba(alt, 1);
    team[1].dark = lumOf(alt) < 0.06;
  }
  let names = Array.isArray(ctx.names) ? [ctx.names[0] || "", ctx.names[1] || ""] : ["", ""];

  // ---------- styles, once per page ----------
  if (!doc.getElementById(STYLE_ID)) {
    const st = doc.createElement("style");
    st.id = STYLE_ID;
    st.textContent = CSS;
    (doc.head || doc.documentElement || doc.body).appendChild(st);
  }

  // ---------- the nodes, built once and reused for the whole match ----------
  const root = doc.createElement("div");
  root.id = ROOT_ID;
  function el(tag, cls, parent, text) {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    (parent || root).appendChild(e);
    return e;
  }

  // score bug
  const bug = el("div", "m3h-bug");
  const bar = el("div", "m3h-bar m3h-g m3h-blur", bug);
  const hot = el("i", "m3h-hot", bar);
  const tmL = el("div", "m3h-tm", bar);
  const chipL = el("i", "m3h-chip", tmL);
  const codeL = el("b", "m3h-code", tmL);
  const rcL = el("span", "m3h-rc", tmL);
  const sc = el("div", "m3h-sc", bar);
  const dL = el("span", "m3h-d", el("span", "m3h-dw", sc), "0");
  el("i", "m3h-dash", sc);
  const dR = el("span", "m3h-d", el("span", "m3h-dw", sc), "0");
  const tmR = el("div", "m3h-tm r", bar);
  const rcR = el("span", "m3h-rc", tmR);
  const codeR = el("b", "m3h-code", tmR);
  const chipR = el("i", "m3h-chip", tmR);
  const clk = el("div", "m3h-clk", bar, "1'");
  const stEl = el("div", "m3h-st m3h-g m3h-blur", bug, "1st half");

  // tag over the controlled player: power meter on top so the plate never jumps when it appears
  const tag = el("div", "m3h-tag");
  tag.setAttribute("aria-hidden", "true");
  const tagi = el("div", "m3h-tagi", tag);
  const pw = el("div", "m3h-pw", tagi);
  const pk = el("b", "m3h-pk", pw);
  const pt = el("span", "m3h-pt", pw);
  const pf = el("i", "m3h-pf", pt);
  el("i", "m3h-pb", pt);
  const pl = el("div", "m3h-pl", tagi);
  const plate = el("div", "m3h-plate", pl);
  const pn = el("b", "m3h-pn", plate);
  const pnm = el("span", "m3h-pnm", plate);
  const stam = el("span", "m3h-stam", pl);
  const stamF = el("i", "", stam);
  el("i", "m3h-ptick", tagi);

  // small banner
  const banW = el("div", "m3h-banw");
  banW.setAttribute("aria-live", "polite");
  const ban = el("div", "m3h-ban m3h-g m3h-blur", banW);
  const banLine = el("i", "m3h-bline m3h-draw", ban);
  const banK = el("i", "m3h-bk", ban);
  const banWd = el("b", "m3h-bw m3h-rise", ban);
  const banSub = el("span", "m3h-bsub m3h-rise2", ban);
  const banS1 = el("span", "m3h-bs", banSub);
  const banN = el("span", "m3h-bn", banSub);
  const banS2 = el("span", "m3h-bs", banSub);

  // the goal
  const goalW = el("div", "m3h-goalw");
  goalW.setAttribute("aria-live", "polite");
  const goal = el("div", "m3h-goal m3h-g m3h-blur", goalW);
  const gWash = el("i", "m3h-gwash", goal);
  const gRule = el("i", "m3h-grule m3h-draw", goal);
  const gSweep = el("i", "m3h-gsw", goal);
  const gWord = el("b", "m3h-gw m3h-rise", goal, "GOAL");
  const gSub = el("div", "m3h-gs m3h-rise2", goal);
  const gChip = el("i", "m3h-chip", gSub);
  const gName = el("span", "", gSub);
  const gMin = el("span", "n", gSub);

  // commentary: two lines that take turns, so one fades out while the next comes in
  const tick = el("div", "m3h-tick");
  tick.setAttribute("aria-hidden", "true");
  const lines = [0, 1].map(() => {
    const l = el("div", "m3h-tl m3h-g m3h-blur", tick);
    return { l, mn: el("span", "m3h-tmin", l), tx: el("span", "m3h-tt", l) };
  });

  // set piece keys
  const hintW = el("div", "m3h-hintw");
  const hint = el("div", "m3h-hint m3h-g", hintW);
  const hintName = el("b", "m3h-hn", hint);
  const hintKeys = el("span", "m3h-hks", hint);

  // radar
  const rad = el("div", "m3h-radar m3h-g");
  rad.setAttribute("aria-hidden", "true");
  const cv = el("canvas", "", rad);
  const dpr = Math.min(2, Math.max(1, (win && win.devicePixelRatio) || 1));
  cv.width = Math.round(RADAR_W * dpr);
  cv.height = Math.round(RADAR_H * dpr);
  let rc = null;
  try { rc = cv.getContext ? cv.getContext("2d") : null; } catch (e) { rc = null; }
  const RS = Math.min((RADAR_W - 12) / (HL * 2), (RADAR_H - 12) / (HW * 2));
  const OX = RADAR_W / 2, OY = RADAR_H / 2;

  wrap.appendChild(root);

  // ---------- state: the last shown values, so a frame only writes what changed ----------
  const S = {
    t: 0, dead: false, gsOn: false, named: false,
    sL: -1, sR: -1, rL: -1, rR: -1, mi: -1, half: -1, phase: "",
    tagOn: false, tagId: -1, tx: NaN, ty: NaN, stamQ: -1, stamCls: "",
    pwOn: false, pwQ: -1, pwKey: null, pwBand: null, pwOver: false,
    hintKey: ""
  };
  const B = { on: false, until: 0, queued: null };
  const GL = { on: false, until: 0 };
  const T = { cur: -1, next: 0, shownAt: -9, pending: null };
  const tweened = [ban, banWd, banSub, banLine, goal, gWord, gSub, gRule, gSweep, gWash, dL, dR, hot];

  // GSAP drives the motion when it is on the page and the person has not asked for less motion
  function motion() {
    const g = !reduced && win && win.gsap && typeof win.gsap.timeline === "function" ? win.gsap : null;
    const on = !!g;
    if (on !== S.gsOn) { S.gsOn = on; root.classList.toggle("m3h-gsap", on); }
    return g;
  }
  // restart a CSS animation without forcing a layout: swap between two classes that run the same keyframes
  function flip(node, a, b) {
    if (node.classList.contains(a)) { node.classList.remove(a); node.classList.add(b); }
    else { node.classList.remove(b); node.classList.add(a); }
  }

  function paintNames() {
    const codes = teamCodes(names[0], names[1]);
    codeL.textContent = codes[L];
    codeR.textContent = codes[R];
    chipL.style.background = team[L].c1;
    chipR.style.background = team[R].c1;
    // the person's side carries a thin volt underline
    tmL.classList.toggle("me", L === 0);
    tmR.classList.toggle("me", R === 0);
    S.codes = codes;
  }
  paintNames();
  S.named = !!(names[0] && names[1]);

  function setReds(node, n) {
    node.textContent = "";
    for (let i = 0; i < n; i++) el("i", "", node);
  }

  // ---------- motion ----------
  function playIn(slab, word, sub, line, big) {
    const g = motion();
    slab.classList.add("on");
    if (!g) { flip(slab, "pA", "pB"); return; }
    g.killTweensOf(big ? [slab, word, sub, line, gSweep, gWash] : [slab, word, sub, line]);
    const tl = g.timeline();
    if (big) {
      tl.fromTo(slab, { autoAlpha: 0, y: -14 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "expo.out" }, 0)
        .fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: "expo.out" }, 0.02)
        .fromTo(word, { clipPath: "inset(0% 50% 0% 50%)", y: 14, scale: 1.06 }, { clipPath: "inset(0% 0% 0% 0%)", y: 0, scale: 1, duration: 0.7, ease: "expo.out" }, 0.04)
        .fromTo(gWash, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" }, 0)
        .to(gWash, { opacity: 0.45, duration: 1.2, ease: "power1.inOut" }, 0.6)
        .fromTo(sub, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "expo.out" }, 0.22)
        .fromTo(gSweep, { xPercent: -110 }, { xPercent: 260, duration: 1, ease: "power2.inOut" }, 0.18);
    } else {
      tl.fromTo(slab, { autoAlpha: 0, y: -10 }, { autoAlpha: 1, y: 0, duration: 0.42, ease: "expo.out" }, 0)
        .fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 0.55, ease: "expo.out" }, 0.02)
        .fromTo(word, { autoAlpha: 0, y: 7 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: "expo.out" }, 0.05)
        .fromTo(sub, { autoAlpha: 0, x: -6 }, { autoAlpha: 1, x: 0, duration: 0.45, ease: "expo.out" }, 0.14);
    }
  }
  function playOut(slab, now) {
    const g = motion();
    if (!g) { slab.classList.remove("on"); return; }
    g.killTweensOf(slab);
    const done = () => { slab.classList.remove("on"); g.set(slab, { clearProps: "opacity,visibility,transform" }); };
    if (now) { done(); return; }
    g.to(slab, { autoAlpha: 0, y: -8, duration: 0.3, ease: "power2.in", onComplete: done });
  }
  function roll(d) {
    const g = motion();
    if (!g) { flip(d, "rA", "rB"); return; }
    g.fromTo(d, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: "expo.out", overwrite: true });
  }
  function flash(color) {
    bar.style.setProperty("--m3h-hotc", color);
    const g = motion();
    if (!g) { flip(hot, "hA", "hB"); return; }
    g.killTweensOf(hot);
    g.timeline()
      .fromTo(hot, { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 0.6, ease: "expo.out" })
      .to(hot, { opacity: 0, duration: 0.9, ease: "power1.in" }, 2.2);
  }

  // ---------- banners ----------
  function bannerSpec(ev, sim) {
    const m = sim && sim.m;
    const P = id => (m && m.players && id >= 0 && m.players[id]) || null;
    const codes = S.codes || ["", ""];
    const spec = { word: upper(ev.banner), line: "", chip: "", glyph: "", s1: "", n: "", s2: "", hold: 1.9 };
    const teamOf = i => (i === 0 || i === 1 ? i : -1);
    let ti = teamOf(ev.team);
    if (ev.type === "card") {
      const p = P(ev.by);
      spec.glyph = ev.color === "red" ? "r" : "y";
      spec.line = ev.color === "red" ? RED : YELLOW;
      if (p) spec.s1 = upper(p.short || p.name);
      if (sim && sim.minute && m) spec.n = minText(sim.minute(), m.half);
      spec.hold = 2.2;
      return spec;
    }
    if (ev.type === "half" || ev.type === "full") {
      const s = m && m.score ? m.score : [0, 0];
      spec.s1 = codes[L];
      spec.n = (s[L] | 0) + " : " + (s[R] | 0);
      spec.s2 = codes[R];
      spec.hold = 3;
      return spec;
    }
    if (ev.type === "offside") { const p = P(ev.by); if (p) { ti = p.team; spec.s1 = upper(p.short || p.name); } }
    else if (ev.type === "foul") { const p = P(ev.on); if (p) ti = p.team; }
    if (ti >= 0) {
      spec.chip = team[ti].c1;
      if (!spec.s1) spec.s1 = codes[ti];
    }
    if (ev.type === "penalty") spec.hold = 2.2;
    return spec;
  }
  function showBan(spec) {
    ban.style.setProperty("--m3h-bc", spec.line || "var(--m3h-acc)");
    banK.className = "m3h-bk" + (spec.glyph ? " card " + spec.glyph : spec.chip ? "" : " none");
    banK.style.background = spec.glyph ? "" : spec.chip;
    banWd.textContent = spec.word;
    banS1.textContent = spec.s1;
    banN.textContent = spec.n;
    banS2.textContent = spec.s2;
    banSub.classList.toggle("none", !(spec.s1 || spec.n || spec.s2));
    B.on = true;
    B.until = S.t + spec.hold;
    playIn(ban, banWd, banSub, banLine, false);
  }
  function onBanner(ev, sim) {
    const spec = bannerSpec(ev, sim);
    // the goal owns the top of the screen; the newest small banner waits for it to clear
    if (GL.on) { B.queued = { spec, at: S.t }; return; }
    showBan(spec);
  }
  function onGoal(ev, sim) {
    const m = sim && sim.m;
    const ti = ev.team === 1 ? 1 : 0;
    const k = team[ti];
    const p = m && m.players && ev.by >= 0 ? m.players[ev.by] : null;
    gWord.textContent = ev.own ? "OWN GOAL" : "GOAL";
    gName.textContent = upper(p ? p.name || p.short : names[ti]);
    gMin.textContent = ev.min ? minText(ev.min, m ? m.half : 1) : "";
    goal.style.setProperty("--m3h-gc", k.acc);
    goal.style.setProperty("--m3h-gcw", k.wash);
    gChip.style.background = k.c1;
    if (B.on) { playOut(ban, true); B.on = false; }
    B.queued = null;
    GL.on = true;
    GL.until = S.t + 2.8;
    playIn(goal, gWord, gSub, gRule, true);
    flash(k.acc);
  }

  // ---------- commentary ----------
  function stampOf(sim) {
    const m = sim && sim.m;
    if (!m) return "";
    if (m.phase === "full") return "FT";
    if (m.phase === "halftime") return "HT";
    return sim.minute ? minText(sim.minute(), m.half) : "";
  }
  function showLine(it) {
    const i = T.next;
    if (T.cur >= 0) lines[T.cur].l.classList.remove("on");
    const ln = lines[i];
    ln.mn.textContent = it.stamp;
    ln.tx.textContent = it.text;
    ln.l.classList.toggle("goal", it.goal);
    ln.l.classList.add("on");
    T.cur = i;
    T.next = 1 - i;
    T.shownAt = S.t;
  }
  function onSay(ev, sim) {
    if (!ev.text) return;
    const it = { text: String(ev.text), goal: ev.kind === "goal", stamp: stampOf(sim) };
    // every line gets a moment to be read; a newer one waits and replaces anything already waiting
    if (T.cur >= 0 && S.t - T.shownAt < 1.4) { T.pending = it; return; }
    showLine(it);
  }

  // ---------- per frame ----------
  function scoreBug(sim, m) {
    const s = m.score || [0, 0];
    const sL = s[L] | 0, sR = s[R] | 0;
    if (sL !== S.sL) { dL.textContent = String(sL); if (S.sL >= 0) roll(dL); S.sL = sL; }
    if (sR !== S.sR) { dR.textContent = String(sR); if (S.sR >= 0) roll(dR); S.sR = sR; }
    const red = m.stats && m.stats.red;
    if (red) {
      const rl = Math.min(3, red[L] | 0), rr = Math.min(3, red[R] | 0);
      if (rl !== S.rL) { setReds(rcL, rl); S.rL = rl; }
      if (rr !== S.rR) { setReds(rcR, rr); S.rR = rr; }
    }
    const ph = m.phase === "full" || m.phase === "halftime" ? m.phase : "on";
    const mi = ph === "on" && sim.minute ? sim.minute() | 0 : 0;
    if (ph !== S.phase || mi !== S.mi || m.half !== S.half) {
      const halfChanged = ph !== S.phase || m.half !== S.half;
      S.phase = ph; S.mi = mi; S.half = m.half;
      clk.textContent = ph === "full" ? "FT" : ph === "halftime" ? "HT" : minText(mi, m.half);
      if (halfChanged) {
        stEl.textContent = ph === "full" ? "Full time" : ph === "halftime" ? "Half time" : m.half === 2 ? "2nd half" : "1st half";
        stEl.classList.toggle("hot", ph !== "on");
      }
    }
  }

  function playerTag(m, info) {
    const live = m.phase === "play" || m.phase === "restart";
    const c = !m.auto && live && m.ctrl && !m.ctrl.off ? m.ctrl : null;
    let pos = null;
    if (c && info && typeof info.project === "function") {
      pos = info.project(c.x, c.y, 2.2);
      if (!pos || !pos.on || !isFinite(pos.x) || !isFinite(pos.y)) pos = null;
    }
    const on = !!pos;
    if (on !== S.tagOn) { tag.classList.toggle("on", on); S.tagOn = on; }
    if (!on) return;
    const x = Math.round(pos.x * 2) / 2, y = Math.round(pos.y * 2) / 2;
    if (x !== S.tx || y !== S.ty) { S.tx = x; S.ty = y; tag.style.transform = "translate3d(" + x + "px," + y + "px,0)"; }
    if (c.id !== S.tagId) {
      S.tagId = c.id;
      const k = team[c.team === 1 ? 1 : 0];
      pn.textContent = c.num ? String(c.num) : "";
      pn.style.background = k.c1;
      pn.style.color = k.ink;
      pnm.textContent = upper(c.short || c.name);
    }
    const sv = typeof c.stam === "number" ? (c.stam < 0 ? 0 : c.stam > 1 ? 1 : c.stam) : 1;
    const sq = Math.round(sv * 60);
    if (sq !== S.stamQ) {
      S.stamQ = sq;
      stamF.style.transform = "scaleX(" + (sq / 60).toFixed(3) + ")";
      const cls = sv < 0.25 ? "low" : sv < 0.5 ? "mid" : "";
      if (cls !== S.stamCls) { S.stamCls = cls; stam.className = cls ? "m3h-stam " + cls : "m3h-stam"; }
    }
    // the power meter: a kick key held in open play, or the power on a set piece the person is taking
    let v = -1, key = "", band = false;
    const hp = m.hud && m.hud.power;
    const Rs = m.restart;
    if (m.phase === "play" && hp && hp.v > 0) { v = hp.v; key = hp.key || ""; band = key === "E" || key === "R"; }
    else if (m.phase === "restart" && Rs && Rs.ready && Rs.team === m.userTeam && m.aim && m.aim.power > 0) {
      v = m.aim.power; band = Rs.kind === "penalty" || Rs.kind === "freekick";
    }
    const pOn = v >= 0;
    if (pOn !== S.pwOn) { S.pwOn = pOn; pw.classList.toggle("on", pOn); }
    if (!pOn) return;
    const q = Math.round((v > 1 ? 1 : v) * 100);
    if (q !== S.pwQ) { S.pwQ = q; pf.style.transform = "scaleX(" + (q / 100) + ")"; }
    if (key !== S.pwKey) { S.pwKey = key; pk.textContent = key; }
    if (band !== S.pwBand) { S.pwBand = band; pw.classList.toggle("nb", !band); }
    const over = band && v > SWEET_HI;
    if (over !== S.pwOver) { S.pwOver = over; pw.classList.toggle("over", over); }
  }

  function setPieceHint(m) {
    const Rs = m.restart;
    let key = "";
    if (Rs && Rs.ready && !m.auto && m.phase === "restart" && Rs.team === m.userTeam && HINTS[Rs.kind]) {
      key = Rs.kind;
      if (key === "freekick") {
        const tm = m.teams && m.teams[Rs.team];
        const gx = (tm && tm.dir ? tm.dir : 1) * HL;
        if (Math.hypot(gx - Rs.x, Rs.y) >= 35) key = "freekickFar";
      }
    }
    if (key === S.hintKey) return;
    S.hintKey = key;
    if (!key) { hint.classList.remove("on"); return; }
    hintName.textContent = RESTART_NAME[key];
    hintKeys.textContent = "";
    for (const k of HINTS[key]) {
      const ck = el("span", "m3h-ck", hintKeys);
      el("kbd", "", ck, k[0]);
      el("span", "", ck, k[1]);
    }
    hint.classList.add("on");
  }

  function timers() {
    if (GL.on && S.t >= GL.until) {
      GL.on = false;
      playOut(goal);
      const q = B.queued;
      B.queued = null;
      if (q && S.t - q.at < 4) showBan(q.spec);
    }
    if (B.on && S.t >= B.until) { B.on = false; playOut(ban); }
    if (T.pending && S.t - T.shownAt >= 1.4) { const it = T.pending; T.pending = null; showLine(it); }
    else if (T.cur >= 0 && S.t - T.shownAt > 6.5) { lines[T.cur].l.classList.remove("on"); T.cur = -1; }
  }

  function drawRadar(m) {
    if (!rc) return;
    const c = rc;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, RADAR_W, RADAR_H);
    // the pitch: screen up is sim -y, as the broadcast camera sees it
    const x0 = OX - HL * RS, y0 = OY - HW * RS, w = HL * 2 * RS, h = HW * 2 * RS;
    c.fillStyle = "rgba(255,255,255,0.03)";
    c.fillRect(x0, y0, w, h);
    c.strokeStyle = "rgba(255,255,255,0.26)";
    c.lineWidth = 0.75;
    c.beginPath();
    c.rect(x0, y0, w, h);
    c.moveTo(OX, y0); c.lineTo(OX, y0 + h);
    c.moveTo(OX + CIRCLE_R * RS, OY); c.arc(OX, OY, CIRCLE_R * RS, 0, TAU);
    c.rect(x0, OY - BOX_HALF * RS, BOX_D * RS, BOX_HALF * 2 * RS);
    c.rect(x0 + w - BOX_D * RS, OY - BOX_HALF * RS, BOX_D * RS, BOX_HALF * 2 * RS);
    c.rect(x0, OY - SIX_HALF * RS, SIX_D * RS, SIX_HALF * 2 * RS);
    c.rect(x0 + w - SIX_D * RS, OY - SIX_HALF * RS, SIX_D * RS, SIX_HALF * 2 * RS);
    c.stroke();
    const teams = m.teams || [];
    for (let t = 0; t < 2; t++) {
      const tm = teams[t];
      if (!tm || !tm.players) continue;
      const ps = tm.players;
      c.beginPath();
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        if (p.off) continue;
        const X = clampN(OX + p.x * RS, 2, RADAR_W - 2), Y = clampN(OY + p.y * RS, 2, RADAR_H - 2);
        c.moveTo(X + 2.6, Y);
        c.arc(X, Y, 2.6, 0, TAU);
      }
      c.fillStyle = team[t].radar;
      c.fill();
      if (team[t].dark) { c.lineWidth = 0.8; c.strokeStyle = "rgba(255,255,255,0.6)"; c.stroke(); }
    }
    const k = !m.auto && m.ctrl && !m.ctrl.off ? m.ctrl : null;
    if (k) {
      c.beginPath();
      c.arc(clampN(OX + k.x * RS, 2, RADAR_W - 2), clampN(OY + k.y * RS, 2, RADAR_H - 2), 4.6, 0, TAU);
      c.lineWidth = 1.3;
      c.strokeStyle = "#d0e85c";
      c.stroke();
    }
    const b = m.ball;
    if (b && isFinite(b.x) && isFinite(b.y)) {
      // a ball in the air reads a touch bigger
      const r = 1.9 + Math.min(1.4, Math.max(0, (b.z || 0) - 0.3) * 0.12);
      c.beginPath();
      c.arc(clampN(OX + b.x * RS, 2, RADAR_W - 2), clampN(OY + b.y * RS, 2, RADAR_H - 2), r, 0, TAU);
      c.fillStyle = "#ffffff";
      c.fill();
      c.lineWidth = 0.8;
      c.strokeStyle = "rgba(4,6,10,0.85)";
      c.stroke();
    }
  }

  function update(sim, info, dt) {
    if (S.dead || !sim || !sim.m) return;
    const m = sim.m;
    S.t += dt > 0 ? (dt > 0.25 ? 0.25 : dt) : 0;
    if (!S.named && m.teams && m.teams[1]) {
      names = [names[0] || m.teams[0].name || "Home", names[1] || m.teams[1].name || "Away"];
      paintNames();
      S.named = true;
    }
    scoreBug(sim, m);
    playerTag(m, info);
    setPieceHint(m);
    timers();
    drawRadar(m);
  }

  function event(ev, sim) {
    if (S.dead || !ev) return;
    if (ev.type === "say") { onSay(ev, sim); return; }
    if (!ev.banner) return;
    if (ev.type === "goal") onGoal(ev, sim);
    else onBanner(ev, sim);
  }

  function dispose() {
    if (S.dead) return;
    S.dead = true;
    const g = win && win.gsap;
    if (g && typeof g.killTweensOf === "function") { try { g.killTweensOf(tweened); } catch (e) { /* the page is going away anyway */ } }
    if (root.parentNode) root.parentNode.removeChild(root);
    // the style tag goes with the last HUD on the page
    if (!doc.getElementById(ROOT_ID)) {
      const st = doc.getElementById(STYLE_ID);
      if (st && st.parentNode) st.parentNode.removeChild(st);
    }
  }

  return { root, update, event, dispose };
}

function clampN(v, a, b) { return v < a ? a : v > b ? b : v; }
