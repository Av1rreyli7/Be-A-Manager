"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import clsx from "clsx";
import { CheckCircle, Info, WarningCircle } from "@phosphor-icons/react";
import { useGame, type Toast } from "@/lib/store";
import { km } from "@/lib/motion";

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** The kit toast: slides in from the side and settles, a coloured edge says what kind it is. */
function ToastItem({ t, onDismiss }: { t: Toast; onDismiss: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useIso(() => {
    const tw = km.slideIn(ref.current);
    return () => {
      tw?.progress(1).kill();
    };
  }, []);
  const I = t.kind === "success" ? CheckCircle : t.kind === "error" ? WarningCircle : Info;
  return (
    <button ref={ref} onClick={onDismiss} className={clsx("k-toast pointer-events-auto w-full text-left", t.kind === "success" && "good", t.kind === "error" && "bad")} style={{ animation: "none" }}>
      <I size={18} weight="fill" className={clsx("mt-px shrink-0", t.kind === "success" ? "text-good" : t.kind === "error" ? "text-bad" : "text-accent")} />
      <span className="min-w-0 font-medium">{t.text}</span>
    </button>
  );
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed bottom-20 right-3 z-[60] flex w-[min(92vw,380px)] flex-col gap-2 lg:bottom-4 lg:right-4" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}
