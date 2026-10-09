import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import {
  MoneyTransformer,
  MoneyTransformerValueDto,
} from "#/core/decorators/index.js";

import { StoreItemResDto } from "./store-item.res.dto.js";

/** Paket kartı: "KPSS Tarih, tamamı · 5 içerik · 44 bölüm". */
export class StoreBundleResDto {
  @ApiProperty({ type: Number, example: 1 })
  @Expose()
  id!: number;

  @ApiProperty({ type: String, example: "kpss-tarih-tamami" })
  @Expose()
  slug!: string;

  @ApiProperty({ type: String, example: "KPSS Tarih, tamamı" })
  @Expose()
  title!: string;

  @ApiProperty({ type: String })
  @Expose()
  description!: string;

  @ApiProperty({ type: Number, nullable: true })
  @Expose()
  categoryId!: number | null;

  @ApiProperty({ type: String, example: "dinlet_store_bundle_kpss_tarih" })
  @Expose()
  productId!: string;

  @Expose()
  @MoneyTransformer({ skipNullish: true })
  price!: MoneyTransformerValueDto | null;

  @ApiProperty({ type: Number, example: 5 })
  @Expose()
  itemCount!: number;

  @ApiProperty({ type: Number, example: 44 })
  @Expose()
  sectionCount!: number;

  @ApiProperty({
    type: Number,
    description: "Paketteki içeriklerden sahip olunanlar",
  })
  @Expose()
  ownedItemCount!: number;

  @ApiProperty({ type: Boolean, description: "Paketteki tüm içeriklere sahip" })
  @Expose()
  isOwned!: boolean;
}

export class StoreBundleDetailResDto extends StoreBundleResDto {
  @ApiProperty({ type: () => [StoreItemResDto] })
  @Expose()
  @Type(() => StoreItemResDto)
  items!: StoreItemResDto[];
}
