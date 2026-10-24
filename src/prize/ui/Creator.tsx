"use client";
/**
 * Create a fighter: who they are (name, ring name, nationality, stance), their body (build, height, skin), their
 * head (hair, colour, beard), their gear (gloves, trunks, boots) and how they fight (power, speed, chin, stamina,
 * defence from one budget of points). The boxer stands beside the controls in 3D and changes as you go.
 */
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import { ATTR_BUDGET, ATTR_KEYS, ATTR_MAX, ATTR_MIN } from "../engine/rules";
import { BEARDS, BODY_TYPES, COUNTRIES, HAIR_COLOURS, HAIR_STYLES, KIT_COLOURS, NAME_MAX, NICK_MAX, attrsUsed, cleanTyping, defaultCreated, sanitize, toDef, type Created } from "../engine/create";
import type { Attrs } from "../engine/types";
import { STYLE_NAME, inches } from "./fighters";

const Preview3D = dynamic(() => import("./Preview3D"), { ssr: false, loading: () => <div className="pf-stage" /> });

const STEPS = ["Who", "Body", "Head", "Gear", "Fighting"] as const;
const PRESETS: { name: string; a: Attrs }[] = [
  { name: "Balanced", a: { power: 72, speed: 72, chin: 72, stamina: 72, defense: 72 } },
  { name: "Puncher", a: { power: 92, speed: 64, chin: 80, stamina: 64, defense: 60 } },
  { name: "Speedster", a: { power: 62, speed: 92, chin: 64, stamina: 70, defense: 72 } },
  { name: "Iron man", a: { power: 66, speed: 60, chin: 92, stamina: 88, defense: 54 } },
  { name: "Defensive", a: { power: 60, speed: 80, chin: 70, stamina: 60, defense: 90 } },
];
const ATTR_NOTE: Record<keyof Attrs, string> = {
  power: "How much each punch hurts.",
  speed: "How fast punches come out, and your feet.",
  chin: "How well you take a big shot, and how much the corner gets back.",
  stamina: "How long you can keep throwing, and how fast it comes back.",
  defense: "Longer slip windows and a guard that parries on its own.",
};

export default function Creator(props: { initial: Created | null; quality: number; onSave: (c: Created) => string | null; onCancel: () => void }) {
  const [c, setC] = useState<Created>(() => props.initial ?? { ...defaultCreated(), skin: Math.round(Math.random() * 100) / 100, hair: [0, 1, 6, 9][Math.floor(Math.random() * 4)] });
  const [stepI, setStep] = useState(0);
  const [msg, setMsg] = useState("");
  const set = <K extends keyof Created>(k: K, v: Created[K]) => setC(x => ({ ...x, [k]: v }));
  const def = useMemo(() => toDef(sanitize({ ...c, id: c.id || "preview", name: c.name || "Preview" })), [c]);
  const fighters = useMemo(() => [def], [def]);
  const used = attrsUsed(c.attrs);
  const left = ATTR_BUDGET - used;
  const setAttr = (k: keyof Attrs, v: number) => {
    setC(x => {
      const others = attrsUsed(x.attrs) - x.attrs[k];
      const max = Math.min(ATTR_MAX, ATTR_BUDGET - others);
      return { ...x, attrs: { ...x.attrs, [k]: Math.max(ATTR_MIN, Math.min(max, Math.round(v))) } };
    });
  };
  const save = () => {
    if (!c.name.trim()) {
      setStep(0);
      setMsg("Give your fighter a name first.");
      return;
    }
    const err = props.onSave(c);
    if (err) setMsg(err);
  };

  return (
    <main id="main" className="pf-create">
      <header className="k-topbar pf-top">
        <div className="k-brand">
          <span className="sq" />
          <span className="nm">PRIZE FIGHTER</span>
        </div>
        <h1 className="pf-top-title">{props.initial ? "Change your fighter" : "Create a fighter"}</h1>
        <button className="k-btn k-btn-ghost k-btn-sm" data-pf="back" onClick={props.onCancel}>
          Back
        </button>
      </header>
      <div className="pf-create-grid">
        <section className="k-panel pf-create-panel">
          <nav className="pf-steps" aria-label="Steps">
            {STEPS.map((s, i) => (
              <button key={s} className={clsx("pf-step", stepI === i && "is-on")} aria-current={stepI === i ? "step" : undefined} data-pf={"step-" + i} onClick={() => setStep(i)}>
                <b>{i + 1}</b>
                {s}
              </button>
            ))}
          </nav>
          <div className="pf-step-body" key={stepI}>
            {stepI === 0 && (
              <>
                <Field label="Name" htmlFor="pfName">
                  <input id="pfName" className="k-input" maxLength={NAME_MAX} placeholder="Your fighter's name" value={c.name} onChange={e => { set("name", cleanTyping(e.target.value, NAME_MAX)); setMsg(""); }} />
                </Field>
                <Field label="Ring name (optional)" htmlFor="pfNick">
                  <input id="pfNick" className="k-input" maxLength={NICK_MAX} placeholder="The Hammer" value={c.nick} onChange={e => set("nick", cleanTyping(e.target.value, NICK_MAX))} />
                </Field>
                <Field label="Fights for" htmlFor="pfCountry">
                  <select id="pfCountry" className="k-input" value={c.country} onChange={e => set("country", e.target.value)}>
                    {COUNTRIES.map(n => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Stance">
                  <div className="pf-seg">
                    {(["orthodox", "southpaw"] as const).map(s => (
                      <button key={s} className={clsx("k-btn k-btn-sm", c.stance === s && "k-on")} onClick={() => set("stance", s)}>
                        {s === "orthodox" ? "Orthodox" : "Southpaw"}
                      </button>
                    ))}
                  </div>
                  <p className="pf-note">{c.stance === "orthodox" ? "Left hand and left foot forward. The jab is your left." : "Right hand and right foot forward. The jab is your right."}</p>
                </Field>
              </>
            )}
            {stepI === 1 && (
              <>
                <Field label="Build">
                  <div className="pf-choices">
                    {BODY_TYPES.map(b => (
                      <button key={b.id} className={clsx("pf-choice", c.body === b.id && "is-on")} onClick={() => set("body", b.id)}>
                        <b>{b.name}</b>
                        <span>{b.note}</span>
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label={`Height: ${c.heightCm} cm, ${inches(c.heightCm)}`} htmlFor="pfHeight">
                  <input id="pfHeight" type="range" className="pf-range" min={160} max={206} value={c.heightCm} onChange={e => set("heightCm", Number(e.target.value))} />
                  <p className="pf-note">
                    {def.weightClass}, {def.weightKg} kg, reach {def.reachIn} in.
                  </p>
                </Field>
                <Field label="Skin" htmlFor="pfSkin">
                  <input id="pfSkin" type="range" className="pf-range pf-skin" min={0} max={100} value={Math.round(c.skin * 100)} onChange={e => set("skin", Number(e.target.value) / 100)} />
                </Field>
              </>
            )}
            {stepI === 2 && (
              <>
                <Field label="Hair">
                  <div className="pf-grid4">
                    {HAIR_STYLES.map((h, i) => (
                      <button key={h} className={clsx("k-btn k-btn-sm", c.hair === i && "k-on")} onClick={() => set("hair", i)}>
                        {h}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Hair colour">
                  <Swatches list={HAIR_COLOURS} value={HAIR_COLOURS[c.hairCol]} onPick={v => set("hairCol", HAIR_COLOURS.indexOf(v))} />
                </Field>
                <Field label="Beard">
                  <div className="pf-grid3">
                    {BEARDS.map((b, i) => (
                      <button key={b} className={clsx("k-btn k-btn-sm", c.beard === i && "k-on")} onClick={() => set("beard", i)}>
                        {b}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Moustache">
                  <div className="pf-seg">
                    {[0, 1].map(m => (
                      <button key={m} className={clsx("k-btn k-btn-sm", c.moustache === m && "k-on")} onClick={() => set("moustache", m as 0 | 1)}>
                        {m ? "Yes" : "No"}
                      </button>
                    ))}
                  </div>
                </Field>
              </>
            )}
            {stepI === 3 && (
              <>
                <Field label="Gloves">
                  <Swatches list={KIT_COLOURS} value={c.gloves} onPick={v => set("gloves", v)} />
                </Field>
                <Field label="Glove trim">
                  <Swatches list={KIT_COLOURS} value={c.gloveTrim} onPick={v => set("gloveTrim", v)} />
                </Field>
                <Field label="Trunks">
                  <Swatches list={KIT_COLOURS} value={c.trunks[0]} onPick={v => set("trunks", [v, c.trunks[1], c.trunks[2]])} />
                </Field>
                <Field label="Waistband">
                  <Swatches list={KIT_COLOURS} value={c.trunks[1]} onPick={v => set("trunks", [c.trunks[0], v, c.trunks[2]])} />
                </Field>
                <Field label="Stripe">
                  <Swatches list={KIT_COLOURS} value={c.trunks[2]} onPick={v => set("trunks", [c.trunks[0], c.trunks[1], v])} />
                </Field>
                <Field label="Boots">
                  <Swatches list={KIT_COLOURS} value={c.boots} onPick={v => set("boots", v)} />
                </Field>
              </>
            )}
            {stepI === 4 && (
              <>
                <div className="pf-budget" aria-live="polite">
                  <span className="k-label">Points left</span>
                  <b className={clsx(left === 0 && "zero")}>{left}</b>
                  <span className="pf-note">
                    {used} of {ATTR_BUDGET} spent. Fights like a {STYLE_NAME[def.style].toLowerCase()}.
                  </span>
                </div>
                <div className="pf-seg pf-seg-wrap">
                  {PRESETS.map(p => (
                    <button key={p.name} className="k-btn k-btn-sm" onClick={() => set("attrs", { ...p.a })}>
                      {p.name}
                    </button>
                  ))}
                </div>
                {ATTR_KEYS.map(k => (
                  <Field key={k} label={`${k[0].toUpperCase() + k.slice(1)}: ${c.attrs[k]}`} htmlFor={"pfA" + k}>
                    <input id={"pfA" + k} type="range" className="pf-range" min={ATTR_MIN} max={ATTR_MAX} value={c.attrs[k]} onChange={e => setAttr(k, Number(e.target.value))} />
                    <p className="pf-note">{ATTR_NOTE[k]}</p>
                  </Field>
                ))}
              </>
            )}
          </div>
          <div className="pf-create-foot">
            <div className="msg" role="status">
              {msg}
            </div>
            <div className="row">
              {stepI > 0 && (
                <button className="k-btn k-btn-ghost" onClick={() => setStep(stepI - 1)}>
                  Back a step
                </button>
              )}
              {stepI < STEPS.length - 1 && (
                <button className="k-btn" data-pf="next" onClick={() => setStep(stepI + 1)}>
                  Next: {STEPS[stepI + 1]}
                </button>
              )}
              <button className="k-btn k-btn-primary" data-pf="save" onClick={save}>
                Save fighter
              </button>
            </div>
          </div>
        </section>
        <section className="pf-create-stage">
          <Preview3D fighters={fighters} mode="solo" quality={Math.min(props.quality, 2)} label={`${c.name || "Your fighter"} in the ring. Drag to turn.`} />
          <div className="pf-create-plate">
            <b>{c.name.trim() || "Your fighter"}</b>
            <span>
              {c.nick.trim() ? `"${c.nick.trim()}" · ` : ""}
              {c.country} · {c.stance === "orthodox" ? "Orthodox" : "Southpaw"} · {def.weightClass}
            </span>
            <span className="pf-note">Drag to turn round.</span>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="pf-field">
      {htmlFor ? (
        <label className="k-label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <span className="k-label">{label}</span>
      )}
      {children}
    </div>
  );
}

function Swatches({ list, value, onPick }: { list: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="pf-swatches" role="radiogroup">
      {list.map(col => (
        <button key={col} role="radio" aria-checked={col.toLowerCase() === value.toLowerCase()} aria-label={col} className={clsx("pf-swatch", col.toLowerCase() === value.toLowerCase() && "is-on")} style={{ background: col }} onClick={() => onPick(col)} />
      ))}
    </div>
  );
}
