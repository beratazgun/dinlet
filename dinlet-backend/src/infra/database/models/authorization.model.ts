import {
  autoIncrementId,
  type ModelHelpers,
} from "#database/models/model.types.js";

export function createAuthorizationModels({ field, model }: ModelHelpers) {
  const Role = model("Role", {
    fields: {
      id: autoIncrementId(field),
      name: field.text().unique(),
      code: field.text().unique(),
      description: field.text().optional(),
      isSuper: field.boolean().default(false).column("is_super"),
      isSystem: field.boolean().default(false).column("is_system"),
      rank: field.int().default(1),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
      deletedAt: field.temporal
        .timestamptzString()
        .optional()
        .column("deleted_at"),
    },
  }).sql({ table: "roles" });

  const Permission = model("Permission", {
    fields: {
      id: autoIncrementId(field),
      name: field.text().unique(),
      module: field.text(),
      action: field.text(),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
      deletedAt: field.temporal
        .timestamptzString()
        .optional()
        .column("deleted_at"),
    },
  })
    .attributes(({ fields, constraints }) => ({
      uniques: [constraints.unique([fields.module, fields.action])],
    }))
    .sql({ table: "permissions" });

  const RolePermission = model("RolePermission", {
    fields: {
      id: autoIncrementId(field),
      roleId: field.int().column("role_id"),
      permissionId: field.int().column("permission_id"),
      createdAt: field.temporal.createdAtString().column("created_at"),
    },
  })
    .attributes(({ fields, constraints }) => ({
      uniques: [constraints.unique([fields.roleId, fields.permissionId])],
    }))
    .sql({ table: "role_permissions" });

  return { Role, Permission, RolePermission };
}
