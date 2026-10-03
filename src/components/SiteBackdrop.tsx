/**
 * The Be-A-Manager backdrop for menu screens: the starfield and the hairline frame
 * with cut corners from the landing page. Purely decorative, never interactive.
 */
import { STARS_A, STARS_B } from "@/lib/starfield";

export function SiteBackdrop({ frame = true }: { frame?: boolean }) {
  return (
    <>
      <div className="site-stars" aria-hidden="true">
        <i style={{ boxShadow: STARS_A }} />
        <i style={{ boxShadow: STARS_B }} />
      </div>
      {frame && <div className="site-frame" aria-hidden="true" />}
    </>
  );
}
