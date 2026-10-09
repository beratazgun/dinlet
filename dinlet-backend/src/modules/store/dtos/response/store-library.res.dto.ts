import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

/** Kütüphaneye eklenen içerik ve açılan not. */
export class StoreLibraryEntryResDto {
  @ApiProperty({ type: Number, example: 1 })
  @Expose()
  storeItemId!: number;

  @ApiProperty({ type: Number, example: 120, description: "Kütüphanedeki not" })
  @Expose()
  documentId!: number;

  @ApiProperty({
    type: Boolean,
    description: "Bu istekte eklendi (önceden yoksa)",
  })
  @Expose()
  isNew!: boolean;
}

export class StoreLibraryResDto {
  @ApiProperty({ type: () => [StoreLibraryEntryResDto] })
  @Expose()
  @Type(() => StoreLibraryEntryResDto)
  entries!: StoreLibraryEntryResDto[];
}

/** Satın almaları geri yükleme / doğrulama sonucu. */
export class StorePurchaseSyncResDto {
  @ApiProperty({
    type: [Number],
    description: "Bu istekte sahip olunan içerikler",
  })
  @Expose()
  grantedItemIds!: number[];

  @ApiProperty({ type: [Number], description: "Sahip olunan tüm içerikler" })
  @Expose()
  ownedItemIds!: number[];
}
