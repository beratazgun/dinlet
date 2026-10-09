import { StoreBundleRepository } from "./store-bundle.repository.js";
import { StoreCategoryRepository } from "./store-category.repository.js";
import { StoreEntitlementRepository } from "./store-entitlement.repository.js";
import { StoreItemRepository } from "./store-item.repository.js";
import { StoreLibraryRepository } from "./store-library.repository.js";
import { StoreSubmissionRepository } from "./store-submission.repository.js";

export type {
  StoreBundleFilter,
  StoreBundleInput,
} from "./store-bundle.repository.js";
export type { StoreCategoryInput } from "./store-category.repository.js";
export type { EntitlementGrant } from "./store-entitlement.repository.js";
export type {
  StoreSubmissionFilter,
  StoreSubmissionPatch,
} from "./store-submission.repository.js";
export type {
  StoreContentStats,
  StoreItemFilter,
  StoreItemInput,
} from "./store-item.repository.js";

export {
  StoreBundleRepository,
  StoreCategoryRepository,
  StoreEntitlementRepository,
  StoreItemRepository,
  StoreLibraryRepository,
  StoreSubmissionRepository,
};

export const StoreRepositories = [
  StoreCategoryRepository,
  StoreItemRepository,
  StoreBundleRepository,
  StoreEntitlementRepository,
  StoreLibraryRepository,
  StoreSubmissionRepository,
];
