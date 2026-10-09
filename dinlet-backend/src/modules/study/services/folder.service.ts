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
  CreateFolderBodyDto,
  UpdateFolderBodyDto,
} from "#/modules/study/dtos/index.js";
import { FolderRepository } from "#/modules/study/repository/index.js";
import { nextFolderColor, percent } from "#/modules/study/utils/index.js";

import {
  StudyProgressService,
  type StudyDocument,
} from "./study-progress.service.js";

export const MAX_FOLDERS = 50;

/** Kullanıcının klasörleri. Not silinmez; klasör silinince notlar klasörsüz kalır. */
@Injectable()
export class FolderService {
  constructor(
    private readonly folderRepository: FolderRepository,
    private readonly progressService: StudyProgressService,
  ) {}

  async create(
    body: CreateFolderBodyDto,
    userId: number,
  ): Promise<CreatedResponse> {
    const count = await this.folderRepository.countByUser(userId);
    if (count >= MAX_FOLDERS) {
      throw new UnprocessableEntityException(
        `En fazla ${MAX_FOLDERS} klasör oluşturabilirsin.`,
      );
    }
    await this.assertNameFree(userId, body.name);

    const folder = await this.folderRepository.create({
      userId,
      name: body.name,
      color: body.color ?? nextFolderColor(count),
      position: await this.folderRepository.nextPosition(userId),
    });
    return new CreatedResponse("Klasör oluşturuldu", {
      ...folder,
      documentCount: 0,
      finishedCount: 0,
      progressPercent: 0,
    });
  }

  async update(
    id: number,
    body: UpdateFolderBodyDto,
    userId: number,
  ): Promise<OkResponse> {
    const folder = await this.findOwned(id, userId);
    if (body.name && body.name !== folder.name) {
      await this.assertNameFree(userId, body.name);
    }
    await this.folderRepository.update(id, userId, {
      name: body.name,
      color: body.color,
    });

    const documents = await this.progressService.snapshot(userId);
    const updated = await this.findOwned(id, userId);
    return new OkResponse(
      "Klasör güncellendi",
      describeFolder(updated, documents),
    );
  }

  async remove(id: number, userId: number): Promise<NoContentResponse> {
    if (!(await this.folderRepository.delete(id, userId))) {
      throw new NotFoundException(`Klasör bulunamadı: ${id}`);
    }
    return new NoContentResponse(
      "Klasör silindi; içindeki notlar kütüphanede kaldı",
    );
  }

  /** Klasörler, içlerindeki notların ilerlemesiyle. */
  async list(userId: number, documents: StudyDocument[]) {
    const folders = await this.folderRepository.listByUser(userId);
    return folders.map((folder) => describeFolder(folder, documents));
  }

  /** Not taşınırken: klasör bu kullanıcıya mı ait? */
  async assertOwned(id: number, userId: number): Promise<void> {
    await this.findOwned(id, userId);
  }

  private async findOwned(id: number, userId: number) {
    const folder = await this.folderRepository.findOwned(id, userId);
    if (!folder) throw new NotFoundException(`Klasör bulunamadı: ${id}`);
    return folder;
  }

  private async assertNameFree(userId: number, name: string): Promise<void> {
    if (await this.folderRepository.findByName(userId, name)) {
      throw new ConflictException({
        message: `"${name}" adında bir klasörün zaten var.`,
        code: "FOLDER_NAME_TAKEN",
      });
    }
  }
}

function describeFolder(
  folder: { id: number; name: string; color: string },
  documents: StudyDocument[],
) {
  const inFolder = documents.filter(
    (document) => document.folderId === folder.id,
  );
  const finishedCount = inFolder.filter(
    (document) => document.progress.finished,
  ).length;
  return {
    id: folder.id,
    name: folder.name,
    color: folder.color,
    documentCount: inFolder.length,
    finishedCount,
    progressPercent: percent(finishedCount, inFolder.length),
  };
}
