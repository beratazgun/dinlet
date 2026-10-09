import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvType } from "#config/env.validation.js";
import { OkResponse } from "#/core/http/index.js";
import {
  LEGAL_DOCUMENT_CONSENT,
  LEGAL_DOCUMENTS,
  type LegalController,
  type LegalDocumentSlug,
} from "#/modules/auth/legal/legal-documents.js";
import { CONSENT_VERSIONS } from "#/modules/auth/utils/consents.js";

/**
 * Aydınlatma metni, kullanım koşulları ve açık rıza metni. Sürüm, onay
 * defterine yazılan sürümle aynı kaynaktan (`CONSENT_VERSIONS`) gelir;
 * kullanıcının gördüğü metin onayladığı metindir.
 */
@Injectable()
export class LegalService {
  constructor(private readonly configService: ConfigService<EnvType>) {}

  getDocument(document: LegalDocumentSlug): OkResponse {
    const content = LEGAL_DOCUMENTS[document](this.controller());
    return new OkResponse(content.title, {
      document,
      version: CONSENT_VERSIONS[LEGAL_DOCUMENT_CONSENT[document]],
      ...content,
    });
  }

  private controller(): LegalController {
    const get = (
      key:
        | "LEGAL_CONTROLLER_NAME"
        | "LEGAL_CONTROLLER_ADDRESS"
        | "LEGAL_CONTACT_EMAIL",
    ) => this.configService.get(key, { infer: true });
    return {
      name: get("LEGAL_CONTROLLER_NAME") ?? "[Veri sorumlusunun unvanı]",
      address: get("LEGAL_CONTROLLER_ADDRESS") ?? "[Veri sorumlusunun adresi]",
      email: get("LEGAL_CONTACT_EMAIL") ?? "[KVKK başvuru e-postası]",
    };
  }
}
