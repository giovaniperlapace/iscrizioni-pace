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
  // Bound concurrent reads, retain input order and stop scheduling on failure.
  // Pages within each batch remain sequential; no partial result is returned.
  const concurrency = 3;
  for (let index = 0; index < unique.length; index += batchSize * concurrency) {
    const chunks: string[][] = [];
    for (let offset = index; offset < Math.min(unique.length, index + batchSize * concurrency); offset += batchSize) {
      chunks.push(unique.slice(offset, offset + batchSize));
    }
    const results = await Promise.all(chunks.map((chunk) =>
      loadAllRows((from, to) => load(chunk, from, to))
    ));
    for (const result of results) rows.push(...result.data);
  }
  return { data: rows, error: null };
}
