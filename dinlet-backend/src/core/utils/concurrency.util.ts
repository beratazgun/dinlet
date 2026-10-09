/**
 * `items` üzerinde `worker`'ı en fazla `limit` eşzamanlı çalıştırır. Bir
 * öğenin hatası diğerlerini durdurmaz; tüm sonuçlar `Promise.allSettled`
 * biçiminde, girdi sırasıyla döner.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = Array.from({ length: items.length });
  let next = 0;

  const run = async () => {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = {
          status: "fulfilled",
          value: await worker(items[index]!, index),
        };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, run),
  );
  return results;
}
