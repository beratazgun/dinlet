import { Injectable } from "@nestjs/common";
import {
  formatDistanceToNow as dateFnsFormatDistanceToNow,
  differenceInHours,
  differenceInMilliseconds,
  differenceInMinutes,
  format,
  isAfter,
  isBefore,
  parse,
  set,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { tr } from "date-fns/locale";

export type DateFormatType =
  | "dd.MM.yyyy"
  | "dd.MM.yyyy HH:mm"
  | "dd MMMM yyyy"
  | "dd MMMM yyyy HH:mm:ss"
  | "dd MMMM yyyy HH:mm"
  | "yyyy-MM-dd"
  | "yyyy-MM"
  | "HH:mm:ss"
  | "h 'saat' m 'dakika' s 'saniye'"
  | "h 'saat' m 'dakika' önce"
  | "h 'saat' önce"
  | "d MMM"
  | "MMMM"
  | "EEEE"
  | "d MMMM yyyy"
  | "d MMMM"
  | "d"
  | "MMM"
  | "MMMM yyyy"
  | "MMM yyyy"
  | "yyyy-MM-dd HH:mm:ss"
  | "dd"
  | "dd MMMM yyyy EEEE HH:mm:ss"
  | "d MMMM, HH:mm"
  | "d MMMM yyyy EEEE";

export type TimeDifferenceUnit = "milliseconds" | "minutes" | "hours" | "auto";

@Injectable()
export class DateManager {
  protected locale = tr;
  protected timeZone = "Europe/Istanbul";

  getLocale(): typeof tr {
    return this.locale;
  }

  /**
   * Belirli bir tarih/tarih stringini Türkiye saat dilimine dönüştürür
   */
  toTurkeyTime<T extends Date | string>(
    date: T,
    formatStr?: DateFormatType,
  ): Date | string {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const zonedDate = toZonedTime(dateObj, this.timeZone);

    if (formatStr) {
      return this.getFormattedDate(zonedDate, formatStr);
    }

    return zonedDate;
  }

  /**
   * Aylık dönem anahtarı (`2026-10`), Türkiye saat dilimine göre. Ay
   * sınırındaki gece yarısı İstanbul'a göre hesaplanır (kota dönemleri).
   */
  periodKey(date: Date = this.utcNow()): string {
    return this.toTurkeyTime(date, "yyyy-MM") as string;
  }

  /** Türkiye takvimine göre gün (`2026-10-09`); sınav günü gibi saatsiz tarihler için. */
  calendarDay(date: Date = this.utcNow()): string {
    return this.toTurkeyTime(date, "yyyy-MM-dd") as string;
  }

  /**
   * Bir sonraki kota döneminin başladığı an (İstanbul'a göre ayın 1'i,
   * 00:00), UTC `Date` olarak. "Hakkın 1 Kasım'da yenilenir" için.
   */
  nextPeriodStart(date: Date = this.utcNow()): Date {
    const [year, month] = this.periodKey(date).split("-").map(Number) as [
      number,
      number,
    ];
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    return fromZonedTime(
      `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00`,
      this.timeZone,
    );
  }

  /**
   * Şu anki zamanı Türkiye saat diliminde döndürür
   */
  now(): Date {
    return this.toTurkeyTime(new Date()) as Date;
  }

  /** Veritabanı ve token süreleri için mevcut UTC anını döndürür. */
  utcNow(): Date {
    return new Date();
  }

  /** Tarihe milisaniye ekler; giriş verilmezse mevcut UTC anını kullanır. */
  addMilliseconds(milliseconds: number, date: Date = this.utcNow()): Date {
    return new Date(date.getTime() + milliseconds);
  }

  /** Tarihi saniye kaybı olmadan ISO 8601 stringine dönüştürür. */
  toISOString(date: Date = this.utcNow()): string {
    return date.toISOString();
  }

  /** ISO string veya Date değerinin belirtilen ana göre süresinin dolup dolmadığını döndürür. */
  isExpired(date: Date | string, reference: Date = this.utcNow()): boolean {
    const value = typeof date === "string" ? new Date(date) : date;
    return (
      Number.isNaN(value.getTime()) || value.getTime() < reference.getTime()
    );
  }

  /**
   * `date`, `reference`'tan kesin olarak sonra mı? Biçimden bağımsızdır
   * (ISO veya Postgres `timestamptz` metni); metin karşılaştırması yapmaz.
   */
  isAfter(date: Date | string, reference: Date | string): boolean {
    const toMs = (value: Date | string) =>
      (typeof value === "string" ? new Date(value) : value).getTime();
    return toMs(date) > toMs(reference);
  }

  /** Bir tarihten mevcut UTC ana kadar geçen milisaniyeyi döndürür. */
  millisecondsSince(date: Date | string): number {
    const value = typeof date === "string" ? new Date(date) : date;
    return this.utcNow().getTime() - value.getTime();
  }

  /**
   * String'i tarihe çevirir
   * @param dateStr Tarih stringi
   * @param formatStr Format stringi
   */
  parseStringToDate(dateStr: string, formatStr: DateFormatType): Date {
    return parse(dateStr, formatStr, this.now(), { locale: this.locale });
  }

  /**
   * Tarihi verilen formata göre döndürür
   * @param type Format tipi
   * @param date Formatlanacak tarih (default: şu anki tarih)
   */
  getFormattedDate(
    date: Date | string = this.now(),
    type: DateFormatType = "dd MMMM yyyy EEEE HH:mm:ss",
  ): string {
    return format(date, type, { locale: this.locale });
  }

  /**
   * Bugün için belirtilen saati ayarlar
   * @param time HH:mm:ss formatında saat stringi
   */
  setTimeToToday(time: string): Date {
    const [hours, minutes, seconds] = time.split(":").map(Number);
    return set(this.now(), {
      hours,
      minutes,
      seconds,
      milliseconds: 0,
    });
  }

  /**
   * Şu anki saat ve tarih, belirtilen aralıkta mı?
   */
  isCurrentTimeBetween(startTime: Date, endTime: Date): boolean {
    const now = this.now();
    const start = this.setDateToToday(startTime);
    const end = this.setDateToToday(endTime);
    return isAfter(now, start) && isBefore(now, end);
  }

  /**
   * Gönderilen tarihin tarih kısmını bugüne ayarlar
   */
  setDateToToday(date: Date): Date {
    const today = this.now();
    return set(date, {
      year: today.getFullYear(),
      month: today.getMonth(),
      date: today.getDate(),
    });
  }

  /**
   * Verilen tarihi ISO 8601 formatına çevirir
   */
  formatDateForISO8601(date: Date = new Date()): string {
    const cleanedDate = set(date, { seconds: 0, milliseconds: 0 });
    return cleanedDate.toISOString();
  }

  /**
   * İki tarih arasındaki zamanı "X zaman önce" formatında verir.
   * @param startDate Başlangıç tarihi
   * @param endDate Bitiş tarihi (varsayılan: şu anki zaman)
   * @param unit Dönüş birimi ('milliseconds', 'minutes', 'hours', 'auto')
   * @param formatted Metin olarak biçimlendirilmiş sonuç isteniyorsa true, değilse false
   * @returns "X zaman önce" formatında biçimlendirilmiş zaman farkı veya sayısal değer
   */
  getTimeBetween(
    startDate: Date,
    endDate: Date = new Date(),
    unit: TimeDifferenceUnit = "auto",
    formatted: boolean = true,
  ): string | number {
    // Tarihler arasındaki farkları hesapla
    const diffMs = differenceInMilliseconds(endDate, startDate);

    // Negatif değer kontrolü (gelecekteki tarih için)
    const isInFuture = diffMs < 0;
    const absoluteDiffMs = Math.abs(diffMs);

    if (unit === "milliseconds") {
      return formatted
        ? `${absoluteDiffMs} milisaniye${isInFuture ? " sonra" : " önce"}`
        : diffMs;
    }

    const diffMinutes = Math.abs(differenceInMinutes(endDate, startDate));

    if (unit === "minutes") {
      return formatted
        ? `${diffMinutes} dakika${isInFuture ? " sonra" : " önce"}`
        : differenceInMinutes(endDate, startDate);
    }

    const diffHours = Math.abs(differenceInHours(endDate, startDate));

    if (unit === "hours") {
      return formatted
        ? `${diffHours} saat${isInFuture ? " sonra" : " önce"}`
        : differenceInHours(endDate, startDate);
    }

    // Otomatik biçimlendirme için
    if (unit === "auto") {
      const days = Math.floor(absoluteDiffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (absoluteDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      const minutes = Math.floor(
        (absoluteDiffMs % (1000 * 60 * 60)) / (1000 * 60),
      );
      const seconds = Math.floor((absoluteDiffMs % (1000 * 60)) / 1000);

      let result = "";

      // En büyük zaman birimini seç ve sadece onu göster
      if (days > 0) {
        result = `${days} gün`;
      } else if (hours > 0) {
        result = `${hours} saat`;
      } else if (minutes > 0) {
        result = `${minutes} dakika`;
      } else {
        result = `${seconds} saniye`;
      }

      // Eğer hiçbir zaman birimi yoksa
      if (result === "0 saniye") {
        result = "şimdi";
        return result;
      }

      // "önce" veya "sonra" ekle
      result += isInFuture ? " sonra" : " önce";

      return result;
    }

    return diffMs;
  }

  milisecondsToTimeString(
    milliseconds: number,
    formatted: boolean = true,
  ): string | number {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    const remainingSeconds = seconds % 60;
    const remainingMinutes = minutes % 60;

    if (formatted) {
      return `${hours} saat ${remainingMinutes} dakika ${remainingSeconds} saniye`;
    }

    return hours * 3600 + remainingMinutes * 60 + remainingSeconds;
  }

  formatDistanceToNow(date: Date | string): string {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return dateFnsFormatDistanceToNow(dateObj, {
      addSuffix: true,
      locale: this.locale,
    });
  }
}
