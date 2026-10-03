/**
 * The two entries on the site and the copy the landing page shows for each.
 * The second entry is Game Night, a bundle of two basketball games (Front Office and Hardwood Legends).
 * Its id stays "frontoffice" because that is only an internal key and matches the /front-office path.
 */
export type GameId = "floodlights" | "frontoffice";

export interface GameInfo {
  id: GameId;
  name: string;
  /** small label above the game name */
  kind: string;
  /** colour mode from the shared kit: pitch (volt and turf) or court (orange and amber) */
  mode: "pitch" | "court";
  blurb: string;
  /** for a bundle: the games inside it, each with one short line that tells them apart */
  inside?: { name: string; text: string }[];
  /** three short facts shown as chips */
  chips: string[];
  href: string;
  enter: string;
}

export const GAMES: Record<GameId, GameInfo> = {
  floodlights: {
    id: "floodlights",
    name: "Floodlights",
    kind: "FOOTBALL MANAGER",
    mode: "pitch",
    blurb: "Run a football club with your mates. Sign stars, haggle over fees, chase the cups and play the big games yourself in 3D.",
    chips: ["320 clubs", "Play with friends", "Matches in 3D"],
    href: "/floodlights/",
    enter: "ENTER FLOODLIGHTS",
  },
  frontoffice: {
    id: "frontoffice",
    name: "Game Night",
    kind: "BASKETBALL BUNDLE",
    mode: "court",
    blurb: "Two basketball games in one.",
    inside: [
      { name: "Front Office", text: "Be the GM. Run rosters, trades and the draft. The matches play out on their own." },
      { name: "Hardwood Legends", text: "No desk work. Grab the roster and play the season yourself in 5v5." },
    ],
    chips: ["Real rosters", "Trades and drafts", "Play 5v5"],
    href: "/front-office",
    enter: "ENTER GAME NIGHT",
  },
};

export const ORDER: GameId[] = ["floodlights", "frontoffice"];
export const other = (g: GameId): GameId => (g === "floodlights" ? "frontoffice" : "floodlights");
