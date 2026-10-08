"use client";
/** Fast sortable / searchable / filterable table with pagination for large lists. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { CaretDown, CaretLeft, CaretRight, CaretUp, MagnifyingGlass } from "@phosphor-icons/react";
import { PosBadge, inputCls } from "./ui";
import { km } from "@/lib/motion";

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

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
  dense?: boolean; // kept so callers still compile: the kit table sets its own row height
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

  // a new sort or page cascades the rows in again (the first showing is the screen entrance's job)
  const body = useRef<HTMLTableSectionElement>(null);
  const view = `${sort}|${dir}|${cur}|${q}`;
  const firstView = useRef(view);
  useIso(() => {
    if (view === firstView.current || !body.current) return;
    const tl = km.cascade(Array.from(body.current.children), { y: 4 });
    return () => {
      tl?.progress(1).kill();
    };
  }, [view]);

  return (
    <div>
      {(search || filters) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {search && (
            <label className="relative w-full max-w-xs">
              <span className="sr-only">Search</span>
              <MagnifyingGlass size={15} className="pointer-events-none absolute left-2.5 top-1/2 z-[1] -translate-y-1/2 text-mute" />
              <input className={inputCls} style={{ paddingLeft: 32 }} placeholder="Search" value={q} onChange={(e) => (setQ(e.target.value), setPage(0))} />
            </label>
          )}
          {filters}
          <span className="k-label ml-auto">{filtered.length} rows</span>
        </div>
      )}
      <div className="scroll-thin overflow-x-auto">
        <table className="k-table min-w-max">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  title={c.title}
                  aria-sort={sort === c.key ? (dir === "asc" ? "ascending" : "descending") : undefined}
                  onClick={() => {
                    if (!c.value) return;
                    if (sort === c.key) setDir(dir === "asc" ? "desc" : "asc");
                    else {
                      setSort(c.key);
                      setDir(typeof c.value(rows[0] as T) === "string" ? "asc" : "desc");
                    }
                  }}
                  style={{ ...(c.align === "center" ? { textAlign: "center" } : null), ...(sort === c.key ? { boxShadow: "inset 0 -2px 0 var(--k-accent)" } : null) }}
                  className={clsx("select-none", c.value && "cursor-pointer", c.align === "right" && "k-num", c.hideOnMobile && "hidden md:table-cell")}
                >
                  {c.label}
                  {sort === c.key && (dir === "asc" ? <CaretUp size={10} weight="fill" className="ml-0.5 inline align-[0]" /> : <CaretDown size={10} weight="fill" className="ml-0.5 inline align-[0]" />)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody ref={body}>
            {shown.map((r) => (
              <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={clsx(onRowClick && "cursor-pointer", rowClassName?.(r))}>
                {columns.map((c) => (
                  <td key={c.key} className={clsx("num whitespace-nowrap", c.align === "right" ? "k-num" : c.align === "center" && "text-center", c.hideOnMobile && "hidden md:table-cell", c.className)}>
                    {c.render ? c.render(r) : c.key === "pos" && c.value?.(r) ? <PosBadge pos={String(c.value(r))} /> : String(c.value?.(r) ?? "")}
                  </td>
                ))}
              </tr>
            ))}
            {!shown.length && (
              <tr>
                <td colSpan={columns.length} className="text-center text-dim">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="mt-2 flex items-center justify-end gap-1 text-xs text-dim">
          <button className="k-btn k-btn-ghost k-btn-sm" disabled={cur === 0} onClick={() => setPage(cur - 1)}>
            <CaretLeft size={12} weight="bold" /> Prev
          </button>
          <span className="k-msub px-1">
            {cur + 1} / {pages}
          </span>
          <button className="k-btn k-btn-ghost k-btn-sm" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>
            Next <CaretRight size={12} weight="bold" />
          </button>
        </div>
      )}
    </div>
  );
}
