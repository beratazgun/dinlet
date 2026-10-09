import { Injectable } from "@nestjs/common";

import { StudyProgressRepository } from "#/modules/study/repository/index.js";
import {
  summarizeDocument,
  type DocumentStudyProgress,
} from "#/modules/study/utils/index.js";

export interface StudyDocument {
  id: number;
  folderId: number | null;
  isFavorite: boolean;
  createdAt: string;
  progress: DocumentStudyProgress;
}

/** Kullanıcının notları ve her birinin dinleme ilerlemesi (3 sorgu). */
@Injectable()
export class StudyProgressService {
  constructor(private readonly progressRepository: StudyProgressRepository) {}

  async snapshot(userId: number): Promise<StudyDocument[]> {
    const documents = await this.progressRepository.findDocuments(userId);
    const sections = await this.progressRepository.findSectionRows(
      userId,
      documents.map((document) => document.id),
    );
    return documents.map((document) => ({
      id: document.id,
      folderId: document.folderId,
      isFavorite: document.isFavorite,
      createdAt: document.createdAt,
      progress: summarizeDocument(
        document.status,
        sections.get(document.id) ?? [],
      ),
    }));
  }
}
