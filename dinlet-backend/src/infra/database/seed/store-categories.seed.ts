import { db } from "#database/db.js";

/**
 * Mağaza kataloğunun başlangıç ağacı: sınav → ders. Yalnızca eksikler
 * eklenir; yönetim panelinden yapılan ad/sıra değişikliklerine dokunulmaz.
 */
const STORE_CATEGORIES = [
  {
    slug: "kpss",
    name: "KPSS",
    children: [
      { slug: "kpss-tarih", name: "Tarih" },
      { slug: "kpss-cografya", name: "Coğrafya" },
      { slug: "kpss-vatandaslik", name: "Vatandaşlık" },
      { slug: "kpss-guncel", name: "Güncel" },
    ],
  },
  { slug: "yks", name: "YKS", children: [] },
  { slug: "ales", name: "ALES", children: [] },
  { slug: "hukuk", name: "Hukuk", children: [] },
] as const;

export async function seedStoreCategories(): Promise<void> {
  console.log("🛍️  Mağaza kategorileri yükleniyor...");

  let created = 0;
  const ensure = async (
    slug: string,
    name: string,
    position: number,
    parentId: number | null,
  ) => {
    const existing = await db.orm.public.StoreCategory.where({ slug })
      .select("id")
      .first();
    if (existing) return existing.id;
    created++;
    const category = await db.orm.public.StoreCategory.select("id").create({
      slug,
      name,
      position,
      parentId,
    });
    return category.id;
  };

  for (const [examIndex, exam] of STORE_CATEGORIES.entries()) {
    const examId = await ensure(exam.slug, exam.name, examIndex, null);
    for (const [index, subject] of exam.children.entries()) {
      await ensure(subject.slug, subject.name, index, examId);
    }
  }

  console.log(`✅ ${created} yeni mağaza kategorisi`);
}
