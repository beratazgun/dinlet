import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import { StoreCategoryTreeResDto } from "./store-category.res.dto.js";
import { StoreItemResDto } from "./store-item.res.dto.js";

/** Mağaza ana ekranı: sınav çipleri ve öne çıkan içerikler. */
export class StoreHomeResDto {
  @ApiProperty({
    type: () => [StoreCategoryTreeResDto],
    description: "Sınavlar ve dersleri",
  })
  @Expose()
  @Type(() => StoreCategoryTreeResDto)
  categories!: StoreCategoryTreeResDto[];

  @ApiProperty({
    type: () => [StoreItemResDto],
    description: "Öne çıkanlar (en fazla 5)",
  })
  @Expose()
  @Type(() => StoreItemResDto)
  featured!: StoreItemResDto[];
}
