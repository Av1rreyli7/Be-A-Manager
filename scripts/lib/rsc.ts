/**
 * Minimal parser for the React Server Components payload that Next.js embeds in
 * server-rendered pages (`self.__next_f.push([1,"..."])`). We reassemble the stream,
 * JSON-parse each `id:[...]` row, and expose a tree walker over React element tuples
 * (`["$", type, key, props]`).
 */

export interface RscElement {
  type: string;
  key: string | null;
  props: Record<string, unknown>;
}

export function extractRscStream(html: string): string {
  const parts: string[] = [];
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) {
    parts.push(JSON.parse(`"${m[1]}"`) as string);
  }
  return parts.join("");
}

/**
 * Parse every JSON-valued row of the stream (non-JSON rows - module refs, text - are skipped),
 * inline lazy references (`"$L26"` / `"$26"` -> row 26) and return only the root rows,
 * so each element appears exactly once.
 */
export function parseRscRows(stream: string): unknown[] {
  const byId = new Map<string, unknown>();
  const order: string[] = [];
  // rows look like `1f:[...]\n` or `a:{...}\n`; JSON payloads contain newlines only inside strings (escaped)
  const re = /(?:^|\n)([0-9a-f]+):(?=[[{"])/g;
  const starts: { id: string; idx: number; body: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(stream))) starts.push({ id: m[1], idx: m.index, body: m.index + m[0].length });
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1].idx : stream.length;
    const text = stream.slice(starts[i].body, end).trim();
    try {
      byId.set(starts[i].id, JSON.parse(text));
      order.push(starts[i].id);
    } catch {
      /* ignore rows that aren't plain JSON */
    }
  }

  const referenced = new Set<string>();
  const resolve = (node: unknown, stack: Set<string>): unknown => {
    if (typeof node === "string") {
      const r = node.match(/^\$L?([0-9a-f]+)$/);
      if (r && byId.has(r[1]) && !stack.has(r[1])) {
        referenced.add(r[1]);
        const next = new Set(stack).add(r[1]);
        return resolve(byId.get(r[1]), next);
      }
      return node;
    }
    if (Array.isArray(node)) return node.map((n) => resolve(n, stack));
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) out[k] = resolve(v, stack);
      return out;
    }
    return node;
  };
  const resolved = order.map((id) => [id, resolve(byId.get(id), new Set([id]))] as const);
  return resolved.filter(([id]) => !referenced.has(id)).map(([, v]) => v);
}

function asElement(node: unknown): RscElement | null {
  if (Array.isArray(node) && node[0] === "$" && typeof node[1] === "string" && node.length === 4) {
    return { type: node[1], key: (node[2] as string | null) ?? null, props: (node[3] ?? {}) as Record<string, unknown> };
  }
  return null;
}

/** Depth-first walk over all React elements in a parsed tree. */
export function walk(node: unknown, visit: (el: RscElement) => void): void {
  if (Array.isArray(node)) {
    const el = asElement(node);
    if (el) {
      visit(el);
      walk(el.props.children, visit);
      return;
    }
    for (const c of node) walk(c, visit);
  } else if (node && typeof node === "object") {
    for (const v of Object.values(node)) walk(v, visit);
  }
}

export function findAll(root: unknown, pred: (el: RscElement) => boolean): RscElement[] {
  const out: RscElement[] = [];
  walk(root, (el) => {
    if (pred(el)) out.push(el);
  });
  return out;
}

/** Concatenate visible text below a node. RSC escapes a leading "$" as "$$". */
export function textOf(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string") return node.startsWith("$$") ? node.slice(1) : node.startsWith("$") ? "" : node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    const el = asElement(node);
    if (el) return textOf(el.props.children);
    return node.map(textOf).join("");
  }
  return "";
}

export function hasClass(el: RscElement, cls: string): boolean {
  const c = el.props.className;
  return typeof c === "string" && c.split(/\s+/).includes(cls);
}
