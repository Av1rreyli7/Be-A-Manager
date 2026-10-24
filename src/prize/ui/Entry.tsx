"use client";
/**
 * PRIZE FIGHTER's entry: the Floodlights entry, piece for piece (the frame, the starfield, the brand row, the two
 * word title, one line, the three numbers, the panel on the right), with the two ways in where Floodlights has its
 * name and code: QUICK FIGHT and CREATE A FIGHTER. The mode card at the foot of the panel holds your fighters.
 * A fight saved in the middle (a refresh, a closed tab) waits at the top of the panel to carry on.
 */
import { useEffect, useRef, useState } from "react";
import { useKitEntry } from "@/lib/entry";
import { STARS_A, STARS_B } from "@/lib/starfield";
import { ROSTER } from "../engine/roster";
import type { Created } from "../engine/create";
import { recordOf, recordText } from "../save";

export interface ResumeInfo {
  round: number;
  rounds: number;
  them: string;
  at: number;
}

const agoText = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "a moment ago";
  if (m < 60) return m + (m === 1 ? " minute ago" : " minutes ago");
  const h = Math.round(m / 60);
  return h < 24 ? h + (h === 1 ? " hour ago" : " hours ago") : new Date(t).toLocaleDateString("en-GB");
};

export default function Entry(props: {
  created: Created[];
  resume: ResumeInfo | null;
  onQuick: () => void;
  onCreate: () => void;
  onFightAs: (ref: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onResume: () => void;
  onAbandon: () => void;
  onSettings: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  useKitEntry(root);
  const [listOpen, setListOpen] = useState(false);
  const [armed, setArmed] = useState("");
  const [touchOnly, setTouchOnly] = useState(false);
  useEffect(() => {
    const t = window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(any-pointer: fine)").matches;
    Promise.resolve().then(() => setTouchOnly(t));
  }, []);
  useEffect(() => {
    if (!listOpen) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setListOpen(false);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [listOpen]);
  const { created, resume } = props;
  const n = created.length;

  return (
    <main ref={root} id="main" className="k-entry pf-entry">
      <div className="k-stars" aria-hidden>
        <i style={{ boxShadow: STARS_A }} />
        <i style={{ boxShadow: STARS_B }} />
      </div>
      <div className="k-frame" aria-hidden>
        <span className="ln ln-t" />
        <span className="ln ln-b" />
        <span className="ln ln-l" />
        <span className="ln ln-r" />
        <span className="cn cn-tl" />
        <span className="cn cn-tr" />
        <span className="cn cn-bl" />
        <span className="cn cn-br" />
      </div>
      <div className="k-entry-in">
        <div className="k-hero">
          <div className="k-brand">
            <span className="sq" />
            {/* a full page load home, so the landing's own look applies cleanly */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className="homelink" href="/" title="Back to the Be-A-Manager home page">
              <span className="k-dec">Be-A-Manager</span>
            </a>
            <span className="tg">
              <span className="k-dec">First person boxing</span>
            </span>
          </div>
          <h1 className="k-title" style={{ ["--k-title-em" as string]: 8.95 }}>
            <span className="hrise">
              Prize <span>Fighter</span>
            </span>
          </h1>
          <p className="k-sub">
            Step through the ropes as a legend or a boxer you build, and fight every round from behind your own <em>gloves</em>.
          </p>
          <dl className="k-stats">
            <div>
              <dt>
                <span className="k-dec">Fighters</span>
              </dt>
              <dd>{ROSTER.length + n}</dd>
            </div>
            <div>
              <dt>
                <span className="k-dec">Real legends</span>
              </dt>
              <dd>{ROSTER.length}</dd>
            </div>
            <div>
              <dt>
                <span className="k-dec">Modes</span>
              </dt>
              <dd>2</dd>
            </div>
          </dl>
        </div>
        <div className="k-card">
          {resume && (
            <div className="pf-resume" role="status">
              <p className="pf-resume-t">
                <b>Your fight is waiting</b>
                <span>
                  Round {resume.round} of {resume.rounds} against {resume.them}, saved {agoText(resume.at)}.
                </span>
              </p>
              <div className="row">
                <button className="k-btn k-btn-primary k-btn-sm" data-pf="resume" onClick={props.onResume}>
                  Carry on
                </button>
                <button className="k-btn k-btn-ghost k-btn-sm" data-pf="abandon" onClick={props.onAbandon}>
                  Throw it away
                </button>
              </div>
            </div>
          )}
          <span className="flab k-label">Fight now</span>
          <div className="row">
            <button className="k-btn k-btn-primary k-create pf-big" data-pf="quick" onClick={props.onQuick}>
              Quick fight
            </button>
          </div>
          <div className="cardsplit" />
          <span className="flab k-label">Or build your own</span>
          <div className="row">
            <button className="k-btn pf-wide" data-pf="create" onClick={props.onCreate}>
              Create a fighter
            </button>
          </div>
          <div className="msg" role="status">
            {touchOnly ? "Needs a keyboard. Play it on a computer." : ""}
          </div>
          <button className="k-mode" data-pf="fighters" onClick={() => (n ? setListOpen(true) : props.onCreate())}>
            <b>Your fighters</b>
            <span>{n ? `${n} saved on this device. Fight as one, change one, or let one go.` : "None yet. Build one and it waits here with its record."}</span>
            <i aria-hidden>&rarr;</i>
          </button>
        </div>
      </div>
      <button className="pf-settings k-btn k-btn-ghost k-btn-sm" data-pf="settings" onClick={props.onSettings}>
        Graphics and sound
      </button>
      {listOpen && (
        <div className="k-scrim" onMouseDown={e => e.target === e.currentTarget && setListOpen(false)}>
          <div className="k-modal pf-list" role="dialog" aria-modal="true" aria-label="Your fighters">
            <h2 className="k-modal-title">Your fighters</h2>
            <button className="k-btn k-btn-ghost k-btn-sm k-modal-x" onClick={() => setListOpen(false)} aria-label="Close">
              Close
            </button>
            <div className="pf-list-rows">
              {created.map((c, i) => {
                const r = recordOf("c:" + c.id);
                return (
                  <div key={c.id} className="k-mgrow">
                    <span className="n">{String(i + 1).padStart(2, "0")}</span>
                    <div className="pf-list-who">
                      <div className="nm">{c.name}</div>
                      <div className="cl">
                        {recordText(r)} &middot; {c.stance === "orthodox" ? "Orthodox" : "Southpaw"} &middot; {c.country}
                      </div>
                    </div>
                    <span className="pf-list-act">
                      <button className="k-btn k-btn-primary k-btn-sm" onClick={() => props.onFightAs("c:" + c.id)}>
                        Fight
                      </button>
                      <button className="k-btn k-btn-sm" onClick={() => props.onEdit(c.id)}>
                        Change
                      </button>
                      <button
                        className="k-btn k-btn-danger k-btn-sm"
                        onClick={() => {
                          if (armed === c.id) {
                            setArmed("");
                            props.onDelete(c.id);
                          } else setArmed(c.id);
                        }}
                      >
                        {armed === c.id ? "Sure? Delete" : "Delete"}
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
