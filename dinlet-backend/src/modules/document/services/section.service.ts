import { Injectable, NotFoundException } from "@nestjs/common";

import { OkResponse } from "#/core/http/index.js";
import {
  MnemonicRepository,
  PlaybackRepository,
  SectionRepository,
} from "#/modules/document/repository/index.js";

/** Bölüm detayı: ses adresi ve ekranda okumak için metin. */
@Injectable()
export class SectionService {
  constructor(
    private readonly sectionRepository: SectionRepository,
    private readonly playbackRepository: PlaybackRepository,
    private readonly mnemonicRepository: MnemonicRepository,
  ) {}

  async get(id: number, userId: number): Promise<OkResponse> {
    const section = await this.sectionRepository.findWithDocument(id);
    if (
      !section?.document ||
      section.document.userId !== userId ||
      section.document.deletedAt
    ) {
      throw new NotFoundException(`Bölüm bulunamadı: ${id}`);
    }

    return new OkResponse("Bölüm getirildi", {
      ...section,
      paragraphs: section.script?.paragraphs ?? [],
      recap: section.script?.recap ?? null,
      playback: await this.playbackRepository.findForSection(userId, id),
      questions: await this.sectionRepository.findQuizQuestions(id),
      mnemonics: await this.mnemonicRepository.listKeptForSection(id),
      ownVoice: await this.sectionRepository.findOwnVoice(
        userId,
        id,
        section.scriptHash,
      ),
    });
  }
}
