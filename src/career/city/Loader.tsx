"use client";
/**
 * While the city loads: a plain dark screen, the brand's dots pulsing one after another, a small label. Only
 * transform and opacity animate, so it keeps moving while the city is being built, and it fades out once the
 * world has drawn its first frames. One element from the moment he steps in, so nothing restarts or flashes.
 */
import clsx from "clsx";

export default function CityLoader({ out, label }: { out: boolean; label?: string }) {
  return (
    <div className={clsx("pc-load", out && "is-out")} role="status" aria-live="polite" aria-hidden={out}>
      <div className="pc-load-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <p className="pc-load-label">{label || "Loading the city"}</p>
    </div>
  );
}
