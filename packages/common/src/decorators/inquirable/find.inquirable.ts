import { DIProvided } from '@common/interfaces';
import { Channel, GuildMember, Role } from 'discord.js';

interface FindInq<T> {
  /**
   * Searches for objects in the current guild context.
   *
   * @param fuzzy Performs a fuzzy / wildcard match.
   *
   * @usage
   * ```js
   * public async getAdminRoles(roleFinder: FindRoleInq) {
   *   const roles = await roleFinder('admin', true);
   *   return roles.map(e => e.name);
   * }
   * ```
   */
  <F extends boolean, R extends F extends true ? Promise<T[]> : Promise<T>>(
    name: string,
    fuzzy?: F
  ): R;
}

/** Searches for a role in the current guild context. */
export declare interface FindRoleInq extends FindInq<Role> {}

/** Searches for a member in the current guild context. */
export declare interface FindMemberInq extends FindInq<GuildMember> {}

/** Searches for a channel in the current guild context. */
export declare interface FindChannelInq extends FindInq<Channel> {}

/**
 *
 * ---
 * This type is only required to
 * performing type reflection on
 * parameters which use this function.
 * They can be safely ignored and
 * should not be extended.
 */
export abstract class FindRoleInq extends DIProvided({ providedIn: "ctx" }) {}

/**
 *
 * ---
 * This type is only required to
 * performing type reflection on
 * parameters which use this function.
 * They can be safely ignored and
 * should not be extended.
 */
export abstract class FindChannelInq extends DIProvided({
  providedIn: "ctx",
}) {}

/**
 *
 * ---
 * This type is only required to
 * performing type reflection on
 * parameters which use this function.
 * They can be safely ignored and
 * should not be extended.
 */
export abstract class FindMemberInq extends DIProvided({ providedIn: "ctx" }) {}
