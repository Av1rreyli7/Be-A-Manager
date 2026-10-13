/** The still Front Office loading screen: the brand, a thin shimmer and one line (a league loading, a room rejoining). */
export function BootScreen({ text }: { text: string }) {
  return (
    <div className="grid min-h-[100dvh] place-items-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <div className="k-brand">
          <span className="sq" />
          <span className="k-msub" style={{ letterSpacing: "0.2em", color: "#fff", fontWeight: 700 }}>
            FRONT OFFICE
          </span>
        </div>
        <div className="h-px w-44 overflow-hidden bg-line">
          <div className="k-shimmer h-full w-full" />
        </div>
        <span className="k-label">{text}</span>
      </div>
    </div>
  );
}
