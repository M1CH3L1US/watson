import { GUARD_METADATA } from '@constants';
import { applyStackableMetadata } from '@decorators';
import { ExecutionContext } from '@interfaces';
import { isMethodDecorator } from '@utils';
import { Observable } from 'rxjs';

/**
 * Guards will check incoming commands for user permissions or other data you might
 * want to check before enabling them to run a command. If the guard returns false, the framework
 * will throw a `UnauthorizedException`. If don't want this to happen simply throw your own exception instead of returning `false`
 *
 * @param ctx The current execution context
 * @returns {boolean} Whether the user should be allowed to run the command or not.
 */
export interface CanActivate {
  canActivate(
    ctx: ExecutionContext
  ): boolean | Promise<boolean> | Observable<boolean>;
}

interface WithCanActivate {
  prototype: CanActivate;
}

export type GuardFn = (ctx: ExecutionContext) => boolean;

export type GuardsMetadata = CanActivate | WithCanActivate;

export function UseGuards(
  ...guards: GuardsMetadata[]
): MethodDecorator & ClassDecorator {
  return (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor
  ) => {
    if (isMethodDecorator(descriptor)) {
      return applyStackableMetadata(GUARD_METADATA, descriptor!.value, guards);
    }

    applyStackableMetadata(GUARD_METADATA, target.constructor, guards);
  };
}
