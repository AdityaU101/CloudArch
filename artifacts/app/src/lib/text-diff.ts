/**
 * Minimal LCS-based line diff for the version compare view. Produces aligned
 * rows for a side-by-side render. Inputs are capped so the O(n·m) table stays
 * cheap; beyond the cap the compare view falls back to plain panels.
 */

export interface DiffRow {
  left: string | null;
  right: string | null;
  type: "same" | "removed" | "added" | "changed";
}

export const DIFF_LINE_CAP = 600;

export function canDiff(a: string, b: string): boolean {
  return a.split("\n").length <= DIFF_LINE_CAP && b.split("\n").length <= DIFF_LINE_CAP;
}

export function diffLines(a: string, b: string): DiffRow[] {
  const al = a.split("\n");
  const bl = b.split("\n");
  const n = al.length;
  const m = bl.length;

  // LCS table (n+1 x m+1), small enough at the cap (~600²·4B ≈ 1.4MB).
  const table: Uint32Array = new Uint32Array((n + 1) * (m + 1));
  const idx = (i: number, j: number) => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[idx(i, j)] =
        al[i] === bl[j]
          ? table[idx(i + 1, j + 1)] + 1
          : Math.max(table[idx(i + 1, j)], table[idx(i, j + 1)]);
    }
  }

  // Walk the table, emitting aligned rows; pair up adjacent removed/added
  // runs as "changed" so the side-by-side reads naturally.
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  let removed: string[] = [];
  let added: string[] = [];

  const flush = () => {
    const len = Math.max(removed.length, added.length);
    for (let k = 0; k < len; k++) {
      const left = k < removed.length ? removed[k] : null;
      const right = k < added.length ? added[k] : null;
      rows.push({
        left,
        right,
        type: left !== null && right !== null ? "changed" : left !== null ? "removed" : "added",
      });
    }
    removed = [];
    added = [];
  };

  while (i < n && j < m) {
    if (al[i] === bl[j]) {
      flush();
      rows.push({ left: al[i], right: bl[j], type: "same" });
      i++;
      j++;
    } else if (table[idx(i + 1, j)] >= table[idx(i, j + 1)]) {
      removed.push(al[i]);
      i++;
    } else {
      added.push(bl[j]);
      j++;
    }
  }
  while (i < n) removed.push(al[i++]);
  while (j < m) added.push(bl[j++]);
  flush();

  return rows;
}

/** Collapse long unchanged stretches, keeping context lines around changes. */
export function collapseUnchanged(rows: DiffRow[], context = 3): (DiffRow | { collapsed: number })[] {
  const keep = new Array<boolean>(rows.length).fill(false);
  rows.forEach((r, i) => {
    if (r.type !== "same") {
      for (let k = Math.max(0, i - context); k <= Math.min(rows.length - 1, i + context); k++) keep[k] = true;
    }
  });

  const out: (DiffRow | { collapsed: number })[] = [];
  let skipped = 0;
  rows.forEach((r, i) => {
    if (keep[i]) {
      if (skipped > 0) {
        out.push({ collapsed: skipped });
        skipped = 0;
      }
      out.push(r);
    } else {
      skipped++;
    }
  });
  if (skipped > 0) out.push({ collapsed: skipped });
  return out;
}
