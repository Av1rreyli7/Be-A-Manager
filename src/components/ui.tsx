"use client";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { X, Basketball } from "@phosphor-icons/react";
import type { League, Player } from "@/engine/types/game";
import { ratingBg } from "@/lib/format";
import { scoutedRatings } from "@/engine/offseason/draft";

export function Card({ title, right, children, className, pad = true }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={clsx("panel", className)}>
      {(title || right) && (
        <header className="flex min-h-11 items-center justify-between gap-3 border-b border-line px-4 py-2">
          <h2 className="flex min-w-0 items-center gap-2.5 font-display text-[13px] font-bold uppercase leading-none tracking-[0.07em] text-ink">
            <span aria-hidden className="h-[7px] w-[6px] shrink-0 bg-accent" />
            <span className="min-w-0 truncate">{title}</span>
          </h2>
          {right && <div className="flex shrink-0 items-center gap-2 text-xs text-dim [&_a]:font-semibold [&_a]:text-accent [&_a:hover]:underline">{right}</div>}
        </header>
      )}
      <div className={clsx(pad && "p-4")}>{children}</div>
    </section>
  );
}

/** Small condensed heading for sub-sections inside a card. */
export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("label mb-2", className)}>{children}</div>;
}

type Variant = "default" | "primary" | "ghost" | "danger" | "success";

export function Button({ children, onClick, variant = "default", size = "md", disabled, className, title, type = "button" }: { children: ReactNode; onClick?: () => void; variant?: Variant; size?: "sm" | "md"; disabled?: boolean; className?: string; title?: string; type?: "button" | "submit" }) {
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        // the site's buttons (see .btn in globals.css): glow for the main action, liquid glass for the rest
        "btn",
        size === "sm" && "btn-sm",
        variant === "primary" && "btn-glow",
        variant === "default" && "btn-glass",
        variant === "ghost" && "btn-ghost",
        variant === "danger" && "btn-danger",
        variant === "success" && "btn-success",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Class string for segmented toggle buttons (mode pickers, filters). */
export function seg(active: boolean) {
  return clsx(
    "flex-1 rounded-[6px] border px-2 py-2 text-xs font-semibold transition-colors duration-150 active:translate-y-px",
    active ? "border-accent bg-accent/10 text-accent" : "border-line text-dim hover:border-line-2 hover:text-ink",
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "bad" | "warn" }) {
  return (
    <div className="min-w-0">
      <div className="label">{label}</div>
      <div className={clsx("mt-1 font-display text-[24px] font-extrabold leading-none num", tone === "good" && "text-good", tone === "bad" && "text-bad", tone === "warn" && "text-warn")}>{value}</div>
      {sub && <div className="mt-1 truncate text-xs text-dim">{sub}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="scroll-thin -mx-1 flex gap-1 overflow-x-auto border-b border-line px-1">
      {tabs.map((t) => {
        const on = value === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={clsx(
              "relative whitespace-nowrap px-3 pb-3 pt-2.5 font-num text-[11px] font-bold uppercase leading-none tracking-[0.11em] transition-colors duration-150",
              on ? "text-ink" : "text-mute hover:text-dim",
            )}
          >
            {t.label}
            <span aria-hidden className={clsx("absolute inset-x-2 -bottom-px h-[2px] bg-accent transition-transform duration-300 ease-out", on ? "scale-x-100" : "scale-x-0")} />
          </button>
        );
      })}
    </div>
  );
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

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  // portal to <body> so a parent with transform/filter/backdrop-filter can't trap or clip the overlay
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose} role="dialog" aria-modal="true">
      <div className={clsx("panel anim-rise max-h-[92dvh] w-full overflow-y-auto scroll-thin", wide ? "sm:max-w-4xl" : "sm:max-w-lg")} onClick={(e) => e.stopPropagation()}>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel px-4 py-3">
          <span aria-hidden className="absolute left-0 top-0 h-[2px] w-[54px] bg-accent" />
          <h3 className="font-display text-[15px] font-extrabold uppercase tracking-[0.06em]">{title}</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-[4px] text-dim transition-colors hover:bg-ink/5 hover:text-ink" aria-label="Close">
            <X size={18} weight="bold" />
          </button>
        </header>
        <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
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
      <span className="label mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

export const inputCls = "w-full rounded-[6px] border border-line bg-ink/[0.035] px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-mute hover:border-line-2 focus:border-accent focus:ring-1 focus:ring-accent";

export function PageHeader({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="font-display text-[26px] font-black uppercase leading-none tracking-[0.02em] sm:text-[34px]">{title}</h1>
        {sub && <div className="mt-2 max-w-[75ch] text-sm text-dim">{sub}</div>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
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
        <div className="stripes absolute inset-0" />
        <span aria-hidden className="absolute -bottom-5 right-1 font-num text-[96px] font-bold leading-none text-white/10">{player.jersey ?? ""}</span>
        <div className="absolute left-3 top-3">
          <Rating value={player.ovr} size="md" />
        </div>
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
          <span className="rounded-[2px] bg-black/45 px-1.5 py-1 font-num text-[11px] font-bold leading-none tracking-[0.08em] text-white">{player.pos}</span>
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
                <dt className="label !text-[9.5px]">{s.label}</dt>
                <dd className="mt-0.5 font-display text-[15px] font-extrabold leading-tight num">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </>
  );
  const cls = clsx("group panel lift block overflow-hidden", className);
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
