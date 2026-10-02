/** The two games on the site and the copy the landing page shows for each. */
export type GameId = "floodlights" | "frontoffice";

export interface GameInfo {
  id: GameId;
  name: string;
  /** small decode label above the game name */
  kind: string;
  blurb: string;
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
    name: "Front Office",
    kind: "BASKETBALL GM",
    blurb: "Be the GM of a pro basketball team. Real rosters and contracts, trades, the draft, free agency and a 3D game you can play.",
    href: "/front-office",
    enter: "ENTER FRONT OFFICE",
    see: "SEE FRONT OFFICE",
  },
};

export const ORDER: GameId[] = ["floodlights", "frontoffice"];
export const other = (g: GameId): GameId => (g === "floodlights" ? "frontoffice" : "floodlights");
