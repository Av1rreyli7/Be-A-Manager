/**
 * The two entries on the site and the copy the landing page shows for each.
 * The second entry is Game Night, a bundle of two basketball games (Front Office and Hardwood Legends).
 * Its id stays "frontoffice" because that is only an internal key and matches the /front-office path.
 */
export type GameId = "floodlights" | "frontoffice";

export interface GameInfo {
  id: GameId;
  name: string;
  /** small decode label above the game name */
  kind: string;
  blurb: string;
  /** for a bundle: the games inside it, each with one short line that tells them apart */
  inside?: { name: string; text: string }[];
  href: string;
  enter: string;
  /** label on the control that brings this game to the front */
  see: string;
}

export const GAMES: Record<GameId, GameInfo> = {
  floodlights: {
    id: "floodlights",
    name: "Floodlights",
    kind: "FOOTBALL MANAGER",
    blurb: "Run a football club with your friends. Sign players, haggle over fees, chase the cups and play your own matches in 3D.",
    href: "/floodlights/",
    enter: "ENTER FLOODLIGHTS",
    see: "SEE FLOODLIGHTS",
  },
  frontoffice: {
    id: "frontoffice",
    name: "Game Night",
    kind: "BASKETBALL BUNDLE",
    blurb: "Two basketball games in one.",
    inside: [
      { name: "Front Office", text: "Be the GM. Run rosters, trades and the draft. The matches play out on their own." },
      { name: "Hardwood Legends", text: "No desk work. Grab the roster and play the season yourself in 5v5." },
    ],
    href: "/front-office",
    enter: "ENTER GAME NIGHT",
    see: "SEE GAME NIGHT",
  },
};

export const ORDER: GameId[] = ["floodlights", "frontoffice"];
export const other = (g: GameId): GameId => (g === "floodlights" ? "frontoffice" : "floodlights");
