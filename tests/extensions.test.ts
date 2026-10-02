import { describe, expect, it } from "vitest";
import { emptyLeague, addPlayer } from "./fixtures";
import { contractOf } from "../src/engine/league/helpers";
import { extensionAsk, extensionInfoFor, offerExtension, requiredSalary } from "../src/engine/offseason/extensions";

describe("user extensions", () => {
  it("any user player can be extended, even one just signed or already extended", () => {
    const l = emptyLeague();
    const p = addPlayer(l, "LAL", 10_000_000, { years: 3, contract: { isExtension: true } });
    expect(extensionInfoFor(l, p.id).eligible).toBe(true);
  });
  it("accepts the right offer and rejects a lowball", () => {
    const l = emptyLeague();
    const p = addPlayer(l, "LAL", 10_000_000, { years: 1 });
    const ask = extensionAsk(l, p.id);
    expect(offerExtension(l, p.id, Math.round(ask.salary * 0.6), ask.years).accepted).toBe(false);
    const before = contractOf(l, p)!.years.length;
    const r = offerExtension(l, p.id, requiredSalary(l, p.id, ask.years), ask.years);
    expect(r.accepted).toBe(true);
    expect(contractOf(l, p)!.years.length).toBe(before + ask.years);
  });
  it("AI teams still follow the CBA extension rules", () => {
    const l = emptyLeague();
    const p = addPlayer(l, "BOS", 10_000_000, { years: 3, contract: { isExtension: true } });
    expect(extensionInfoFor(l, p.id).eligible).toBe(false);
  });
});
