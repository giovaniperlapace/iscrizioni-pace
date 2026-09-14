/** Page past PostgREST's row cap before applying client filters and sorting. */
export async function loadAllRows<T>(
  load: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ data: T[]; error: null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const result = await load(from, from + 499);
    if (result.error) throw new Error(result.error.message);
    rows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 500) break;
  }
  return { data: rows, error: null };
}

export async function loadRowsForIds<T>(
  ids: string[],
  load: (
    ids: string[],
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ data: T[]; error: null }> {
  const rows: T[] = [];
  const unique = [...new Set(ids)];
  // Encoded UUID filters must fit Kong's request-line limit (8 KiB).
  // 300 UUIDs produce an ~12 KiB URL; 100 leave room for selects and filters.
  const batchSize = 100;
  for (let index = 0; index < unique.length; index += batchSize) {
    const chunk = unique.slice(index, index + batchSize);
    rows.push(...(await loadAllRows((from, to) => load(chunk, from, to))).data);
  }
  return { data: rows, error: null };
}
