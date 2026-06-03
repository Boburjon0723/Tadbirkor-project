export type ListPaginationQuery = {
  page?: string | number;
  limit?: string | number;
  all?: string | boolean;
  full?: string | boolean;
};

/** Eski klientlar: to‘liq ro‘yxat (sahifalashsiz massiv). `?all=true` yoki `?limit=all` */
export function wantsFullList(query?: ListPaginationQuery): boolean {
  if (!query) return false;
  const all = query.all;
  if (all === true || all === 'true' || all === '1') return true;
  const full = query.full;
  if (full === true || full === 'true' || full === '1') return true;
  const lim = String(query.limit ?? '').trim().toLowerCase();
  return lim === 'all' || lim === '0';
}

export function parseListPagination(
  query: ListPaginationQuery | undefined,
  defaults: { page?: number; limit?: number; maxLimit?: number } = {},
) {
  const page = Math.max(1, Number(query?.page) || defaults.page || 1);
  const maxLimit = defaults.maxLimit ?? 100;
  const limit = Math.min(
    Math.max(Number(query?.limit) || defaults.limit || 30, 1),
    maxLimit,
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
