import { describe, expect, it } from "vitest";
import { validateTrade } from "../src/engine/cap/trade";
import { executeTrade } from "../src/engine/trade/execute";
import { addPlayer, emptyLeague, fillTo, twoTeam } from "./fixtures";

const rules = (v: ReturnType<typeof validateTrade>, team?: string) => v.issues.filter((i) => i.severity === "error" && (!team || i.teamId === team)).map((i) => i.rule);

/** Two over-cap, non-apron teams at ~$180M each. */
function setup() {
  const l = emptyLeague();
  fillTo(l, "BOS", 170_000_000, 12);
  fillTo(l, "NY", 170_000_000, 12);
  return l;
}

describe("salary matching (non-apron)", () => {
  it("$10M out allows exactly $19,096,000 back (published example)", () => {
    const l = setup();
    const out = addPlayer(l, "BOS", 10_000_000);
    const inn = addPlayer(l, "NY", 19_096_000);
    expect(validateTrade(l, twoTeam("BOS", "NY", [out.id], [inn.id])).valid).toBe(true);
    const inn2 = addPlayer(l, "NY", 19_096_001);
    expect(rules(validateTrade(l, twoTeam("BOS", "NY", [out.id], [inn2.id])), "BOS")).toContain("salary-matching");
  });
  it("small salaries use 200% + $250K", () => {
    const l = setup();
    const out = addPlayer(l, "BOS", 3_000_000);
    const ok = addPlayer(l, "NY", 6_250_000);
    const bad = addPlayer(l, "NY", 6_260_000);
    expect(validateTrade(l, twoTeam("BOS", "NY", [out.id], [ok.id])).valid).toBe(true);
    expect(rules(validateTrade(l, twoTeam("BOS", "NY", [out.id], [bad.id])), "BOS")).toContain("salary-matching");
  });
  it("large salaries use 125% + $250K", () => {
    const l = emptyLeague();
    fillTo(l, "BOS", 140_000_000, 12);
    fillTo(l, "NY", 130_000_000, 12);
    const out = addPlayer(l, "BOS", 40_000_000);
    const ok = addPlayer(l, "NY", 50_250_000);
    const bad = addPlayer(l, "NY", 50_300_000);
    expect(rules(validateTrade(l, twoTeam("BOS", "NY", [out.id], [ok.id])), "BOS")).not.toContain("salary-matching");
    expect(rules(validateTrade(l, twoTeam("BOS", "NY", [out.id], [bad.id])), "BOS")).toContain("salary-matching");
  });
  it("teams that stay under the cap can absorb salary", () => {
    const l = emptyLeague();
    fillTo(l, "BOS", 130_000_000, 12);
    fillTo(l, "NY", 170_000_000, 12);
    const inn = addPlayer(l, "NY", 20_000_000);
    expect(rules(validateTrade(l, twoTeam("BOS", "NY", [], [inn.id])), "BOS")).toEqual([]);
    const big = addPlayer(l, "NY", 40_000_000);
    expect(rules(validateTrade(l, twoTeam("BOS", "NY", [], [big.id])), "BOS")).toContain("salary-matching");
  });
});

describe("apron restrictions (strict mode)", () => {
  it("over the 1st apron after the trade: only 100% of outgoing salary", () => {
    const l = emptyLeague();
    l.settings.strictAprons = true;
    fillTo(l, "BOS", 198_000_000, 12);
    fillTo(l, "NY", 150_000_000, 12);
    const out = addPlayer(l, "BOS", 10_000_000);
    const ok = addPlayer(l, "NY", 10_000_000);
    const bad = addPlayer(l, "NY", 11_500_000);
    expect(rules(validateTrade(l, twoTeam("BOS", "NY", [out.id], [ok.id])), "BOS")).toEqual([]);
    expect(rules(validateTrade(l, twoTeam("BOS", "NY", [out.id], [bad.id])), "BOS")).toContain("first-apron");
  });
  it("over the 2nd apron: no salary aggregation", () => {
    const l = emptyLeague();
    l.settings.strictAprons = true;
    fillTo(l, "BOS", 215_000_000, 11);
    fillTo(l, "NY", 150_000_000, 12);
    const a = addPlayer(l, "BOS", 5_000_000);
    const b = addPlayer(l, "BOS", 5_000_000);
    const inn = addPlayer(l, "NY", 9_000_000);
    expect(rules(validateTrade(l, twoTeam("BOS", "NY", [a.id, b.id], [inn.id])), "BOS")).toContain("second-apron-aggregate");
  });
  it("over the 2nd apron: can't send cash", () => {
    const l = emptyLeague();
    l.settings.strictAprons = true;
    fillTo(l, "BOS", 224_000_000, 12);
    fillTo(l, "NY", 150_000_000, 12);
    const out = addPlayer(l, "BOS", 2_000_000);
    expect(rules(validateTrade(l, twoTeam("BOS", "NY", [out.id], [], { aCash: 1_000_000 })), "BOS")).toContain("second-apron-cash");
  });
  it("hard caps don't block trades (disabled by design)", () => {
    const l = emptyLeague();
    l.settings.strictAprons = true;
    fillTo(l, "BOS", 196_000_000, 12);
    fillTo(l, "NY", 150_000_000, 12);
    l.teams.BOS.hardCap = "first";
    const out = addPlayer(l, "BOS", 10_000_000);
    const inn = addPlayer(l, "NY", 14_000_000); // post 210M > 209.015M
    expect(rules(validateTrade(l, twoTeam("BOS", "NY", [out.id], [inn.id])), "BOS")).not.toContain("hard-cap");
  });
  it("aggregation no longer triggers a hard cap", () => {
    const l = setup();
    l.settings.strictAprons = true;
    const a = addPlayer(l, "BOS", 4_000_000);
    const b = addPlayer(l, "BOS", 4_000_000);
    const inn = addPlayer(l, "NY", 9_000_000);
    const v = validateTrade(l, twoTeam("BOS", "NY", [a.id, b.id], [inn.id]));
    expect(v.teams.find((t) => t.teamId === "BOS")!.triggersHardCap).toBe(null);
  });
});

describe("player & roster restrictions", () => {
  it("newly signed free agents can't be traded until Dec 15 / 3 months", () => {
    const l = setup();
    const p = addPlayer(l, "BOS", 5_000_000, { contract: { signedDate: "2026-07-15", signedWith: "nt-mle" } });
    const inn = addPlayer(l, "NY", 5_000_000);
    expect(rules(validateTrade(l, twoTeam("BOS", "NY", [p.id], [inn.id])), "BOS")).toContain("newly-signed");
    l.date = "2026-12-16";
    expect(rules(validateTrade(l, twoTeam("BOS", "NY", [p.id], [inn.id])), "BOS")).not.toContain("newly-signed");
  });
  it("recently acquired players can be re-traded immediately", () => {
    const l = setup();
    const a = addPlayer(l, "BOS", 4_000_000, { acquiredDate: "2026-11-01" });
    const b = addPlayer(l, "BOS", 4_000_000);
    const inn = addPlayer(l, "NY", 8_000_000);
    expect(rules(validateTrade(l, twoTeam("BOS", "NY", [a.id, b.id], [inn.id])), "BOS")).not.toContain("aggregation-60");
  });
  it("roster can't exceed 15 standard players in season", () => {
    const l = emptyLeague();
    fillTo(l, "BOS", 150_000_000, 15);
    fillTo(l, "NY", 150_000_000, 13);
    const a = addPlayer(l, "NY", 3_000_000);
    const b = addPlayer(l, "NY", 3_000_000);
    const out = l.contracts[Object.keys(l.contracts).find((k) => l.contracts[k].teamId === "BOS")!].playerId!;
    expect(rules(validateTrade(l, twoTeam("BOS", "NY", [out], [a.id, b.id])), "BOS")).toContain("roster-max");
  });
  it("no-trade clause blocks moves the player won't approve", () => {
    const l = setup();
    const p = addPlayer(l, "BOS", 5_000_000, { morale: 80, contract: { noTradeClause: true } });
    const inn = addPlayer(l, "UTAH", 5_000_000);
    fillTo(l, "UTAH", 150_000_000, 12);
    l.standings.UTAH.w = 5;
    l.standings.UTAH.l = 20;
    expect(rules(validateTrade(l, twoTeam("BOS", "UTAH", [p.id], [inn.id])), "BOS")).toContain("no-trade-clause");
  });
  it("trades are blocked after the deadline", () => {
    const l = setup();
    l.date = "2027-02-20";
    const out = addPlayer(l, "BOS", 5_000_000);
    const inn = addPlayer(l, "NY", 5_000_000);
    expect(rules(validateTrade(l, twoTeam("BOS", "NY", [out.id], [inn.id])))).toContain("window");
  });
});

describe("draft pick rules", () => {
  it("Stepien rule: no consecutive years without a 1st", () => {
    const l = setup();
    const bad = validateTrade(l, twoTeam("BOS", "NY", [], [], { aPicks: ["2027-1-BOS", "2028-1-BOS"] }));
    expect(rules(bad, "BOS")).toContain("stepien");
    const ok = validateTrade(l, twoTeam("BOS", "NY", [], [], { aPicks: ["2027-1-BOS", "2029-1-BOS"] }));
    expect(rules(ok, "BOS")).not.toContain("stepien");
  });
  it("picks can only be traded seven drafts out", () => {
    const l = setup();
    l.picks["2034-1-BOS"] = { ...l.picks["2033-1-BOS"], id: "2034-1-BOS", year: 2034 };
    expect(rules(validateTrade(l, twoTeam("BOS", "NY", [], [], { aPicks: ["2034-1-BOS"] })), "BOS")).toContain("pick-window");
  });
  it("frozen picks can't be traded", () => {
    const l = setup();
    l.picks["2033-1-BOS"].frozen = true;
    expect(rules(validateTrade(l, twoTeam("BOS", "NY", [], [], { aPicks: ["2033-1-BOS"] })), "BOS")).toContain("frozen-pick");
  });
  it("can only trade picks you own", () => {
    const l = setup();
    expect(rules(validateTrade(l, twoTeam("BOS", "NY", [], [], { aPicks: ["2027-1-NY"] })), "BOS")).toContain("ownership");
  });
});

describe("cash", () => {
  it("respects the season cash limit", () => {
    const l = setup();
    l.teams.BOS.cashSent = 8_000_000;
    const out = addPlayer(l, "BOS", 2_000_000);
    expect(rules(validateTrade(l, twoTeam("BOS", "NY", [out.id], [], { aCash: 1_000_000 })), "BOS")).toContain("cash-limit");
  });
});

describe("executing a trade", () => {
  it("moves players, contracts, picks; pays trade kickers; creates a TPE", () => {
    const l = setup();
    const star = addPlayer(l, "BOS", 20_000_000, { contract: { tradeKicker: { pct: 15, value: 0 } } });
    const filler = addPlayer(l, "NY", 12_000_000);
    const a = twoTeam("BOS", "NY", [star.id], [filler.id], { aPicks: ["2029-2-BOS"] });
    // NY receives 20M+kicker(3M)=23M for 12M out: max(min(24.25, 21.096), 15.25) = 21.096M → illegal
    expect(validateTrade(l, a).valid).toBe(false);
    const filler2 = addPlayer(l, "NY", 3_000_000);
    const b = twoTeam("BOS", "NY", [star.id], [filler.id, filler2.id], { aPicks: ["2029-2-BOS"] });
    const v = executeTrade(l, b);
    expect(v.valid).toBe(true);
    expect(l.players[star.id].teamId).toBe("NY");
    expect(l.contracts[star.contractId!].teamId).toBe("NY");
    expect(l.contracts[star.contractId!].years[0].salary).toBe(23_000_000);
    expect(l.picks["2029-2-BOS"].owner).toBe("NY");
    expect(l.teams.BOS.exceptions.tpes.length).toBe(1);
    expect(l.teams.BOS.exceptions.tpes[0].amount).toBe(5_000_000);
  });
});
