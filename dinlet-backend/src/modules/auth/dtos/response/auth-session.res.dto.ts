import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose } from "class-transformer";
import {
  DateTransformer,
  DateTransformerValueDto,
} from "#/core/decorators/index.js";

/**
 * Giriş yanıtı. Tarayıcıda oturum kimliği yalnızca imzalı `httpOnly` cookie
 * ile taşınır ve gövdede dönmez. Mobilde (`X-Client: mobile`) aynı kimlik
 * `accessToken` olarak döner ve `Authorization: Bearer` ile gönderilir.
 */
export class AuthSessionResDto {
  @ApiProperty({
    description: "Oturumun saniye cinsinden ömrü",
    example: 604_800,
  })
  @Expose()
  expiresIn!: number;

  @ApiProperty({ type: DateTransformerValueDto })
  @Expose()
  @DateTransformer({ format: "dd MMMM yyyy HH:mm", withRawAndDisplay: true })
  expiresAt!: DateTransformerValueDto<string>;

  @ApiPropertyOptional({
    type: String,
    description:
      "Yalnızca `X-Client: mobile` girişlerinde döner. İmzalı oturum kimliğidir (JWT değil); güvenli depoda saklanır.",
  })
  @Expose()
  accessToken?: string;
}
