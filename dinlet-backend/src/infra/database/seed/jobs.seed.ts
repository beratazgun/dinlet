import { db } from "#database/db.js";
import type { JobCategory } from "#database/enums.js";
import { asCronPattern, asJobCode, asJobName } from "#database/scalars.js";

interface JobSeed {
  code: string;
  name: string;
  description?: string;
  category: JobCategory;
  cronPattern: string;
  retryLimit?: number;
  params?: Record<string, number | string | boolean>;
  isActive?: boolean;
}

const JOBS: JobSeed[] = [
  {
    code: "AUDIT_LOG_CLEANUP",
    name: "Denetim kaydı temizliği",
    description:
      "Saklama süresini (params.retentionDays) aşan audit_logs kayıtlarını siler.",
    category: "CLEANUP",
    cronPattern: "0 4 * * *",
    params: { retentionDays: 90 },
    isActive: true,
  },
  {
    code: "DOCUMENT_PIPELINE_RECONCILE",
    name: "Not işleme hattı uzlaştırma",
    description:
      "Kuyruk olayları kaçtığı için params.staleMinutes'tan uzun süre aynı durumda kalan notları/bölümleri onarır.",
    category: "MAINTENANCE",
    cronPattern: "*/5 * * * *",
    retryLimit: 1,
    params: { staleMinutes: 15 },
    isActive: true,
  },
  {
    code: "DATA_PURGE",
    name: "Silinen not ve hesapların kalıcı temizliği",
    description:
      "params.graceDays'ten (en fazla 7) eski silinmiş notların R2 dosyalarını ve kayıtlarını, sonra notu kalmamış silinmiş hesapları kalıcı siler.",
    category: "CLEANUP",
    cronPattern: "30 3 * * *",
    params: { graceDays: 3 },
    isActive: true,
  },
  {
    code: "QUEUE_HEALTH_ALERT",
    name: "Kuyruk alarmı",
    description:
      "DLQ'ya düşen işler ve tts kuyruğunda params.maxWaitMinutes'tan uzun bekleyen işler için ALERT_EMAIL'e e-posta gönderir.",
    category: "MAINTENANCE",
    cronPattern: "*/10 * * * *",
    retryLimit: 1,
    params: { maxWaitMinutes: 120 },
    isActive: true,
  },
];

export async function seedJobs(): Promise<void> {
  console.log("⏰ Job tanımları yükleniyor...");

  for (const job of JOBS) {
    const values = {
      name: asJobName(job.name),
      description: job.description,
      category: job.category,
      cronPattern: asCronPattern(job.cronPattern),
      retryLimit: job.retryLimit ?? 3,
      params: job.params ?? null,
      isActive: job.isActive ?? false,
    };

    await db.orm.public.Job.upsert({
      create: { code: asJobCode(job.code), ...values },
      update: values,
      conflictOn: { code: asJobCode(job.code) },
    });
  }

  console.log(`✅ ${JOBS.length} job hazır`);
}
