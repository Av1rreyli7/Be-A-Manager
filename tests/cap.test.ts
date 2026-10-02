import { describe, expect, it } from "vitest";
import { DEFAULT_CBA, projectCba } from "../src/engine/config/cba";
import { capHoldFor, maxSalary, minSalary, signingMethods, validateOffer, rookieScaleContract, extensionEligibility } from "../src/engine/cap/contracts";
import { capStatus, isRepeater, statusFor, taxBill, teamSalary } from "../src/engine/cap/payroll";
import { addPlayer, emptyLeague, fillTo } from "./fixtures";

const cba = DEFAULT_CBA;

describe("2026-27 CBA figures", () => {
  it("matches the official thresholds", () => {
    expect(cba.salaryCap.value).toBe(164_961_000);
    expect(cba.luxuryTax.value).toBe(200_428_000);
    expect(cba.firstApron.value).toBe(209_015_000);
    expect(cba.secondApron.value).toBe(221_686_000);
    expect(cba.minimumTeamSalary.value).toBe(148_465_000);
    expect(cba.exceptions.nonTaxpayerMLE.value).toBe(15_044_000);
    expect(cba.exceptions.taxpayerMLE.value).toBe(6_064_000);
    expect(cba.exceptions.roomMLE.value).toBe(9_366_000);
    expect(cba.exceptions.biAnnual.value).toBe(5_477_000);
  });
});

describe("luxury tax", () => {
  it("reproduces the published OKC example (standard rates, 3rd bracket)", () => {
    // $214,279,492 payroll = $13,851,492 over → 6.064M×1 + 6.064M×1.25 + 1,723,492×3.5
    expect(taxBill(214_279_492, cba, false)).toBeCloseTo(19_676_219, -1);
  });
  it("reproduces the published Lakers repeater example", () => {
    expect(taxBill(200_897_322, cba, true)).toBe(1_407_966);
  });
  it("is zero at or below the tax line", () => {
    expect(taxBill(cba.luxuryTax.value, cba, false)).toBe(0);
    expect(taxBill(150_000_000, cba, true)).toBe(0);
  });
  it("adds $0.50 per bracket beyond the table (5th bracket = 5.25 / 7.25)", () => {
    const b = cba.tax.bracketSize;
    const over5 = cba.luxuryTax.value + 4 * b + 1_000_000;
    const base = b * (1 + 1.25 + 3.5 + 4.75);
    expect(taxBill(over5, cba, false)).toBe(Math.round(base + 1_000_000 * 5.25));
    const baseR = b * (3 + 3.25 + 5.5 + 6.75);
    expect(taxBill(over5, cba, true)).toBe(Math.round(baseR + 1_000_000 * 7.25));
  });
  it("detects repeaters (3 of previous 4 seasons)", () => {
    const l = emptyLeague();
    const t = l.teams.DEN;
    t.taxHistory = [{ season: "2023-24", paid: 1 }, { season: "2024-25", paid: 1 }, { season: "2025-26", paid: 1 }];
    expect(isRepeater(t, "2026-27")).toBe(true);
    t.taxHistory = [{ season: "2021-22", paid: 1 }, { season: "2024-25", paid: 1 }, { season: "2025-26", paid: 1 }];
    expect(isRepeater(t, "2026-27")).toBe(false);
  });
});

describe("apron status", () => {
  it("classifies payrolls against each threshold", () => {
    expect(statusFor(150e6, cba)).toBe("under-cap");
    expect(statusFor(170e6, cba)).toBe("over-cap");
    expect(statusFor(205e6, cba)).toBe("over-tax");
    expect(statusFor(215e6, cba)).toBe("over-first");
    expect(statusFor(222e6, cba)).toBe("over-second");
  });
  it("sums contracts and dead money but not two-way deals", () => {
    const l = emptyLeague();
    addPlayer(l, "BOS", 10_000_000);
    const tw = addPlayer(l, "BOS", 678_882);
    l.contracts[tw.contractId!].type = "two-way";
    l.contracts.dead = { id: "dead", playerId: null, playerName: "Waived", teamId: "BOS", type: "standard", years: [{ season: l.season, salary: 2_000_000, guaranteed: 2_000_000, option: null }], tradeKicker: null, noTradeClause: false, signedDate: "2025-07-01", deadMoney: true, notes: [] };
    expect(teamSalary(l, "BOS")).toBe(12_000_000);
  });
  it("reports hard-cap room", () => {
    const l = emptyLeague();
    fillTo(l, "BOS", 200_000_000);
    l.teams.BOS.hardCap = "first";
    const st = capStatus(l, "BOS");
    expect(st.hardCapRoom).toBeCloseTo(cba.firstApron.value - 200_000_000, -2);
  });
});

describe("salary limits", () => {
  it("max salary by years of service", () => {
    expect(maxSalary(cba, 3)).toBe(41_240_250);
    expect(maxSalary(cba, 8)).toBe(49_488_300);
    expect(maxSalary(cba, 12)).toBe(57_736_350);
    expect(maxSalary(cba, 8, true)).toBe(Math.round(cba.salaryCap.value * 0.35));
  });
  it("minimum salary by years of service", () => {
    expect(minSalary(cba, 0)).toBe(1_357_763);
    expect(minSalary(cba, 2)).toBe(2_449_421);
    expect(minSalary(cba, 15)).toBe(3_876_529);
  });
  it("cap holds by Bird level, capped at the max", () => {
    const l = emptyLeague();
    const p = addPlayer(l, null, 0, { experience: 6 });
    expect(capHoldFor(cba, p, 10_000_000, "bird", false)).toBe(19_000_000); // 190% below average salary
    expect(capHoldFor(cba, p, 20_000_000, "bird", false)).toBe(30_000_000); // 150% above average
    expect(capHoldFor(cba, p, 10_000_000, "early-bird", false)).toBe(13_000_000);
    expect(capHoldFor(cba, p, 10_000_000, "non-bird", false)).toBe(12_000_000);
    expect(capHoldFor(cba, p, 40_000_000, "bird", false)).toBe(maxSalary(cba, 6));
  });
  it("rookie scale: #1 pick at 120% with team options in years 3-4", () => {
    const l = emptyLeague();
    const yrs = rookieScaleContract(l, 1, "2026-27");
    expect(yrs[0].salary).toBe(14_748_000);
    expect(yrs.map((y) => y.option)).toEqual([null, null, "team", "team"]);
  });
  it("projects the CBA forward with cap growth", () => {
    const next = projectCba(cba, 0.1, "2027-28");
    expect(next.salaryCap.value).toBe(Math.round(cba.salaryCap.value * 1.1));
    expect(next.status).toBe("projected");
    expect(next.maxSalary.byService[0].value).toBe(Math.round(next.salaryCap.value * 0.25));
  });
});

describe("signing exceptions", () => {
  const method = (l: ReturnType<typeof emptyLeague>, t: string, id: string) => {
    const p = addPlayer(l, null, 0, { experience: 4 });
    return signingMethods(l, t, p).find((m) => m.id === id)!;
  };
  it("over-cap team below the 1st apron has the non-taxpayer MLE (hard-caps at 1st apron)", () => {
    const l = emptyLeague();
    fillTo(l, "BOS", 180_000_000);
    const m = method(l, "BOS", "nt-mle");
    expect(m.available).toBe(true);
    expect(m.maxFirstYear).toBe(15_044_000);
    expect(m.hardCap).toBe("first");
  });
  it("NT-MLE can't push a team over the 1st apron", () => {
    const l = emptyLeague();
    fillTo(l, "BOS", 205_000_000);
    const m = method(l, "BOS", "nt-mle");
    expect(m.maxFirstYear).toBeLessThanOrEqual(cba.firstApron.value - 205_000_000 + 10);
  });
  it("team above the 1st apron only has the taxpayer MLE", () => {
    const l = emptyLeague();
    fillTo(l, "BOS", 212_000_000);
    expect(method(l, "BOS", "nt-mle").available).toBe(false);
    const tp = method(l, "BOS", "tp-mle");
    expect(tp.available).toBe(true);
    expect(tp.maxFirstYear).toBe(6_064_000);
    expect(tp.hardCap).toBe("second");
  });
  it("team above the 2nd apron has no MLE", () => {
    const l = emptyLeague();
    fillTo(l, "BOS", 225_000_000);
    expect(method(l, "BOS", "tp-mle").available).toBe(false);
    expect(method(l, "BOS", "nt-mle").available).toBe(false);
  });
  it("under-cap team gets the room exception, not the NT-MLE or BAE", () => {
    const l = emptyLeague();
    fillTo(l, "BOS", 120_000_000);
    const p = addPlayer(l, null, 0);
    const ids = signingMethods(l, "BOS", p).map((m) => m.id);
    expect(ids).toContain("room-mle");
    expect(ids).not.toContain("nt-mle");
    expect(signingMethods(l, "BOS", p).find((m) => m.id === "bae")!.available).toBe(false);
  });
  it("bi-annual can't be used in consecutive seasons", () => {
    const l = emptyLeague();
    fillTo(l, "BOS", 180_000_000);
    l.teams.BOS.exceptions.baeLastUsedSeason = "2025-26";
    expect(method(l, "BOS", "bae").available).toBe(false);
  });
  it("validates offers against the exception limits", () => {
    const l = emptyLeague();
    fillTo(l, "BOS", 180_000_000, 12);
    const p = addPlayer(l, null, 0, { experience: 4 });
    expect(validateOffer(l, "BOS", p, { salary: 16_000_000, years: 3, raisePct: 0.05, option: null, method: "nt-mle" })).toContainEqual(expect.stringContaining("first-year salary"));
    expect(validateOffer(l, "BOS", p, { salary: 14_000_000, years: 5, raisePct: 0.05, option: null, method: "nt-mle" })).toContainEqual(expect.stringContaining("at most 4 years"));
    expect(validateOffer(l, "BOS", p, { salary: 14_000_000, years: 3, raisePct: 0.08, option: null, method: "nt-mle" })).toContainEqual(expect.stringContaining("raises"));
    expect(validateOffer(l, "BOS", p, { salary: 14_000_000, years: 3, raisePct: 0.05, option: null, method: "nt-mle" })).toEqual([]);
  });
});

describe("extensions", () => {
  it("veteran extension needs two years since signing", () => {
    const l = emptyLeague();
    const p = addPlayer(l, "BOS", 20_000_000, { years: 2 });
    l.contracts[p.contractId!].years[0].season = l.season; // signed this season
    expect(extensionEligibility(l, p).eligible).toBe(false);
    const q = addPlayer(l, "BOS", 20_000_000, { years: 1 });
    l.contracts[q.contractId!].years.unshift({ season: "2024-25", salary: 20e6, guaranteed: 20e6, option: null }, { season: "2025-26", salary: 20e6, guaranteed: 20e6, option: null });
    const info = extensionEligibility(l, q);
    expect(info.eligible).toBe(true);
    expect(info.maxFirstYear).toBe(Math.round(Math.max(20e6, cba.averageSalaryEstimate.value) * 1.4));
  });
});
