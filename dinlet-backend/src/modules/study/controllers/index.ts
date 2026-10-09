import { CollectionsController } from "./collections.controller.js";
import { FolderController } from "./folder.controller.js";
import { ReviewController } from "./review.controller.js";
import { StudyGoalController } from "./study-goal.controller.js";
import { TagController } from "./tag.controller.js";

export {
  CollectionsController,
  FolderController,
  ReviewController,
  StudyGoalController,
  TagController,
};

export const StudyControllers = [
  CollectionsController,
  FolderController,
  TagController,
  StudyGoalController,
  ReviewController,
];
