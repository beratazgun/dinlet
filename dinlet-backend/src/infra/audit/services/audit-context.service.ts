import { AsyncLocalStorage } from "node:async_hooks";
import { Injectable } from "@nestjs/common";

import {
  type AuditFieldChange,
  calculateDiff,
  type DiffOptions,
} from "#/core/utils/index.js";

interface AuditStore {
  changes: AuditFieldChange[];
}

/**
 * Mevcut istek yaşam döngüsü boyunca veri değişikliklerini (diff / eski-yeni
 * değer) toplar. Servisler değişiklikleri buraya kaydeder; istek bitince
 * `AuditContextInterceptor` bunları denetim kaydının `changes` alanına aktarır.
 *
 * `AuditModule` global olduğu için her modülden enjekte edilebilir.
 */
@Injectable()
export class AuditContextService {
  private readonly storage = new AsyncLocalStorage<AuditStore>();

  /** Yeni bir istek bağlamı başlatarak verilen fonksiyonu yürütür. */
  run<R>(fn: () => R): R {
    return this.storage.run({ changes: [] }, fn);
  }

  /** Tek bir alan değişikliği kaydeder. */
  recordChange(change: AuditFieldChange): void {
    this.storage.getStore()?.changes.push(change);
  }

  /** Birden fazla alan değişikliği kaydeder. */
  recordChanges(changes: AuditFieldChange[]): void {
    this.storage.getStore()?.changes.push(...changes);
  }

  /** İki nesne arasındaki farkı hesaplayıp kaydeder. */
  recordDiff<T extends object>(
    before: T | null | undefined,
    after: T | null | undefined,
    options?: DiffOptions<T>,
  ): void {
    const diff = calculateDiff(before, after, options);
    if (diff.length > 0) this.recordChanges(diff);
  }

  /** Mevcut istekte biriken değişiklikleri döner. */
  getChanges(): AuditFieldChange[] {
    return this.storage.getStore()?.changes ?? [];
  }

  /** Mevcut bağlamdaki değişiklikleri sıfırlar. */
  clear(): void {
    const store = this.storage.getStore();
    if (store) store.changes = [];
  }
}
