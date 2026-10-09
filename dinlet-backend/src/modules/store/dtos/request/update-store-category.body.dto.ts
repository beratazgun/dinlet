import { PartialType } from "@nestjs/swagger";

import { CreateStoreCategoryBodyDto } from "./create-store-category.body.dto.js";

export class UpdateStoreCategoryBodyDto extends PartialType(
  CreateStoreCategoryBodyDto,
) {}
