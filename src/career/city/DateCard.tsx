"use client";
/**
 * A date as it happens: what she says, three things he can say back (1, 2, 3), and at the end how it went.
 * The moments come from the server (floodlights/career/social.js); this only shows them.
 */
import { useEffect } from "react";
import clsx from "clsx";
import type { DateScene } from "../types";

const VENUE: Record<string, string> = {
  restaurant: "Dinner",
  cafe: "Coffee",
  mall: "The mall",
  walk: "A walk",
  drive: "A drive",
  club: "A night out",
  wedding: "Your wedding",
};

export default function DateCard({ scene, busy, onSay, onEnd, endLabel }: { scene: DateScene; busy: boolean; onSay: (id: string) => void; onEnd: () => void; endLabel?: string }) {
  const done = !!scene.result;
  const r = scene.result;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (busy || e.repeat) return;
      if (done) {
        if (e.key === "1" || e.key.toLowerCase() === "e" || e.key === "Enter") {
          e.stopImmediatePropagation();
          onEnd();
        }
        return;
      }
      const n = Number(e.key);
      const ch = scene.beat?.choices || [];
      if (n >= 1 && n <= ch.length) {
        e.stopImmediatePropagation();
        onSay(ch[n - 1].id);
      }
      // no running out on her: Esc does nothing here
      if (e.key === "Escape") e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [scene, busy, done, onSay, onEnd]);
  return (
    <div className="pc-date">
      <div className={clsx("pc-talk pc-date-card k-panel", r?.proposal === "yes" && "is-yes", scene.venue === "wedding" && "is-wedding")} role="dialog" aria-label={scene.venue === "wedding" ? "Your wedding" : "A date with " + scene.first}>
        <p className="k-label">{scene.venue === "wedding" ? "Your wedding, " + scene.first : (VENUE[scene.venue] || "A date") + " with " + scene.first}</p>
        <div className="pc-date-steps" aria-hidden="true">
          {scene.keys.map((_, i) => (
            <i key={i} className={clsx(i < scene.step && "is-done", i === scene.step && !done && "is-now")} />
          ))}
        </div>
        {scene.said.length > 0 && <p className="pc-talk-me">{scene.said[scene.said.length - 1]}</p>}
        {!done && scene.beat && (
          <>
            <p className="pc-talk-line">{scene.beat.t}</p>
            <div className="pc-talk-opts">
              {scene.beat.choices.map((o, i) => (
                <button key={o.id} type="button" className="k-btn k-btn-sm" disabled={busy} onClick={() => onSay(o.id)}>
                  <kbd aria-hidden="true">{i + 1}</kbd>
                  {o.label}
                </button>
              ))}
            </div>
          </>
        )}
        {r && (
          <>
            {r.proposal === "yes" && <h3 className="pc-date-yes">She said yes</h3>}
            <p className={clsx("pc-date-result", "is-" + r.res)}>{r.text}</p>
            <p className="pc-talk-rel">
              <span className={clsx("k-tag", r.res === "bad" ? "k-warn" : "k-good")}>{r.stage}</span>
              <span className="pc-talk-bar" aria-hidden="true">
                <i style={{ width: r.rel + "%" }} />
              </span>
            </p>
            <div className="pc-talk-opts">
              <button type="button" className="k-btn k-btn-primary k-btn-sm" disabled={busy} onClick={onEnd}>
                <kbd aria-hidden="true">1</kbd>
                {endLabel || "Say goodnight"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
