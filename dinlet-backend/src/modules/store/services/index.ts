import { StoreAdminService } from "./store-admin.service.js";
import { StoreCatalogService } from "./store-catalog.service.js";
import { StoreLibraryService } from "./store-library.service.js";
import { StorePresenterService } from "./store-presenter.service.js";
import { StoreSubmissionService } from "./store-submission.service.js";

export {
  StoreAdminService,
  StoreCatalogService,
  StoreLibraryService,
  StorePresenterService,
  StoreSubmissionService,
};

export const StoreServices = [
  StorePresenterService,
  StoreCatalogService,
  StoreLibraryService,
  StoreAdminService,
  StoreSubmissionService,
];
