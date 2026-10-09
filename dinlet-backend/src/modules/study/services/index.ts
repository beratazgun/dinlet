import { CollectionsService } from "./collections.service.js";
import { FolderService } from "./folder.service.js";
import { ReviewService } from "./review.service.js";
import { StudyGoalService } from "./study-goal.service.js";
import { StudyProgressService } from "./study-progress.service.js";
import { TagService } from "./tag.service.js";

export {
  CollectionsService,
  FolderService,
  ReviewService,
  StudyGoalService,
  StudyProgressService,
  TagService,
};

export const StudyServices = [
  StudyProgressService,
  FolderService,
  TagService,
  StudyGoalService,
  CollectionsService,
  ReviewService,
];
