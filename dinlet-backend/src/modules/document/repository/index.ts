import { DocumentRepository } from "./document.repository.js";
import { LlmUsageRepository } from "./llm-usage.repository.js";
import { MnemonicRepository } from "./mnemonic.repository.js";
import { PlaybackRepository } from "./playback.repository.js";
import { SectionRepository } from "./section.repository.js";

export const DocumentRepositories = [
  DocumentRepository,
  SectionRepository,
  LlmUsageRepository,
  PlaybackRepository,
  MnemonicRepository,
];

export {
  DocumentRepository,
  LlmUsageRepository,
  MnemonicRepository,
  PlaybackRepository,
  SectionRepository,
};
export type { NewMnemonic } from "./mnemonic.repository.js";
export type {
  DocumentListFilter,
  DocumentPatch,
  NewDocument,
} from "./document.repository.js";
export type {
  NewSection,
  QuickPatch,
  SectionPatch,
} from "./section.repository.js";
