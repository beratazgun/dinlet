import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Queue } from "bullmq";
import { nanoid } from "nanoid";

import { db } from "#database/db.js";
import { DEFAULT_JOB_OPTIONS, QueueName } from "#/infra/queue/queue.constants.js";

/**
 * Geliştirme ortamı için örnek mağaza içerikleri. Her içerik, süper
 * yöneticinin hesabında bir not olarak açılır ve normal işleme akışından
 * geçer: Markdown R2'ye yazılır, not `SCRIPTING` durumunda açılır ve
 * bölümleme kuyruğa alınır; sesleri worker üretir (birkaç dakika).
 * Production ve test ortamında çalışmaz; slug'ı olan içerik atlanır.
 */

interface DemoItem {
  slug: string;
  title: string;
  description: string;
  source: "ORIGINAL" | "LEGISLATION";
  credit: string;
  categorySlugs: string[];
  productId?: string;
  priceTry?: string;
  isFeatured?: boolean;
  position: number;
  pageCount: number;
  markdown: string;
}

const DEMO_ITEMS: DemoItem[] = [
  {
    slug: "anayasa-temel-ilkeler",
    title: "T.C. Anayasası: Temel İlkeler",
    description:
      "1982 Anayasası'nın ilk maddeleri sınavda en çok sorulan hâliyle: devletin nitelikleri, egemenlik, eşitlik ve kuvvetler ayrılığı.",
    source: "LEGISLATION",
    credit: "Dinlet editörleri",
    categorySlugs: ["kpss", "kpss-vatandaslik", "hukuk"],
    isFeatured: true,
    position: 0,
    pageCount: 4,
    markdown: `# Devletin Nitelikleri

1982 Anayasası'nın birinci maddesine göre Türkiye Devleti bir Cumhuriyettir. İkinci madde Cumhuriyetin niteliklerini sayar: Türkiye Cumhuriyeti, toplumun huzuru, millî dayanışma ve adalet anlayışı içinde, insan haklarına saygılı, Atatürk milliyetçiliğine bağlı, başlangıçta belirtilen temel ilkelere dayanan, demokratik, lâik ve sosyal bir hukuk Devletidir.

Üçüncü maddeye göre Türkiye Devleti, ülkesi ve milletiyle bölünmez bir bütündür. Dili Türkçedir. Bayrağı beyaz ay yıldızlı al bayraktır. Millî marşı İstiklâl Marşı'dır. Başkenti Ankara'dır.

Dördüncü madde bu ilk üç maddeyi güvenceye alır: Cumhuriyet olan devlet şekli, Cumhuriyetin nitelikleri ve üçüncü maddedeki hükümler değiştirilemez, değiştirilmesi teklif dahi edilemez. Sınavda bu maddeler "değiştirilemez hükümler" olarak sorulur.

# Egemenlik ve Kanun Önünde Eşitlik

Altıncı maddeye göre egemenlik kayıtsız şartsız Milletindir. Türk Milleti egemenliğini, Anayasanın koyduğu esaslara göre, yetkili organları eliyle kullanır. Egemenliğin kullanılması hiçbir surette hiçbir kişiye, zümreye veya sınıfa bırakılamaz. Hiçbir kimse veya organ kaynağını Anayasadan almayan bir Devlet yetkisi kullanamaz.

Onuncu madde eşitlik ilkesini düzenler: Herkes dil, ırk, renk, cinsiyet, siyasi düşünce, felsefi inanç, din, mezhep ve benzeri sebeplerle ayırım gözetilmeksizin kanun önünde eşittir. Kadınlar ve erkekler eşit haklara sahiptir ve Devlet bu eşitliğin yaşama geçmesini sağlamakla yükümlüdür.

On birinci maddeye göre Anayasa hükümleri yasama, yürütme ve yargı organlarını, idare makamlarını ve diğer kuruluş ve kişileri bağlayan temel hukuk kurallarıdır. Kanunlar Anayasaya aykırı olamaz.

# Kuvvetler Ayrılığı

Anayasa devlet yetkisini üç kuvvete ayırır. Yedinci maddeye göre yasama yetkisi Türk Milleti adına Türkiye Büyük Millet Meclisinindir ve bu yetki devredilemez.

Sekizinci maddeye göre yürütme yetkisi ve görevi, Cumhurbaşkanı tarafından Anayasaya ve kanunlara uygun olarak kullanılır ve yerine getirilir. Bu hüküm 2017 Anayasa değişikliğiyle bugünkü hâlini almıştır.

Dokuzuncu maddeye göre yargı yetkisi, Türk Milleti adına bağımsız ve tarafsız mahkemelerce kullanılır. "Tarafsız" ifadesi de 2017 değişikliğiyle eklenmiştir.
`,
  },
  {
    slug: "osmanli-kurulus-donemi",
    title: "Osmanlı Kuruluş Dönemi",
    description:
      "Osman Bey'den I. Murat'a kuruluş döneminin savaşları, fetihleri ve ilkleri; KPSS tarih sorularına göre özetlenmiş anlatım.",
    source: "ORIGINAL",
    credit: "Dinlet editörleri",
    categorySlugs: ["kpss", "kpss-tarih"],
    productId: "dinlet_store_osmanli_kurulus",
    priceTry: "79.99",
    position: 1,
    pageCount: 5,
    markdown: `# Osman Bey Dönemi

Osmanlı Beyliği, Kayı boyuna bağlı bir aşiret olarak Söğüt ve Domaniç çevresinde, Bizans sınırında kuruldu. Beyliğin sınırda olması, gaza anlayışıyla Bizans topraklarına doğru genişlemesini kolaylaştırdı.

Osman Bey döneminde Bizans ile yapılan ilk önemli savaş Koyunhisar Savaşı'dır. Bu savaşı Osmanlılar kazandı ve beyliğin bölgedeki gücü arttı. Osman Bey'in son yıllarında Bursa kuşatıldı; şehir onun ölümünden sonra, oğlu Orhan Bey zamanında alındı.

# Orhan Bey Dönemi

Orhan Bey, bin üç yüz yirmi altıda Bursa'yı aldı ve burayı başkent yaptı. Bin üç yüz yirmi dokuzda yapılan Maltepe Savaşı, Osmanlıların Bizans ile yaptığı ilk meydan savaşıdır.

Bu zaferin ardından İznik bin üç yüz otuz birde, İzmit ise bin üç yüz otuz yedide alındı. İlk Osmanlı medresesi İznik'te açıldı. Karesi Beyliği'nin topraklarının alınmasıyla Osmanlılar ilk kez bir Türk beyliğinin topraklarını kendine kattı ve donanma gücü kazandı.

Orhan Bey döneminde yaya ve müsellem adıyla ilk düzenli ordu kuruldu, ilk Osmanlı gümüş parası olan akçe basıldı. Rumeli'deki ilk toprak olan Çimpe Kalesi de bu dönemde alındı.

# I. Murat Dönemi

I. Murat döneminde Edirne alındı ve başkent oldu. Balkanlarda Sırpsındığı ve Çirmen savaşları kazanıldı. Bin üç yüz seksen dokuzdaki I. Kosova Savaşı da Osmanlılar tarafından kazanıldı; I. Murat savaştan sonra şehit edildi.

Bu dönemde pençik sistemiyle Yeniçeri Ocağı kuruldu ve Kapıkulu ordusunun temeli atıldı. Devlet işlerinin görüşüldüğü Divan-ı Hümayun da bu dönemde teşkilatlandı.
`,
  },
  {
    slug: "islamiyet-oncesi-turk-tarihi",
    title: "İslamiyet Öncesi Türk Tarihi",
    description:
      "Asya Hun Devleti, Kök Türkler ve Uygurlar: devlet teşkilatı, yazılı belgeler ve ilkler.",
    source: "ORIGINAL",
    credit: "Dinlet editörleri",
    categorySlugs: ["kpss", "kpss-tarih", "yks"],
    productId: "dinlet_store_islamiyet_oncesi",
    priceTry: "79.99",
    position: 2,
    pageCount: 4,
    markdown: `# Asya Hun Devleti

Asya Hun Devleti, bilinen ilk Türk devletidir. Devletin en parlak dönemi Mete Han zamanıdır. Mete Han, orduyu onluk sisteme göre düzenledi; bu sistem daha sonra pek çok Türk devletinde ve başka ordularda da kullanıldı.

Çinliler, Hun akınlarına karşı korunmak için Çin Seddi'ni inşa etti. Hunlar ile Çin arasındaki ilişkiler savaşlar ve ticaret üzerine kuruluydu.

# Kök Türkler

Kök Türk Devleti, beş yüz elli ikide Bumin Kağan tarafından kuruldu. "Türk" adını devlet adı olarak kullanan ilk Türk devletidir. Batıda İstemi Yabgu, Sasanilerle işbirliği yaparak Akhunları yıktı.

İkinci Kök Türk Devleti döneminde dikilen Orhun Yazıtları, Türk adının geçtiği ilk Türkçe yazılı belgelerdir. Tonyukuk, Kül Tigin ve Bilge Kağan adına dikilen bu yazıtlar devletin tarihini, yönetim anlayışını ve halka verilen öğütleri anlatır.

# Uygurlar

Uygur Devleti yedi yüz kırk dörtte kuruldu. Uygurlar yerleşik hayata geçen ilk Türk devletidir. Bögü Kağan döneminde Mani dinini kabul ettiler; bu da hayvancılığı ve savaşçı yaşamı geri plana iterek yerleşik kültürü güçlendirdi.

Uygurlar kendilerine özgü bir alfabe kullandı, kütüphaneler kurdu ve kâğıt ile matbaayı kullandı. Devlet sekiz yüz kırkta Kırgızlar tarafından yıkıldı.
`,
  },
  {
    slug: "turkiyenin-iklimi",
    title: "Türkiye'nin İklimi",
    description:
      "İklimi etkileyen etkenler ve Türkiye'de görülen iklim tipleri, bitki örtüleriyle birlikte.",
    source: "ORIGINAL",
    credit: "Dinlet editörleri",
    categorySlugs: ["kpss", "kpss-cografya", "yks"],
    isFeatured: true,
    position: 3,
    pageCount: 3,
    markdown: `# İklimi Etkileyen Etkenler

Türkiye, otuz altı ile kırk iki kuzey paralelleri ve yirmi altı ile kırk beş doğu meridyenleri arasında yer alır. Orta kuşakta bulunduğu için dört mevsim belirgin olarak yaşanır.

Yer şekilleri iklimi güçlü biçimde etkiler. Kuzeyde ve güneyde dağların kıyıya paralel uzanması, deniz etkisinin iç bölgelere girmesini zorlaştırır. Yükselti genel olarak batıdan doğuya doğru artar; bu yüzden aynı enlemde doğudaki yerler daha soğuktur.

# İklim Tipleri

Akdeniz ikliminde yazlar sıcak ve kurak, kışlar ılık ve yağışlıdır. Bu iklimin doğal bitki örtüsü makidir.

Karadeniz ikliminde her mevsim yağışlıdır. Türkiye'de en fazla yağış Doğu Karadeniz kıyılarında, özellikle Rize çevresinde görülür. Doğal bitki örtüsü ormandır.

Karasal iklimde yazlar sıcak ve kurak, kışlar soğuk ve kar yağışlıdır. Doğal bitki örtüsü bozkırdır. İç Anadolu, özellikle Tuz Gölü çevresi, Türkiye'nin en az yağış alan yerlerindendir.

Marmara Bölgesi'nde Akdeniz, Karadeniz ve karasal iklim arasında bir geçiş iklimi görülür. Bu nedenle bitki örtüsü yer yer maki, orman ve bozkırdan oluşur.
`,
  },
  {
    slug: "ataturk-ilkeleri",
    title: "Atatürk İlkeleri",
    description:
      "Altı ilkenin anlamı ve her ilkeyle ilgili inkılaplar; tarih ve vatandaşlık sorularında sık karşılaşılan eşleştirmeler.",
    source: "ORIGINAL",
    credit: "Dinlet editörleri",
    categorySlugs: ["kpss", "kpss-tarih"],
    position: 4,
    pageCount: 4,
    markdown: `# Cumhuriyetçilik ve Milliyetçilik

Atatürk ilkeleri cumhuriyetçilik, milliyetçilik, halkçılık, devletçilik, laiklik ve inkılapçılıktır. Bu altı ilke bin dokuz yüz otuz yedide Anayasaya girdi.

Cumhuriyetçilik, millî egemenliğe dayanan yönetim anlayışıdır. Yirmi dokuz Ekim bin dokuz yüz yirmi üçte Cumhuriyetin ilanı bu ilkenin en önemli adımıdır. Milliyetçilik ise ortak tarih, dil ve kültür bilinciyle millî birliği esas alır.

# Halkçılık ve Devletçilik

Halkçılık, hiçbir kişiye, aileye veya sınıfa ayrıcalık tanınmamasını ve herkesin kanun önünde eşit olmasını ifade eder. Bin dokuz yüz yirmi beşte aşar vergisinin kaldırılması bu ilkeyle ilişkilendirilir.

Devletçilik, özel girişimin yetersiz kaldığı alanlarda devletin ekonomiye doğrudan katılmasıdır. Bin dokuz yüz otuz dörtte uygulamaya konan Birinci Beş Yıllık Sanayi Planı devletçiliğin örneğidir.

# Laiklik ve İnkılapçılık

Laiklik, din ve devlet işlerinin birbirinden ayrılmasıdır. Üç Mart bin dokuz yüz yirmi dörtte halifelik kaldırıldı ve aynı gün Tevhid-i Tedrisat Kanunu ile eğitim birleştirildi. Bin dokuz yüz yirmi altıda kabul edilen Türk Medeni Kanunu da laik hukukun temelini oluşturdu.

İnkılapçılık, yapılan inkılapların korunmasını ve çağın gereklerine göre geliştirilmesini amaçlar. Diğer ilkelerin kalıcı olmasını sağlayan ilke olarak görülür.
`,
  },
  {
    slug: "uluslararasi-kuruluslar",
    title: "Uluslararası Kuruluşlar",
    description:
      "Birleşmiş Milletler, NATO, Avrupa Konseyi, Türk Devletleri Teşkilatı ve İslam İşbirliği Teşkilatı: kuruluş yılları, merkezleri, Türkiye'nin üyeliği.",
    source: "ORIGINAL",
    credit: "Dinlet editörleri",
    categorySlugs: ["kpss", "kpss-guncel"],
    productId: "dinlet_store_uluslararasi_kuruluslar",
    priceTry: "49.99",
    position: 5,
    pageCount: 3,
    markdown: `# Birleşmiş Milletler

Birleşmiş Milletler bin dokuz yüz kırk beşte kuruldu ve merkezi New York'tadır. Türkiye, Birleşmiş Milletler'in kurucu üyelerindendir.

Güvenlik Konseyi'nin beş daimi üyesi vardır: Amerika Birleşik Devletleri, Rusya, Çin, Birleşik Krallık ve Fransa. Daimi üyelerin veto hakkı bulunur. Konseyin ayrıca iki yıllığına seçilen on geçici üyesi vardır.

# NATO ve Avrupa Konseyi

Kuzey Atlantik Antlaşması Örgütü, yani NATO, bin dokuz yüz kırk dokuzda kuruldu; merkezi Brüksel'dedir. Türkiye NATO'ya bin dokuz yüz elli ikide üye oldu.

Avrupa Konseyi de bin dokuz yüz kırk dokuzda kuruldu ve merkezi Strazburg'dadır. Türkiye aynı yıl konseye katıldı. Avrupa İnsan Hakları Mahkemesi de Strazburg'dadır.

# Türk Devletleri Teşkilatı ve İslam İşbirliği Teşkilatı

Türk Devletleri Teşkilatı, iki bin dokuzda imzalanan Nahçıvan Anlaşması ile Türk Konseyi adıyla kuruldu. İki bin yirmi birdeki İstanbul Zirvesi'nde adı Türk Devletleri Teşkilatı oldu. Sekretaryası İstanbul'dadır.

İslam İşbirliği Teşkilatı bin dokuz yüz altmış dokuzda Rabat'ta kuruldu. Merkezi Suudi Arabistan'ın Cidde şehrindedir.
`,
  },
];

const DEMO_BUNDLE = {
  slug: "kpss-tarih-paketi",
  title: "KPSS Tarih Paketi",
  description: "Osmanlı Kuruluş Dönemi ve İslamiyet Öncesi Türk Tarihi bir arada; tek tek almaktan uygun.",
  categorySlug: "kpss-tarih",
  productId: "dinlet_store_bundle_kpss_tarih",
  priceTry: "129.99",
  itemSlugs: ["osmanli-kurulus-donemi", "islamiyet-oncesi-turk-tarihi"],
};

export async function seedStoreDemo(): Promise<void> {
  const env = process.env.NODE_ENV;
  if (env === "production" || env === "test") return;
  console.log("🛍️  Örnek mağaza içerikleri yükleniyor...");

  const role = await db.orm.public.Role.where({ code: "SUPER_ADMIN" }).select("id").first();
  const editor = role
    ? await db.orm.public.User.where({ roleId: role.id })
        .select("id")
        .orderBy((user) => user.id.asc())
        .first()
    : null;
  if (!editor) {
    console.warn("   ⚠️  Süper yönetici yok; örnek mağaza içerikleri atlandı");
    return;
  }

  const categories = await db.orm.public.StoreCategory.select("id", "slug").all();
  const categoryId = new Map(categories.map((category) => [category.slug, category.id]));

  const s3 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    },
  });
  const queue = new Queue(QueueName.DOCUMENT_PROCESS, {
    connection: {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
      password: process.env.REDIS_PASSWORD || undefined,
    },
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });

  let created = 0;
  try {
    for (const item of DEMO_ITEMS) {
      if (await db.orm.public.StoreItem.where({ slug: item.slug }).select("id").first()) {
        continue;
      }
      const extractedKey = `extracted/seed-${item.slug}-${nanoid(8)}.md`;
      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: extractedKey,
          Body: item.markdown,
          ContentType: "text/markdown",
        }),
      );

      const document = await db.orm.public.Document.select("id").create({
        userId: editor.id,
        mediaId: null,
        title: item.title,
        status: "SCRIPTING",
        pageCount: item.pageCount,
        sourceHash: `seed:${item.slug}`,
        storagePrefix: nanoid(16),
        rewriteMode: "RAW",
        extractedKey,
        extractQuality: "OK",
      });
      const storeItem = await db.orm.public.StoreItem.select("id").create({
        slug: item.slug,
        title: item.title,
        description: item.description,
        source: item.source,
        credit: item.credit,
        documentId: document.id,
        productId: item.productId ?? null,
        priceTry: item.priceTry ?? null,
        sampleSections: 1,
        isFeatured: item.isFeatured ?? false,
        isPublished: true,
        position: item.position,
        publishedAt: new Date().toISOString(),
      });
      const links = item.categorySlugs.flatMap((slug) => {
        const id = categoryId.get(slug);
        return id ? [{ storeItemId: storeItem.id, categoryId: id }] : [];
      });
      if (links.length > 0) await db.orm.public.StoreItemCategory.createAll(links);

      // Bölümleme + seslendirme normal akıştan (API ve worker açıkken).
      await queue.add("process", { documentId: document.id }, {
        jobId: `doc-${document.id}`,
        priority: 10,
      });
      created++;
    }

    const bundleExists = await db.orm.public.StoreBundle.where({ slug: DEMO_BUNDLE.slug })
      .select("id")
      .first();
    if (!bundleExists) {
      const items = await db.orm.public.StoreItem.where((row) =>
        row.slug.in(DEMO_BUNDLE.itemSlugs),
      )
        .select("id")
        .all();
      if (items.length === DEMO_BUNDLE.itemSlugs.length) {
        const bundle = await db.orm.public.StoreBundle.select("id").create({
          slug: DEMO_BUNDLE.slug,
          title: DEMO_BUNDLE.title,
          description: DEMO_BUNDLE.description,
          categoryId: categoryId.get(DEMO_BUNDLE.categorySlug) ?? null,
          productId: DEMO_BUNDLE.productId,
          priceTry: DEMO_BUNDLE.priceTry,
          isPublished: true,
          position: 0,
        });
        await db.orm.public.StoreBundleItem.createAll(
          items.map((row) => ({ bundleId: bundle.id, storeItemId: row.id })),
        );
      }
    }
  } catch (error) {
    // Örnek veri seed'i durdurmaz (ör. LocalStack veya Redis kapalı).
    console.warn(
      `   ⚠️  Örnek mağaza içerikleri eksik kaldı: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await queue.close();
    s3.destroy();
  }

  console.log(
    created > 0
      ? `✅ ${created} örnek mağaza içeriği eklendi; sesleri worker hazırlıyor`
      : "✅ Örnek mağaza içerikleri zaten var",
  );
}
