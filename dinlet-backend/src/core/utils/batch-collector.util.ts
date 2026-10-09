export interface BatchCollectorOptions<T> {
  /** Bu sayıya ulaşınca beklemeden yazılır. */
  maxSize: number;
  /** İlk öğeden en fazla bu kadar ms sonra (dolmasa da) yazılır. */
  maxWaitMs: number;
  /** Tüm grubu tek seferde yazar (ör. çok satırlı INSERT). */
  flush: (items: T[]) => Promise<void>;
  /**
   * Grup yazımı başarısız olursa öğeler tek tek bununla denenir; böylece tek
   * bir bozuk öğe tüm grubu düşürmez. Verilmezse gruptaki herkes hata alır.
   */
  flushOne?: (item: T) => Promise<void>;
}

interface Pending<T> {
  item: T;
  resolve: () => void;
  reject: (error: unknown) => void;
}

/**
 * Tek tek gelen öğeleri gruplayıp toplu yazan, bellek içi toplayıcı.
 *
 * `add()` öğe gerçekten yazıldığında çözülen bir promise döndürür; çağıran
 * (ör. kuyruk worker'ı) bunu bekleyerek "yazıldı" garantisini korur — veri
 * yazılmadan iş tamamlandı sayılmaz. Saf yardımcıdır; I/O `flush`'tadır.
 */
export class BatchCollector<T> {
  private pending: Pending<T>[] = [];
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly options: BatchCollectorOptions<T>) {}

  add(item: T): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.pending.push({ item, resolve, reject });

      if (this.pending.length >= this.options.maxSize) {
        void this.flushNow();
      } else {
        this.timer ??= setTimeout(
          () => void this.flushNow(),
          this.options.maxWaitMs,
        );
      }
    });
  }

  /** Bekleyen grubu hemen yazar (kapanışta da çağrılır). */
  async flushNow(): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;
    const batch = this.pending;
    this.pending = [];
    if (batch.length === 0) return;

    try {
      await this.options.flush(batch.map(({ item }) => item));
      for (const entry of batch) entry.resolve();
    } catch (error) {
      await this.settleIndividually(batch, error);
    }
  }

  private async settleIndividually(
    batch: Pending<T>[],
    batchError: unknown,
  ): Promise<void> {
    const flushOne = this.options.flushOne;
    if (!flushOne) {
      for (const entry of batch) entry.reject(batchError);
      return;
    }

    await Promise.all(
      batch.map(async (entry) => {
        try {
          await flushOne(entry.item);
          entry.resolve();
        } catch (error) {
          entry.reject(error);
        }
      }),
    );
  }
}
