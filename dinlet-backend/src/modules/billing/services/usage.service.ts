import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";

import { DateManager } from "#/core/utils/date-manager.js";
import {
  SubscriptionRepository,
  UsageLedgerRepository,
} from "#/modules/billing/repository/index.js";
import {
  PLAN_LIMITS,
  resolveEffectivePlan,
  type PlanLimits,
} from "#/modules/billing/utils/index.js";

export interface MonthlyUsage {
  periodKey: string;
  usedPages: number;
  remainingPages: number;
}

/**
 * Plan ve aylık sayfa kotası. Kota sayfa başına, dönem anahtarı
 * (`periodKey`, Europe/Istanbul) ile aylık uygulanır.
 */
@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly ledgerRepository: UsageLedgerRepository,
    private readonly dateManager: DateManager,
  ) {}

  /** Kullanıcının şu anki etkin planının limitleri. */
  async getPlanLimits(userId: number): Promise<PlanLimits> {
    const subscription =
      await this.subscriptionRepository.findSnapshotByUserId(userId);
    return PLAN_LIMITS[
      resolveEffectivePlan(subscription, this.dateManager.utcNow())
    ];
  }

  async getMonthlyUsage(
    userId: number,
    limits: PlanLimits,
  ): Promise<MonthlyUsage> {
    const periodKey = this.dateManager.periodKey();
    const usedPages = await this.ledgerRepository.sumPages(userId, periodKey);
    return {
      periodKey,
      usedPages,
      remainingPages: Math.max(0, limits.monthlyPages - usedPages),
    };
  }

  /**
   * Kotada `pages` kadar yer yoksa **402** fırlatır. Eşzamanlı yüklemelerde
   * doğruluk için çağıran taraf kullanıcı kota kilidi altında çağırır ve
   * düşümü aynı kilit içinde yazar.
   */
  async assertQuota(
    userId: number,
    limits: PlanLimits,
    pages: number,
  ): Promise<MonthlyUsage> {
    const usage = await this.getMonthlyUsage(userId, limits);
    if (pages > usage.remainingPages) {
      throw new HttpException(
        {
          message: `Bu ayki sayfa kotanız yetersiz: ${pages} sayfa gerekiyor, ${usage.remainingPages} sayfa kaldı.`,
          remainingPages: usage.remainingPages,
          requiredPages: pages,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    return usage;
  }

  /** Belge için kotadan sayfa düşer (yeniden denemede; kota kilidi altında). */
  async chargeDocument(
    userId: number,
    documentId: number,
    pages: number,
  ): Promise<void> {
    await this.ledgerRepository.create({
      userId,
      documentId,
      pages,
      periodKey: this.dateManager.periodKey(),
    });
  }

  /**
   * Belge için düşülen kotayı iade eder. İdempotenttir: belgenin net düşümü
   * zaten sıfırsa yeni kayıt yazılmaz. İade, düşümün yapıldığı dönemin değil
   * içinde bulunulan dönemin defterine yazılır.
   */
  async refundDocument(userId: number, documentId: number): Promise<void> {
    const charged = await this.ledgerRepository.sumPagesForDocument(documentId);
    if (charged <= 0) return;

    await this.ledgerRepository.create({
      userId,
      documentId,
      pages: -charged,
      periodKey: this.dateManager.periodKey(),
    });
    this.logger.log(`Kota iade edildi: belge#${documentId}, ${charged} sayfa`);
  }
}
