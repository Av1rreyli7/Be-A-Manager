/**
 * The gym, the training ground and the stadium: the rooms the old city built, dressed in the place's own
 * colours, with the new hotspots (gym:<id>, session:<id>, fans) and a way out.
 */
import type { CareerState, WorldPlace } from "../../types";
import type { PlaceId } from "../CityScene";
import type { Kit, Room } from "./common";
import { buildLegacyRoom } from "./legacy";

export function sportRoom(k: Kit, p: WorldPlace, night: number): Room {
  const st = k.st;
  // the old builder reads the city's accent and the place names; give it this place's
  const life = { ...st.life, style: { ...st.life.style, accent: p.style.accent || st.life.style.accent }, places: { ...st.life.places, gym: p.kind === "gym" ? p.name : st.life.places.gym } };
  const s2 = { ...st, life } as CareerState;
  const room = buildLegacyRoom(p.kind as PlaceId, s2, night);
  const hs = room.hotspots;
  if (p.kind === "gym") {
    for (const h of hs) if (["weights", "engine", "mobility", "spa"].includes(h.id)) h.id = "gym:" + h.id;
    hs.push({ id: "door", label: "Way out", x: 0, z: room.d / 2 - 0.6, r: 1.0, tag: true });
    // someone between sets, by the way in
    room.slots = [{ x: -1.8, z: room.d / 2 - 2.6, ry: Math.PI / 2 + 0.5, sx: -0.9, sz: room.d / 2 - 2.1 }];
  } else if (p.kind === "training") {
    const drills = hs.findIndex((h) => h.id === "drills");
    if (drills >= 0) hs.splice(drills, 1);
    const ids = Object.keys(st.training.sessions).filter((id) => id !== "rest");
    // one station per session along the near touchline
    // two rows of stations along the near half of the pitch
    const per = Math.ceil(ids.length / 2);
    ids.forEach((id, i) => {
      const row = Math.floor(i / per),
        col = i % per;
      const x = -room.w / 2 + 3 + col * ((room.w - 6) / Math.max(1, per - 1)) + row * 1.2;
      hs.push({ id: "session:" + id, label: st.training.sessions[id].label, x, z: 2.0 + row * 2.6, r: 1.1, tag: true });
    });
    hs.push({ id: "door", label: "Back to the car park", x: 0, z: room.d / 2 - 1.2, r: 1.2, tag: true });
  } else {
    const pitch = hs.findIndex((h) => h.id === "pitch");
    if (pitch >= 0) hs.splice(pitch, 1);
    hs.push({ id: "door", label: "Down the tunnel", x: 6, z: room.d / 2 - 1.6, r: 1.2, tag: true });
  }
  for (const h of hs) h.tag = true;
  void k;
  return { ...room, accent: p.style.accent || st.life.style.accent };
}
