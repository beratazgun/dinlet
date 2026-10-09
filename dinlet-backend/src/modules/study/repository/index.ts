import { FolderRepository } from "./folder.repository.js";
import { ReviewRepository } from "./review.repository.js";
import { StudyGoalRepository } from "./study-goal.repository.js";
import { StudyProgressRepository } from "./study-progress.repository.js";
import { TagRepository } from "./tag.repository.js";

export {
  FolderRepository,
  ReviewRepository,
  StudyGoalRepository,
  StudyProgressRepository,
  TagRepository,
};

export const StudyRepositories = [
  FolderRepository,
  TagRepository,
  StudyGoalRepository,
  StudyProgressRepository,
  ReviewRepository,
];
export type {
  ReviewQuestionRow,
  ReviewSectionInfo,
} from "./review.repository.js";
