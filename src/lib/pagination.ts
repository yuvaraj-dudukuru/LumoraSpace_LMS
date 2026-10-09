/** Admin tables page in memory: the queries return the whole filtered list
 * (cohort-sized data), and the page slices it. Swap for skip/take in the
 * query when a table can realistically reach thousands of rows. */
export const ADMIN_PAGE_SIZE = 10;

export type Page<T> = {
  rows: T[];
  page: number;
  pageCount: number;
  total: number;
  /** 1-based index of the first/last row shown; both 0 when empty. */
  from: number;
  to: number;
};

export function paginate<T>(all: T[], rawPage: string | undefined, pageSize: number = ADMIN_PAGE_SIZE): Page<T> {
  const pageCount = Math.max(1, Math.ceil(all.length / pageSize));
  const parsed = Number.parseInt(rawPage ?? "1", 10);
  const page = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), pageCount) : 1;
  const start = (page - 1) * pageSize;
  const rows = all.slice(start, start + pageSize);
  return {
    rows,
    page,
    pageCount,
    total: all.length,
    from: rows.length === 0 ? 0 : start + 1,
    to: start + rows.length,
  };
}

/** Builds `/path?a=1&b=2`, dropping empty values and the defaults given. */
export function buildHref(
  path: string,
  params: Record<string, string | number | undefined>,
  defaults: Record<string, string | number> = {},
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    if (String(defaults[key]) === String(value)) continue;
    query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}
