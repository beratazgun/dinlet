import { StoreAdminController } from "./store-admin.controller.js";
import { StoreSubmissionController } from "./store-submission.controller.js";
import { StoreController } from "./store.controller.js";

export { StoreAdminController, StoreController, StoreSubmissionController };

export const StoreControllers = [
  StoreController,
  StoreSubmissionController,
  StoreAdminController,
];
