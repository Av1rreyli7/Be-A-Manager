"use client";
/* eslint-disable react-hooks/immutability -- the world's controller is a plain object the map moves on purpose (the waypoint) */
/**
 * The city map (M or the Map button): the streets, the districts, the sea, every place, his home, the bus
 * stops, where his cars are parked (a blue P) and where he is. Click anywhere to set a waypoint (a beam in the street and an arrow on the screen
 * lead him there); click a place he has been to, or pick it from the list, to go straight there.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type { CityPlan, PlaceSpot } from "./gen";
import type { WorldCtl } from "./World";

const ZONE_COL: Record<string, string> = {
  centre: "#3a4250",
  mid: "#323a45",
  suburb: "#2e3d33",
  hill: "#2f4034",
  outskirts: "#3a3a3a",
  sports: "#2b4a33",
  seafront: "#45413a",
  park: "#2f5a36",
};
const KIND_COL: Record<string, string> = {
  store: "#ff7a70",
  watches: "#ffd35c",
  mall: "#ff9a52",
  supermarket: "#7ad0ff",
  cafe: "#e0b07a",
  restaurant: "#ffcf5c",
  club: "#c77dff",
  clinic: "#4ee08f",
  gym: "#7ad0ff",
  training: "#9ae66e",
  stadium: "#9ae66e",
  school: "#ffb86b",
  college: "#8fb8ff",
  dealer: "#d9dde3",
  home: "#d0e85c",
};
const KIND_LABEL: Record<string, string> = {
  store: "Shops",
  watches: "Watches",
  mall: "Mall",
  supermarket: "Supermarket",
  cafe: "Cafes",
  restaurant: "Restaurant",
  club: "Nightclub",
  clinic: "Clinic",
  gym: "Gym",
  training: "Training grounds",
  stadium: "Stadiums",
  school: "Schools",
  college: "Colleges",
  dealer: "Cars",
  home: "Homes",
};

export default function CityMap({
  plan,
  ctl,
  visited,
  homeId,
  ownedHomes,
  cars,
  carName,
  onClose,
  onTravel,
}: {
  plan: CityPlan;
  ctl: React.MutableRefObject<WorldCtl>;
  visited: string[];
  homeId: string;
  ownedHomes: string[];
  /** where his cars are kept: his bays on the street or the garage of the home he bought (null before he has a spot) */
  cars: { x: number; z: number; label: string; n: number } | null;
  /** a car's name, for one he has left somewhere else */
  carName: (id: string) => string;
  onClose: () => void;
  onTravel: (s: PlaceSpot) => void;
}) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<PlaceSpot | null>(null);
  const [sel, setSel] = useState<PlaceSpot | null>(null);
  const size = plan.n * plan.pitch + 80;
  const isHome = (s: PlaceSpot) => s.place.kind === "home" && (s.place.homeId || s.place.id.replace("home:", "")) === homeId;
  const known = (s: PlaceSpot) => visited.includes(s.place.id) || isHome(s) || ownedHomes.includes(s.place.homeId || s.place.id.replace("home:", ""));
  // the map, drawn once; the dots for him and the waypoint go on top every frame
  const base = useMemo(() => {
    if (typeof document === "undefined") return null;
    const S = 1100;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const x = c.getContext("2d")!;
    const k = S / size;
    const X = (v: number) => (v + size / 2) * k;
    x.fillStyle = "#14171c";
    x.fillRect(0, 0, S, S);
    if (plan.coastZ !== null) {
      x.fillStyle = "#16384a";
      x.fillRect(0, X(plan.coastZ + plan.road + plan.walk), S, S);
      x.fillStyle = "#c9b98f";
      x.fillRect(0, X(plan.coastZ + plan.road / 2 + plan.walk + 2), S, 30 * k);
    }
    const inner = plan.pitch - plan.road - plan.walk * 2;
    for (let i = 0; i < plan.n; i++)
      for (let j = 0; j < plan.n; j++) {
        if (plan.coastRow !== null && j > plan.coastRow) continue;
        const cx = -plan.half + i * plan.pitch + plan.pitch / 2,
          cz = -plan.half + j * plan.pitch + plan.pitch / 2;
        x.fillStyle = "#5d6066";
        x.fillRect(X(cx - inner / 2 - plan.walk), X(cz - inner / 2 - plan.walk), (inner + plan.walk * 2) * k, (inner + plan.walk * 2) * k);
        if (plan.zones[i][j] === "river") {
          x.fillStyle = "#1d4a60";
          x.fillRect(X(cx - inner / 2 - plan.walk), X(cz - inner / 2 - plan.walk), (inner + plan.walk * 2) * k, (inner + plan.walk * 2) * k);
          continue;
        }
        x.fillStyle = ZONE_COL[plan.zones[i][j]] || "#333";
        x.fillRect(X(cx - inner / 2), X(cz - inner / 2), inner * k, inner * k);
      }
    x.fillStyle = "#596170";
    for (const b of plan.buildings) x.fillRect(X(b.x - b.w / 2), X(b.z - b.d / 2), b.w * k, b.d * k);
    // the bus loop
    x.strokeStyle = "rgba(255,176,0,0.55)";
    x.lineWidth = 3;
    x.setLineDash([8, 6]);
    x.beginPath();
    plan.bus.forEach(([bx, bz], n) => (n ? x.lineTo(X(bx), X(bz)) : x.moveTo(X(bx), X(bz))));
    x.closePath();
    x.stroke();
    x.setLineDash([]);
    for (const st of plan.stops) {
      x.fillStyle = "#ffb000";
      x.fillRect(X(st.x) - 4, X(st.z) - 4, 8, 8);
    }
    // district names
    x.font = "600 26px Inter, system-ui, sans-serif";
    x.textAlign = "center";
    x.fillStyle = "rgba(255,255,255,0.32)";
    for (const d of plan.districts) x.fillText(d.name.toUpperCase(), X(d.x), X(d.z));
    return { c, k, X };
  }, [plan, size]);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const el = cv.current;
      if (el && base) {
        const g = el.getContext("2d")!;
        const S = el.width;
        g.clearRect(0, 0, S, S);
        g.drawImage(base.c, 0, 0, S, S);
        const f = S / base.c.width;
        const X = (v: number) => base.X(v) * f;
        for (const s of plan.places) {
          const on = known(s);
          g.fillStyle = KIND_COL[s.place.kind] || "#fff";
          g.globalAlpha = on ? 1 : 0.55;
          const r = s.place.kind === "stadium" || s.place.kind === "training" || s.place.kind === "mall" || s.place.kind === "school" || s.place.kind === "college" ? 9 : 6;
          g.beginPath();
          g.arc(X(s.door.x), X(s.door.z), r * f * 1.4, 0, Math.PI * 2);
          g.fill();
          if (isHome(s)) {
            g.strokeStyle = "#ffffff";
            g.lineWidth = 3;
            g.stroke();
          }
          g.globalAlpha = 1;
        }
        const c = ctl.current;
        // his cars: a blue P where they are kept, a smaller one for a car he has left somewhere else
        const pin = (px: number, pz: number, r: number) => {
          g.fillStyle = "#1f5fbf";
          g.strokeStyle = "#ffffff";
          g.lineWidth = 2;
          g.beginPath();
          g.roundRect(X(px) - r, X(pz) - r, r * 2, r * 2, r * 0.35);
          g.fill();
          g.stroke();
          g.fillStyle = "#ffffff";
          g.font = "800 " + Math.round(r * 1.3) + "px Inter, system-ui, sans-serif";
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText("P", X(px), X(pz) + 1);
        };
        if (cars) pin(cars.x, cars.z, 11);
        const left = c.parked;
        if (left && (!cars || Math.hypot(left.x - cars.x, left.z - cars.z) > 12)) pin(left.x, left.z, 8);
        if (c.waypoint) {
          g.strokeStyle = "#ffd35c";
          g.lineWidth = 3;
          g.beginPath();
          g.arc(X(c.waypoint.x), X(c.waypoint.z), 12, 0, Math.PI * 2);
          g.stroke();
          g.beginPath();
          g.moveTo(X(c.x), X(c.z));
          g.lineTo(X(c.waypoint.x), X(c.waypoint.z));
          g.setLineDash([6, 6]);
          g.stroke();
          g.setLineDash([]);
        }
        // him: an arrow the way he faces
        g.save();
        g.translate(X(c.x), X(c.z));
        g.rotate(-c.ry + Math.PI);
        g.fillStyle = "#ffffff";
        g.strokeStyle = "#0b0d10";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(0, -13);
        g.lineTo(9, 10);
        g.lineTo(0, 5);
        g.lineTo(-9, 10);
        g.closePath();
        g.fill();
        g.stroke();
        g.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
    // known() reads the props each frame
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, plan, ctl, visited, homeId, cars]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key.toLowerCase() === "m") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const toWorld = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const el = cv.current!;
    const r = el.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * size - size / 2,
      pz = ((e.clientY - r.top) / r.height) * size - size / 2;
    return { x: px, z: pz };
  };
  const spotAt = (p: { x: number; z: number }) => {
    let best: PlaceSpot | null = null,
      bd = 14;
    for (const s of plan.places) {
      const d = Math.hypot(s.door.x - p.x, s.door.z - p.z);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  };
  const groups = useMemo(() => {
    const g = new Map<string, PlaceSpot[]>();
    for (const s of plan.places) {
      const k = KIND_LABEL[s.place.kind] || s.place.kind;
      const a = g.get(k);
      if (a) a.push(s);
      else g.set(k, [s]);
    }
    return [...g.entries()];
  }, [plan]);

  return (
    <div className="pc-map" role="dialog" aria-label="City map">
      <div className="pc-map-sheet">
        <div className="pc-map-canvas">
          <canvas
            ref={cv}
            width={900}
            height={900}
            onMouseMove={(e) => setHover(spotAt(toWorld(e)))}
            onMouseLeave={() => setHover(null)}
            onClick={(e) => {
              const p = toWorld(e);
              const s = spotAt(p);
              if (s) {
                setSel(s);
                ctl.current.waypoint = { x: s.door.x, z: s.door.z };
              } else {
                setSel(null);
                ctl.current.waypoint = p;
              }
            }}
          />
          {hover && <p className="pc-map-hover">{hover.place.name}</p>}
        </div>
        <aside className="pc-map-side">
          <header className="k-controls">
            <h3 className="k-panel-title" style={{ marginRight: "auto" }}>
              Map
            </h3>
            <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={onClose}>
              Close
            </button>
          </header>
          <p className="pc-dim">Click the map to set a waypoint. Places you have been to can be reached at once.</p>
          {sel && (
            <div className="pc-map-sel">
              <b>{sel.place.name}</b>
              <span>{KIND_LABEL[sel.place.kind]}</span>
              <div className="pc-map-sel-row">
                <button type="button" className="k-btn k-btn-sm" onClick={() => (ctl.current.waypoint = { x: sel.door.x, z: sel.door.z })}>
                  Waypoint
                </button>
                <button type="button" className="k-btn k-btn-primary k-btn-sm" disabled={!known(sel)} title={known(sel) ? "" : "Visit it once first"} onClick={() => onTravel(sel)}>
                  Go there
                </button>
              </div>
            </div>
          )}
          <ul className="pc-map-list">
            {(cars || ctl.current.parked) && (
              <li>
                <span className="k-label">Your cars</span>
                {cars && (
                  <button
                    type="button"
                    className="pc-map-row"
                    onClick={() => {
                      setSel(null);
                      ctl.current.waypoint = { x: cars.x, z: cars.z };
                    }}
                  >
                    <i style={{ background: "#1f5fbf" }} />
                    {cars.label}
                    {cars.n ? " (" + cars.n + (cars.n === 1 ? " car)" : " cars)") : " (empty)"}
                  </button>
                )}
                {(() => {
                  const left = ctl.current.parked;
                  if (!left || (cars && Math.hypot(left.x - cars.x, left.z - cars.z) <= 12)) return null;
                  return (
                    <button
                      type="button"
                      className="pc-map-row"
                      onClick={() => {
                        setSel(null);
                        ctl.current.waypoint = { x: left.x, z: left.z };
                      }}
                    >
                      <i style={{ background: "#1f5fbf" }} />
                      {carName(left.id)}, where you left it
                    </button>
                  );
                })()}
              </li>
            )}
            {groups.map(([label, list]) => (
              <li key={label}>
                <span className="k-label">{label}</span>
                {list.map((s) => (
                  <button
                    type="button"
                    key={s.place.id}
                    className={clsx("pc-map-row", sel === s && "is-on", isHome(s) && "is-home")}
                    onClick={() => {
                      setSel(s);
                      ctl.current.waypoint = { x: s.door.x, z: s.door.z };
                    }}
                  >
                    <i style={{ background: KIND_COL[s.place.kind] }} />
                    {s.place.name}
                    {isHome(s) ? " (home)" : known(s) ? "" : " (not visited)"}
                  </button>
                ))}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
