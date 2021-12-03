import { PassThrough } from '@common/decorators';
import { Injectable } from '@common/injectable';
import { ExecutionContext } from '@common/pipeline';

/**
 * Default filter for specifying guilds whose
 * events should call the handler method.
 */
@Injectable()
export class GuildFilter implements PassThrough {
  public readonly allowedGuilds: string[];

  constructor(allowedGuild: string);
  constructor(allowedGuilds: string[]);
  constructor(guilds: string | string[]) {
    if (!Array.isArray(guilds)) {
      guilds = [guilds];
    }

    this.allowedGuilds = guilds;
  }

  pass(ctx: ExecutionContext) {
    return true;
  }
}
