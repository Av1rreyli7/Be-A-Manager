"use client";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { X, Basketball } from "@phosphor-icons/react";
import type { League, Player } from "@/engine/types/game";
import { ratingBg } from "@/lib/format";
import { scoutedRatings } from "@/engine/offseason/draft";
import { km } from "@/lib/motion";

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function Card({ title, right, children, className, pad = true }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section data-km="block" className={clsx("k-panel", !pad && "k-flush", className)}>
      {(title || right) && (
        <header className="k-controls">
          <h2 className="k-panel-title min-w-0" style={{ marginRight: "auto" }}>
            <span className="min-w-0 truncate">{title}</span>
          </h2>
          {right && <div className="flex shrink-0 items-center gap-2 text-xs text-dim [&_a]:font-semibold [&_a]:text-accent [&_a:hover]:underline">{right}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Small condensed heading for sub-sections inside a card. */
export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("k-mlab mb-2", className)}>{children}</div>;
}

type Variant = "default" | "primary" | "ghost" | "danger";

export function Button({ children, onClick, variant = "default", size = "md", disabled, className, title, type = "button" }: { children: ReactNode; onClick?: () => void; variant?: Variant; size?: "sm" | "md"; disabled?: boolean; className?: string; title?: string; type?: "button" | "submit" }) {
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={(e) => {
        km.press(e.currentTarget);
        onClick?.();
      }}
      className={clsx(
        // the kit buttons (public/kit.css), the same ones Floodlights uses: tinted glass for the main action,
        // liquid glass for the rest
        "k-btn",
        size === "sm" && "k-btn-sm",
        variant === "primary" && "k-btn-primary",
        variant === "ghost" && "k-btn-ghost",
        variant === "danger" && "k-btn-danger",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Class string for segmented toggle buttons (mode pickers, filters): small kit buttons, the picked one lit. */
export function seg(active: boolean) {
  return clsx("k-btn k-btn-sm flex-1", active && "k-on");
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "bad" | "warn" }) {
  return (
    <div className="min-w-0">
      <div className="k-cmk">{label}</div>
      <div className={clsx("k-cmv mt-2", tone === "good" && "k-good", tone === "bad" && "k-bad", tone === "warn" && "!text-warn")}>{typeof value === "number" ? <CountUp value={value} /> : value}</div>
      {sub && <div className="mt-1 truncate text-xs text-dim">{sub}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  const bar = useRef<HTMLDivElement>(null);
  // the kit indicator slides under the active tab
  useIso(() => {
    const el = bar.current;
    if (!el) return;
    km.tabIndicator(el, el.querySelector<HTMLElement>('[aria-selected="true"]'));
    el.classList.add("has-ind");
  }, [value, tabs.length]);
  return (
    <div ref={bar} role="tablist" className="k-tabs">
      {tabs.map((t) => {
        const on = value === t.id;
        return (
          <button key={t.id} role="tab" aria-selected={on} className={clsx(on && "on")} onClick={() => onChange(t.id)}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** A number that counts up to its value, and gives a small pulse whenever it changes. */
export function CountUp({ value, format, className }: { value: number; format?: (v: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const last = useRef<number | null>(null);
  const fmt = format ?? ((v: number) => String(Math.round(v)));
  useIso(() => {
    const el = ref.current;
    if (!el) return;
    const from = last.current;
    last.current = value;
    const tw = km.count(el, value, { from: from ?? (Number.isInteger(value) && Math.abs(value) < 10 ? value : 0), format: fmt, duration: from == null ? 0.55 : 0.4 });
    if (from != null && from !== value) km.pulse(el, { scale: 1.12 });
    return () => {
      tw?.progress(1).kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <span ref={ref} className={clsx("inline-block", className)}>
      {fmt(value)}
    </span>
  );
}

/** Something that shows up after the screen is in (a result, a banner, a pick): rises, pops or celebrates once. */
export function Appear({ children, kind = "rise", sparks, className, style }: { children: ReactNode; kind?: "rise" | "pop" | "celebrate"; sparks?: boolean; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useIso(() => {
    const el = ref.current;
    if (!el) return;
    const tw = kind === "pop" ? km.pop(el) : kind === "celebrate" ? km.celebrate(el, { tilt: 0 }) : km.rise(el);
    // court colours for the sparks: orange, amber, teal, violet, gold
    if (sparks) km.sparks(el, { colors: ["#ff8a3d", "#ffbe4a", "#3ee6c4", "#8b6cff", "#ffcf5a"] });
    return () => {
      tw?.progress(1).kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} className={clsx(kind === "celebrate" && "relative", className)} style={style}>
      {children}
    </div>
  );
}

/** Basketball position as a coloured kit badge: guards sky, forwards teal, centers violet. */
export function PosBadge({ pos, className }: { pos: string; className?: string }) {
  const k = pos.startsWith("C") ? "c" : pos.includes("G") ? "g" : "f";
  return <span className={clsx("k-pos", k, className)}>{pos}</span>;
}

export function TeamBadge({ league, teamId, size = "md", withName }: { league: League; teamId: string | null | undefined; size?: "sm" | "md" | "lg"; withName?: boolean }) {
  if (!teamId) return <span className="text-dim">FA</span>;
  const t = league.teams[teamId];
  if (!t) return <span className="text-dim">{teamId}</span>;
  return (
    <Link href={`/game/team/${t.id}`} className="group inline-flex min-w-0 items-center gap-2 align-middle">
      <TeamMark id={t.id} colors={t.colors} size={size} />
      {withName && <span className="truncate font-semibold text-ink group-hover:text-accent">{t.fullName}</span>}
    </Link>
  );
}

/** Team abbreviation block in brand colours, with a secondary-colour baseline. */
export function TeamMark({ id, colors, size = "md" }: { id: string; colors: { primary: string; secondary: string }; size?: "sm" | "md" | "lg" | "xl" }) {
  const dim = size === "sm" ? "h-5 min-w-9 text-[10px] px-1" : size === "lg" ? "h-12 min-w-16 text-xl px-2" : size === "xl" ? "h-16 min-w-20 text-2xl px-2.5" : "h-7 min-w-11 text-xs px-1.5";
  return (
    <span
      className={clsx("chamfer inline-flex shrink-0 items-center justify-center font-num font-bold leading-none tracking-[0.06em] text-white transition-transform duration-200 group-hover:-translate-y-px", dim)}
      style={{ background: `linear-gradient(180deg, ${colors.primary} 0 82%, ${colors.secondary} 82% 100%)`, textShadow: "0 1px 2px rgba(0,0,0,.45)" }}
    >
      {id}
    </span>
  );
}

export function PlayerLink({ player, className }: { player: Player | undefined; className?: string }) {
  if (!player) return <span className="text-dim">-</span>;
  return (
    <Link href={`/game/player/${player.id}`} className={clsx("font-semibold text-ink decoration-accent decoration-2 underline-offset-4 hover:text-accent hover:underline", className)}>
      {player.name}
      {player.injury && <span className="ml-1.5 rounded-[2px] bg-bad/15 px-1 py-px align-[1px] text-[9.5px] font-bold text-bad no-underline" title={`${player.injury.type}, ${player.injury.daysOut}d`}>INJ</span>}
    </Link>
  );
}

export function Rating({ value, className, title, size = "sm" }: { value: number; className?: string; title?: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const dim = size === "sm" ? "h-6 min-w-[30px] text-[13px]" : size === "md" ? "h-9 min-w-11 text-xl" : size === "lg" ? "h-14 min-w-16 text-[34px]" : "h-20 min-w-[88px] text-[50px]";
  return (
    <span title={title} className={clsx("chamfer inline-flex items-center justify-center px-1 font-display font-black leading-none num", dim, ratingBg(value), className)}>
      {value}
    </span>
  );
}

/** OVR/POT that respects draft-prospect scouting uncertainty. */
export function OvrPot({ p, size = "sm" }: { p: Player; size?: "sm" | "md" | "lg" }) {
  if (p.status === "prospect") {
    const s = scoutedRatings(p);
    return (
      <span className="inline-flex items-center gap-1" title={`Scouted ranges: OVR ${s.ovrRange[0]}-${s.ovrRange[1]}, POT ${s.potRange[0]}-${s.potRange[1]}`}>
        <Rating value={s.ovr} size={size} className="opacity-85" />
        <Rating value={s.pot} size={size} className="opacity-60 saturate-50" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Rating value={p.ovr} size={size} title="Overall" />
      <Rating value={p.pot} size={size} className="opacity-60 saturate-50" title="Potential" />
    </span>
  );
}

export function Bar({ value, max = 100, color = "bg-accent" }: { value: number; max?: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden bg-ink/[0.08]">
      <div className={clsx("h-full origin-left transition-[width] duration-500 ease-out", color)} style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
    </div>
  );
}

export function Modal({ open, onClose, title, kicker, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; kicker?: ReactNode; children: ReactNode; wide?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  useIso(() => {
    if (open) km.pop(box.current);
  }, [open]);
  if (!open || typeof document === "undefined") return null;
  // portal to <body> so a parent with transform/filter/backdrop-filter can't trap or clip the overlay
  return createPortal(
    <div className="k-scrim" onClick={onClose} role="dialog" aria-modal="true">
      <div ref={box} className="k-modal scroll-thin max-h-[92dvh] overflow-y-auto" style={wide ? { width: "min(94vw, 896px)" } : undefined} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="k-btn k-btn-ghost k-btn-sm k-modal-x" aria-label="Close">
          <X size={14} weight="bold" />
        </button>
        {kicker && <div className="k-mlab">{kicker}</div>}
        <h3 className="k-modal-title">{title}</h3>
        <div className="mt-3">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <Basketball size={28} weight="duotone" className="text-mute" />
      <div className="max-w-[46ch] text-sm text-dim">{children}</div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="k-label mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

/** The kit input (public/kit.css), the same one Floodlights uses. */
export const inputCls = "k-input";

export function PageHeader({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-[18px]" data-km="head">
      <div className="k-controls !mb-0">
        <h1 className="k-panel-title" style={{ marginRight: "auto" }}>{title}</h1>
        {right}
      </div>
      {sub && <p className="k-pickhelp !mt-1.5">{sub}</p>}
    </div>
  );
}

/** Large trading-card style player tile used on the roster and player pages. */
export function PlayerCard({ league, player, stats, href = true, className, style }: { league: League; player: Player; stats?: { label: string; value: ReactNode }[]; href?: boolean; className?: string; style?: React.CSSProperties }) {
  const t = player.teamId ? league.teams[player.teamId] : null;
  const colors = t?.colors ?? { primary: "#3a4150", secondary: "#1b1f27" };
  const body = (
    <>
      <div className="card-wash relative h-24 overflow-hidden" style={{ ["--tc-team" as string]: colors.primary }}>
        
        <span aria-hidden className="absolute -bottom-5 right-1 font-num text-[96px] font-bold leading-none text-white/10">{player.jersey ?? ""}</span>
        <div className="absolute left-3 top-3">
          <Rating value={player.ovr} size="md" />
        </div>
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
          <PosBadge pos={player.pos} className="!bg-black/55" />
          {player.injury && <span className="rounded-[2px] bg-bad px-1.5 py-0.5 text-[10px] font-bold leading-none text-bg">OUT {player.injury.daysOut}D</span>}
        </div>
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-1" style={{ background: colors.secondary }} />
      </div>
      <div className="px-3 pb-3 pt-2.5">
        <div className="truncate text-xs text-dim">{player.firstName}</div>
        <div className="truncate font-display text-[17px] font-black uppercase leading-tight tracking-[0.02em] group-hover:text-accent">{player.lastName}</div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-mute">
          <span>POT</span>
          <span className={clsx("font-num text-[13px] font-bold", player.pot >= 80 ? "text-gold" : "text-dim")}>{player.pot}</span>
          {player.jersey && <span className="ml-auto">#{player.jersey}</span>}
        </div>
        {stats && stats.length > 0 && (
          <dl className="mt-2.5 grid grid-cols-3 gap-px overflow-hidden border border-line bg-line">
            {stats.map((s) => (
              <div key={s.label} className="bg-panel px-1.5 py-1.5 text-center">
                <dt className="k-label">{s.label}</dt>
                <dd className="mt-0.5 font-display text-[15px] font-extrabold leading-tight num">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </>
  );
  const cls = clsx("group k-panel k-flush lift block overflow-hidden", className);
  return href ? (
    <Link href={`/game/player/${player.id}`} className={cls} style={style}>
      {body}
    </Link>
  ) : (
    <div className={cls} style={style}>
      {body}
    </div>
  );
}
