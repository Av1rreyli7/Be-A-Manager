/** IndexedDB save slots (Dexie). */
import Dexie, { type Table } from "dexie";
import type { League } from "@/engine/types/game";

export interface SaveMeta {
  id: string;
  name: string;
  userTeams: string[];
  season: string;
  date: string;
  phase: string;
  updatedAt: number;
  online?: boolean;
}

export interface SaveRow extends SaveMeta {
  league: League;
}

class FrontOfficeDB extends Dexie {
  saves!: Table<SaveRow, string>;
  constructor() {
    super("front-office");
    this.version(1).stores({ saves: "id, updatedAt" });
  }
}

let db: FrontOfficeDB | null = null;
function getDb() {
  if (!db) db = new FrontOfficeDB();
  return db;
}

export function metaOf(l: League): SaveMeta {
  return { id: l.id, name: l.name, userTeams: l.userTeams, season: l.season, date: l.date, phase: l.phase, updatedAt: Date.now(), online: !!l.online };
}

export async function listSaves(): Promise<SaveMeta[]> {
  const rows = await getDb().saves.orderBy("updatedAt").reverse().toArray();
  // drop the heavy league blob from the list rows
  return rows.map((r) => {
    const m: Partial<typeof r> = { ...r };
    delete m.league;
    return m as SaveMeta;
  });
}

export async function saveLeague(l: League) {
  await getDb().saves.put({ ...metaOf(l), league: l });
}

export async function loadSave(id: string): Promise<League | null> {
  return (await getDb().saves.get(id))?.league ?? null;
}

export async function deleteSave(id: string) {
  await getDb().saves.delete(id);
}
