"use client";
import clsx from "clsx";
import { CircleHalf, Desktop, Moon, Palette, Sun, type Icon } from "@phosphor-icons/react";
import { setAppearance, useAppearance, type Mode, type Style } from "@/lib/appearance";

const MODES: { id: Mode; label: string; icon: Icon }[] = [
  { id: "dark", label: "Dark", icon: Moon },
  { id: "light", label: "Light", icon: Sun },
  { id: "system", label: "System", icon: Desktop },
];
const STYLES: { id: Style; label: string; icon: Icon; hint: string }[] = [
  { id: "colorful", label: "Colorful", icon: Palette, hint: "Team colours on the header and cards" },
  { id: "plain", label: "Plain", icon: CircleHalf, hint: "No team colours" },
];

function Group<T extends string>({ label, value, options, onChange, compact }: { label: string; value: T; options: { id: T; label: string; icon: Icon; hint?: string }[]; onChange: (v: T) => void; compact?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label}>
      <div className="label mb-1.5">{label}</div>
      <div className="flex gap-1 rounded-[7px] border border-line bg-ink/[0.03] p-0.5">
        {options.map((o) => {
          const on = value === o.id;
          const I = o.icon;
          return (
            <button
              key={o.id}
              role="radio"
              aria-checked={on}
              title={o.hint ?? o.label}
              onClick={() => onChange(o.id)}
              className={clsx(
                "flex flex-1 items-center justify-center gap-1.5 rounded-[5px] font-semibold transition-colors duration-150 active:translate-y-px",
                compact ? "px-1.5 py-1.5 text-[11.5px]" : "px-3 py-2 text-sm",
                on ? "bg-accent/10 text-accent shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--accent)_55%,transparent)]" : "text-dim hover:text-ink",
              )}
            >
              <I size={compact ? 13 : 16} weight={on ? "fill" : "regular"} className={on ? "text-accent" : undefined} />
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Light / dark / system mode plus colourful / plain style. Saved per browser. */
export function AppearancePicker({ compact }: { compact?: boolean }) {
  const a = useAppearance();
  return (
    <div className={clsx("grid", compact ? "gap-2.5" : "gap-4 sm:grid-cols-2")}>
      <Group label="Mode" value={a.mode} options={MODES} onChange={(mode) => setAppearance({ mode })} compact={compact} />
      <Group label="Style" value={a.style} options={STYLES} onChange={(style) => setAppearance({ style })} compact={compact} />
    </div>
  );
}
