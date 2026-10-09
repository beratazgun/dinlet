import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";

import {
  CreatedResponse,
  NoContentResponse,
  OkResponse,
} from "#/core/http/index.js";
import type {
  SetDocumentTagsBodyDto,
  TagNameBodyDto,
} from "#/modules/study/dtos/index.js";
import {
  StudyProgressRepository,
  TagRepository,
} from "#/modules/study/repository/index.js";

export const MAX_TAGS = 50;

/** Etiketler ("Zor konular") ve notlara bağlanmaları. */
@Injectable()
export class TagService {
  constructor(
    private readonly tagRepository: TagRepository,
    private readonly progressRepository: StudyProgressRepository,
  ) {}

  async create(body: TagNameBodyDto, userId: number): Promise<CreatedResponse> {
    if ((await this.tagRepository.countByUser(userId)) >= MAX_TAGS) {
      throw new UnprocessableEntityException(
        `En fazla ${MAX_TAGS} etiket oluşturabilirsin.`,
      );
    }
    await this.assertNameFree(userId, body.name);
    const tag = await this.tagRepository.create({ userId, name: body.name });
    return new CreatedResponse("Etiket oluşturuldu", {
      ...tag,
      documentCount: 0,
    });
  }

  async rename(
    id: number,
    body: TagNameBodyDto,
    userId: number,
  ): Promise<OkResponse> {
    const tag = await this.findOwned(id, userId);
    if (tag.name !== body.name) await this.assertNameFree(userId, body.name);
    await this.tagRepository.rename(id, userId, body.name);
    const counts = await this.tagRepository.countDocumentsByTag([id]);
    return new OkResponse("Etiket güncellendi", {
      id,
      name: body.name,
      documentCount: counts.get(id) ?? 0,
    });
  }

  async remove(id: number, userId: number): Promise<NoContentResponse> {
    if (!(await this.tagRepository.delete(id, userId))) {
      throw new NotFoundException(`Etiket bulunamadı: ${id}`);
    }
    return new NoContentResponse("Etiket silindi");
  }

  /** Notun etiketlerini değiştirir; başkasının etiketi kabul edilmez. */
  async setForDocument(
    documentId: number,
    body: SetDocumentTagsBodyDto,
    userId: number,
  ): Promise<OkResponse> {
    if (!(await this.progressRepository.ownsDocument(userId, documentId))) {
      throw new NotFoundException(`Not bulunamadı: ${documentId}`);
    }
    const owned = await this.tagRepository.findOwnedIds(userId, body.tagIds);
    if (owned.length !== body.tagIds.length) {
      throw new NotFoundException("Etiketlerden biri bulunamadı.");
    }
    await this.tagRepository.setForDocument(documentId, body.tagIds);
    const tags = await this.tagRepository.findForDocuments([documentId]);
    return new OkResponse(
      "Notun etiketleri güncellendi",
      tags.get(documentId) ?? [],
    );
  }

  /** Etiketler, not sayılarıyla. */
  async list(userId: number) {
    const tags = await this.tagRepository.listByUser(userId);
    const counts = await this.tagRepository.countDocumentsByTag(
      tags.map((tag) => tag.id),
    );
    return tags.map((tag) => ({
      ...tag,
      documentCount: counts.get(tag.id) ?? 0,
    }));
  }

  private async findOwned(id: number, userId: number) {
    const tag = await this.tagRepository.findOwned(id, userId);
    if (!tag) throw new NotFoundException(`Etiket bulunamadı: ${id}`);
    return tag;
  }

  private async assertNameFree(userId: number, name: string): Promise<void> {
    if (await this.tagRepository.findByName(userId, name)) {
      throw new ConflictException({
        message: `"${name}" adında bir etiketin zaten var.`,
        code: "TAG_NAME_TAKEN",
      });
    }
  }
}
