/**
 * How each brand's shop looks inside: its floor, its walls, its rails, its light and its sign. The real brands
 * get their own looks (the user asked for them by name); anything else is styled from the place's own colours.
 */
import * as THREE from "three";
import type { WorldPlace } from "../../types";
import { cachedTexture } from "../kit3d";
import { slug, type Surface } from "./common";

export interface BrandLook {
  key: string;
  floor: [Surface, string, string?];
  floorRough: number;
  floorTile: number;
  wall: [Surface, string, string?];
  wallBase: string;
  wallTile: number;
  /** the back wall's big moment */
  feature: "none" | "heart" | "ledwall" | "stripes" | "graffiti" | "chandelier" | "monogram" | "velvet" | "fireplace" | "bootwall" | "screens" | "cases";
  rail: string;
  railMetal: number;
  table: string;
  plinth: string;
  mannequin: string;
  hanger: string;
  lights: "track" | "strips" | "spots" | "chandelier" | "pendants";
  lightCol: string;
  warm: boolean;
  hemi: number;
  bg: string;
  /** colours for the stock that fills the rails around the real items */
  palette: string[];
  /** 0.5 a sparse luxury floor, 1 a full high street floor */
  density: number;
  luxury: boolean;
  signFg: string;
  signBg: string;
  accent: string;
}

const L = (o: Partial<BrandLook> & { key: string }): BrandLook => ({
  floor: ["concrete", "#8a8782"],
  floorRough: 0.6,
  floorTile: 4,
  wall: ["plain", "#e6e2da"],
  wallBase: "#e6e2da",
  wallTile: 3,
  feature: "none",
  rail: "#202020",
  railMetal: 0.7,
  table: "#d8d2c6",
  plinth: "#e8e4dc",
  mannequin: "#e9e6e0",
  hanger: "#1a1a1a",
  lights: "track",
  lightCol: "#fff4e2",
  warm: false,
  hemi: 0.8,
  bg: "#0b0c0e",
  palette: ["#222222", "#e8e4dc", "#7a7a7a", "#2a3a5a"],
  density: 1,
  luxury: false,
  signFg: "#111111",
  signBg: "#f2f0ea",
  accent: "#d0e85c",
  ...o,
});

export const LOOKS: Record<string, BrandLook> = {
  essentials: L({
    key: "essentials",
    floor: ["concrete", "#c8bcaa"],
    floorRough: 0.75,
    wall: ["concrete", "#ddd2c2"],
    wallBase: "#ddd2c2",
    rail: "#8f8a80",
    table: "#c9b79a",
    plinth: "#cfc3b1",
    mannequin: "#d8ccba",
    hanger: "#b49e7c",
    lights: "strips",
    lightCol: "#fff0dc",
    warm: true,
    hemi: 0.85,
    palette: ["#cbbfae", "#a89c8a", "#ece4d6", "#2a2826", "#8a8680", "#6e665a"],
    density: 0.8,
    signFg: "#2a2622",
    signBg: "#d8ccba",
    accent: "#cbbfae",
  }),
  ralph: L({
    key: "ralph",
    floor: ["carpet", "#1f3a2a"],
    floorRough: 0.95,
    wall: ["panels", "#563620", "#c9a45a"],
    wallBase: "#3a2416",
    rail: "#b8913a",
    railMetal: 1,
    table: "#4a2e1c",
    plinth: "#4a2e1c",
    mannequin: "#d8cfc0",
    hanger: "#6a4426",
    lights: "pendants",
    lightCol: "#ffd8a0",
    warm: true,
    hemi: 0.6,
    palette: ["#1d2a4a", "#f2efe6", "#a8202a", "#1f4a33", "#c8a878", "#7a8a9a"],
    density: 0.85,
    luxury: true,
    signFg: "#d9b46a",
    signBg: "#14251b",
    accent: "#c9a45a",
    feature: "fireplace",
  }),
  givenchy: L({
    key: "givenchy",
    floor: ["marble", "#141414", "#d8d8d8"],
    floorRough: 0.12,
    floorTile: 2.5,
    wall: ["marble", "#eeeeec", "#5a5a5a"],
    wallBase: "#eeeeec",
    wallTile: 2.5,
    rail: "#0c0c0c",
    railMetal: 0.8,
    table: "#111111",
    plinth: "#151515",
    mannequin: "#111111",
    hanger: "#0d0d0d",
    lights: "strips",
    lightCol: "#f4f6ff",
    hemi: 0.7,
    palette: ["#0e0e0e", "#f4f4f2", "#5a5a5a", "#8a1a1a"],
    density: 0.75,
    luxury: true,
    signFg: "#ffffff",
    signBg: "#0b0b0b",
    accent: "#ffffff",
  }),
  ami: L({
    key: "ami",
    floor: ["parquet", "#d6b98e"],
    floorRough: 0.5,
    floorTile: 3,
    wall: ["plain", "#f6f4ef"],
    wallBase: "#f6f4ef",
    rail: "#e8e6e0",
    railMetal: 0.3,
    table: "#f2f0ea",
    plinth: "#ffffff",
    mannequin: "#f4f2ec",
    hanger: "#d8c4a4",
    lights: "spots",
    lightCol: "#fff6ea",
    warm: true,
    hemi: 0.85,
    palette: ["#1d2a4a", "#efe8dc", "#c8202a", "#7a7a72", "#2e4a3a", "#e8d8b8"],
    density: 0.75,
    signFg: "#c8102e",
    signBg: "#f6f4ef",
    accent: "#e5102e",
    feature: "heart",
  }),
  stussy: L({
    key: "stussy",
    floor: ["concrete", "#7e7b76"],
    floorRough: 0.7,
    wall: ["graffiti", "#c8a878"],
    wallBase: "#b8976a",
    wallTile: 3.2,
    rail: "#1a1a1a",
    table: "#c8a878",
    plinth: "#b8976a",
    mannequin: "#2a2a2a",
    hanger: "#c8a878",
    lights: "track",
    lightCol: "#fff2dc",
    warm: true,
    hemi: 0.75,
    palette: ["#111111", "#f2f2ee", "#5a6a3a", "#1d2a4a", "#a8202a", "#d8c8a8", "#3a6a8a"],
    density: 1,
    signFg: "#111111",
    signBg: "#e8dcc4",
    accent: "#e8dcc4",
    feature: "graffiti",
  }),
  nike: L({
    key: "nike",
    floor: ["rubber", "#141414"],
    floorRough: 0.85,
    wall: ["plain", "#151515"],
    wallBase: "#151515",
    rail: "#2a2a2a",
    table: "#1e1e1e",
    plinth: "#222222",
    mannequin: "#1a1a1a",
    hanger: "#0d0d0d",
    lights: "strips",
    lightCol: "#f4f8ff",
    hemi: 0.75,
    bg: "#050505",
    palette: ["#111111", "#f4f4f4", "#d4f53c", "#e5322d", "#5a6a7a", "#2a4aa8"],
    density: 1,
    signFg: "#ffffff",
    signBg: "#111111",
    accent: "#d4f53c",
    feature: "ledwall",
  }),
  adidas: L({
    key: "adidas",
    floor: ["concrete", "#c8c8c4"],
    floorRough: 0.45,
    wall: ["stripes", "#f4f4f2", "#111111"],
    wallBase: "#f4f4f2",
    wallTile: 3.6,
    rail: "#111111",
    table: "#f2f2f0",
    plinth: "#111111",
    mannequin: "#e8e8e6",
    hanger: "#111111",
    lights: "strips",
    lightCol: "#f6f8ff",
    hemi: 0.85,
    palette: ["#111111", "#f4f4f4", "#1d2a5a", "#1f6a3a", "#c8202a", "#8a8a8a"],
    signFg: "#111111",
    signBg: "#ffffff",
    accent: "#111111",
    feature: "stripes",
  }),
  zara: L({
    key: "zara",
    floor: ["tile", "#f2f1ee", "#dcdad6"],
    floorRough: 0.2,
    floorTile: 2.4,
    wall: ["plain", "#fbfbfa"],
    wallBase: "#fbfbfa",
    rail: "#d8d8d8",
    railMetal: 1,
    table: "#f6f6f4",
    plinth: "#f8f8f6",
    mannequin: "#f2f0ec",
    hanger: "#1a1a1a",
    lights: "strips",
    lightCol: "#ffffff",
    hemi: 0.95,
    palette: ["#111111", "#f4f2ec", "#c8a878", "#8a8a84", "#5a5a3a", "#e8dccc"],
    density: 0.85,
    signFg: "#111111",
    signBg: "#fbfbfa",
    accent: "#111111",
  }),
  gucci: L({
    key: "gucci",
    floor: ["parquet", "#5a3a22"],
    floorRough: 0.35,
    floorTile: 3,
    wall: ["velvet", "#1f4a33"],
    wallBase: "#173a28",
    rail: "#c9a24a",
    railMetal: 1,
    table: "#3a2414",
    plinth: "#8a1a24",
    mannequin: "#e8dccc",
    hanger: "#c9a24a",
    lights: "spots",
    lightCol: "#ffdcaa",
    warm: true,
    hemi: 0.6,
    palette: ["#1f4a33", "#a8202a", "#efe6d6", "#6a4a2a", "#111111", "#d88aa0"],
    density: 0.8,
    luxury: true,
    signFg: "#d8b45a",
    signBg: "#123020",
    accent: "#d8b45a",
    feature: "velvet",
  }),
  dior: L({
    key: "dior",
    floor: ["parquet", "#c8b496"],
    floorRough: 0.3,
    floorTile: 3,
    wall: ["moulding", "#d9d7d3"],
    wallBase: "#d9d7d3",
    wallTile: 3.4,
    rail: "#c8c8c4",
    railMetal: 1,
    table: "#e8e6e2",
    plinth: "#efedea",
    mannequin: "#e6e4e0",
    hanger: "#bdbdbd",
    lights: "chandelier",
    lightCol: "#fff4e4",
    warm: true,
    hemi: 0.8,
    palette: ["#9a9a98", "#f2f0ec", "#1d2a4a", "#111111", "#e8c8c0"],
    density: 0.8,
    luxury: true,
    signFg: "#3a3a3a",
    signBg: "#e6e4e0",
    accent: "#bfa76a",
    feature: "chandelier",
  }),
  lv: L({
    key: "lv",
    floor: ["marble", "#d8ccb8", "#a89878"],
    floorRough: 0.2,
    floorTile: 2.6,
    wall: ["monogram", "#5a3e28", "#b89a62"],
    wallBase: "#4a3220",
    wallTile: 1.6,
    rail: "#c9a24a",
    railMetal: 1,
    table: "#3a2618",
    plinth: "#2e1e12",
    mannequin: "#e6dccc",
    hanger: "#3a2618",
    lights: "spots",
    lightCol: "#ffe2b8",
    warm: true,
    hemi: 0.6,
    palette: ["#5a3e28", "#111111", "#efe6d6", "#b89a62", "#1d2a4a"],
    density: 0.75,
    luxury: true,
    signFg: "#e8d4a8",
    signBg: "#2e1e12",
    accent: "#c9a24a",
    feature: "monogram",
  }),
  boots: L({
    key: "boots",
    floor: ["rubber", "#1a1c1a"],
    floorRough: 0.8,
    wall: ["plain", "#1c1e1c"],
    wallBase: "#1c1e1c",
    rail: "#2a2a2a",
    table: "#2a2c2a",
    plinth: "#262826",
    lights: "strips",
    lightCol: "#f4fff0",
    hemi: 0.75,
    bg: "#050605",
    palette: ["#d4f53c", "#111111", "#f4f4f4", "#e5322d", "#2a6ad8", "#ff8a2a"],
    signFg: "#0b0d0a",
    signBg: "#d0e85c",
    accent: "#d0e85c",
    feature: "bootwall",
  }),
  tech: L({
    key: "tech",
    floor: ["tile", "#d8d6d0", "#c8c6c0"],
    floorRough: 0.35,
    floorTile: 1.6,
    wall: ["plain", "#f2f2f0"],
    wallBase: "#f2f2f0",
    table: "#c9a87a",
    plinth: "#e8e8e6",
    lights: "strips",
    lightCol: "#ffffff",
    hemi: 0.95,
    palette: ["#1a1a1a", "#e8e8e8", "#8a8a8a", "#2a4a8a"],
    signFg: "#111111",
    signBg: "#f2f2f0",
    accent: "#2a7ad8",
    feature: "screens",
  }),
  jeweller: L({
    key: "jeweller",
    floor: ["marble", "#e8e2d8", "#b8a888"],
    floorRough: 0.15,
    floorTile: 2.5,
    wall: ["velvet", "#1a2340"],
    wallBase: "#141a30",
    rail: "#c9a24a",
    railMetal: 1,
    table: "#1a2340",
    plinth: "#1a2340",
    lights: "spots",
    lightCol: "#fff2dc",
    warm: true,
    hemi: 0.65,
    palette: ["#e8c46a", "#d8d8d8"],
    density: 0.6,
    luxury: true,
    signFg: "#e8c46a",
    signBg: "#141a30",
    accent: "#e8c46a",
    feature: "cases",
  }),
};

/** which look a store wears */
export function lookFor(p: WorldPlace, mostly?: string): BrandLook {
  const s = slug((p.brand || "") + " " + p.name + " " + p.id);
  const has = (...w: string[]) => w.some((x) => s.includes(x));
  if (has("essentials", "fearofgod")) return LOOKS.essentials;
  if (has("ralph", "poloralph")) return LOOKS.ralph;
  if (has("givenchy")) return LOOKS.givenchy;
  if (has("amiparis", "storeami") || slug(p.brand || "") === "ami") return LOOKS.ami;
  if (has("stussy")) return LOOKS.stussy;
  if (has("nike", "jordan")) return LOOKS.nike;
  if (has("adidas")) return LOOKS.adidas;
  if (has("zara")) return LOOKS.zara;
  if (has("gucci")) return LOOKS.gucci;
  if (has("dior")) return LOOKS.dior;
  if (has("louisvuitton", "vuitton") || slug(p.brand || "") === "lv") return LOOKS.lv;
  if (p.id === "boots" || mostly === "boots") return { ...LOOKS.boots, signBg: p.style.accent || LOOKS.boots.signBg, accent: p.style.accent || LOOKS.boots.accent };
  if (mostly === "tech" || has("apple", "samsung", "tech", "electronic", "croma", "currys")) return LOOKS.tech;
  if (has("tiffany"))
    return {
      ...LOOKS.jeweller,
      key: "tiffany",
      wall: ["plain", "#8fdcd4"],
      wallBase: "#8fdcd4",
      floor: ["marble", "#f4f2ee", "#c8c8c4"],
      table: "#f8f8f6",
      plinth: "#ffffff",
      signFg: "#0a2a28",
      signBg: "#ffffff",
      accent: "#81d8d0",
      palette: ["#d8d8d8", "#e8c46a", "#d8a38f"],
    };
  if (has("cartier"))
    return {
      ...LOOKS.jeweller,
      key: "cartier",
      wall: ["velvet", "#7a1420"],
      wallBase: "#5a0e18",
      table: "#5a0e18",
      plinth: "#5a0e18",
      signFg: "#e8c46a",
      signBg: "#4a0a12",
      accent: "#c8102e",
      palette: ["#e8c46a", "#d8a38f", "#d8d8d8"],
    };
  if (mostly === "jewellery" || has("jewel", "tanishq", "bulgari")) return { ...LOOKS.jeweller };
  // anything else: from the place's own colours and its vibe
  const st = p.style;
  const v = (st.vibe || "").toLowerCase();
  const base = v.includes("lux") ? LOOKS.lv : v.includes("street") ? LOOKS.stussy : v.includes("prep") ? LOOKS.ralph : v.includes("indus") ? LOOKS.essentials : LOOKS.zara;
  return {
    ...base,
    key: "own",
    floor: [base.floor[0], st.floor || base.floor[1], base.floor[2]],
    wall: [base.wall[0] === "monogram" || base.wall[0] === "graffiti" ? "plain" : base.wall[0], st.wall || base.wall[1], base.wall[2]],
    wallBase: st.wall || base.wallBase,
    rail: st.trim || base.rail,
    signFg: st.accent || base.signFg,
    signBg: st.wall || base.signBg,
    accent: st.accent || base.accent,
    feature: "none",
  };
}

/** the brand's sign, drawn the way the brand writes its name */
export function logoTex(look: BrandLook, name: string, bg?: string) {
  const back = bg ?? look.signBg;
  return cachedTexture(
    "logo|" + look.key + "|" + name + "|" + back,
    (x, w, h) => {
      if (back !== "transparent") {
        x.fillStyle = back;
        x.fillRect(0, 0, w, h);
      }
      x.fillStyle = look.signFg;
      x.strokeStyle = look.signFg;
      x.textAlign = "center";
      x.textBaseline = "middle";
      const fit = (t: string, font: string, size: number, y = h / 2, spacing = 0) => {
        let s = size;
        const set = () => {
          x.font = font.replace("{s}", String(s));
          if ("letterSpacing" in x) (x as unknown as { letterSpacing: string }).letterSpacing = spacing * s + "px";
        };
        set();
        while (x.measureText(t).width > w * 0.9 && s > 10) {
          s -= 4;
          set();
        }
        x.fillText(t, w / 2, y);
        if ("letterSpacing" in x) (x as unknown as { letterSpacing: string }).letterSpacing = "0px";
      };
      const k = look.key;
      if (k === "nike") {
        // the tick, then the name
        x.beginPath();
        const cx = w * 0.3,
          cy = h * 0.55;
        x.moveTo(cx - 90, cy - 10);
        x.quadraticCurveTo(cx - 130, cy + 60, cx - 40, cy + 40);
        x.lineTo(cx + 120, cy - 40);
        x.lineTo(cx - 40, cy + 20);
        x.quadraticCurveTo(cx - 100, cy + 30, cx - 90, cy - 10);
        x.fill();
        x.textAlign = "left";
        x.font = "italic 900 120px Futura, 'Helvetica Neue', Arial, sans-serif";
        x.fillText("NIKE", w * 0.46, h * 0.55);
      } else if (k === "adidas") {
        // three bars like a mountain, then the name in lower case
        const bx = w * 0.18,
          by = h * 0.78;
        for (let i = 0; i < 3; i++) {
          x.save();
          x.translate(bx + i * 46, by);
          x.rotate(-0.55);
          x.fillRect(0, -(40 + i * 34), 34, 40 + i * 34);
          x.restore();
        }
        x.textAlign = "left";
        x.font = "800 120px 'Avenir Next', 'Helvetica Neue', Arial, sans-serif";
        x.fillText("adidas", w * 0.4, h * 0.55);
      } else if (k === "ami") {
        // the heart with an A in it, then the name
        heart(x, w * 0.2, h * 0.52, 70, "#e5102e");
        x.fillStyle = "#ffffff";
        x.font = "700 64px Futura, 'Helvetica Neue', sans-serif";
        x.fillText("A", w * 0.2, h * 0.5);
        x.fillStyle = look.signFg;
        x.textAlign = "left";
        x.font = "700 100px Futura, 'Helvetica Neue', sans-serif";
        x.fillText("AMI PARIS", w * 0.33, h * 0.54);
      } else if (k === "stussy") fit("Stüssy", "{s}px 'Brush Script MT', 'Snell Roundhand', 'Marker Felt', cursive", 190, h * 0.55);
      else if (k === "zara") fit("ZARA", "400 {s}px Didot, 'Bodoni 72', 'Times New Roman', serif", 200, h * 0.55, 0.02);
      else if (k === "gucci") fit("GUCCI", "500 {s}px 'Times New Roman', Didot, serif", 160, h * 0.55, 0.12);
      else if (k === "dior") fit("DIOR", "400 {s}px Didot, 'Bodoni 72', 'Times New Roman', serif", 170, h * 0.55, 0.06);
      else if (k === "lv") {
        fit("LOUIS VUITTON", "400 {s}px Futura, 'Gill Sans', 'Helvetica Neue', sans-serif", 96, h * 0.55, 0.22);
      } else if (k === "givenchy") fit("GIVENCHY", "700 {s}px 'Helvetica Neue', Futura, Arial, sans-serif", 120, h * 0.55, 0.16);
      else if (k === "ralph") {
        fit("RALPH LAUREN", "400 {s}px Didot, 'Bodoni 72', 'Times New Roman', serif", 100, h * 0.46, 0.14);
        x.font = "italic 400 40px Didot, 'Times New Roman', serif";
        x.fillText("Polo", w / 2, h * 0.8);
      } else if (k === "essentials") {
        x.font = "600 30px 'Helvetica Neue', Arial, sans-serif";
        x.fillText("FEAR OF GOD", w / 2, h * 0.24);
        fit("ESSENTIALS", "800 {s}px 'Helvetica Neue', Arial, sans-serif", 110, h * 0.6, 0.04);
      } else fit(name.toUpperCase(), "700 {s}px 'Helvetica Neue', Inter, Arial, sans-serif", 120, h * 0.55, 0.08);
    },
    1024,
    256,
  );
}
export function heart(x: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string) {
  x.save();
  x.fillStyle = col;
  x.beginPath();
  x.moveTo(cx, cy + r * 0.9);
  x.bezierCurveTo(cx - r * 1.4, cy, cx - r * 0.9, cy - r * 1.1, cx, cy - r * 0.45);
  x.bezierCurveTo(cx + r * 0.9, cy - r * 1.1, cx + r * 1.4, cy, cx, cy + r * 0.9);
  x.fill();
  x.restore();
}
/** a red neon heart (AMI's back wall), glowing */
export function heartTex() {
  return cachedTexture(
    "neonheart",
    (x, w, h) => {
      x.clearRect(0, 0, w, h);
      x.shadowColor = "#ff2040";
      x.shadowBlur = 40;
      x.strokeStyle = "#ff5a6a";
      x.lineWidth = 18;
      x.lineJoin = "round";
      const cx = w / 2,
        cy = h / 2,
        r = w * 0.3;
      x.beginPath();
      x.moveTo(cx, cy + r * 0.9);
      x.bezierCurveTo(cx - r * 1.4, cy, cx - r * 0.9, cy - r * 1.1, cx, cy - r * 0.45);
      x.bezierCurveTo(cx + r * 0.9, cy - r * 1.1, cx + r * 1.4, cy, cx, cy + r * 0.9);
      x.stroke();
      x.shadowBlur = 0;
      x.strokeStyle = "#ffd0d6";
      x.lineWidth = 6;
      x.stroke();
    },
    512,
    512,
  );
}
/** the moving picture on Nike's LED wall: drawn once, scrolled by its texture offset */
export function ledTex(accent: string) {
  const t = cachedTexture(
    "ledwall|" + accent,
    (x, w, h) => {
      const g = x.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, "#08080a");
      g.addColorStop(0.25, accent);
      g.addColorStop(0.5, "#ff4a2a");
      g.addColorStop(0.75, "#2a5aff");
      g.addColorStop(1, "#08080a");
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
      x.fillStyle = "rgba(0,0,0,0.35)";
      for (let i = 0; i < w; i += 6) x.fillRect(i, 0, 2, h);
      for (let j = 0; j < h; j += 6) x.fillRect(0, j, w, 2);
      x.fillStyle = "#ffffff";
      x.font = "italic 900 130px Futura, 'Helvetica Neue', Arial, sans-serif";
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillText("JUST DO IT.", w * 0.5, h * 0.52);
    },
    1024,
    256,
    [1, 1],
  );
  t.wrapS = THREE.RepeatWrapping;
  return t;
}
