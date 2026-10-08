/**
 * Every place in the city, built from its WorldPlace: which builder makes it, and the key that says when it
 * must be rebuilt (what is on sale changing, not what he owns: buying a jacket never rebuilds the shop).
 */
import type { CareerState, WorldPlace } from "../../types";
import { Kit, catalogOf, placesOf, type Room } from "./common";
import { buildStore } from "./store";
import { mallRoom } from "./mall";
import { supermarketRoom } from "./supermarket";
import { watchRoom } from "./watches";
import { cafeRoom, restaurantRoom } from "./food";
import { clubRoom } from "./club";
import { clinicRoom } from "./clinic";
import { dealerRoom } from "./dealer";
import { homeRoom, garageRoom, isGarage } from "./home";
import { sportRoom } from "./sport";

export { garagePlace, isGarage, homeOwned } from "./home";

export function buildPlace(place: WorldPlace, st: CareerState, night: number, quality: number): Room {
  const k = new Kit(st, place, night, quality);
  if (isGarage(place)) return garageRoom(k, place);
  switch (place.kind) {
    case "mall":
      return mallRoom(k, place);
    case "supermarket":
      return supermarketRoom(k, place);
    case "watches":
      return watchRoom(k, place);
    case "cafe":
      return cafeRoom(k, place);
    case "restaurant":
      return restaurantRoom(k, place);
    case "club":
      return clubRoom(k, place);
    case "clinic":
      return clinicRoom(k, place);
    case "dealer":
      return dealerRoom(k, place);
    case "home":
      return homeRoom(k, place);
    case "gym":
    case "training":
    case "stadium":
      return sportRoom(k, place, night);
    default:
      return storeRoom(k, place);
  }
}

/** a shop on its own street door */
export function storeRoom(k: Kit, place: WorldPlace): Room {
  const { look, light } = buildStore(k, place, {});
  const lux = look.luxury;
  const w = lux ? 13 : 14,
    d = 11;
  return k.finish({ w, d, spawn: [0, d / 2 - 1.7], mood: look.warm ? "warm" : "cool", light, accent: look.accent });
}

/** when a place must be built again: what it sells or shows changed (never just what he owns) */
export function roomKey(place: WorldPlace, st: CareerState): string {
  const cat = catalogOf(st);
  const life = st.life;
  const ids = (a: { id: string }[]) => a.map((x) => x.id).join(",");
  const base = place.id + "|" + place.kind + "|" + place.style.floor + place.style.wall + place.style.accent;
  if (isGarage(place)) return base + "|" + garageIds(st).join(",");
  switch (place.kind) {
    case "store":
    case "watches":
      return base + "|" + ids(cat.items.filter((i) => i.store === place.id));
    case "mall": {
      const inside = place.inside || [];
      return (
        base +
        "|" +
        inside.join(",") +
        "|" +
        ids(cat.items.filter((i) => inside.includes(i.store))) +
        "|" +
        placesOf(st)
          .filter((p) => inside.includes(p.id))
          .map((p) => p.name)
          .join(",")
      );
    }
    case "supermarket":
      return base + "|" + ids(cat.groceries);
    case "dealer":
      return base + "|" + ids(cat.cars.filter((c) => c.dealer === place.id));
    case "cafe":
      return base + "|" + ids(cat.menus.cafe);
    case "restaurant":
      return base + "|" + ids(cat.menus.restaurant);
    case "club":
      return base + "|" + ids(cat.menus.club) + "|" + (st.player.age >= (place.minAge ?? 18));
    case "clinic":
      return base + "|" + ids(cat.menus.clinic);
    case "home":
      return (
        base +
        "|" +
        life.home.id +
        life.home.mode +
        "|" +
        life.owned.map((o) => o.id + o.city).join(",") +
        "|" +
        (st.trophies.length + st.awards.length) +
        "|" +
        (life.items.some((i) => i.id === "console" && i.owned) || cat.items.some((i) => i.owned && /console|playstation|xbox|ps5/i.test(i.label))) +
        "|" +
        garageIds(st).length
      );
    case "training":
      return base + "|" + Object.keys(st.training.sessions).join(",");
    default:
      return base;
  }
}

/** every car he owns: the catalog's and the old list's (old saves) */
export function garageIds(st: CareerState) {
  const out = new Set<string>(st.life.garage || []);
  for (const c of catalogOf(st).cars) if (c.owned) out.add(c.id);
  for (const c of st.life.cars) if (c.owned) out.add(c.id);
  return [...out];
}

/** the place for an id, the garage of a home included ("home:villa/garage") */
export function resolvePlace(st: CareerState, id: string): WorldPlace | null {
  const places = placesOf(st);
  if (id.endsWith("/garage")) {
    const home = places.find((p) => p.id === id.slice(0, -7));
    return home ? { ...home, id, name: "Garage" } : null;
  }
  return places.find((p) => p.id === id) || null;
}
