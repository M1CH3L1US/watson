import { LifecycleFunction } from '@core/router/route-handler-factory';
import { BaseRoute, ExceptionHandler, WatsonEvent } from '@watsonjs/common';
import iterate from 'iterare';

export abstract class AbstractProxy<
  Event extends WatsonEvent = WatsonEvent,
  Route extends BaseRoute = BaseRoute,
  ProxyData = any
> {
  public readonly handlers = new Map<
    Route,
    [LifecycleFunction, ExceptionHandler]
  >();

  constructor(
    /**
     * The {@link WatsonEvent} this proxy is bound to
     */
    public readonly type: Event,
    /**
     * If the proxy is bound to the discord websocket
     * connection or the client event emitter
     */
    public readonly isWsEvent: boolean = false
  ) {}

  public abstract proxy(args: ProxyData): Promise<void>;

  public abstract bind(
    route: BaseRoute,
    eventHandler: LifecycleFunction,
    exceptionHandler: ExceptionHandler
  ): void;

  public getHandlerFns(): [Route, [LifecycleFunction, ExceptionHandler]][] {
    return iterate(this.handlers).toArray();
  }
}
