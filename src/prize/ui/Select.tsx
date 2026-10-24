"use client";
/**
 * Quick fight: pick who you are and who you fight from the real legends and your own fighters, see them face off
 * under the light, read the tale of the tape, set the rounds, the round length and how good the other corner is,
 * then fight. Choosing goes to whichever side is lit; picking yourself moves on to the opponent.
 */
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import type { FighterDef, Tier } from "../engine/types";
import { TIER_NAME, TRAIT_NAME, ATTR_KEYS } from "../engine/rules";
import { STYLE_NAME, GUARD_NAME, inches } from "./fighters";
import { recordOf, recordText, type Settings } from "../save";

const Preview3D = dynamic(() => import("./Preview3D"), { ssr: false, loading: () => <div className="pf-stage" /> });

const TIER_NOTE = [
  "Slow to react and easy to read. Learn the controls.",
  "A solid pro. Punishes lazy habits now and then.",
  "A real test: slips, counters and learns what you do.",
  "Sharp reactions and quick to read you. Mix it up.",
  "Reads everything, times everything. Good luck.",
];

export default function Select(props: {
  fighters: FighterDef[];
  me: string | null;
  them: string | null;
  settings: Settings;
  onPick: (side: "me" | "them", id: string) => void;
  onSettings: (s: Partial<Settings>) => void;
  onFight: () => void;
  onBack: () => void;
}) {
  const { fighters, settings } = props;
  const [side, setSide] = useState<"me" | "them">(props.me ? "them" : "me");
  const [filter, setFilter] = useState<"all" | "real" | "mine">("all");
  const [find, setFind] = useState("");
  const me = fighters.find(f => f.id === props.me) ?? null;
  const them = fighters.find(f => f.id === props.them) ?? null;
  const list = useMemo(() => {
    const q = find.trim().toLowerCase();
    return fighters.filter(f => (filter === "all" || (filter === "real" ? f.real : !f.real)) && (!q || f.name.toLowerCase().includes(q) || f.nick.toLowerCase().includes(q) || f.country.toLowerCase().includes(q)));
  }, [fighters, filter, find]);
  const pick = (id: string) => {
    props.onPick(side, id);
    if (side === "me") setSide("them");
  };
  const random = () => {
    const pool = fighters.filter(f => f.id !== (side === "me" ? props.them : props.me));
    if (pool.length) pick(pool[Math.floor(Math.random() * pool.length)].id);
  };
  const pair = useMemo(() => [me, them], [me, them]);
  const ready = !!me && !!them;

  return (
    <main id="main" className="pf-select">
      <header className="k-topbar pf-top">
        <div className="k-brand">
          <span className="sq" />
          <span className="nm">PRIZE FIGHTER</span>
        </div>
        <h1 className="pf-top-title">Quick fight</h1>
        <button className="k-btn k-btn-ghost k-btn-sm" data-pf="back" onClick={props.onBack}>
          Back
        </button>
      </header>
      <div className="pf-select-grid">
        <section className="k-panel k-flush pf-roster" aria-label="Fighters">
          <div className="pf-roster-head">
            <div className="pf-seg" role="tablist" aria-label="Show">
              {(["all", "real", "mine"] as const).map(k => (
                <button key={k} role="tab" aria-selected={filter === k} className={clsx("k-btn k-btn-sm", filter === k && "k-on")} onClick={() => setFilter(k)}>
                  {k === "all" ? "All" : k === "real" ? "Legends" : "Yours"}
                </button>
              ))}
            </div>
            <input className="k-input pf-find" placeholder="Find a fighter" value={find} onChange={e => setFind(e.target.value)} aria-label="Find a fighter" />
          </div>
          <ul className="pf-rows" data-pf="roster">
            {list.length === 0 && <li className="pf-empty">{filter === "mine" ? "You have not built a fighter yet." : "Nobody by that name."}</li>}
            {list.map(f => {
              const isMe = f.id === props.me, isThem = f.id === props.them;
              return (
                <li key={f.id}>
                  <button className={clsx("pf-row", isMe && "is-me", isThem && "is-them")} data-id={f.id} onClick={() => pick(f.id)}>
                    <span className="pf-row-name">
                      <b>{f.name}</b>
                      <span>
                        {f.nick ? `"${f.nick}" · ` : ""}
                        {f.weightClass} · {f.stance === "orthodox" ? "Orthodox" : "Southpaw"}
                      </span>
                    </span>
                    <span className="pf-row-bars" aria-hidden>
                      {ATTR_KEYS.map(k => (
                        <i key={k} style={{ ["--v" as string]: f.attrs[k] / 100 }} />
                      ))}
                    </span>
                    <span className="pf-row-tag">{isMe ? "You" : isThem ? "Opponent" : f.real ? "" : "Yours"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="pf-match" aria-label="The fight">
          <div className="pf-faceoff">
            <Preview3D fighters={pair} mode="faceoff" quality={Math.min(settings.gfx, 2)} label={`${me?.name ?? "Pick a fighter"} against ${them?.name ?? "pick an opponent"}`} />
            <div className="pf-plates">
              {(["me", "them"] as const).map(s => {
                const f = s === "me" ? me : them;
                return (
                  <button key={s} className={clsx("pf-plate", side === s && "is-on", s)} data-pf={"side-" + s} onClick={() => setSide(s)}>
                    <span className="pf-plate-who">{s === "me" ? "You" : "Opponent"}</span>
                    <b>{f ? f.name : "Pick from the list"}</b>
                    <span className="pf-plate-sub">{f ? (f.real ? recordText(recordOf(f.id)) === "0-0-0" ? f.era : `Your record as him ${recordText(recordOf(f.id))}` : `Record ${recordText(recordOf(f.id))}`) : side === s ? "Choosing now" : "Click to choose"}</span>
                  </button>
                );
              })}
            </div>
            <button className="k-btn k-btn-sm pf-random" onClick={random}>
              Random {side === "me" ? "fighter" : "opponent"}
            </button>
          </div>
          <div className="pf-tape k-panel" aria-label="Tale of the tape">
            <h2 className="k-panel-title">Tale of the tape</h2>
            <table className="pf-tape-t">
              <tbody>
                <TapeRow label="Height" a={me && inches(me.heightCm)} b={them && inches(them.heightCm)} />
                <TapeRow label="Reach" a={me && `${me.reachIn} in`} b={them && `${them.reachIn} in`} />
                <TapeRow label="Weight" a={me && `${me.weightKg} kg`} b={them && `${them.weightKg} kg`} />
                <TapeRow label="Stance" a={me && (me.stance === "orthodox" ? "Orthodox" : "Southpaw")} b={them && (them.stance === "orthodox" ? "Orthodox" : "Southpaw")} />
                <TapeRow label="Style" a={me && STYLE_NAME[me.style]} b={them && STYLE_NAME[them.style]} />
                <TapeRow label="Guard" a={me && GUARD_NAME[me.guard]} b={them && GUARD_NAME[them.guard]} />
                {ATTR_KEYS.map(k => (
                  <BarRow key={k} label={k[0].toUpperCase() + k.slice(1)} a={me?.attrs[k] ?? null} b={them?.attrs[k] ?? null} />
                ))}
                <TapeRow label="Edge" a={me && (me.traits.map(t => TRAIT_NAME[t]).join(", ") || "None")} b={them && (them.traits.map(t => TRAIT_NAME[t]).join(", ") || "None")} />
              </tbody>
            </table>
          </div>
          <div className="pf-setup k-panel">
            <h2 className="k-panel-title">The fight</h2>
            <div className="pf-setup-row">
              <span className="k-label">Rounds</span>
              <div className="pf-seg">
                {([3, 6, 12] as const).map(r => (
                  <button key={r} className={clsx("k-btn k-btn-sm", settings.rounds === r && "k-on")} data-pf={"rounds-" + r} onClick={() => props.onSettings({ rounds: r })}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="pf-setup-row">
              <span className="k-label">Each round</span>
              <div className="pf-seg">
                {[60, 120, 180].map(s => (
                  <button key={s} className={clsx("k-btn k-btn-sm", settings.roundSec === s && "k-on")} data-pf={"sec-" + s} onClick={() => props.onSettings({ roundSec: s })}>
                    {s / 60} min
                  </button>
                ))}
              </div>
            </div>
            <div className="pf-setup-row">
              <span className="k-label">Opponent</span>
              <div className="pf-seg pf-seg-wrap">
                {TIER_NAME.map((n, i) => (
                  <button key={n} className={clsx("k-btn k-btn-sm", settings.tier === i && "k-on")} data-pf={"tier-" + i} onClick={() => props.onSettings({ tier: i as Tier })}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <p className="pf-note">{TIER_NOTE[settings.tier]}</p>
            <button className="k-btn k-btn-primary pf-go" data-pf="fight" disabled={!ready || me?.id === them?.id} onClick={props.onFight}>
              {!ready ? "Pick both fighters" : me?.id === them?.id ? "Pick two different fighters" : "Fight"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function TapeRow({ label, a, b }: { label: string; a: string | null; b: string | null }) {
  return (
    <tr>
      <td className="a">{a ?? "?"}</td>
      <th scope="row">{label}</th>
      <td className="b">{b ?? "?"}</td>
    </tr>
  );
}

function BarRow({ label, a, b }: { label: string; a: number | null; b: number | null }) {
  return (
    <tr className="bar">
      <td className="a">
        <span className={clsx("pf-bar l", a !== null && b !== null && a > b && "up")} style={{ ["--v" as string]: (a ?? 0) / 100 }}>
          <i />
          <b>{a ?? "?"}</b>
        </span>
      </td>
      <th scope="row">{label}</th>
      <td className="b">
        <span className={clsx("pf-bar r", a !== null && b !== null && b > a && "up")} style={{ ["--v" as string]: (b ?? 0) / 100 }}>
          <i />
          <b>{b ?? "?"}</b>
        </span>
      </td>
    </tr>
  );
}
