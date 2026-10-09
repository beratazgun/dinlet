import { Injectable, UnprocessableEntityException } from "@nestjs/common";

import { OkResponse } from "#/core/http/index.js";
import { RecordingRepository } from "#/modules/recording/repository/index.js";
import { VoicePreference } from "#database/enums.js";

/**
 * Ses seçenekleri. "Doğal ses" (Pro) için worker'da henüz ikinci bir ses
 * yok; listede kilitli görünür, seçilemez.
 */
const VOICE_OPTIONS = [
  {
    voice: VoicePreference.STANDARD,
    available: true,
    requiresPro: false,
    description: "Hızlı hazırlanır, tüm planlarda.",
  },
  {
    voice: VoicePreference.NATURAL,
    available: false,
    requiresPro: true,
    description: "Daha akıcı vurgu ve tonlama. Çok yakında.",
  },
  {
    voice: VoicePreference.OWN,
    available: true,
    requiresPro: false,
    description:
      "Kaydettiğin bölümler senin sesinle çalar; kaydetmediklerin Dinlet sesiyle.",
  },
] as const;

@Injectable()
export class VoiceSettingService {
  constructor(private readonly recordingRepository: RecordingRepository) {}

  async get(userId: number): Promise<OkResponse> {
    return new OkResponse("Ses tercihi", await this.view(userId));
  }

  async update(voice: VoicePreference, userId: number): Promise<OkResponse> {
    const option = VOICE_OPTIONS.find((candidate) => candidate.voice === voice);
    if (!option?.available) {
      throw new UnprocessableEntityException({
        message: "Bu ses henüz kullanılamıyor.",
        code: "VOICE_UNAVAILABLE",
      });
    }
    await this.recordingRepository.upsertVoiceSetting(userId, voice);
    return new OkResponse("Ses tercihi güncellendi", await this.view(userId));
  }

  private async view(userId: number) {
    const [setting, sectionIds] = await Promise.all([
      this.recordingRepository.findVoiceSetting(userId),
      this.recordingRepository.findLiveSectionIds(userId),
    ]);
    return {
      voice: setting?.voice ?? VoicePreference.STANDARD,
      options: VOICE_OPTIONS,
      recordingCount: sectionIds.length,
    };
  }
}
