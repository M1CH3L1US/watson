import { isNil, isString } from '@watsonjs/common';
import { MessageEmbed } from 'discord.js';

import { NotParsableException } from '../exceptions/not-parsable.exception';
import { ExecutionContextHost } from './execution-context-host';

export type ICommandResponse<T = any> = undefined | T[] | T;

export class ResponseParser {
  public async parse(ctx: ExecutionContextHost, commandData: ICommandResponse) {
    if (isNil(commandData)) {
      return;
    }

    if (!(ctx.getType() === "command")) {
      return;
    }

    if (!this.isSendableMessage(commandData)) {
      return;
      // Might be annoying for returning `channel.send`
      throw new NotParsableException(commandData, ctx);
    }

    return commandData;
  }

  private isSendableMessage(message: unknown) {
    return (
      isString(message) ||
      typeof message === "number" ||
      typeof message === "boolean" ||
      typeof message === "bigint" ||
      message instanceof MessageEmbed
    );
  }
}
