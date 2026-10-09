import { SetMetadata } from "@nestjs/common";
import type { AppAbility } from "#/core/casl/index.js";
import { CHECK_POLICIES_KEY } from "#/core/constants/index.js";

export type PolicyHandlerCallback = (ability: AppAbility) => boolean;

export interface PolicyHandlerObject {
  handle(ability: AppAbility): boolean;
}

export type PolicyHandler = PolicyHandlerCallback | PolicyHandlerObject;

/**
 * Bir endpoint'e erişmek için CASL ability kontrolü gerektiren dekoratör.
 * Birden fazla handler AND'lenir (`every`); OR gereken durumlarda handler
 * içinde `||` kullanılır.
 *
 * @example
 * @CheckPolicies((ability: AppAbility) => ability.can('list', 'Job'))
 *
 * @example
 * @CheckPolicies(
 *   (ability) => ability.can('create', 'Job') || ability.can('update', 'Job'),
 * )
 */
export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);
