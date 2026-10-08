"use client";
import { CheckCircle, Handshake, XCircle } from "@phosphor-icons/react";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { useGame, useLeague, useTeamId } from "@/lib/store";
import { Appear, Bar, Button, Card, Empty, Modal, OvrPot, PageHeader, PlayerLink, Tabs, TeamBadge, inputCls } from "@/components/ui";
import type { League, TeamId, TradeAssets } from "@/engine/types/game";
import { contractOf, newId, salaryIn, seasonAge, teamPlayers } from "@/engine/league/helpers";
import { addDays } from "@/engine/util/dates";
import { validateTrade, tradeWindowOpen, nextDraftYear, destinationOf } from "@/engine/cap/trade";
import { aiDecision, counterOffer } from "@/engine/trade/ai";
import { executeTrade, describeTrade } from "@/engine/trade/execute";
import { money, STATUS_COLOR, STATUS_LABEL } from "@/lib/format";
import { pickValue, playerValue } from "@/engine/trade/value";

const empty = (teams: TeamId[]): TradeAssets => ({ sides: teams.map((t) => ({ teamId: t, players: [], picks: [], cash: 0 })), destinations: {} });

function TradeMachine() {
  const l = useLeague();
  const me = useTeamId();
  const params = useSearchParams();
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [tab, setTab] = useState<"machine" | "offers" | "block">(params.get("tab") === "offers" ? "offers" : "machine");
  const initial = useMemo(() => {
    if (params.get("load")) {
      const saved = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("fo:loadTrade") : null;
      if (saved) return JSON.parse(saved) as TradeAssets;
    }
    const theirs = params.get("theirs");
    const mine = params.get("mine");
    const other = theirs ? l.players[theirs]?.teamId : null;
    const a = empty([me, other && other !== me ? other : Object.keys(l.teams).find((t) => t !== me)!]);
    if (theirs && other) a.sides[1].players.push(theirs);
    if (mine) a.sides[0].players.push(mine);
    return a;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [a, setA] = useState<TradeAssets>(initial);
  const [done, setDone] = useState<string | null>(null);
  const router = useRouter();
  const tw = tradeWindowOpen(l);

  const v = useMemo(() => validateTrade(l, a), [l, a]);
  const ai = useMemo(() => aiDecision(l, a), [l, a]);
  const aiTeams = a.sides.filter((s) => !l.userTeams.includes(s.teamId));
  const anyAssets = a.sides.some((s) => s.players.length || s.picks.length || s.cash) || (a.swaps?.length ?? 0) > 0;

  const update = (fn: (x: TradeAssets) => void) =>
    setA((prev) => {
      const n: TradeAssets = JSON.parse(JSON.stringify(prev));
      fn(n);
      return n;
    });
  const togglePlayer = (t: TeamId, pid: string) => update((x) => { const s = x.sides.find((y) => y.teamId === t)!; s.players = s.players.includes(pid) ? s.players.filter((p) => p !== pid) : [...s.players, pid]; });
  const togglePick = (t: TeamId, kid: string) => update((x) => { const s = x.sides.find((y) => y.teamId === t)!; s.picks = s.picks.includes(kid) ? s.picks.filter((p) => p !== kid) : [...s.picks, kid]; if (!s.picks.includes(kid) && x.protections) delete x.protections[kid]; });

  const propose = (force = false) => {
    if (!v.valid && !force) return toast("Fix the cap problems first", "error");
    if (!force && aiTeams.length && !ai.accept) return toast("They said no. See their counter offer", "error");
    // online: a trade with a friend's team is sent to them to accept
    const friends = l.online ? a.sides.map((s) => s.teamId).filter((t) => t !== me && l.userTeams.includes(t)) : [];
    if (friends.length > 1) return toast("Trades can include only one friend at a time", "error");
    if (friends.length === 1 && !force) {
      const to = friends[0];
      const who = l.online?.members[to] ?? l.teams[to].name;
      mutate((lg) => void lg.tradeOffers.push({ id: newId(lg, "to"), from: me, to, assets: JSON.parse(JSON.stringify(a)), created: lg.date, expires: addDays(lg.date, 14), reasoning: [`Offer from ${lg.online?.members[me] ?? lg.teams[me].name} (${lg.teams[me].fullName})`] }));
      toast(`Offer sent to ${who}. It waits in their “Offers received”`, "success");
      setA(empty(a.sides.map((s) => s.teamId)));
      return;
    }
    const text = describeTrade(l, a);
    mutate((lg) => void executeTrade(lg, a, { force }));
    setDone(text);
    setA(empty(a.sides.map((s) => s.teamId)));
  };

  const counter = () => {
    const ai1 = aiTeams[0]?.teamId;
    if (!ai1) return;
    const c = counterOffer(l, a, ai1, me);
    if (c) {
      setA(c);
      toast("Counter offer loaded. Check it and send", "success");
    } else toast("They don't see a deal here", "error");
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Trade Machine" sub={tw.open ? "Up to 4 teams · live cap check · see how close the AI is to yes" : tw.reason} />
      <Tabs tabs={[{ id: "machine", label: "Build a trade" }, { id: "offers", label: `Offers received (${l.tradeOffers.filter((o) => (l.online ? o.to === me : l.userTeams.includes(o.to))).length})` }, { id: "block", label: `Trade block (${l.tradeBlock.length})` }]} value={tab} onChange={setTab} />

      {tab === "machine" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {a.sides.map((s, i) => (
              <select key={i} className={inputCls} style={{ width: "auto" }} value={s.teamId} onChange={(e) => update((x) => { x.sides[i] = { teamId: e.target.value, players: [], picks: [], cash: 0 }; x.destinations = {}; })}>
                {Object.values(l.teams).sort((p, q) => p.fullName.localeCompare(q.fullName)).filter((t) => t.id === s.teamId || !a.sides.some((y) => y.teamId === t.id)).map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
              </select>
            ))}
            {a.sides.length < 4 && <Button size="sm" onClick={() => update((x) => void x.sides.push({ teamId: Object.keys(l.teams).find((t) => !x.sides.some((y) => y.teamId === t))!, players: [], picks: [], cash: 0 }))}>+ Add team</Button>}
            {a.sides.length > 2 && <Button size="sm" variant="ghost" onClick={() => update((x) => { x.sides.pop(); x.destinations = {}; })}>Remove team</Button>}
            <Button size="sm" variant="ghost" onClick={() => setA(empty(a.sides.map((s) => s.teamId)))}>Clear</Button>
          </div>

          <div className={clsx("grid gap-4", a.sides.length === 2 ? "lg:grid-cols-2" : a.sides.length === 3 ? "xl:grid-cols-3" : "lg:grid-cols-2 2xl:grid-cols-4")}>
            {a.sides.map((s) => <TeamColumn key={s.teamId} l={l} a={a} teamId={s.teamId} togglePlayer={togglePlayer} togglePick={togglePick} update={update} />)}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <Card title="CBA check" right={anyAssets ? (v.valid ? <span className="inline-flex items-center gap-1 font-bold text-good"><CheckCircle size={15} weight="fill" /> Legal</span> : <span className="inline-flex items-center gap-1 font-bold text-bad"><XCircle size={15} weight="fill" /> Illegal</span>) : null}>
              {!anyAssets ? (
                <Empty>Pick players, picks or cash to build a trade.</Empty>
              ) : (
                <>
                  <div className="overflow-x-auto scroll-thin">
                    <table className="k-table min-w-[520px]">
                      <thead><tr><th>Team</th><th className="k-num">Out</th><th className="k-num">In</th><th className="k-num">Max in</th><th className="k-num">Post-trade</th><th className="k-num">Roster</th></tr></thead>
                      <tbody>
                        {v.teams.map((t) => (
                          <tr key={t.teamId}>
                            <td><TeamBadge league={l} teamId={t.teamId} size="sm" /></td>
                            <td className="k-num">{money(t.outgoingSalary, 2)}</td>
                            <td className="k-num">{money(t.incomingSalary, 2)}</td>
                            <td className="k-num text-dim">{t.maxIncoming >= Number.MAX_SAFE_INTEGER ? "room" : money(t.maxIncoming, 2)}</td>
                            <td className={clsx("k-num", STATUS_COLOR[t.postApron])}>{money(t.postSalary)} · {STATUS_LABEL[t.postApron]}</td>
                            <td className="k-num">{t.rosterAfter}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {v.issues.map((i, k) => (
                      <li key={k} className={clsx("rounded-[4px] border px-3 py-2", i.severity === "error" ? "border-bad/40 bg-bad/5 text-bad" : "border-warn/30 bg-warn/5 text-warn")}>
                        <b className="mr-2 text-xs uppercase">{i.teamId ?? "Trade"} · {i.rule}</b>
                        {i.message}
                      </li>
                    ))}
                    {v.teams.filter((t) => t.triggersHardCap).map((t) => <li key={t.teamId + "hc"} className="rounded-[4px] border border-info/30 px-3 py-2 text-info"><b className="mr-2 text-xs uppercase">{t.teamId} · hard cap</b>This trade hard-caps {t.teamId} at the {t.triggersHardCap} apron for the rest of the season.</li>)}
                    {v.valid && !v.issues.length && <li className="text-good">Passes every CBA check.</li>}
                  </ul>
                </>
              )}
            </Card>
            <Card title="Their decision">
              {!aiTeams.length ? (
                <p className="text-sm text-dim">All teams are user-controlled.</p>
              ) : (
                ai.evaluations.map((e) => (
                  <div key={e.teamId} className="mb-4">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <TeamBadge league={l} teamId={e.teamId} size="sm" withName />
                      <span className={clsx("font-num text-[17px] font-bold", e.accept ? "text-good" : e.meter > 75 ? "text-warn" : "text-bad")}>{Math.min(100, e.meter)}%</span>
                    </div>
                    <Bar value={Math.min(100, e.meter)} color={e.accept ? "bg-good" : e.meter > 75 ? "bg-warn" : "bg-bad"} />
                    <div className="mt-1 text-xs text-dim">Value in {e.valueIn} · out {e.valueOut} · needs +{e.required}</div>
                    <ul className="mt-1 list-disc pl-5 text-xs text-dim">{e.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                  </div>
                ))
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="primary" disabled={!anyAssets || !tw.open} onClick={() => propose()}>Propose trade</Button>
                {aiTeams.length > 0 && !ai.accept && anyAssets && <Button onClick={counter}>Ask for counter-offer</Button>}
                {l.settings.commissioner && <Button variant="danger" disabled={!anyAssets} onClick={() => propose(true)}>Force (commissioner)</Button>}
              </div>
            </Card>
          </div>
        </>
      )}

      {tab === "offers" && <OffersTab onLoad={(x) => (setA(x), setTab("machine"))} />}
      {tab === "block" && (
        <Card title="Your trade block">
          {l.tradeBlock.length === 0 ? <Empty>Add players from the roster page. AI teams call about anyone on your block.</Empty> : (
            <ul className="space-y-2">
              {l.tradeBlock.map((id) => <li key={id} className="flex items-center justify-between"><PlayerLink player={l.players[id]} /><Button size="sm" onClick={() => router.push(`/game/finder?player=${id}`)}>Find offers</Button></li>)}
            </ul>
          )}
        </Card>
      )}

      <Modal open={!!done} onClose={() => setDone(null)} kicker="Trade machine" title="Trade accepted">
        <Appear kind="celebrate" sparks className="text-center">
          <Handshake size={56} weight="duotone" className="mx-auto mb-3 text-accent drop-shadow-[0_0_18px_var(--accent)]" />
          <p className="text-sm">{done}</p>
        </Appear>
      </Modal>
    </div>
  );
}

function TeamColumn({ l, a, teamId, togglePlayer, togglePick, update }: { l: League; a: TradeAssets; teamId: TeamId; togglePlayer: (t: TeamId, p: string) => void; togglePick: (t: TeamId, k: string) => void; update: (fn: (x: TradeAssets) => void) => void }) {
  const me = useTeamId();
  const side = a.sides.find((s) => s.teamId === teamId)!;
  const others = a.sides.map((s) => s.teamId).filter((t) => t !== teamId);
  const [show, setShow] = useState<"players" | "picks">("players");
  const players = teamPlayers(l, teamId).sort((x, y) => salaryIn(contractOf(l, y), l.season) - salaryIn(contractOf(l, x), l.season));
  const ndy = nextDraftYear(l);
  const picks = Object.values(l.picks).filter((k) => k.owner === teamId && !k.forfeited && k.year <= ndy + 6).sort((x, y) => x.year - y.year || x.round - y.round);
  const t = l.teams[teamId];
  const destSelect = (key: string) =>
    others.length > 1 ? (
      <select className="k-input ml-1" style={{ width: "auto" }} value={destinationOf(a, key, teamId)} onClick={(e) => e.stopPropagation()} onChange={(e) => update((x) => void (x.destinations[key] = e.target.value))}>
        {others.map((o) => <option key={o} value={o}>→ {o}</option>)}
      </select>
    ) : null;
  return (
    <Card className="overflow-hidden" title={<span className="flex items-center gap-2"><TeamBadge league={l} teamId={teamId} size="sm" />{t.name}</span>} right={<span className="k-tag">{t.strategy.mode}</span>} pad={false}>
      <div aria-hidden className="h-1" style={{ background: `linear-gradient(90deg, ${t.colors.primary} 70%, ${t.colors.secondary} 70%)` }} />
      {(side.players.length > 0 || side.picks.length > 0) && (
        <div className="border-b border-line bg-accent/5 px-3 py-2 text-sm">
          <div className="k-label mb-1">Sending</div>
          {side.players.map((pid) => <div key={pid} className="flex items-center justify-between"><span>{l.players[pid].name} <span className="text-xs text-dim">{money(salaryIn(contractOf(l, l.players[pid]), l.season))}</span></span>{destSelect(`p:${pid}`)}</div>)}
          {side.picks.map((kid) => {
            const k = l.picks[kid];
            return (
              <div key={kid} className="flex flex-wrap items-center justify-between gap-1">
                <span>{k.year} {k.originalTeam} {k.round === 1 ? "1st" : "2nd"}</span>
                <span className="flex items-center gap-1">
                  {k.protection.kind === "none" && (
                    <select className="k-input" style={{ width: "auto" }} value={a.protections?.[kid] ?? 0} onChange={(e) => update((x) => { x.protections = { ...(x.protections ?? {}) }; const v = Number(e.target.value); if (v) x.protections[kid] = v; else delete x.protections[kid]; })}>
                      <option value={0}>Unprotected</option>
                      {[1, 3, 4, 5, 8, 10, 14, 20].map((n) => <option key={n} value={n}>Top-{n} protected</option>)}
                    </select>
                  )}
                  {destSelect(`k:${kid}`)}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div className="k-tabs">
        {(["players", "picks"] as const).map((x) => <button key={x} onClick={() => setShow(x)} className={clsx(show === x && "on")}>{x}</button>)}
      </div>
      <div className="max-h-80 overflow-y-auto scroll-thin">
        {show === "players" ? (
          players.map((p) => {
            const c = contractOf(l, p);
            const sel = side.players.includes(p.id);
            return (
              <button key={p.id} onClick={() => togglePlayer(teamId, p.id)} className={clsx("grid w-full grid-cols-[18px_1fr_auto_auto] items-center gap-2 border-b border-line/40 px-3 py-1.5 text-left text-sm hover:bg-ink/5", sel && "bg-accent/10")}>
                <input type="checkbox" className="k-check" readOnly checked={sel} />
                <span className="min-w-0 truncate">{p.name} <span className="text-xs text-dim">{p.pos} · {seasonAge(p, l.season)}{c?.type === "two-way" ? " · 2W" : ""}{c?.noTradeClause ? " · NTC" : ""}</span></span>
                <OvrPot p={p} />
                <span className="w-24 text-right text-xs num">{money(salaryIn(c, l.season))} <span className="text-mute">{c ? `×${c.years.filter((y) => y.season >= l.season).length}` : ""}</span><br /><span className="text-mute">val {playerValue(l, p, me).toFixed(0)}</span></span>
              </button>
            );
          })
        ) : (
          <>
            {picks.map((k) => {
              const sel = side.picks.includes(k.id);
              return (
                <button key={k.id} disabled={k.frozen} onClick={() => togglePick(teamId, k.id)} className={clsx("grid w-full grid-cols-[18px_1fr_auto] items-center gap-2 border-b border-line/40 px-3 py-1.5 text-left text-sm hover:bg-ink/5 disabled:opacity-40", sel && "bg-accent/10")}>
                  <input type="checkbox" className="k-check" readOnly checked={sel} />
                  <span>{k.year} {k.round === 1 ? "1st" : "2nd"} <span className="text-xs text-dim">({k.originalTeam}){k.protection.kind !== "none" ? ` · ${k.protection.kind === "top" ? `top-${k.protection.keepTop}` : "complex"}` : ""}{k.swap ? " · swap" : ""}{k.frozen ? " · frozen" : ""}</span></span>
                  <span className="text-xs text-mute num">val {pickValue(l, k, me).toFixed(1)}</span>
                </button>
              );
            })}
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
              <span className="text-dim">Grant swap right:</span>
              <select id={`sw-${teamId}`} className="k-input" style={{ width: "auto" }}>
                {Array.from({ length: 7 }, (_, i) => ndy + i).map((y) => <option key={y} value={y}>{y} 1st</option>)}
              </select>
              <Button size="sm" onClick={() => { const y = Number((document.getElementById(`sw-${teamId}`) as HTMLSelectElement).value); update((x) => void (x.swaps = [...(x.swaps ?? []), { year: y, round: 1, from: teamId, to: others[0] }])); }}>Add swap → {others[0]}</Button>
            </div>
            {(a.swaps ?? []).filter((s) => s.from === teamId).map((s, i) => <div key={i} className="flex justify-between px-3 py-1 text-xs"><span>Swap {s.year} 1sts with {s.to}</span><button className="k-btn k-btn-danger k-btn-sm" onClick={() => update((x) => void (x.swaps = (x.swaps ?? []).filter((z) => z !== (x.swaps ?? []).find((q) => q.year === s.year && q.from === s.from && q.to === s.to))))}>remove</button></div>)}
          </>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-line px-3 py-2 text-xs">
        <span className="text-dim">Cash</span>
        <input type="number" step={500000} min={0} className="k-input" style={{ width: 128 }} value={side.cash} onChange={(e) => update((x) => void (x.sides.find((y) => y.teamId === teamId)!.cash = Math.max(0, Number(e.target.value))))} />
        {t.exceptions.tpes.length > 0 && (
          <select className="k-input" style={{ width: "auto" }} value={side.tpe ?? ""} onChange={(e) => update((x) => void (x.sides.find((y) => y.teamId === teamId)!.tpe = e.target.value || undefined))}>
            <option value="">No TPE</option>
            {t.exceptions.tpes.map((x) => <option key={x.id} value={x.id}>TPE {money(x.amount)}</option>)}
          </select>
        )}
      </div>
    </Card>
  );
}

function OffersTab({ onLoad }: { onLoad: (a: TradeAssets) => void }) {
  const l = useLeague();
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const me = useTeamId();
  const offers = l.tradeOffers.filter((o) => (l.online ? o.to === me : l.userTeams.includes(o.to)));
  const sent = l.online ? l.tradeOffers.filter((o) => o.from === me) : [];
  if (!offers.length && !sent.length) return <Empty>No offers right now. Put players on the trade block to draw calls.</Empty>;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {sent.map((o) => (
        <Card key={o.id} title={<span className="flex items-center gap-2">Your offer to <TeamBadge league={l} teamId={o.to} size="sm" /> {l.online?.members[o.to]} · waiting</span>}>
          <p className="text-sm">{describeTrade(l, o.assets)}</p>
          <div className="mt-3"><Button variant="ghost" onClick={() => mutate((lg) => void (lg.tradeOffers = lg.tradeOffers.filter((x) => x.id !== o.id)))}>Withdraw</Button></div>
        </Card>
      ))}
      {offers.map((o) => {
        const v = validateTrade(l, o.assets);
        return (
          <Card key={o.id} title={<span className="flex items-center gap-2"><TeamBadge league={l} teamId={o.from} size="sm" /> offer · expires {o.expires}</span>}>
            <p className="text-sm">{describeTrade(l, o.assets)}</p>
            <ul className="mt-2 list-disc pl-5 text-xs text-dim">{o.reasoning.map((r) => <li key={r}>{r}</li>)}</ul>
            {!v.valid && <p className="mt-2 text-xs text-bad">No longer CBA-legal: {v.issues.find((i) => i.severity === "error")?.message}</p>}
            <div className="mt-3 flex gap-2">
              <Button disabled={!v.valid} onClick={() => { mutate((lg) => { executeTrade(lg, o.assets); lg.tradeOffers = lg.tradeOffers.filter((x) => x.id !== o.id); }); toast("Trade completed", "success"); }}>Accept</Button>
              <Button onClick={() => onLoad(o.assets)}>Negotiate</Button>
              <Button variant="ghost" onClick={() => mutate((lg) => void (lg.tradeOffers = lg.tradeOffers.filter((x) => x.id !== o.id)))}>Decline</Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense>
      <TradeMachine />
    </Suspense>
  );
}
