/**
 * Storage key (R2/S3) → CDN URL dönüşümü için tek bir merkez.
 *
 * Bootstrap'ta `MediaUrl.configure(env.R2_CDN_BASE_URL)` ile init edilir;
 * sonrasında servis/handler/decorator nereden çağırırsa çağırsın aynı
 * base URL üzerinden çalışır. Inline string concat veya servise gömülü
 * helper yazmak yerine her zaman buradan kullan.
 *
 * Tür sınıflandırması (image/video) **hem dosya uzantısı hem mimeType**
 * üzerinden yapılır — biri yanlış kaydedilmiş olsa bile diğeri kurtarır.
 * Geçmiş bir bug yüzünden `.MOV` dosyalarının DB'de `image/jpeg` mime ile
 * kaydedildiği durumlar olmuştu; bu yüzden tek başına mime güvenilir değil.
 */

export type MediaFilter = 'all' | 'image' | 'video';

const IMAGE_EXTS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'heic',
  'heif',
  'avif',
  'bmp',
  'svg',
]);

const VIDEO_EXTS = new Set([
  'mp4',
  'mov',
  'm4v',
  'webm',
  'mkv',
  'avi',
  'mpeg',
  'mpg',
  '3gp',
  'qt',
]);

interface MediaLike {
  storageKey: string | null | undefined;
  mimeType?: string | null;
  fileName?: string | null;
}

function extOf(name: string | null | undefined): string {
  if (!name) return '';
  const clean = name.split('?')[0];
  const dot = clean.lastIndexOf('.');
  if (dot < 0 || dot === clean.length - 1) return '';
  return clean.slice(dot + 1).toLowerCase();
}

export type MediaKind = 'image' | 'video' | 'other';

export function classifyMedia(item: MediaLike): MediaKind {
  const ext = extOf(item.storageKey) || extOf(item.fileName);
  const mime = (item.mimeType ?? '').toLowerCase();

  if (IMAGE_EXTS.has(ext)) return 'image';
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'other';
}

export class MediaUrl {
  private static base = '';

  static configure(cdnBaseUrl: string) {
    if (!cdnBaseUrl) {
      throw new Error('MediaUrl.configure: cdnBaseUrl boş olamaz.');
    }
    this.base = cdnBaseUrl.replace(/\/+$/, '');
  }

  static toUrl(storageKey: string | null | undefined): string | null {
    if (!storageKey) return null;
    if (!this.base) {
      throw new Error(
        'MediaUrl kullanılmadan önce MediaUrl.configure() çağrılmalı.',
      );
    }
    return `${this.base}/${String(storageKey).replace(/^\/+/, '')}`;
  }

  static toUrls(items: MediaLike[], filter: MediaFilter = 'all'): string[] {
    return items
      .filter((m) => {
        if (filter === 'all') return true;
        return classifyMedia(m) === filter;
      })
      .map((m) => this.toUrl(m.storageKey))
      .filter((u): u is string => !!u);
  }

  static toItems(
    items: MediaLike[],
    filter: MediaFilter = 'all',
  ): Array<{ url: string; type: MediaKind; mimeType: string }> {
    const out: Array<{ url: string; type: MediaKind; mimeType: string }> = [];
    for (const m of items) {
      const type = classifyMedia(m);
      if (filter !== 'all' && type !== filter) continue;
      const url = this.toUrl(m.storageKey);
      if (!url) continue;
      out.push({ url, type, mimeType: m.mimeType ?? '' });
    }
    return out;
  }
}
