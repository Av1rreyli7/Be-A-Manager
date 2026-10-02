"use client";
import { useState } from "react";
import clsx from "clsx";
import { useLeague, useTeamId } from "@/lib/store";
import { Card, PageHeader, Tabs } from "@/components/ui";
import { NewsList } from "@/components/NewsList";
import { fmtDate } from "@/engine/util/dates";

const TYPES = ["all", "trade", "signing", "injury", "award", "draft", "rumor", "request", "release", "extension", "retirement", "milestone", "league"];

export default function NewsPage() {
  const l = useLeague();
  const me = useTeamId();
  const [tab, setTab] = useState<"news" | "tx" | "injuries">("news");
  const [type, setType] = useState("all");
  const [mine, setMine] = useState(false);
  const items = l.news.filter((n) => (type === "all" || n.type === type) && (!mine || n.teams.includes(me)));
  const injured = Object.values(l.players).filter((p) => p.injury && p.teamId).sort((a, b) => b.ovr - a.ovr);
  return (
    <div className="space-y-4">
      <PageHeader title="News & Transactions" />
      <Tabs tabs={[{ id: "news", label: "News feed" }, { id: "tx", label: "Transactions" }, { id: "injuries", label: `Injury report (${injured.length})` }]} value={tab} onChange={setTab} />
      {tab === "news" && (
        <Card
          right={
            <>
              <select className="rounded-[3px] border border-line-2 bg-bg px-2 py-1 text-xs" value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
              <label className="flex items-center gap-1"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> My team</label>
            </>
          }
          title="Feed"
        >
          <NewsList items={items.slice(0, 300)} />
        </Card>
      )}
      {tab === "tx" && (
        <Card title="Transactions">
          <ul className="divide-y divide-line/60 text-sm">
            {l.transactions.slice(0, 400).map((t, i) => (
              <li key={i} className={clsx("flex gap-3 py-1.5", t.teams.includes(me) && "text-ink")}>
                <span className="w-16 shrink-0 text-xs text-mute">{fmtDate(t.date)}</span>
                <span className="text-dim">{t.text}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {tab === "injuries" && (
        <Card title="League injury report">
          <ul className="divide-y divide-line/60 text-sm">
            {injured.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span><b>{p.name}</b> <span className="text-dim">({p.teamId})</span></span>
                <span className="text-bad">{p.injury!.type} · {p.injury!.severity} · {p.injury!.daysOut} days</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
