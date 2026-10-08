"use client";
/**
 * Create your player: seven short steps next to a live 3D stage. Every slider moves the actual body the match
 * will draw. The camera moves in for the face and hair, out for the body, down for the boots.
 */
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import type { Look, PersonForm } from "./types";
import { OUTFITS } from "./body";
import type { View } from "./Stage";

const Stage = dynamic(() => import("./Stage"), {
  ssr: false,
  loading: () => <div className="pc-stage-wait">Setting up the lights</div>,
});

export interface Meta {
  countries: Record<string, { path: string; lang: string[]; city: string }>;
  positions: string[];
  groups: Record<string, string>;
  styles: Record<string, string[]>;
  labels: Record<string, string>;
  attrs: Record<string, string[]>;
  sessions: Record<
    string,
    {
      label: string;
      grows: string[] | null;
      fatigue: number;
      risk: number;
      cost?: number;
    }
  >;
  intensities: string[];
  slots: number;
  fx: Record<string, { sym: string; r: number }>;
}

export const HAIRSTYLES = [
  "Buzz cut",
  "Short crop",
  "Curly top",
  "Afro",
  "Long with a bun",
  "Mohawk",
  "Bald",
  "Long and loose",
  "Side part",
  "Skin fade",
  "Cornrows",
  "Dreadlocks",
  "Quiff",
  "Undercut bun",
  "Twists",
  "Mullet",
];
export const HAIR_COLOURS = ["#151110", "#2a1d15", "#4a3222", "#6e4a2c", "#a87a46", "#d2b07a", "#8b8b8b", "#e9e1c8", "#a4512c", "#5a1f1a", "#c9cbd3", "#2f4fa8", "#d9d9d9"];
export const EYE_COLOURS = [
  ["#3b2416", "Brown"],
  ["#24170f", "Dark brown"],
  ["#6b4a2b", "Hazel"],
  ["#4d6b3a", "Green"],
  ["#3f6f9f", "Blue"],
  ["#6f7c86", "Grey"],
];
export const BEARDS = ["Clean", "Full beard", "Beard and tache", "Stubble", "Goatee", "Chin strap"];
// the boot brands are invented; each colourway is one of the match's boot colours (6 to 13)
export const BOOT_MODELS = [
  { i: 6, brand: "Apex", model: "Strike Volt" },
  { i: 7, brand: "Korra", model: "Night Ember" },
  { i: 8, brand: "Valoré", model: "Pearl Crown" },
  { i: 9, brand: "Apex", model: "Ultra Pulse" },
  { i: 10, brand: "Tidal", model: "Surge Elite" },
  { i: 11, brand: "Korra", model: "Neon Rose" },
  { i: 12, brand: "Valoré", model: "Chrome Mirage" },
  { i: 13, brand: "Tidal", model: "Sunburst" },
];
export const FINISH_SW: Record<string, string> = {
  gold: "#d4af37",
  silver: "#c8ccd2",
  black: "#141414",
  rose: "#d8a38f",
  white: "#f2f2f2",
  steel: "#9aa3ad",
  volt: "#d0e85c",
  red: "#d0263b",
  blue: "#2a5bd7",
  navy: "#1c2a4a",
  orange: "#ff7a2a",
  pink: "#ff5fa2",
  green: "#2fbf71",
};
const ACCESSORIES: { key: keyof Look; label: string; finishes: string[] }[] = [
  {
    key: "watch",
    label: "Watch",
    finishes: ["steel", "gold", "silver", "black", "rose"],
  },
  { key: "necklace", label: "Necklace", finishes: ["gold", "silver", "black"] },
  { key: "earrings", label: "Earrings", finishes: ["silver", "gold", "black"] },
  {
    key: "bracelet",
    label: "Bracelet",
    finishes: ["silver", "gold", "black", "red", "blue"],
  },
  {
    key: "headband",
    label: "Headband",
    finishes: ["black", "white", "volt", "red", "blue", "pink"],
  },
  { key: "gloves", label: "Gloves", finishes: ["black", "navy", "white"] },
  {
    key: "compression",
    label: "Compression",
    finishes: ["black", "white", "navy", "volt"],
  },
];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const STEPS = [
  { id: "who", label: "Who you are", view: "full" as View },
  { id: "game", label: "Your game", view: "full" as View },
  { id: "face", label: "Face", view: "face" as View },
  { id: "hair", label: "Hair", view: "face" as View },
  { id: "body", label: "Body", view: "full" as View },
  { id: "acc", label: "Accessories", view: "body" as View },
  { id: "go", label: "Ready", view: "hero" as View },
];
export const DEFAULT_LOOK: Look = {
  skinF: 0.45,
  faceW: 0.5,
  jaw: 0.5,
  chin: 0.5,
  cheeks: 0.5,
  eyes: 0.5,
  eyeCol: 0,
  brows: 0.5,
  nose: 0.5,
  mouth: 0.5,
  ears: 0.5,
  hairline: 0.45,
  hair: 9,
  hairCol: 0,
  beard: 0,
  moustache: 0,
  muscle: 0.5,
  shoulders: 0.5,
  legs: 0.5,
  watch: null,
  necklace: null,
  earrings: null,
  bracelet: null,
  headband: null,
  gloves: null,
  compression: null,
  boot: 6,
};
export const DEFAULT_FORM: PersonForm = {
  first: "",
  last: "",
  nick: "",
  dobY: 2011,
  dobM: 3,
  dobD: 14,
  country: "India",
  nat: "India",
  nat2: "",
  lang: "Hindi",
  foot: "Right",
  height: 176,
  weight: 67,
  pos: "ST",
  pos2: null,
  num: 9,
  style: null,
};
// where each position sits on the little pitch (x across 0 to 100, y up the pitch 0 to 100)
const PITCH: Record<string, [number, number]> = {
  GK: [50, 7],
  LB: [14, 28],
  CB: [50, 22],
  RB: [86, 28],
  LWB: [10, 44],
  RWB: [90, 44],
  CDM: [50, 40],
  CM: [50, 53],
  LM: [14, 60],
  RM: [86, 60],
  CAM: [50, 66],
  LW: [16, 80],
  RW: [84, 80],
  ST: [50, 86],
  CF: [50, 76],
};

function Slider({ label, value, onChange, left, right }: { label: string; value: number; onChange: (v: number) => void; left?: string; right?: string }) {
  return (
    <label className="pc-slider">
      <span className="pc-slider-top">
        <span>{label}</span>
        <span className="pc-slider-ends">
          {left && <i>{left}</i>}
          {right && <i>{right}</i>}
        </span>
      </span>
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
    </label>
  );
}

export default function Creator({
  meta,
  quality,
  setQuality,
  onCreate,
  busy,
  error,
  onBack,
}: {
  meta: Meta;
  quality: number;
  setQuality: (q: number) => void;
  onCreate: (form: PersonForm, look: Look) => void;
  busy: boolean;
  error: string;
  onBack: () => void;
}) {
  const [step, setStep] = useState(0);
  const stylesFor = (pos: string) =>
    Object.entries(meta.styles)
      .filter(([, ps]) => ps.includes(pos))
      .map(([k]) => k);
  const [form, setForm] = useState<PersonForm>(() => ({
    ...DEFAULT_FORM,
    style: stylesFor(DEFAULT_FORM.pos)[0] || null,
  }));
  const [look, setLook] = useState<Look>(DEFAULT_LOOK);
  const [bootsView, setBootsView] = useState(false);
  const set = <K extends keyof PersonForm>(k: K, v: PersonForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const lk = <K extends keyof Look>(k: K, v: Look[K]) => setLook((l) => ({ ...l, [k]: v }));
  const country = meta.countries[form.country];
  const styles = useMemo(
    () =>
      Object.entries(meta.styles)
        .filter(([, pos]) => pos.includes(form.pos))
        .map(([k]) => k),
    [meta.styles, form.pos],
  );
  const age = 2026 - form.dobY - (form.dobM > 10 ? 1 : 0);
  const okWho = form.first.trim() && form.last.trim() && age >= 14 && age <= 17;
  const view: View = bootsView ? "boots" : STEPS[step].view;
  const S = STEPS[step];
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  const random = () => {
    const r = () => Math.round(Math.random() * 100) / 100;
    setLook((l) => ({
      ...l,
      skinF: r(),
      faceW: r(),
      jaw: r(),
      chin: r(),
      cheeks: r(),
      eyes: r(),
      brows: r(),
      nose: r(),
      mouth: r(),
      ears: r(),
      hairline: r() * 0.7,
      hair: Math.floor(Math.random() * 16),
      hairCol: Math.floor(Math.random() * 7),
      eyeCol: Math.floor(Math.random() * 6),
      beard: Math.random() < 0.7 ? 0 : Math.floor(Math.random() * 6),
    }));
  };
  return (
    <div className="pc-creator">
      <section className="pc-creator-stage">
        <Stage look={look} person={form} outfit={OUTFITS.training} view={view} quality={quality} onSlow={setQuality} className="pc-stage" />
        <div className="pc-stage-tag">
          <span className="pc-num">{form.num}</span>
          <span className="pc-stage-name">
            {(form.first || "Your").toUpperCase()} {(form.last || "player").toUpperCase()}
          </span>
          <span className="pc-stage-sub">
            {form.pos}
            {form.pos2 ? " / " + form.pos2 : ""} · {form.height} cm · {form.foot} foot
          </span>
        </div>
        <p className="pc-stage-hint">Drag to turn him</p>
      </section>
      <section className="pc-creator-panel">
        <header className="pc-creator-head">
          <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={onBack}>
            Back
          </button>
          <p className="pc-kicker">Create your player</p>
          <ol className="pc-steps" aria-label="Steps">
            {STEPS.map((s2, i) => (
              <li key={s2.id}>
                <button type="button" className={clsx("pc-step", i === step && "is-on", i < step && "is-done")} onClick={() => (i <= step || okWho ? setStep(i) : null)} aria-current={i === step}>
                  <span>{i + 1}</span>
                  {s2.label}
                </button>
              </li>
            ))}
          </ol>
        </header>
        <div className="pc-creator-body" key={S.id}>
          <h2 className="pc-h2">{S.label}</h2>
          {S.id === "who" && (
            <div className="pc-grid2">
              <label className="pc-field">
                <span>First name</span>
                <input className="k-input" value={form.first} maxLength={24} onChange={(e) => set("first", e.target.value)} placeholder="Aarav" />
              </label>
              <label className="pc-field">
                <span>Last name</span>
                <input className="k-input" value={form.last} maxLength={24} onChange={(e) => set("last", e.target.value)} placeholder="Mehta" />
              </label>
              <label className="pc-field">
                <span>Nickname</span>
                <input className="k-input" value={form.nick} maxLength={20} onChange={(e) => set("nick", e.target.value)} placeholder="optional" />
              </label>
              <div className="pc-field">
                <span>Date of birth</span>
                <div className="pc-row3">
                  <select className="k-input" value={form.dobD} onChange={(e) => set("dobD", Number(e.target.value))} aria-label="Day">
                    {Array.from({ length: 31 }, (_, i) => (
                      <option key={i} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                  <select className="k-input" value={form.dobM} onChange={(e) => set("dobM", Number(e.target.value))} aria-label="Month">
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select className="k-input" value={form.dobY} onChange={(e) => set("dobY", Number(e.target.value))} aria-label="Year">
                    {[2009, 2010, 2011, 2012].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <small className={clsx(age < 14 || age > 17 ? "pc-bad" : "pc-dim")}>{age} in October 2026. Careers start between 14 and 17.</small>
              </div>
              <label className="pc-field">
                <span>Country</span>
                <select
                  className="k-input"
                  value={form.country}
                  onChange={(e) => {
                    const c = e.target.value;
                    setForm((f) => ({
                      ...f,
                      country: c,
                      nat: c,
                      lang: meta.countries[c]?.lang[0] || "English",
                    }));
                  }}
                >
                  {Object.keys(meta.countries).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <small className="pc-dim">
                  {country?.path === "school"
                    ? "You start at school in " + country.city + ", then a football college."
                    : country?.path === "academy"
                      ? "You start in a club academy at home."
                      : "You start at the national development centre, then trials abroad."}
                </small>
              </label>
              <label className="pc-field">
                <span>Nationality</span>
                <input className="k-input" value={form.nat} maxLength={24} onChange={(e) => set("nat", e.target.value)} />
              </label>
              <label className="pc-field">
                <span>Second nationality</span>
                <input className="k-input" value={form.nat2} maxLength={24} onChange={(e) => set("nat2", e.target.value)} placeholder="optional" />
              </label>
              <label className="pc-field">
                <span>Language</span>
                <select className="k-input" value={form.lang} onChange={(e) => set("lang", e.target.value)}>
                  {(country?.lang || ["English"]).map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {S.id === "game" && (
            <div className="pc-stack">
              <div className="pc-field">
                <span>Preferred foot</span>
                <div className="pc-seg">
                  {(["Right", "Left", "Both"] as const).map((f) => (
                    <button type="button" key={f} className={clsx("k-btn k-btn-sm", form.foot === f && "k-on")} onClick={() => set("foot", f)}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pc-grid2">
                <label className="pc-field">
                  <span>
                    Height <b className="pc-val">{form.height} cm</b>
                  </span>
                  <input type="range" min={158} max={200} value={form.height} onChange={(e) => set("height", Number(e.target.value))} />
                </label>
                <label className="pc-field">
                  <span>
                    Weight <b className="pc-val">{form.weight} kg</b>
                  </span>
                  <input type="range" min={48} max={100} value={form.weight} onChange={(e) => set("weight", Number(e.target.value))} />
                </label>
              </div>
              <div className="pc-field">
                <span>Position: tap once for your main spot, again on another for a second one</span>
                <div className="pc-pitch" role="group" aria-label="Positions">
                  <i className="pc-pitch-box top" />
                  <i className="pc-pitch-box bot" />
                  <i className="pc-pitch-mid" />
                  {meta.positions.map((p) => (
                    <button
                      type="button"
                      key={p}
                      className={clsx("pc-pos", form.pos === p && "is-main", form.pos2 === p && "is-second")}
                      style={{
                        left: PITCH[p][0] + "%",
                        bottom: PITCH[p][1] + "%",
                      }}
                      onClick={() => {
                        if (form.pos === p) return;
                        if (form.pos2 === p) set("pos2", null);
                        else if (form.pos && !form.pos2 && meta.groups[p] !== "GK" && form.pos !== "GK") set("pos2", p);
                        else {
                          const fits = stylesFor(p);
                          setForm((f) => ({
                            ...f,
                            pos: p,
                            pos2: null,
                            style: f.style && fits.includes(f.style) ? f.style : fits[0] || null,
                          }));
                        }
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pc-grid2">
                <label className="pc-field">
                  <span>Shirt number</span>
                  <input className="k-input" type="number" min={1} max={99} value={form.num} onChange={(e) => set("num", Math.max(1, Math.min(99, Number(e.target.value) || 1)))} />
                </label>
                <div className="pc-field">
                  <span>Playing style</span>
                  <div className="pc-chips">
                    {styles.map((s2) => (
                      <button type="button" key={s2} className={clsx("k-btn k-btn-sm", form.style === s2 && "k-on")} onClick={() => set("style", s2)}>
                        {s2}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {S.id === "face" && (
            <div className="pc-stack">
              <label className="pc-slider pc-skin">
                <span className="pc-slider-top">
                  <span>Skin tone</span>
                </span>
                <input type="range" min={0} max={1} step={0.01} value={look.skinF} onChange={(e) => lk("skinF", Number(e.target.value))} aria-label="Skin tone" />
              </label>
              <div className="pc-grid2">
                <Slider label="Face shape" value={look.faceW} onChange={(v) => lk("faceW", v)} left="narrow" right="wide" />
                <Slider label="Jaw" value={look.jaw} onChange={(v) => lk("jaw", v)} left="soft" right="strong" />
                <Slider label="Chin" value={look.chin} onChange={(v) => lk("chin", v)} left="short" right="long" />
                <Slider label="Cheeks" value={look.cheeks} onChange={(v) => lk("cheeks", v)} left="hollow" right="full" />
                <Slider label="Eyes" value={look.eyes} onChange={(v) => lk("eyes", v)} left="small" right="big" />
                <Slider label="Eyebrows" value={look.brows} onChange={(v) => lk("brows", v)} left="thin" right="thick" />
                <Slider label="Nose" value={look.nose} onChange={(v) => lk("nose", v)} left="narrow" right="broad" />
                <Slider label="Mouth" value={look.mouth} onChange={(v) => lk("mouth", v)} left="small" right="wide" />
                <Slider label="Ears" value={look.ears} onChange={(v) => lk("ears", v)} left="small" right="big" />
              </div>
              <div className="pc-field">
                <span>Eye colour</span>
                <div className="pc-swatches">
                  {EYE_COLOURS.map(([c, n], i) => (
                    <button type="button" key={c} title={n} aria-label={n} className={clsx("pc-sw", look.eyeCol === i && "is-on")} style={{ background: c }} onClick={() => lk("eyeCol", i)} />
                  ))}
                </div>
              </div>
              <button type="button" className="k-btn k-btn-ghost pc-mini" onClick={random}>
                Surprise me
              </button>
            </div>
          )}
          {S.id === "hair" && (
            <div className="pc-stack">
              <div className="pc-tiles">
                {HAIRSTYLES.map((h, i) => (
                  <button type="button" key={h} className={clsx("pc-tile", look.hair === i && "is-on")} onClick={() => lk("hair", i)}>
                    {h}
                  </button>
                ))}
              </div>
              <div className="pc-field">
                <span>Hair colour</span>
                <div className="pc-swatches">
                  {HAIR_COLOURS.map((c, i) => (
                    <button
                      type="button"
                      key={c}
                      aria-label={"Hair colour " + (i + 1)}
                      className={clsx("pc-sw", look.hairCol === i && "is-on")}
                      style={{ background: c }}
                      onClick={() => lk("hairCol", i)}
                    />
                  ))}
                </div>
              </div>
              <Slider label="Hairline" value={look.hairline} onChange={(v) => lk("hairline", v)} left="low" right="high" />
              <div className="pc-field">
                <span>Facial hair</span>
                <div className="pc-chips">
                  {BEARDS.map((b, i) => (
                    <button type="button" key={b} className={clsx("k-btn k-btn-sm", look.beard === i && "k-on")} onClick={() => lk("beard", i)}>
                      {b}
                    </button>
                  ))}
                  <button type="button" className={clsx("k-btn k-btn-sm", look.moustache === 1 && "k-on")} onClick={() => lk("moustache", look.moustache ? 0 : 1)}>
                    Moustache
                  </button>
                </div>
              </div>
            </div>
          )}
          {S.id === "body" && (
            <div className="pc-stack">
              <div className="pc-grid2">
                <label className="pc-field">
                  <span>
                    Height <b className="pc-val">{form.height} cm</b>
                  </span>
                  <input type="range" min={158} max={200} value={form.height} onChange={(e) => set("height", Number(e.target.value))} />
                </label>
                <label className="pc-field">
                  <span>
                    Weight <b className="pc-val">{form.weight} kg</b>
                  </span>
                  <input type="range" min={48} max={100} value={form.weight} onChange={(e) => set("weight", Number(e.target.value))} />
                </label>
              </div>
              <Slider label="Muscle" value={look.muscle} onChange={(v) => lk("muscle", v)} left="lean" right="powerful" />
              <Slider label="Shoulders" value={look.shoulders} onChange={(v) => lk("shoulders", v)} left="narrow" right="broad" />
              <Slider label="Legs" value={look.legs} onChange={(v) => lk("legs", v)} left="slim" right="strong" />
              <p className="pc-note">Taller players head the ball and win duels, lighter ones turn and accelerate. It nudges where you start, never where you finish.</p>
            </div>
          )}
          {S.id === "acc" && (
            <div className="pc-stack">
              {ACCESSORIES.map((a) => (
                <div className="pc-field" key={a.key}>
                  <span>{a.label}</span>
                  <div className="pc-swatches">
                    <button type="button" className={clsx("pc-sw pc-sw-none", !look[a.key] && "is-on")} aria-label={"No " + a.label} onClick={() => lk(a.key, null as never)}>
                      None
                    </button>
                    {a.finishes.map((f) => (
                      <button
                        type="button"
                        key={f}
                        aria-label={a.label + " " + f}
                        title={f}
                        className={clsx("pc-sw", look[a.key] === f && "is-on")}
                        style={{ background: FINISH_SW[f] }}
                        onClick={() => lk(a.key, f as never)}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <div className="pc-field" onMouseEnter={() => setBootsView(true)} onMouseLeave={() => setBootsView(false)} onFocus={() => setBootsView(true)} onBlur={() => setBootsView(false)}>
                <span>Boots</span>
                <div className="pc-tiles pc-boots">
                  {BOOT_MODELS.map((b) => (
                    <button type="button" key={b.i} className={clsx("pc-tile", look.boot === b.i && "is-on")} onClick={() => lk("boot", b.i)}>
                      <b>{b.brand}</b>
                      {b.model}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {S.id === "go" && (
            <div className="pc-stack">
              <div className="pc-summary">
                <p>
                  <b>
                    {form.first} {form.last}
                  </b>
                  {form.nick ? " (" + form.nick + ")" : ""}, {age}, from {form.country}.
                </p>
                <p>
                  {form.pos}
                  {form.pos2 ? " and " + form.pos2 : ""}, {form.style}, {form.foot.toLowerCase()} footed, {form.height} cm, number {form.num}.
                </p>
                <p className="pc-dim">
                  {country?.path === "school"
                    ? "First stop: picking a school in " + country.city + "."
                    : country?.path === "academy"
                      ? "First stop: picking an academy."
                      : "First stop: the national development centre."}
                </p>
              </div>
              <label className="pc-field">
                <span>Graphics</span>
                <div className="pc-seg">
                  {["Low", "Medium", "High", "Ultra"].map((g, i) => (
                    <button type="button" key={g} className={clsx("k-btn k-btn-sm", quality === i && "k-on")} onClick={() => setQuality(i)}>
                      {g}
                    </button>
                  ))}
                </div>
              </label>
              {error && <p className="pc-bad">{error}</p>}
              <button type="button" className="k-btn k-btn-primary" disabled={busy || !okWho} onClick={() => onCreate(form, look)}>
                {busy ? "Building your world" : "Start my career"}
              </button>
            </div>
          )}
        </div>
        <footer className="pc-creator-foot">
          <button type="button" className="k-btn k-btn-ghost" onClick={back} disabled={step === 0}>
            Back
          </button>
          {step < STEPS.length - 1 && (
            <button type="button" className="k-btn k-btn-primary" onClick={next} disabled={step === 0 && !okWho}>
              Next: {STEPS[step + 1].label}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
