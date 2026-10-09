/**
 * Veri dönmeyen (yalnızca `message` içeren) uçların serializer'ı.
 *
 * `@Serialize(EmptyResDto)` ile bağlanır; `data` yanlışlıkla doldurulsa bile
 * hiçbir alan dışarı sızmaz (`excludeExtraneousValues`).
 */
export class EmptyResDto {}
