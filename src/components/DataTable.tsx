"use client";
/** Fast sortable / searchable / filterable table with pagination for large lists. */
import { useMemo, useState, type ReactNode } from "react";
import clsx from "clsx";
import { CaretDown, CaretLeft, CaretRight, CaretUp, MagnifyingGlass } from "@phosphor-icons/react";
import { inputCls } from "./ui";

export interface Column<T> {
  key: string;
  label: ReactNode;
  value?: (row: T) => number | string | null | undefined; // sort value
  render?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  title?: string;
  hideOnMobile?: boolean;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  defaultSort,
  defaultDir = "desc",
  search,
  pageSize = 50,
  filters,
  dense,
  onRowClick,
  empty = "Nothing to show",
  rowClassName,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  defaultSort?: string;
  defaultDir?: "asc" | "desc";
  search?: (row: T) => string;
  pageSize?: number;
  filters?: ReactNode;
  dense?: boolean;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  rowClassName?: (row: T) => string | undefined;
}) {
  const [sort, setSort] = useState(defaultSort ?? "");
  const [dir, setDir] = useState<"asc" | "desc">(defaultDir);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let out = rows;
    if (q && search) {
      const s = q.toLowerCase();
      out = out.filter((r) => search(r).toLowerCase().includes(s));
    }
    const col = columns.find((c) => c.key === sort);
    if (col?.value) {
      const v = col.value;
      out = [...out].sort((a, b) => {
        const x = v(a);
        const y = v(b);
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
        return dir === "asc" ? c : -c;
      });
    }
    return out;
  }, [rows, q, search, sort, dir, columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const shown = filtered.slice(cur * pageSize, cur * pageSize + pageSize);

  return (
    <div>
      {(search || filters) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {search && (
            <label className="relative w-full max-w-xs">
              <span className="sr-only">Search</span>
              <MagnifyingGlass size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-mute" />
              <input className={clsx(inputCls, "pl-8")} placeholder="Search" value={q} onChange={(e) => (setQ(e.target.value), setPage(0))} />
            </label>
          )}
          {filters}
          <span className="label ml-auto">{filtered.length} rows</span>
        </div>
      )}
      <div className="scroll-thin overflow-x-auto border border-line bg-ink/[0.012]">
        <table className="w-full min-w-max border-collapse text-[13px]">
          <thead className="sticky top-0 z-[1] bg-panel-2">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  title={c.title}
                  onClick={() => {
                    if (!c.value) return;
                    if (sort === c.key) setDir(dir === "asc" ? "desc" : "asc");
                    else {
                      setSort(c.key);
                      setDir(typeof c.value(rows[0] as T) === "string" ? "asc" : "desc");
                    }
                  }}
                  className={clsx(
                    "label select-none whitespace-nowrap border-b border-line px-2.5 py-2.5 transition-colors",
                    c.value && "cursor-pointer hover:!text-ink",
                    c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                    c.hideOnMobile && "hidden md:table-cell",
                    sort === c.key && "!text-accent shadow-[inset_0_-1px_0_var(--accent)]",
                  )}
                >
                  {c.label}
                  {sort === c.key && (dir === "asc" ? <CaretUp size={10} weight="fill" className="ml-0.5 inline align-[0]" /> : <CaretDown size={10} weight="fill" className="ml-0.5 inline align-[0]" />)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={clsx("border-b border-line/60 transition-colors duration-100 last:border-0 even:bg-ink/[0.018] hover:bg-ink/[0.05]", onRowClick && "cursor-pointer", rowClassName?.(r))}>
                {columns.map((c) => (
                  <td key={c.key} className={clsx(dense ? "px-2.5 py-1" : "px-2.5 py-1.5", "num whitespace-nowrap", c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left", c.hideOnMobile && "hidden md:table-cell", c.className)}>
                    {c.render ? c.render(r) : String(c.value?.(r) ?? "")}
                  </td>
                ))}
              </tr>
            ))}
            {!shown.length && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-dim">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="mt-2 flex items-center justify-end gap-1 text-xs text-dim">
          <button className="inline-flex items-center gap-1 rounded-[4px] px-2 py-1.5 font-semibold transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-30" disabled={cur === 0} onClick={() => setPage(cur - 1)}>
            <CaretLeft size={12} weight="bold" /> Prev
          </button>
          <span className="px-1 font-display text-[13px] font-bold text-ink num">
            {cur + 1} / {pages}
          </span>
          <button className="inline-flex items-center gap-1 rounded-[4px] px-2 py-1.5 font-semibold transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-30" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>
            Next <CaretRight size={12} weight="bold" />
          </button>
        </div>
      )}
    </div>
  );
}
