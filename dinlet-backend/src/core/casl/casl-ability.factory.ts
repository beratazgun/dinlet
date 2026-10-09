import { AbilityBuilder } from "@casl/ability";
import { createPrismaAbility } from "@casl/prisma/runtime";
import { Injectable } from "@nestjs/common";

import type {
  AppAbility,
  AppRule,
  AppSubjects,
} from "#/core/casl/casl-ability.type.js";
import { RedisPermissionHelper } from "#/infra/redis/helpers/redis-permission.helper.js";
import { DatabaseService } from "#database/database.service.js";
import type { SessionUser } from "#/types/session-user.type.js";

@Injectable()
export class CaslAbilityFactory {
  constructor(
    private readonly database: DatabaseService,
    private readonly permissionCache: RedisPermissionHelper,
  ) {}

  async createForUser(user: SessionUser): Promise<AppAbility> {
    const { can, build } = new AbilityBuilder<AppAbility>(createPrismaAbility);

    if (user.role.isSuper) {
      can("manage", "all");
    } else {
      for (const rule of await this.getRolePermissionRules(user.role.id)) {
        can(rule.action, rule.subject);
      }
    }

    return build();
  }

  private async getRolePermissionRules(roleId: number): Promise<AppRule[]> {
    const cached = await this.permissionCache.get(roleId);
    if (cached) return cached;

    const rolePermissions =
      await this.database.client.orm.public.RolePermission.where({
        roleId: roleId,
      })
        .include("permission", (permission) =>
          permission.select("module", "action"),
        )
        .all();
    const rules = rolePermissions.map(({ permission }) => ({
      action: permission.action,
      subject: permission.module as AppSubjects,
    }));

    await this.permissionCache.set(roleId, rules);
    return rules;
  }
}
