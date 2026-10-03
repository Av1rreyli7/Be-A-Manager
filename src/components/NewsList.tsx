"use client";
import clsx from "clsx";
import type { NewsItem } from "@/engine/types/game";
import { fmtDate } from "@/engine/util/dates";
import { Empty } from "./ui";

/** Each kind of story gets its own kit chip colour. */
const TYPE_TONE: Record<string, string> = {
  trade: "",
  signing: "good",
  extension: "good",
  injury: "bad",
  award: "gold",
  milestone: "gold",
  draft: "info",
  request: "warn",
};

export function NewsList({ items }: { items: NewsItem[] }) {
  if (!items.length) return <Empty>No news yet. Sim a few days and it fills up.</Empty>;
  return (
    <ul className="divide-y divide-line/60" data-km="rows">
      {items.map((n) => (
        <li key={n.id} className={clsx("grid grid-cols-[52px_84px_1fr] items-center gap-2.5 py-2 text-sm", n.important && "font-semibold")}>
          <span className="font-num text-[10.5px] font-bold uppercase tracking-[0.08em] text-mute num">{fmtDate(n.date)}</span>
          <span className={clsx("k-chip w-fit !h-[18px] !px-1.5 !text-[9px]", TYPE_TONE[n.type] ?? "info")}>{n.type}</span>
          <span className="min-w-0 text-ink/90">{n.text}</span>
        </li>
      ))}
    </ul>
  );
}
