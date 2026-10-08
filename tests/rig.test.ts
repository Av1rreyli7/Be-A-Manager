// The body rig (floodlights/m3d/view/rig.mjs): the match's players and his own career body must come out byte for
// byte the same as before the woman's figure, long hair and everyday clothes were added. The numbers below are
// fingerprints of every vertex, colour, bone weight and triangle for a spread of match and career looks, taken
// before those options existed. The new options must change the body (or they do nothing).
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildBody } from "../floodlights/m3d/view/rig.mjs";

function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const KITS: [string, string][] = [["#c8102e", "#ffffff"], ["#1b2430", "#ffffff"], ["#6cabdd", "#1c2c5b"], ["#fde100", "#000000"], ["#034694", "#ffffff"]];
function matchLook(r: () => number) {
  const kit = KITS[Math.floor(r() * KITS.length)];
  return {
    h: 1.68 + r() * 0.26,
    mass: 62 + r() * 28,
    skin: Math.floor(r() * 8),
    hair: Math.floor(r() * 16),
    hairCol: Math.floor(r() * 7),
    beard: Math.floor(r() * 6),
    boot: Math.floor(r() * 6),
    sleeve: r() < 0.2,
    sock: r() < 0.3,
    kit,
    shorts: r() < 0.5 ? kit[0] : kit[1],
    socks: kit[0],
    gk: r() < 0.1,
    cell: r() < 0.7 ? [0.25, 0.33, 0.5, 0.66] : null,
  };
}
// his own body in the career: the creator's sliders on top of a match look
function careerLook(r: () => number) {
  return {
    ...matchLook(r),
    skinF: r(),
    faceW: r(),
    jaw: r(),
    chin: r(),
    cheeks: r(),
    eyes: r(),
    eyeCol: Math.floor(r() * 6),
    brows: r(),
    nose: r(),
    mouth: r(),
    ears: r(),
    hairline: r(),
    moustache: r() < 0.3 ? 1 : 0,
    muscle: r(),
    shoulders: r(),
    legs: r(),
    watch: r() < 0.5 ? "gold" : undefined,
    bracelet: r() < 0.3 ? "silver" : undefined,
    necklace: r() < 0.3 ? "gold" : undefined,
    earrings: r() < 0.3 ? "silver" : undefined,
    headband: r() < 0.2 ? "white" : undefined,
    compression: r() < 0.2 ? "black" : undefined,
    gloves: r() < 0.1 ? "black" : undefined,
  };
}
function fnv(h: number, a: ArrayLike<number>, f32: boolean) {
  const buf = f32 ? new Uint8Array(new Float32Array(Array.from(a)).buffer) : new Uint8Array(new Uint32Array(Array.from(a)).buffer);
  for (let i = 0; i < buf.length; i++) h = Math.imul(h ^ buf[i], 16777619) >>> 0;
  return h;
}
function print(g: THREE.BufferGeometry) {
  let h = 2166136261;
  for (const k of ["position", "color", "uv", "skinIndex", "skinWeight", "normal"]) {
    const at = g.getAttribute(k) as THREE.BufferAttribute;
    h = fnv(h, at.array as ArrayLike<number>, k !== "skinIndex");
  }
  h = fnv(h, g.getIndex()!.array as ArrayLike<number>, false);
  for (const gr of g.groups) h = fnv(h, [gr.start, gr.count, gr.materialIndex || 0], false);
  return h.toString(16);
}
function sweep(seed: number, n: number, make: (r: () => number) => object, opts?: object) {
  const r = rand(seed);
  let h = 2166136261;
  for (let i = 0; i < n; i++) {
    const g = buildBody(THREE, make(r), opts) as THREE.BufferGeometry;
    h = fnv(h, [parseInt(print(g), 16)], false);
    g.dispose();
  }
  return h.toString(16);
}

describe("bodies stay the same", () => {
  it("match players (the match's detail) are byte for byte the same", () => {
    expect(sweep(7, 60, matchLook)).toBe(MATCH);
  });
  it("his own career body (close up detail, by material) is byte for byte the same", () => {
    expect(sweep(11, 16, careerLook, { detail: 2, groups: true })).toBe(CAREER2);
    expect(sweep(13, 16, careerLook, { detail: 1.5, groups: true })).toBe(CAREER15);
  });
});

describe("the people round him", () => {
  const base = { ...matchLook(rand(3)), sleeve: false, gk: false, cell: null, beard: 0 };
  const fp = (o: object, opts?: object) => print(buildBody(THREE, { ...base, ...o }, opts) as THREE.BufferGeometry);
  it("a woman's figure, everyday clothes and the long styles each change the body, at both details", () => {
    for (const opts of [undefined, { detail: 1.5, groups: true }]) {
      const plain = fp({}, opts);
      const seen = new Set([plain]);
      for (const o of [{ fem: true }, { bottom: "trousers" }, { bottom: "skirt" }, { bottom: "dress" }, { bottom: "gown" }, { top: "vest" }, { plain: true }, { shoe: ["#ffffff", "#cccccc"] }]) {
        const f = fp(o, opts);
        expect(seen.has(f)).toBe(false);
        seen.add(f);
      }
      for (let hair = 16; hair <= 21; hair++) {
        const f = fp({ hair }, opts);
        expect(f).not.toBe(fp({ hair: hair - 16 }, opts));
      }
    }
  });
  it("a gown hides the legs and a skirt shows them", () => {
    const g = buildBody(THREE, { ...base, fem: true, bottom: "gown", kit: ["#fbf8f2", "#fbf8f2"], shorts: "#fbf8f2" }) as THREE.BufferGeometry;
    const s = buildBody(THREE, { ...base, fem: true, bottom: "skirt", kit: ["#fbf8f2", "#fbf8f2"], shorts: "#fbf8f2" }) as THREE.BufferGeometry;
    // vertices low on the legs (below the knee) that are skin coloured
    const skinLow = (geo: THREE.BufferGeometry) => {
      const P = geo.getAttribute("position"), C = geo.getAttribute("color");
      let n = 0;
      for (let i = 0; i < P.count; i++) if (P.getY(i) < 0.4 && P.getY(i) > 0.12 && Math.abs(C.getX(i) - 0.984) > 0.05) n++;
      return n;
    };
    expect(skinLow(g)).toBe(0);
    expect(skinLow(s)).toBeGreaterThan(50);
  });
});

const MATCH = "c5da0f3d";
const CAREER2 = "d4db9d5b";
const CAREER15 = "4660b9d3";
