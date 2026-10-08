/**
 * The Be-A-Manager backdrop for menu screens: the kit starfield and the hairline frame with cut corners,
 * the same ones Floodlights draws (public/kit.css). Purely decorative, never interactive.
 * The stars sit at z-index -1, so the screen around them needs its own stacking context (isolate).
 */
import { STARS_A, STARS_B } from "@/lib/starfield";

export function SiteBackdrop({ frame = true }: { frame?: boolean }) {
  return (
    <>
      <div className="k-stars" aria-hidden="true">
        <i style={{ boxShadow: STARS_A }} />
        <i style={{ boxShadow: STARS_B }} />
      </div>
      {frame && (
        <div className="k-frame" aria-hidden="true">
          <span className="ln ln-t" />
          <span className="ln ln-b" />
          <span className="ln ln-l" />
          <span className="ln ln-r" />
          <span className="cn cn-tl" />
          <span className="cn cn-tr" />
          <span className="cn cn-bl" />
          <span className="cn cn-br" />
        </div>
      )}
    </>
  );
}
