import {
  COMMAND_METADATA,
  EVENT_METADATA,
  EventExceptionHandler,
  EXCEPTION_HANDLER_METADATA,
  IClientEvent,
  ICommandOptions,
  isFunction,
  PartialApplicationCommand,
  RECEIVER_METADATA,
  SLASH_COMMAND_METADATA,
  TReceiver,
  Type,
} from '@watsonjs/common';
import iterate from 'iterare';

import { InstanceWrapper, MetadataResolver, Module } from '../injector';
import { CommonExceptionHandler, EventProxy, ExceptionHandler } from '../lifecycle';
import { COMPLETED, EXPLORE_RECEIVER, EXPLORE_START, Logger, MAP_COMMAND, MAP_EVENT, MAP_SLASH_COMMAND } from '../logger';
import { WatsonContainer } from '../watson-container';
import { CommandRoute } from './command';
import { ConcreteEventRoute } from './event';
import { IHandlerFunction, RouteHandlerFactory } from './route-handler-factory';
import { SlashRoute } from './slash';

export class RouteExplorer {
  private constainer: WatsonContainer;
  private resolver: MetadataResolver;

  private logger = new Logger("RouteExplorer");

  private eventRoutes = new Set<ConcreteEventRoute<any>>();
  private commandRoutes = new Set<CommandRoute>();
  private slashRoutes = new Set<SlashRoute>();

  private eventProxies = new Map<IClientEvent, EventProxy<any>>();
  private routeHanlderFactory: RouteHandlerFactory;

  constructor(container: WatsonContainer) {
    this.constainer = container;
    this.resolver = new MetadataResolver(container);
    this.routeHanlderFactory = new RouteHandlerFactory(container);
  }

  public async explore() {
    this.logger.logMessage(EXPLORE_START());
    const receivers = this.constainer.globalInstanceHost.getAllInstancesOfType(
      "receiver"
    );

    for (const receiver of receivers) {
      const { wrapper } = receiver;

      this.logger.logMessage(EXPLORE_RECEIVER(receiver.wrapper));

      await this.reflectEventRoutes(wrapper);
      await this.reflectCommandRoutes(wrapper);
      await this.reflectSlashRoutes(wrapper);
    }

    this.logger.logMessage(COMPLETED());
  }

  private async reflectEventRoutes(receiver: InstanceWrapper<TReceiver>) {
    const { metatype } = receiver;
    const receiverMethods = this.reflectReceiverMehtods(metatype);

    for (const method of receiverMethods) {
      const { descriptor } = method;
      const metadata = this.resolver.getMetadata<IClientEvent>(
        EVENT_METADATA,
        descriptor
      );

      if (!metadata) {
        continue;
      }

      const routeRef = new ConcreteEventRoute(
        metadata,
        receiver,
        descriptor,
        this.constainer
      );

      const handler = await this.routeHanlderFactory.createEventHandler(
        routeRef,
        descriptor,
        receiver,
        receiver.host
      );

      this.eventRoutes.add(routeRef);
      this.logger.logMessage(MAP_EVENT(routeRef));

      const exceptionHandler = this.createExceptionHandler(
        receiver.metatype,
        method.descriptor,
        receiver.host
      );

      this.bindHandler(metadata, handler, exceptionHandler);
    }
  }

  private async reflectCommandRoutes(receiver: InstanceWrapper<TReceiver>) {
    const { metatype } = receiver;
    const receiverMethods = this.reflectReceiverMehtods(metatype);
    const receiverOptions = this.resolver.getMetadata(
      RECEIVER_METADATA,
      metatype
    );

    for (const method of receiverMethods) {
      const metadata = this.resolver.getMetadata<ICommandOptions>(
        COMMAND_METADATA,
        method.descriptor
      );

      if (!metadata) {
        continue;
      }

      const routeRef = new CommandRoute(
        metadata,
        receiverOptions,
        receiver,
        method,
        this.constainer
      );

      const handler = await this.routeHanlderFactory.createCommandHandler(
        routeRef,
        method.descriptor,
        receiver,
        receiver.host
      );

      this.commandRoutes.add(routeRef);
      this.logger.logMessage(MAP_COMMAND(routeRef));

      const exceptionHandler = this.createExceptionHandler(
        receiver.metatype,
        method.descriptor,
        receiver.host
      );

      this.bindHandler("message", handler, exceptionHandler);
    }
  }

  private async reflectSlashRoutes(receiver: InstanceWrapper<TReceiver>) {
    const { metatype } = receiver;
    const receiverMethods = this.reflectReceiverMehtods(metatype);

    for (const method of receiverMethods) {
      const { descriptor } = method;
      const metadata = this.resolver.getMetadata<PartialApplicationCommand>(
        SLASH_COMMAND_METADATA,
        descriptor
      );

      if (!metadata) {
        continue;
      }

      const routeRef = new SlashRoute(
        metadata,
        receiver,
        descriptor,
        this.constainer
      );

      const handler = await this.routeHanlderFactory.createSlashHandler(
        routeRef,
        method.descriptor,
        receiver,
        receiver.host
      );

      this.slashRoutes.add(routeRef);
      this.logger.logMessage(MAP_SLASH_COMMAND(routeRef));

      const exceptionHandler = this.createExceptionHandler(
        receiver.metatype,
        method.descriptor,
        receiver.host
      );

      this.bindHandler(
        "INTERACTION_CREATE" as any,
        handler,
        exceptionHandler,
        true
      );
    }
  }

  private reflectReceiverMehtods(receiver: Type) {
    return this.resolver.reflectMethodsFromMetatype(receiver);
  }

  private reflectExceptionHandlers(
    metadataKey: string,
    reflectee: Type | Function,
    module: Module
  ) {
    const handlerMetadata = this.resolver.getArrayMetadata<
      EventExceptionHandler[]
    >(metadataKey, reflectee);

    const instances = handlerMetadata.filter(
      (e: EventExceptionHandler) => e instanceof EventExceptionHandler
    );
    const injectables = handlerMetadata.filter(isFunction);
    const injectableInstances = injectables.map(
      (injectable) =>
        module.injectables.get(injectable).instance as EventExceptionHandler
    );

    const hanlders = [...injectableInstances, ...instances];

    return hanlders;
  }

  public getEventProxies() {
    return this.eventProxies;
  }

  public getEventProxiesArray() {
    return iterate(this.eventProxies).toArray();
  }

  public getEventProxy(event: IClientEvent) {
    return this.eventProxies.get(event);
  }

  private bindHandler(
    event: IClientEvent,
    handler: IHandlerFunction,
    exceptionHandler: ExceptionHandler,
    isWsEvent?: boolean
  ) {
    if (!this.eventProxies.has(event)) {
      this.eventProxies.set(event, new EventProxy(event, isWsEvent));
    }

    const proxyRef = this.eventProxies.get(event);
    proxyRef.bind(handler, exceptionHandler);
  }

  private createExceptionHandler(
    receiver: Type,
    method: Function,
    module: Module
  ) {
    const defaultHandlers = [new CommonExceptionHandler()];
    const customGlobalHandlers = this.constainer.getGlobalExceptionHandlers();
    const customReceiverHandlers = this.reflectExceptionHandlers(
      EXCEPTION_HANDLER_METADATA,
      receiver,
      module
    );
    const customCommandHandlers = this.reflectExceptionHandlers(
      EXCEPTION_HANDLER_METADATA,
      method,
      module
    );

    const customHandlers = [
      ...customGlobalHandlers,
      ...customReceiverHandlers,
      ...customCommandHandlers,
    ];

    const handlers = [...defaultHandlers, ...customHandlers];
    const handler = new ExceptionHandler(handlers);

    return handler;
  }
}
