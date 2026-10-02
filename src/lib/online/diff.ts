/**
 * Structural diff/patch for league state, used to sync online games.
 * Objects are diffed key by key; arrays that only grew at the end (box scores, game logs) or the front
 * (news, transactions) become push/unshift ops, anything else replaces the array.
 */
export type Path = (string | number)[];
export type Op =
  | { t: "set"; p: Path; v: unknown }
  | { t: "del"; p: Path }
  | { t: "push"; p: Path; v: unknown[] }
  | { t: "unshift"; p: Path; v: unknown[] };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!equal(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!equal((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  return true;
}

function diffArray(a: unknown[], b: unknown[], p: Path, out: Op[]) {
  if (a === b) return;
  if (b.length > a.length) {
    const n = a.length;
    let prefix = true;
    for (let i = 0; i < n && prefix; i++) if (!equal(a[i], b[i])) prefix = false;
    if (prefix) return void out.push({ t: "push", p, v: b.slice(n) });
    const off = b.length - n;
    let suffix = true;
    for (let i = 0; i < n && suffix; i++) if (!equal(a[i], b[i + off])) suffix = false;
    if (suffix) return void out.push({ t: "unshift", p, v: b.slice(0, off) });
  }
  if (a.length === b.length) {
    // same length: diff element-wise when only a few entries changed (e.g. depth chart slots)
    const changed: number[] = [];
    for (let i = 0; i < a.length; i++) if (!equal(a[i], b[i])) changed.push(i);
    if (!changed.length) return;
    if (changed.length <= Math.max(2, a.length / 4)) {
      for (const i of changed) diffValue(a[i], b[i], [...p, i], out);
      return;
    }
  }
  if (!equal(a, b)) out.push({ t: "set", p, v: b });
}

function diffValue(a: unknown, b: unknown, p: Path, out: Op[]) {
  if (a === b) return;
  if (isObj(a) && isObj(b)) {
    for (const k of Object.keys(b)) {
      if (!(k in a)) out.push({ t: "set", p: [...p, k], v: b[k] });
      else diffValue(a[k], b[k], [...p, k], out);
    }
    for (const k of Object.keys(a)) if (!(k in b)) out.push({ t: "del", p: [...p, k] });
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) return diffArray(a, b, p, out);
  if (!equal(a, b)) out.push({ t: "set", p, v: b });
}

/** Ops that turn `before` into `after`. Top-level keys in `skip` are ignored. */
export function diff(before: object, after: object, skip: string[] = []): Op[] {
  const out: Op[] = [];
  const a = before as Record<string, unknown>;
  const b = after as Record<string, unknown>;
  for (const k of Object.keys(b)) {
    if (skip.includes(k)) continue;
    if (!(k in a)) out.push({ t: "set", p: [k], v: b[k] });
    else diffValue(a[k], b[k], [k], out);
  }
  for (const k of Object.keys(a)) if (!skip.includes(k) && !(k in b)) out.push({ t: "del", p: [k] });
  return out;
}

/** Apply ops in place. */
export function applyOps(target: object, ops: Op[]) {
  for (const op of ops) {
    let cur = target as Record<string | number, unknown>;
    for (let i = 0; i < op.p.length - 1; i++) {
      const k = op.p[i];
      if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = typeof op.p[i + 1] === "number" ? [] : {};
      cur = cur[k] as Record<string | number, unknown>;
    }
    const last = op.p[op.p.length - 1];
    if (op.t === "set") cur[last] = op.v;
    else if (op.t === "del") {
      if (Array.isArray(cur)) cur.splice(Number(last), 1);
      else delete cur[last];
    } else {
      const arr = Array.isArray(cur[last]) ? (cur[last] as unknown[]) : (cur[last] = []) as unknown[];
      if (op.t === "push") arr.push(...op.v);
      else arr.unshift(...op.v);
    }
  }
}

/** Deep copy of everything except the heavy, sim-only collections. */
export function snapshotFor(l: object, skip: string[]): object {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(l)) out[k] = skip.includes(k) ? v : structuredClone(v);
  return out;
}
