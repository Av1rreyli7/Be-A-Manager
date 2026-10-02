/** Calendar helpers. Dates are ISO "YYYY-MM-DD" strings (UTC, no time). */

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);
}

export function dayOfWeek(iso: string): number {
  return new Date(iso + "T00:00:00Z").getUTCDay(); // 0 = Sunday
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
}

/** "2026-27" for a season starting in 2026 */
export function seasonLabel(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function seasonStartYear(label: string): number {
  return Number(label.slice(0, 4));
}

export function nextSeason(label: string): string {
  return seasonLabel(seasonStartYear(label) + 1);
}

/** Age on a given date from ISO DOB */
export function ageOn(dob: string, iso: string): number {
  const [y, m, d] = dob.split("-").map(Number);
  const [Y, M, D] = iso.split("-").map(Number);
  return Y - y - (M < m || (M === m && D < d) ? 1 : 0);
}

/** Key dates of a league year that starts in `y` (season y-(y+1)). Mirrors the NBA's usual calendar. */
export function seasonCalendar(y: number) {
  const nthWeekday = (year: number, month: number, weekday: number, n: number) => {
    const first = new Date(Date.UTC(year, month - 1, 1));
    const offset = (weekday - first.getUTCDay() + 7) % 7;
    return new Date(Date.UTC(year, month - 1, 1 + offset + (n - 1) * 7)).toISOString().slice(0, 10);
  };
  const tipoff = nthWeekday(y, 10, 2, 3); // 3rd Tuesday of October
  const allStarSunday = nthWeekday(y + 1, 2, 0, 3); // 3rd Sunday of February
  return {
    preseasonStart: `${y}-09-29`,
    tipoff,
    cupGroupStart: nthWeekday(y, 11, 5, 1), // first Friday of November
    cupGroupEnd: nthWeekday(y, 12, 2, 1), // first Tuesday of December
    cupQuarterfinals: nthWeekday(y, 12, 2, 2), // 2nd Tuesday of Dec (West plays the next night)
    cupSemifinals: addDays(nthWeekday(y, 12, 2, 2), 4), // that Saturday
    cupFinal: addDays(nthWeekday(y, 12, 2, 2), 7), // the following Tuesday
    tradeDeadline: addDays(allStarSunday, -10), // Thursday ~10 days before ASG
    allStarBreakStart: addDays(allStarSunday, -3),
    allStarSunday,
    allStarBreakEnd: addDays(allStarSunday, 3),
    buyoutDeadline: `${y + 1}-03-01`,
    twoWayDeadline: `${y + 1}-03-04`,
    regularSeasonEnd: nthWeekday(y + 1, 4, 0, 2), // 2nd Sunday of April
    playInStart: addDays(nthWeekday(y + 1, 4, 0, 2), 2),
    playoffsStart: addDays(nthWeekday(y + 1, 4, 0, 2), 6),
    draftLottery: nthWeekday(y + 1, 5, 0, 2),
    draft: nthWeekday(y + 1, 6, 3, 4),
    freeAgencyStart: `${y + 1}-06-30`,
    moratoriumEnd: `${y + 1}-07-06`,
    summerLeague: `${y + 1}-07-10`,
    trainingCamp: `${y + 1}-09-29`,
  };
}
export type SeasonCalendar = ReturnType<typeof seasonCalendar>;
