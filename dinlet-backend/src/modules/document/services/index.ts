import { CoverageService } from "./coverage.service.js";
import { DocumentPipelineService } from "./document-pipeline.service.js";
import { DocumentPurgeService } from "./document-purge.service.js";
import { DocumentReconcileService } from "./document-reconcile.service.js";
import { DocumentService } from "./document.service.js";
import { NarrationService } from "./narration.service.js";
import { PlaybackService } from "./playback.service.js";
import { SectionService } from "./section.service.js";
import { StudyGenerationService } from "./study-generation.service.js";

export const DocumentServices = [
  DocumentService,
  SectionService,
  DocumentPipelineService,
  DocumentReconcileService,
  DocumentPurgeService,
  NarrationService,
  PlaybackService,
  CoverageService,
  StudyGenerationService,
];

export {
  CoverageService,
  DocumentPipelineService,
  DocumentPurgeService,
  DocumentReconcileService,
  DocumentService,
  NarrationService,
  PlaybackService,
  SectionService,
  StudyGenerationService,
};
