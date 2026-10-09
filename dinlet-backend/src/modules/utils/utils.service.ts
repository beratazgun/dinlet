import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvType } from "#config/env.validation.js";
import { OkResponse } from "#/core/http/index.js";
import { EnumTranslations } from "#/core/utils/enum-translations.js";
import { EmailQueueService } from "#/infra/queue/index.js";
import { NOTIFICATION_TEMPLATES_BY_CODE } from "#/infra/notifications/constants/notification-templates.constant.js";
import { UtilsRepository } from "#/modules/utils/utils.repository.js";
import type { GetEnumOptionsQueryDto, SendTestEmailBodyDto } from "#/modules/utils/dtos/request/index.js";
import type { EnumOptionResDto } from "#/modules/utils/dtos/response/enum-option.res.dto.js";

@Injectable()
export class UtilsService {
  constructor(
    private readonly utilsRepository: UtilsRepository,
    private readonly emailQueue: EmailQueueService,
    private readonly configService: ConfigService<EnvType>,
  ) {}

  getEnumOptions(query: GetEnumOptionsQueryDto): OkResponse {
    const translationsMap = EnumTranslations.translations;
    const translation = translationsMap[query.type];

    if (!translation) {
      throw new BadRequestException(
        `Geçersiz enum tipi: ${query.type}. Mevcut tipler: ${Object.keys(
          translationsMap,
        ).join(", ")}`,
      );
    }

    const options: EnumOptionResDto[] = Object.entries(translation).map(
      ([value, label]) => ({ value, label }),
    );

    return new OkResponse("Enum seçenekleri başarıyla getirildi", options);
  }

  async sendTestEmail(body: SendTestEmailBodyDto): Promise<OkResponse> {
    const templateDef = NOTIFICATION_TEMPLATES_BY_CODE.get(body.code);
    if (!templateDef) {
      throw new BadRequestException(
        `Geçersiz şablon kodu: ${body.code}. Desteklenen şablonlar: ${Array.from(
          NOTIFICATION_TEMPLATES_BY_CODE.keys(),
        ).join(", ")}`,
      );
    }

    const defaultDevEmail =
      this.configService.get("RESEND_MAIL_FOR_DEV_ENV", { infer: true }) ||
      this.configService.get("ALERT_EMAIL", { infer: true }) ||
      "delivered@resend.dev";

    const to = body.to || defaultDevEmail;
    const variables = {
      ...templateDef.sampleVariables,
      ...body.variables,
    };

    await this.emailQueue.enqueueEmail({
      to,
      code: body.code,
      variables,
    });

    return new OkResponse(`"${body.code}" şablonu ${to} adresine kuyruğa eklendi.`, {
      code: body.code,
      to,
      variables,
    });
  }
}
