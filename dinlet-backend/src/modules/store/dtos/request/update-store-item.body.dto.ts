import { OmitType, PartialType } from "@nestjs/swagger";

import { CreateStoreItemBodyDto } from "./create-store-item.body.dto.js";

/**
 * İçeriği günceller. Kaynak not değiştirilemez: sahiplerin kopyaları o
 * notun ses dosyalarını kullanır.
 */
export class UpdateStoreItemBodyDto extends PartialType(
  OmitType(CreateStoreItemBodyDto, ["documentId"] as const),
) {}
