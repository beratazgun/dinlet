import { type Type, UseInterceptors } from "@nestjs/common";

import { SerializeInterceptor } from "#/core/interceptors/index.js";

export function Serialize(dto: Type<unknown>) {
  return UseInterceptors(new SerializeInterceptor(dto));
}
