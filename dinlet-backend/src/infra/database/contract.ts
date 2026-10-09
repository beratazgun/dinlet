import { defineContract } from "@prisma/orm-postgres/contract-builder";
import { createAuditModels } from "#database/models/audit.model.js";
import { authEnums, createAuthModels } from "#database/models/auth.model.js";
import { createAuthorizationModels } from "#database/models/authorization.model.js";
import {
  billingEnums,
  createBillingModels,
} from "#database/models/billing.model.js";
import {
  createDocumentModels,
  documentEnums,
} from "#database/models/document.model.js";
import { createJobModels, jobEnums } from "#database/models/job.model.js";
import { createMediaModels } from "#database/models/media.model.js";
import { createStudyModels } from "#database/models/study.model.js";
import {
  createRecordingModels,
  recordingEnums,
} from "#database/models/recording.model.js";
import {
  createStoreModels,
  storeEnums,
} from "#database/models/store.model.js";
import {
  createNotificationModels,
  notificationEnums,
} from "#database/models/notification.model.js";

export const contract = defineContract(
  {},
  ({ field, model, rel, type }) => {
    const { User, Account, VerificationToken, UserConsent } = createAuthModels({
      field,
      model,
      type,
    });

    const { Role, Permission, RolePermission } = createAuthorizationModels({
      field,
      model,
      type,
    });

    const {
      Job,
      JobExecution,
      types: jobTypes,
    } = createJobModels({
      field,
      model,
      type,
    });

    const { Media } = createMediaModels({
      field,
      model,
      type,
    });

    const { AuditLog } = createAuditModels({ field, model, type });

    const { NotificationTemplates, Notification, PushToken } =
      createNotificationModels({
        field,
        model,
        type,
      });

    const { Document, Section, PlaybackProgress, QuizQuestion, Mnemonic } =
      createDocumentModels({
      field,
      model,
      type,
    });

    const { Subscription, UsageLedger, LlmUsage, RevenueCatEvent } =
      createBillingModels({ field, model, type });

    const { Folder, Tag, DocumentTag, StudyGoal, ReviewItem, ReviewDay } =
      createStudyModels({
      field,
      model,
      type,
    });

    const {
      StoreSubmission,
      StoreCategory,
      StoreItem,
      StoreItemCategory,
      StoreBundle,
      StoreBundleItem,
      StoreEntitlement,
    } = createStoreModels({ field, model, type });

    const { VoiceSetting, SectionRecording, RecordingClip } =
      createRecordingModels({ field, model, type });

    return {
      types: {
        ...jobTypes,
      },
      enums: {
        ...authEnums,
        ...jobEnums,
        ...notificationEnums,
        ...documentEnums,
        ...billingEnums,
        ...storeEnums,
        ...recordingEnums,
      },
      models: {
        User: User.relations({
          role: rel
            .belongsTo(Role, { from: "roleId", to: "id" })
            .sql({ fk: { onDelete: "restrict" } }),
          verificationTokens: rel.hasMany(VerificationToken, { by: "userId" }),
          consents: rel.hasMany(UserConsent, { by: "userId" }),
          accounts: rel.hasMany(Account, { by: "userId" }),
          notificationsReceived: rel.hasMany(Notification, {
            by: "recipientId",
          }),
          notificationsTriggered: rel.hasMany(Notification, { by: "actorId" }),
          documents: rel.hasMany(Document, { by: "userId" }),
          pushTokens: rel.hasMany(PushToken, { by: "userId" }),
          folders: rel.hasMany(Folder, { by: "userId" }),
          tags: rel.hasMany(Tag, { by: "userId" }),
          storeEntitlements: rel.hasMany(StoreEntitlement, { by: "userId" }),
          sectionRecordings: rel.hasMany(SectionRecording, { by: "userId" }),
          storeSubmissions: rel.hasMany(StoreSubmission, { by: "userId" }),
        }),
        Account: Account.relations({
          user: rel
            .belongsTo(User, { from: "userId", to: "id" })
            .sql({ fk: { onDelete: "restrict" } }),
        }),
        UserConsent: UserConsent.relations({
          user: rel
            .belongsTo(User, { from: "userId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
        }),
        VerificationToken: VerificationToken.relations({
          user: rel
            .belongsTo(User, { from: "userId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
        }),
        Role: Role.relations({
          users: rel.hasMany(User, { by: "roleId" }),
          rolePermissions: rel.hasMany(RolePermission, { by: "roleId" }),
        }),
        Permission: Permission.relations({
          rolePermissions: rel.hasMany(RolePermission, { by: "permissionId" }),
        }),
        RolePermission: RolePermission.relations({
          role: rel
            .belongsTo(Role, { from: "roleId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
          permission: rel
            .belongsTo(Permission, { from: "permissionId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
        }),
        Job: Job.relations({
          jobExecutions: rel.hasMany(JobExecution, { by: "jobId" }),
        }),
        JobExecution: JobExecution.relations({
          job: rel
            .belongsTo(Job, { from: "jobId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
        }),
        Media: Media.relations({
          documents: rel.hasMany(Document, { by: "mediaId" }),
        }),
        NotificationTemplates,
        AuditLog,
        Notification: Notification.relations({
          recipient: rel
            .belongsTo(User, { from: "recipientId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
          actor: rel
            .belongsTo(User, { from: "actorId", to: "id" })
            .sql({ fk: { onDelete: "setNull" } }),
        }),
        PushToken: PushToken.relations({
          user: rel
            .belongsTo(User, { from: "userId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
        }),
        Document: Document.relations({
          user: rel
            .belongsTo(User, { from: "userId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
          // Bir nota bağlı PDF, not silinmeden silinemez.
          media: rel
            .belongsTo(Media, { from: "mediaId", to: "id" })
            .sql({ fk: { onDelete: "restrict" } }),
          sections: rel.hasMany(Section, { by: "documentId" }),
          folder: rel
            .belongsTo(Folder, { from: "folderId", to: "id" })
            .sql({ fk: { onDelete: "setNull" } }),
          documentTags: rel.hasMany(DocumentTag, { by: "documentId" }),
          mnemonics: rel.hasMany(Mnemonic, { by: "documentId" }),
          storeSubmissions: rel.hasMany(StoreSubmission, { by: "documentId" }),
          // Mağaza kopyası; içerik kaldırılamaz (sahipleri var), yalnızca yayından çekilir.
          storeItem: rel
            .belongsTo(StoreItem, { from: "storeItemId", to: "id" })
            .sql({ fk: { onDelete: "restrict" } }),
        }),
        Mnemonic: Mnemonic.relations({
          document: rel
            .belongsTo(Document, { from: "documentId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
          section: rel
            .belongsTo(Section, { from: "sectionId", to: "id" })
            .sql({ fk: { onDelete: "setNull" } }),
        }),
        Section: Section.relations({
          document: rel
            .belongsTo(Document, { from: "documentId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
          playbackProgress: rel.hasMany(PlaybackProgress, { by: "sectionId" }),
          quizQuestions: rel.hasMany(QuizQuestion, { by: "sectionId" }),
          mnemonics: rel.hasMany(Mnemonic, { by: "sectionId" }),
          reviewItems: rel.hasMany(ReviewItem, { by: "sectionId" }),
          recordings: rel.hasMany(SectionRecording, { by: "sectionId" }),
        }),
        QuizQuestion: QuizQuestion.relations({
          section: rel
            .belongsTo(Section, { from: "sectionId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
        }),
        PlaybackProgress: PlaybackProgress.relations({
          user: rel
            .belongsTo(User, { from: "userId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
          section: rel
            .belongsTo(Section, { from: "sectionId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
        }),
        Subscription: Subscription.relations({
          user: rel
            .belongsTo(User, { from: "userId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
        }),
        UsageLedger: UsageLedger.relations({
          user: rel
            .belongsTo(User, { from: "userId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
          document: rel
            .belongsTo(Document, { from: "documentId", to: "id" })
            .sql({ fk: { onDelete: "setNull" } }),
        }),
        LlmUsage: LlmUsage.relations({
          document: rel
            .belongsTo(Document, { from: "documentId", to: "id" })
            .sql({ fk: { onDelete: "setNull" } }),
          section: rel
            .belongsTo(Section, { from: "sectionId", to: "id" })
            .sql({ fk: { onDelete: "setNull" } }),
        }),
        RevenueCatEvent,
        Folder: Folder.relations({
          user: rel
            .belongsTo(User, { from: "userId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
          documents: rel.hasMany(Document, { by: "folderId" }),
        }),
        Tag: Tag.relations({
          user: rel
            .belongsTo(User, { from: "userId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
          documentTags: rel.hasMany(DocumentTag, { by: "tagId" }),
        }),
        DocumentTag: DocumentTag.relations({
          document: rel
            .belongsTo(Document, { from: "documentId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
          tag: rel
            .belongsTo(Tag, { from: "tagId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
        }),
        StudyGoal: StudyGoal.relations({
          user: rel
            .belongsTo(User, { from: "userId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
        }),
        ReviewItem: ReviewItem.relations({
          user: rel
            .belongsTo(User, { from: "userId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
          section: rel
            .belongsTo(Section, { from: "sectionId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
        }),
        StoreSubmission: StoreSubmission.relations({
          user: rel
            .belongsTo(User, { from: "userId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
          document: rel
            .belongsTo(Document, { from: "documentId", to: "id" })
            .sql({ fk: { onDelete: "setNull" } }),
          storeItem: rel
            .belongsTo(StoreItem, { from: "storeItemId", to: "id" })
            .sql({ fk: { onDelete: "setNull" } }),
        }),
        StoreCategory: StoreCategory.relations({
          parent: rel
            .belongsTo(StoreCategory, { from: "parentId", to: "id" })
            .sql({ fk: { onDelete: "restrict" } }),
          itemCategories: rel.hasMany(StoreItemCategory, { by: "categoryId" }),
          bundles: rel.hasMany(StoreBundle, { by: "categoryId" }),
        }),
        StoreItem: StoreItem.relations({
          // Yayındaki içeriğin kaynak notu silinemez.
          document: rel
            .belongsTo(Document, { from: "documentId", to: "id" })
            .sql({ fk: { onDelete: "restrict" } }),
          itemCategories: rel.hasMany(StoreItemCategory, { by: "storeItemId" }),
          bundleItems: rel.hasMany(StoreBundleItem, { by: "storeItemId" }),
          entitlements: rel.hasMany(StoreEntitlement, { by: "storeItemId" }),
          copies: rel.hasMany(Document, { by: "storeItemId" }),
          submissions: rel.hasMany(StoreSubmission, { by: "storeItemId" }),
          author: rel
            .belongsTo(User, { from: "authorUserId", to: "id" })
            .sql({ fk: { onDelete: "setNull" } }),
        }),
        StoreItemCategory: StoreItemCategory.relations({
          storeItem: rel
            .belongsTo(StoreItem, { from: "storeItemId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
          category: rel
            .belongsTo(StoreCategory, { from: "categoryId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
        }),
        StoreBundle: StoreBundle.relations({
          category: rel
            .belongsTo(StoreCategory, { from: "categoryId", to: "id" })
            .sql({ fk: { onDelete: "setNull" } }),
          bundleItems: rel.hasMany(StoreBundleItem, { by: "bundleId" }),
        }),
        StoreBundleItem: StoreBundleItem.relations({
          bundle: rel
            .belongsTo(StoreBundle, { from: "bundleId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
          storeItem: rel
            .belongsTo(StoreItem, { from: "storeItemId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
        }),
        StoreEntitlement: StoreEntitlement.relations({
          user: rel
            .belongsTo(User, { from: "userId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
          storeItem: rel
            .belongsTo(StoreItem, { from: "storeItemId", to: "id" })
            .sql({ fk: { onDelete: "restrict" } }),
          bundle: rel
            .belongsTo(StoreBundle, { from: "bundleId", to: "id" })
            .sql({ fk: { onDelete: "setNull" } }),
        }),
        VoiceSetting: VoiceSetting.relations({
          user: rel
            .belongsTo(User, { from: "userId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
        }),
        SectionRecording: SectionRecording.relations({
          user: rel
            .belongsTo(User, { from: "userId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
          // Not kalıcı silinince kayıt da gider (dosyaları not önekinde).
          section: rel
            .belongsTo(Section, { from: "sectionId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
          clips: rel.hasMany(RecordingClip, { by: "recordingId" }),
        }),
        RecordingClip: RecordingClip.relations({
          recording: rel
            .belongsTo(SectionRecording, { from: "recordingId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
        }),
        ReviewDay: ReviewDay.relations({
          user: rel
            .belongsTo(User, { from: "userId", to: "id" })
            .sql({ fk: { onDelete: "cascade" } }),
        }),
      },
    };
  },
);
