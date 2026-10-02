"use client";
import clsx from "clsx";
import { CheckCircle, Info, WarningCircle } from "@phosphor-icons/react";
import { useGame } from "@/lib/store";

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed bottom-20 right-3 z-[60] flex w-[min(92vw,380px)] flex-col gap-2 lg:bottom-4 lg:right-4" aria-live="polite">
      {toasts.map((t) => {
        const I = t.kind === "success" ? CheckCircle : t.kind === "error" ? WarningCircle : Info;
        return (
          <button
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={clsx(
              "panel anim-rise pointer-events-auto flex items-start gap-2.5 px-4 py-3 text-left text-sm",
              t.kind === "success" && "shadow-[inset_2px_0_0_var(--color-good)]",
              t.kind === "error" && "shadow-[inset_2px_0_0_var(--color-bad)]",
              t.kind !== "success" && t.kind !== "error" && "shadow-[inset_2px_0_0_var(--accent)]",
            )}
          >
            <I size={18} weight="fill" className={clsx("mt-px shrink-0", t.kind === "success" ? "text-good" : t.kind === "error" ? "text-bad" : "text-accent")} />
            <span className="min-w-0">{t.text}</span>
          </button>
        );
      })}
    </div>
  );
}
