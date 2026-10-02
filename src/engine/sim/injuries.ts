/** Injury catalogue: type, severity band and days-out range. */
import type { Injury } from "../types/game";
import { Rng } from "../util/rng";

interface InjuryDef {
  type: string;
  severity: Injury["severity"];
  days: [number, number];
  weight: number;
}

export const INJURIES: InjuryDef[] = [
  { type: "Ankle Sprain", severity: "minor", days: [2, 10], weight: 14 },
  { type: "Knee Soreness", severity: "minor", days: [1, 6], weight: 8 },
  { type: "Back Spasms", severity: "minor", days: [1, 7], weight: 6 },
  { type: "Hamstring Tightness", severity: "minor", days: [2, 8], weight: 7 },
  { type: "Illness", severity: "minor", days: [1, 4], weight: 7 },
  { type: "Sore Foot", severity: "minor", days: [1, 6], weight: 5 },
  { type: "Hip Contusion", severity: "minor", days: [1, 6], weight: 4 },
  { type: "Finger Sprain", severity: "minor", days: [1, 7], weight: 4 },
  { type: "Groin Strain", severity: "moderate", days: [8, 24], weight: 5 },
  { type: "Calf Strain", severity: "moderate", days: [10, 30], weight: 5 },
  { type: "Hamstring Strain", severity: "moderate", days: [10, 28], weight: 5 },
  { type: "Wrist Sprain", severity: "moderate", days: [8, 21], weight: 3 },
  { type: "Concussion", severity: "moderate", days: [7, 18], weight: 3 },
  { type: "Knee Sprain", severity: "moderate", days: [12, 35], weight: 3 },
  { type: "Broken Hand", severity: "major", days: [30, 60], weight: 2 },
  { type: "Torn Meniscus", severity: "major", days: [35, 90], weight: 1.5 },
  { type: "High Ankle Sprain", severity: "major", days: [28, 55], weight: 2 },
  { type: "Fractured Foot", severity: "major", days: [45, 100], weight: 1.2 },
  { type: "Torn ACL", severity: "season-ending", days: [240, 330], weight: 0.45 },
  { type: "Torn Achilles", severity: "season-ending", days: [260, 360], weight: 0.35 },
  { type: "Ruptured Patellar Tendon", severity: "season-ending", days: [220, 320], weight: 0.2 },
];

export function rollInjury(rng: Rng): { type: string; severity: Injury["severity"]; daysOut: number } {
  const d = INJURIES[rng.weighted(INJURIES.map((i) => i.weight))];
  return { type: d.type, severity: d.severity, daysOut: rng.int(d.days[0], d.days[1]) };
}

export function severityOf(type: string): Injury["severity"] {
  return INJURIES.find((i) => i.type === type)?.severity ?? "minor";
}
