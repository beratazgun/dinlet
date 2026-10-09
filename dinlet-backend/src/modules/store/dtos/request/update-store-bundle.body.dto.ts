import { PartialType } from "@nestjs/swagger";

import { CreateStoreBundleBodyDto } from "./create-store-bundle.body.dto.js";

export class UpdateStoreBundleBodyDto extends PartialType(
  CreateStoreBundleBodyDto,
) {}
