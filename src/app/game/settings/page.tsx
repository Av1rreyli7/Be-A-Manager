"use client";
import { useState } from "react";
import Link from "next/link";
import { useGame, useIsOnlineGuest, useLeague } from "@/lib/store";
import { Button, Card, Field, PageHeader, inputCls } from "@/components/ui";
import type { Settings } from "@/engine/types/game";
import { fmtDate } from "@/engine/util/dates";

export default function SettingsPage() {
  const l = useLeague();
  const mutate = useGame((s) => s.mutate);
  const saveNow = useGame((s) => s.saveNow);
  const toast = useGame((s) => s.toast);
  const [refresh, setRefresh] = useState<string | null>(null);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => (guest ? toast("Only the host can change league settings", "error") : mutate((lg) => void (lg.settings[k] = v)));
  const s = l.settings;
  const guest = useIsOnlineGuest();

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(l)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${l.name.replace(/\W+/g, "-")}-${l.season}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const runRefresh = async () => {
    setRefresh("Re-pulling rosters, contracts, picks and cap data (takes a few minutes)…");
    try {
      const res = await fetch("/api/refresh-data", { method: "POST" });
      const j = (await res.json()) as { ok: boolean; output?: string; error?: string };
      setRefresh(j.ok ? `Done. New leagues will use the refreshed data.\n${j.output ?? ""}` : `Failed: ${j.error}`);
    } catch (e) {
      setRefresh(`Failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Settings & Saves" sub={`${l.name} · created ${fmtDate(l.created.slice(0, 10), { year: "numeric", month: "short", day: "numeric" })}`} right={<><Button onClick={() => saveNow()}>Save now</Button><Button onClick={exportJson}>Export JSON</Button><Link href="/gm"><Button variant="ghost">Main menu</Button></Link></>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Gameplay">
          <div className="grid gap-3">
            <Field label="Difficulty">
              <select className={inputCls} value={s.difficulty} onChange={(e) => set("difficulty", e.target.value as Settings["difficulty"])}>{["easy", "normal", "hard", "insane"].map((d) => <option key={d}>{d}</option>)}</select>
            </Field>
            <Field label={`Trade difficulty ${s.tradeDifficulty.toFixed(2)} (AI's required margin)`}>
              <input type="range" min={0.8} max={1.3} step={0.05} value={s.tradeDifficulty} onChange={(e) => set("tradeDifficulty", Number(e.target.value))} className="w-full" />
            </Field>
            <Field label={`Injury frequency ${s.injuryFrequency.toFixed(1)}×`}>
              <input type="range" min={0} max={2} step={0.1} value={s.injuryFrequency} onChange={(e) => set("injuryFrequency", Number(e.target.value))} className="w-full" />
            </Field>
            <Field label={`Progression variance ${s.progressionVariance.toFixed(1)}×`}>
              <input type="range" min={0.5} max={1.5} step={0.1} value={s.progressionVariance} onChange={(e) => set("progressionVariance", Number(e.target.value))} className="w-full" />
            </Field>
            <Field label={`Season length ${s.seasonLength} games (applies from next season)`}>
              <input type="range" min={20} max={82} step={2} value={s.seasonLength} onChange={(e) => set("seasonLength", Number(e.target.value))} className="w-full" />
            </Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.salaryCap} onChange={(e) => set("salaryCap", e.target.checked)} /> Enforce salary cap & CBA rules</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.aiTrades} onChange={(e) => set("aiTrades", e.target.checked)} /> AI-to-AI trades</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!s.strictAprons} onChange={(e) => set("strictAprons", e.target.checked)} /> Strict apron trade rules (100% matching above the 1st apron, no aggregation above the 2nd)</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.commissioner} onChange={(e) => set("commissioner", e.target.checked)} /> Commissioner mode (edit players, contracts, force trades)</label>
          </div>
        </Card>
        {!l.online && <Card title="Teams you control">
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {Object.values(l.teams).sort((a, b) => a.fullName.localeCompare(b.fullName)).map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={l.userTeams.includes(t.id)} onChange={(e) => mutate((lg) => { if (e.target.checked) lg.userTeams = [...lg.userTeams, t.id]; else if (lg.userTeams.length > 1) lg.userTeams = lg.userTeams.filter((x) => x !== t.id); })} />
                {t.fullName}
              </label>
            ))}
          </div>
        </Card>}
        <Card title="Data & rosters">
          <p className="text-sm text-dim">Seed data fetched {l.dataFetchedAt ? fmtDate(l.dataFetchedAt.slice(0, 10), { year: "numeric", month: "short", day: "numeric" }) : "-"}. Sources: ESPN (rosters, bios, stats, contract records), Hoops Nightly (cap sheets, pick ledgers), Hoops Rumors (two-way deals, hard caps, CBA figures). See <code>data/DATA_REPORT.md</code> for anything that couldn&apos;t be verified.</p>
          <p className="mt-2 text-sm">CBA year {l.cba.season}: cap {`$${(l.cba.salaryCap.value / 1e6).toFixed(3)}M`} · <span className={l.cba.status === "official" ? "text-good" : "text-warn"}>{l.cba.status}</span></p>
          <Button className="mt-3" onClick={runRefresh}>Refresh rosters (re-pull data)</Button>
          {refresh && <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap rounded-[4px] border border-line bg-bg p-3 text-xs text-dim scroll-thin">{refresh}</pre>}
          <p className="mt-2 text-xs text-mute">Refreshing updates the seed files used for new leagues; existing saves keep their own world. Only available while running locally (npm run dev).</p>
        </Card>
        <Card title="Danger zone">
          <Button variant="danger" onClick={() => { if (confirm("Clear all news and transactions?")) mutate((lg) => { lg.news = []; lg.transactions = []; toast("Cleared"); }); }}>Clear news log</Button>
        </Card>
      </div>
    </div>
  );
}
