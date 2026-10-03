/* Be-A-Manager motion kit. One timing language for the whole site, built on GSAP.
   Floodlights and Hardwood Legends load it as a plain script after gsap.min.js and use window.KitMotion.
   The landing and Game Night import createKitMotion from src/lib/motion.ts with the npm gsap.

   Rules (from the GSAP guide): only transform and opacity move, so the GPU does the work.
   Entrances run once and stay under half a second in total. Nothing sets pointer-events, so input is never
   blocked. Every tween clears its inline transform when done, so nothing is left trapping a fixed child.
   Reduced motion users get the end state at once. */
(function (root) {
  "use strict";

  function createKitMotion(gsap) {
    var mm = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    function reduced() { return !gsap || !!(mm && mm.matches); }
    var CLEAR = "transform,opacity,visibility";
    var EASE = "power3.out";
    var MAX_ROWS = 24;

    function list(t, scope) {
      if (!t) return [];
      if (typeof t === "string") return Array.prototype.slice.call((scope || document).querySelectorAll(t));
      if (t.length !== undefined && !t.nodeType) return Array.prototype.slice.call(t);
      return [t];
    }
    function done(els) { if (gsap) gsap.set(els, { clearProps: CLEAR }); }

    /* headers and blocks rise in */
    function rise(targets, o) {
      o = o || {};
      var els = list(targets, o.scope);
      if (!els.length) return null;
      if (reduced()) { done(els); return null; }
      return gsap.fromTo(els, { autoAlpha: 0, y: o.y == null ? 12 : o.y }, {
        autoAlpha: 1, y: 0, duration: o.duration || 0.38, delay: o.delay || 0, ease: EASE,
        stagger: o.stagger == null ? 0.05 : o.stagger, overwrite: "auto", clearProps: CLEAR
      });
    }

    /* rows of a table or list cascade in; only the first 24 get their own beat so a long table never drags */
    function cascade(targets, o) {
      o = o || {};
      var els = list(targets, o.scope);
      if (!els.length) return null;
      if (reduced()) { done(els); return null; }
      var head = els.slice(0, MAX_ROWS), tail = els.slice(MAX_ROWS);
      var each = Math.min(o.each || 0.022, 0.3 / Math.max(1, head.length));
      var tl = gsap.timeline({ delay: o.delay || 0 });
      tl.fromTo(head, { autoAlpha: 0, y: o.y == null ? 8 : o.y }, { autoAlpha: 1, y: 0, duration: 0.3, ease: EASE, stagger: each, clearProps: CLEAR }, 0);
      if (tail.length) tl.fromTo(tail, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25, ease: "power1.out", clearProps: CLEAR }, each * head.length);
      return tl;
    }

    /* a whole screen: the heading rises, panels settle, rows cascade. Pass the screen root. */
    function enter(rootEl, o) {
      o = o || {};
      if (!rootEl) return null;
      var heads = list(o.heads || "[data-km=head]", rootEl);
      var blocks = list(o.blocks || "[data-km=block]", rootEl);
      var rows = list(o.rows || "[data-km=rows] > *", rootEl);
      if (reduced()) { done(heads.concat(blocks, rows)); return null; }
      var tl = gsap.timeline();
      if (heads.length) tl.add(rise(heads, { y: 14, stagger: 0.04 }), 0);
      if (blocks.length) tl.add(rise(blocks, { y: 10, stagger: 0.04, duration: 0.34 }), 0.06);
      if (rows.length) tl.add(cascade(rows), 0.1);
      return tl;
    }

    /* numbers count up from where they were (or from 0) to the new value */
    function count(el, to, o) {
      o = o || {};
      if (!el) return null;
      var fmt = o.format || function (v) { return String(Math.round(v)); };
      var from = o.from != null ? o.from : 0;
      if (reduced() || from === to) { el.textContent = fmt(to); return null; }
      var box = { v: from };
      return gsap.to(box, { v: to, duration: o.duration || 0.6, ease: "power2.out", onUpdate: function () { el.textContent = fmt(box.v); }, onComplete: function () { el.textContent = fmt(to); } });
    }

    /* a small pop for something that just appeared (a modal, a badge, a chip) */
    function pop(el, o) {
      o = o || {};
      if (!el) return null;
      if (reduced()) { done(el); return null; }
      return gsap.fromTo(el, { autoAlpha: 0, scale: o.scale || 0.94 }, { autoAlpha: 1, scale: 1, duration: o.duration || 0.32, ease: "back.out(1.6)", clearProps: CLEAR });
    }

    /* a single heartbeat on something that changed (a form arrow, a score) */
    function pulse(el, o) {
      o = o || {};
      if (!el || reduced()) return null;
      return gsap.fromTo(el, { scale: 1 }, { scale: o.scale || 1.28, duration: 0.16, ease: "power2.out", yoyo: true, repeat: 1, clearProps: "transform" });
    }

    /* toasts slide in from the side and settle */
    function slideIn(el, o) {
      o = o || {};
      if (!el) return null;
      if (reduced()) { done(el); return null; }
      return gsap.fromTo(el, { autoAlpha: 0, x: o.x == null ? 22 : o.x }, { autoAlpha: 1, x: 0, duration: 0.38, ease: EASE, clearProps: CLEAR });
    }

    /* a tab indicator that slides to the active tab. Call again whenever the active tab changes. */
    function tabIndicator(bar, active, o) {
      o = o || {};
      if (!bar || !active) return;
      var ind = bar.querySelector(".k-tab-ind");
      if (!ind) {
        ind = document.createElement("span");
        ind.className = "k-tab-ind";
        ind.setAttribute("aria-hidden", "true");
        if (getComputedStyle(bar).position === "static") bar.style.position = "relative";
        bar.appendChild(ind);
      }
      var x = active.offsetLeft, w = active.offsetWidth;
      if (reduced() || !ind.dataset.ready) {
        if (gsap) gsap.set(ind, { x: x, width: w }); else { ind.style.transform = "translateX(" + x + "px)"; ind.style.width = w + "px"; }
        ind.dataset.ready = "1";
        return;
      }
      gsap.to(ind, { x: x, width: w, duration: 0.32, ease: "power3.out", overwrite: "auto" });
    }

    /* the big moment: a burst of light behind a headline plus a punchy scale in. Used for HERE WE GO and goals. */
    function celebrate(el, o) {
      o = o || {};
      if (!el) return null;
      if (reduced()) { done(el); return null; }
      var tl = gsap.timeline();
      tl.fromTo(el, { autoAlpha: 0, scale: 0.6, rotate: o.tilt == null ? -3 : o.tilt }, { autoAlpha: 1, scale: 1.08, rotate: 0, duration: 0.32, ease: "back.out(2.2)" })
        .to(el, { scale: 1, duration: 0.24, ease: "power2.out", clearProps: CLEAR });
      var ring = document.createElement("span");
      ring.className = "k-ring";
      ring.setAttribute("aria-hidden", "true");
      (o.ringParent || el).appendChild(ring);
      tl.fromTo(ring, { autoAlpha: 0.9, scale: 0.3 }, { autoAlpha: 0, scale: 2.4, duration: 0.8, ease: "power2.out", onComplete: function () { ring.remove(); } }, 0.05);
      return tl;
    }

    /* confetti style sparks for a celebration, a handful of small dots, all transform only */
    function sparks(host, o) {
      o = o || {};
      if (!host || reduced()) return null;
      var n = o.count || 18, colors = o.colors || ["#d0e85c", "#2fd27a", "#ffcf5a", "#3ee6c4", "#ff8a3d"];
      var tl = gsap.timeline();
      for (var i = 0; i < n; i++) {
        var d = document.createElement("i");
        d.className = "k-spark";
        d.style.background = colors[i % colors.length];
        host.appendChild(d);
        var a = (i / n) * Math.PI * 2 + Math.random() * 0.4, r = 70 + Math.random() * 90;
        tl.fromTo(d, { x: 0, y: 0, scale: 1, autoAlpha: 1 }, { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.7 + 30, scale: 0.4, autoAlpha: 0, duration: 0.7 + Math.random() * 0.3, ease: "power2.out", onComplete: (function (node) { return function () { node.remove(); }; })(d) }, Math.random() * 0.08);
      }
      return tl;
    }

    /* press feedback for buttons that are drawn by JS (CSS handles the rest with .k-press) */
    function press(el) {
      if (!el || reduced()) return null;
      return gsap.fromTo(el, { scale: 0.96 }, { scale: 1, duration: 0.22, ease: "back.out(2)", clearProps: "transform" });
    }

    return { reduced: reduced, rise: rise, cascade: cascade, enter: enter, count: count, pop: pop, pulse: pulse, slideIn: slideIn, tabIndicator: tabIndicator, celebrate: celebrate, sparks: sparks, press: press };
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { createKitMotion: createKitMotion };
  if (root && typeof root === "object") {
    root.createKitMotion = createKitMotion;
    if (root.gsap && !root.KitMotion) root.KitMotion = createKitMotion(root.gsap);
  }
})(typeof window !== "undefined" ? window : null);
