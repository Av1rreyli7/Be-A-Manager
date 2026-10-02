"use client";
import { Check, X, XCircle } from "@phosphor-icons/react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { callWorker, useGame, useLeague, useTeamId } from "@/lib/store";
import { Button, Card, Empty, Field, OvrPot, PageHeader, PlayerLink, Tabs, TeamBadge, inputCls } from "@/components/ui";
import type { FinderOffer } from "@/engine/trade/ai";
import { executeTrade } from "@/engine/trade/execute";
import { validateTrade } from "@/engine/cap/trade";
import { contractOf, salaryIn, teamPlayers } from "@/engine/league/helpers";
import { money } from "@/lib/format";
import { pickValue, playerValue } from "@/engine/trade/value";
import clsx from "clsx";
import { POSITIONS } from "@/engine/types/game";

function OfferCard({ o, rank }: { o: FinderOffer; rank?: number }) {
  const l = useLeague();
  const me = useTeamId();
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const router = useRouter();
  const [gone, setGone] = useState(false);
  if (gone) return null;
  const v = validateTrade(l, o.assets);
  return (
    <div className="panel anim-rise p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">{rank != null && <span className="font-display text-xl font-black text-mute">#{rank}</span>}<TeamBadge league={l} teamId={o.teamId} withName /></span>
        <span className="text-xs text-dim">value to you <b className="text-ink">{o.valueToMe.toFixed(1)}</b> · their meter {Math.min(100, o.meter)}%</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {(["give", "get"] as const).map((dir) => {
          const side = o.assets.sides.find((x) => (dir === "give" ? x.teamId === me : x.teamId !== me));
          return (
            <div key={dir} className={dir === "give" ? "rounded-[4px] border border-bad/30 bg-bad/5 p-2" : "rounded-[4px] border border-good/30 bg-good/5 p-2"}>
              <div className={dir === "give" ? "mb-1 label !text-[10px] text-bad" : "mb-1 label !text-[10px] text-good"}>{dir === "give" ? "You give" : "You get"}</div>
              {side?.players.map((id) => <div key={id} className="truncate">{l.players[id]?.name} <span className="text-xs text-dim">{l.players[id]?.pos} · {l.players[id]?.ovr}</span></div>)}
              {side?.picks.map((id) => { const k = l.picks[id]; return <div key={id}>{k ? `${k.year} ${k.originalTeam} ${k.round === 1 ? "1st" : "2nd"}` : id}{k && k.protection.kind !== "none" ? <span className="text-xs text-dim"> ({k.protection.kind === "top" ? `top-${k.protection.keepTop}` : "prot."})</span> : null}</div>; })}
              {side?.cash ? <div>{money(side.cash)} cash</div> : null}
              {!side?.players.length && !side?.picks.length && !side?.cash && <div className="text-xs text-dim">Nothing</div>}
            </div>
          );
        })}
      </div>
      <ul className="mt-2 flex flex-wrap gap-1">{o.reasoning.map((r) => <li key={r} className="chip">{r}</li>)}</ul>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="success" disabled={!v.valid} onClick={() => { mutate((lg) => void executeTrade(lg, o.assets)); toast("Trade completed", "success"); setGone(true); }}>Accept</Button>
        <Button size="sm" onClick={() => { sessionStorage.setItem("fo:loadTrade", JSON.stringify(o.assets)); router.push("/game/trade?load=1"); }}>Open in Trade Machine</Button>
      </div>
    </div>
  );
}

function Finder() {
  const l = useLeague();
  const me = useTeamId();
  const params = useSearchParams();
  const [tab, setTab] = useState<"shop" | "acquire" | "need">(params.get("target") ? "acquire" : "shop");
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<string[]>(params.get("player") ? [params.get("player")!] : []);
  const [offers, setOffers] = useState<FinderOffer[] | null>(null);
  const [myPicks, setMyPicks] = useState<string[]>([]);
  const [target, setTarget] = useState(params.get("target") ?? "");
  const [q, setQ] = useState("");
  const [take, setTake] = useState<FinderOffer | null | undefined>(undefined);
  const [takeReason, setTakeReason] = useState<string | null>(null);
  const [need, setNeed] = useState({ pos: "", maxSalary: 20, minOvr: 70 });
  const [needRes, setNeedRes] = useState<{ playerId: string; offer: FinderOffer | null }[] | null>(null);
  // results land below long lists: bring them into view when a search finishes
  const results = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (offers || take !== undefined || needRes) results.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [offers, take, needRes]);

  const shop = async () => {
    if (!mine.length && !myPicks.length) return;
    setBusy(true);
    setOffers(null);
    const r = await callWorker({ cmd: "findOffers", league: l, playerIds: mine, pickIds: myPicks, team: me });
    setOffers(r.result as FinderOffer[]);
    setBusy(false);
  };
  const acquire = async (id = target) => {
    if (!id) return;
    setBusy(true);
    const r = await callWorker({ cmd: "whatWouldItTake", league: l, target: id, team: me });
    const res = r.result as { offer: FinderOffer | null; reason: string | null };
    setTake(res.offer ?? null);
    setTakeReason(res.reason);
    setBusy(false);
  };
  const search = async () => {
    setBusy(true);
    const r = await callWorker({ cmd: "findPlayers", league: l, team: me, filter: { pos: need.pos || undefined, maxSalary: need.maxSalary * 1e6, minOvr: need.minOvr } });
    setNeedRes(r.result as { playerId: string; offer: FinderOffer | null }[]);
    setBusy(false);
  };
  useEffect(() => {
    const t = setTimeout(() => {
      if (params.get("player")) void shop();
      if (params.get("target")) void acquire(params.get("target")!);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roster = teamPlayers(l, me).sort((a, b) => b.ovr - a.ovr);
  const picks = Object.values(l.picks).filter((k) => k.owner === me && !k.forfeited).sort((a, b) => a.year - b.year || a.round - b.round);
  // rules your package breaks on its own, whoever the partner is (Stepien, newly signed, frozen picks…)
  const PACKAGE_RULES = ["stepien", "newly-signed", "frozen-pick", "pick-window", "aggregation-60", "ownership", "window"];
  const packageIssues =
    mine.length || myPicks.length
      ? validateTrade(l, { sides: [{ teamId: me, players: mine, picks: myPicks, cash: 0 }, { teamId: Object.keys(l.teams).find((x) => x !== me)!, players: [], picks: [], cash: 0 }], destinations: {} }).issues.filter((i) => i.severity === "error" && (i.teamId === me || i.teamId === null) && PACKAGE_RULES.includes(i.rule))
      : [];
  const candidates = q.length >= 2 ? Object.values(l.players).filter((p) => p.status === "active" && p.teamId && p.teamId !== me && p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];

  return (
    <div className="space-y-4">
      <PageHeader title="Trade Finder" sub="The AI scans all 29 teams and returns CBA-legal deals it would actually accept." />
      <Tabs tabs={[{ id: "shop", label: "Shop my player" }, { id: "acquire", label: "What would it take?" }, { id: "need", label: "Find a player by need" }]} value={tab} onChange={setTab} />
      {busy && <div className="panel shimmer px-4 py-3 text-sm">Scanning the league…</div>}

      {tab === "shop" && (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card title="Build your package" right={<span>{mine.length} player{mine.length === 1 ? "" : "s"} · {myPicks.length} pick{myPicks.length === 1 ? "" : "s"} selected</span>} pad={false}>
              <div className="border-b border-line px-3 pt-3 label">Players</div>
              <div className="max-h-80 overflow-y-auto scroll-thin">
                {roster.map((p) => {
                  const on = mine.includes(p.id);
                  return (
                    <button key={p.id} onClick={() => setMine((m) => (on ? m.filter((x) => x !== p.id) : [...m, p.id]))} className={clsx("grid w-full grid-cols-[22px_1fr_auto_auto] items-center gap-3 border-b border-line/40 px-3 py-2 text-left text-sm transition", on ? "bg-accent/20 shadow-[inset_3px_0_0_var(--color-accent)]" : "hover:bg-ink/5")}>
                      <span className={clsx("grid h-5 w-5 place-items-center rounded-[3px] border text-xs font-bold", on ? "border-accent bg-accent text-accent-ink" : "border-line-2")}>{on ? <Check size={12} weight="bold" /> : null}</span>
                      <span className={clsx("truncate", on && "font-semibold text-ink")}>{p.name} <span className="text-xs text-dim">{p.pos} · {p.ovr} OVR</span></span>
                      <span className="text-xs text-dim num">{money(salaryIn(contractOf(l, p), l.season))}</span>
                      <span className="w-14 text-right text-xs text-mute num">val {playerValue(l, p, me).toFixed(0)}</span>
                    </button>
                  );
                })}
              </div>
              <div className="border-b border-line px-3 pt-3 label">Draft picks</div>
              <div className="max-h-60 overflow-y-auto scroll-thin">
                {picks.map((k) => {
                  const on = myPicks.includes(k.id);
                  return (
                    <button key={k.id} disabled={k.frozen} onClick={() => setMyPicks((m) => (on ? m.filter((x) => x !== k.id) : [...m, k.id]))} className={clsx("grid w-full grid-cols-[22px_1fr_auto] items-center gap-3 border-b border-line/40 px-3 py-2 text-left text-sm transition disabled:opacity-40", on ? "bg-accent/20 shadow-[inset_3px_0_0_var(--color-accent)]" : "hover:bg-ink/5")}>
                      <span className={clsx("grid h-5 w-5 place-items-center rounded-[3px] border text-xs font-bold", on ? "border-accent bg-accent text-accent-ink" : "border-line-2")}>{on ? <Check size={12} weight="bold" /> : null}</span>
                      <span className={clsx(on && "font-semibold text-ink")}>{k.year} {k.round === 1 ? "1st" : "2nd"} <span className="text-xs text-dim">({k.originalTeam}){k.protection.kind !== "none" ? ` · ${k.protection.kind === "top" ? `top-${k.protection.keepTop}` : "protected"}` : ""}{k.frozen ? " · frozen" : ""}</span></span>
                      <span className="text-xs text-mute num">val {pickValue(l, k, me).toFixed(1)}</span>
                    </button>
                  );
                })}
              </div>
            </Card>
            <div className="space-y-3 lg:sticky lg:top-[calc(var(--hdr,92px)+16px)] lg:self-start">
              <Card title="Your package">
                {!mine.length && !myPicks.length ? (
                  <p className="text-sm text-dim">Tick players and/or picks on the left. You can combine as many as you like.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {mine.map((id) => (
                      <li key={id} className="flex items-center justify-between gap-2 rounded-[4px] bg-accent/10 px-2 py-1">
                        <span className="truncate font-semibold">{l.players[id]?.name}</span>
                        <span className="flex items-center gap-2 text-xs text-dim">{money(salaryIn(contractOf(l, l.players[id]), l.season))}<button className="text-bad hover:text-bad" onClick={() => setMine((m) => m.filter((x) => x !== id))} aria-label="Remove"><X size={13} weight="bold" /></button></span>
                      </li>
                    ))}
                    {myPicks.map((id) => {
                      const k = l.picks[id];
                      return (
                        <li key={id} className="flex items-center justify-between gap-2 rounded-[4px] bg-accent/10 px-2 py-1">
                          <span className="font-semibold">{k ? `${k.year} ${k.originalTeam} ${k.round === 1 ? "1st" : "2nd"}` : id}</span>
                          <button className="text-xs text-bad hover:text-bad" onClick={() => setMyPicks((m) => m.filter((x) => x !== id))} aria-label="Remove"><X size={13} weight="bold" /></button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="mt-3 flex justify-between text-xs text-dim">
                  <span>Outgoing salary <b className="text-ink">{money(mine.reduce((s2, id) => s2 + salaryIn(contractOf(l, l.players[id]), l.season), 0))}</b></span>
                  <span>Package value <b className="text-ink">{(mine.reduce((s2, id) => s2 + playerValue(l, l.players[id], me), 0) + myPicks.reduce((s2, id) => s2 + (l.picks[id] ? pickValue(l, l.picks[id], me) : 0), 0)).toFixed(0)}</b></span>
                </div>
                {packageIssues.length > 0 && (
                  <ul className="mt-3 space-y-1 rounded-[4px] border border-bad/40 bg-bad/10 p-2 text-xs text-bad">
                    {packageIssues.map((i) => <li key={i.message} className="flex gap-1.5"><XCircle size={14} weight="fill" className="mt-px shrink-0" /> {i.message}</li>)}
                  </ul>
                )}
                <div className="mt-3 flex gap-2">
                  <Button variant="primary" className="flex-1" disabled={(!mine.length && !myPicks.length) || busy || packageIssues.length > 0} onClick={shop}>Find offers</Button>
                  {(mine.length > 0 || myPicks.length > 0) && <Button variant="ghost" onClick={() => (setMine([]), setMyPicks([]), setOffers(null))}>Clear</Button>}
                </div>
              </Card>
            </div>
          </div>
          <div ref={tab === "shop" ? results : undefined} className="scroll-mt-[calc(var(--hdr,92px)+12px)]" />
          {offers && (offers.length ? <div className="grid gap-3 lg:grid-cols-2">{offers.map((o, i) => <OfferCard key={o.teamId} o={o} rank={i + 1} />)}</div> : <Empty>No team would make a CBA-legal offer right now.</Empty>)}
        </>
      )}

      {tab === "acquire" && (
        <>
          <Card title="Target">
            <input className={inputCls} placeholder="Search any player on another team…" value={q} onChange={(e) => setQ(e.target.value)} />
            {candidates.length > 0 && (
              <ul className="mt-2 divide-y divide-line rounded-[4px] border border-line">
                {candidates.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="flex items-center gap-2"><TeamBadge league={l} teamId={p.teamId} size="sm" /> {p.name} <OvrPot p={p} /></span>
                    <Button size="sm" onClick={() => (setTarget(p.id), setQ(""), void acquire(p.id))}>What would it take?</Button>
                  </li>
                ))}
              </ul>
            )}
            {target && <p className="mt-3 text-sm">Target: <PlayerLink player={l.players[target]} /> ({l.players[target]?.teamId})</p>}
          </Card>
          <div ref={tab === "acquire" ? results : undefined} className="scroll-mt-[calc(var(--hdr,92px)+12px)]" />
          {take === null && <div className="panel border-bad/40 px-4 py-4 text-sm text-bad">{takeReason ?? "Not possible."}</div>}
          {take && <OfferCard o={take} />}
        </>
      )}

      {tab === "need" && (
        <>
          <Card title="Criteria">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Position">
                <select className={inputCls} value={need.pos} onChange={(e) => setNeed({ ...need, pos: e.target.value })}>
                  <option value="">Any</option>
                  {POSITIONS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
              <Field label={`Max salary ($${need.maxSalary}M)`}>
                <input type="range" min={2} max={60} value={need.maxSalary} onChange={(e) => setNeed({ ...need, maxSalary: Number(e.target.value) })} className="w-full" />
              </Field>
              <Field label={`Min OVR (${need.minOvr})`}>
                <input type="range" min={55} max={90} value={need.minOvr} onChange={(e) => setNeed({ ...need, minOvr: Number(e.target.value) })} className="w-full" />
              </Field>
              <div className="flex items-end"><Button variant="primary" onClick={search} disabled={busy}>Search</Button></div>
            </div>
          </Card>
          <div ref={tab === "need" ? results : undefined} className="scroll-mt-[calc(var(--hdr,92px)+12px)]" />
          {needRes && (needRes.length ? (
            <div className="space-y-3">
              {needRes.map((r) => (
                <div key={r.playerId}>
                  <div className="mb-1 flex items-center gap-2 text-sm"><PlayerLink player={l.players[r.playerId]} /> <OvrPot p={l.players[r.playerId]} /> <span className="text-dim">{money(salaryIn(contractOf(l, l.players[r.playerId]), l.season))}</span></div>
                  {r.offer ? <OfferCard o={r.offer} /> : <p className="text-xs text-dim">Not available for anything you can offer.</p>}
                </div>
              ))}
            </div>
          ) : <Empty>No matches.</Empty>)}
        </>
      )}
    </div>
  );
}

export default function FinderPage() {
  return (
    <Suspense>
      <Finder />
    </Suspense>
  );
}

