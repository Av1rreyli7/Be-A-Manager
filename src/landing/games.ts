/**
 * The three entries on the site and the little the landing page says about each: Floodlights, PRIZE FIGHTER
 * (first person boxing) and Game Night, a bundle of two basketball games (Front Office and Hardwood Legends).
 * Its id stays "frontoffice" because that is only an internal key and matches the /front-office path.
 */
export type GameId = "floodlights" | "prizefighter" | "frontoffice";

export interface GameInfo {
  id: GameId;
  name: string;
  /** colour mode from the shared kit: pitch (volt and turf), ring (hot red orange) or court (orange and amber) */
  mode: "pitch" | "ring" | "court";
  /** the one short line under the title */
  line: string;
  href: string;
  enter: string;
}

export const GAMES: Record<GameId, GameInfo> = {
  floodlights: {
    id: "floodlights",
    name: "Floodlights",
    mode: "pitch",
    line: "Run a football club with your mates.",
    href: "/floodlights/",
    enter: "ENTER FLOODLIGHTS",
  },
  prizefighter: {
    id: "prizefighter",
    name: "Prize Fighter",
    mode: "ring",
    line: "First person boxing under the ring lights.",
    href: "/prize-fighter",
    enter: "ENTER PRIZE FIGHTER",
  },
  frontoffice: {
    id: "frontoffice",
    name: "Game Night",
    mode: "court",
    line: "Run the team, or play it yourself.",
    href: "/front-office",
    enter: "ENTER GAME NIGHT",
  },
};

export const ORDER: GameId[] = ["floodlights", "prizefighter", "frontoffice"];
