import {
  autoIncrementId,
  type ModelHelpers,
} from "#database/models/model.types.js";

export function createMediaModels({ field, model }: ModelHelpers) {
  const Media = model("Media", {
    fields: {
      id: autoIncrementId(field),
      storageKey: field.text().column("storage_key"),
      fileName: field.text().column("file_name"),
      mimeType: field.text().column("mime_type"),
      size: field.int(),
      width: field.int().optional(),
      height: field.int().optional(),
      duration: field.int().optional(),
      metadata: field.json().optional(),
      uploaderId: field.int().optional().column("uploader_id"),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
    },
  }).sql(({ cols, constraints }) => ({
    table: "media",
    indexes: [constraints.index([cols.uploaderId])],
  }));

  return { Media };
}
