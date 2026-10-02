"use client";
import clsx from "clsx";
import type { NewsItem } from "@/engine/types/game";
import { fmtDate } from "@/engine/util/dates";
import { Empty } from "./ui";

const TYPE_TONE: Record<string, string> = {
  trade: "bg-accent text-accent-ink",
  signing: "bg-good/90 text-bg",
  extension: "bg-good/90 text-bg",
  injury: "bg-bad text-bg",
  award: "bg-gold text-bg",
  milestone: "bg-gold text-bg",
  draft: "bg-info text-bg",
  request: "bg-warn/90 text-bg",
};

export function NewsList({ items }: { items: NewsItem[] }) {
  if (!items.length) return <Empty>No news yet. Sim a few days and the wire fills up.</Empty>;
  return (
    <ul className="stagger divide-y divide-line/60">
      {items.map((n, i) => (
        <li key={n.id} style={{ ["--i" as string]: Math.min(i, 12) }} className={clsx("grid grid-cols-[52px_78px_1fr] items-baseline gap-2.5 py-2 text-sm", n.important && "font-semibold")}>
          <span className="font-num text-[10.5px] font-bold uppercase tracking-[0.08em] text-mute num">{fmtDate(n.date)}</span>
          <span className={clsx("w-fit rounded-[2px] px-1.5 pb-[2px] pt-[3px] font-num text-[9px] font-bold uppercase leading-none tracking-[0.1em]", TYPE_TONE[n.type] ?? "bg-ink/10 text-dim")}>{n.type}</span>
          <span className="min-w-0 text-ink/90">{n.text}</span>
        </li>
      ))}
    </ul>
  );
}
