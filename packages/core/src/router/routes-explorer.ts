import {
  COMMAND_METADATA,
  DESIGN_PARAMETERS,
  EXCEPTION_HANDLER_METADATA,
  isFunction,
  RECEIVER_METADATA,
  ReceiverDef,
  Type,
  WatsonEvent,
} from '@watsonjs/common';
import iterate from 'iterare';

export class RouteExplorer {
  private container: WatsonContainer;
  private scanner: MetadataResolver;

  private logger = new Logger("RouteExplorer");

  private eventRoutes = new Set<EventRouteHost<any>>();
  private commandRoutes = new Set<CommandRoute>();
  private slashRoutes = new Set<SlashRoute>();

  private eventProxies = new Map<WatsonEvent, EventProxy>();
  private routeHanlderFactory: RouteHandlerFactory;

  constructor(container: WatsonContainer) {
    this.container = container;
    this.scanner = new MetadataResolver(container);
    this.routeHanlderFactory = new RouteHandlerFactory(container);
  }

  public async explore() {
    this.logger.logMessage(EXPLORE_START());
    const receivers =
      this.container.globalInstanceHost.getAllInstancesOfType("receiver");

    for (const receiver of receivers) {
      const { wrapper } = receiver;

      this.logger.logMessage(EXPLORE_RECEIVER(receiver.wrapper));

      const {
        createCommandHandler,
        //  createEventHandler,
        //  createSlashHandler,
      } = this.routeHanlderFactory;

      // await this.reflectRoute(
      //   wrapper,
      //   EVENT_METADATA,
      //   EventRoute,
      //   createEventHandler,
      //   this.eventRoutes,
      //   (metadata: WatsonEvent) => metadata,
      //   MAP_EVENT
      // );

      await this.reflectRoute(
        wrapper,
        COMMAND_METADATA,
        CommandRoute,
        CommandProxy,
        [this.container.getCommands()],
        createCommandHandler,
        this.commandRoutes,
        () => WatsonEvent.MESSAGE_CREATE,
        MAP_COMMAND
      );

      //  await this.reflectRoute(
      //    wrapper,
      //    SLASH_COMMAND_METADATA,
      //    SlashRoute,
      //    createSlashHandler,
      //    this.slashRoutes,
      //    () => WatsonEvent.INTERACTION_CREATE,
      //    MAP_SLASH_COMMAND,
      //    true
      //  );
    }
    this.logger.logMessage(COMPLETED());
  }

  private async reflectCommands(receiver: InstanceWrapper<ReceiverDef>) {
    const { metatype } = receiver;
    const receiverMethods = this.reflecReceiverDefMehtods(metatype);
    for (const method of receiverMethods) {
      const { descriptor, name } = method;
      this.scanner.getMetadata<unknown[]>(DESIGN_PARAMETERS, metatype, name);
    }
  }

  private async reflectRoute<T extends string>(
    receiver: InstanceWrapper<ReceiverDef>,
    metadataKey: string,
    routeType: Type,
    eventProxyType: Type<EventProxy>,
    proxyArgs: unknown[],
    handlerFactory: HandlerFactory,
    collectionRef: Set<IBaseRoute>,
    eventFunction: (metadata: unknown) => WatsonEvent,
    logMessage: Function,
    isWsEvent?: boolean
  ) {
    const { metatype } = receiver;
    const receiverMethods = this.reflecReceiverDefMehtods(metatype);

    for (const method of receiverMethods) {
      const { descriptor } = method;
      const metadata = this.scanner.getMetadata<T>(metadataKey, descriptor);
      const receiverMetadata = this.scanner.getMetadata<T>(
        RECEIVER_METADATA,
        receiver.metatype
      );

      if (!metadata) {
        continue;
      }

      const routeRef = new routeType(
        metadata,
        receiverMetadata,
        receiver,
        descriptor,
        this.container
      );

      if (metadataKey === COMMAND_METADATA) {
        this.container.addCommand(routeRef);
      }

      const moduleId = this.container.generateTokenFromModule(receiver.host);

      const handler = await handlerFactory.call(
        this.routeHanlderFactory,
        routeRef,
        method.descriptor,
        receiver,
        moduleId
      );

      collectionRef.add(routeRef);
      this.logger.logMessage(logMessage(routeRef));

      const exceptionHandler = this.createExceptionHandler(
        receiver.metatype,
        method.descriptor,
        receiver.host
      );

      this.bindHandler(
        eventFunction(metadata),
        routeRef,
        eventProxyType,
        handler,
        exceptionHandler,
        proxyArgs
      );
    }
  }

  private reflecReceiverDefMehtods(receiver: Type) {
    return this.scanner.reflectMethodsFromMetatype(receiver);
  }

  private reflectExceptionHandlers(
    metadataKey: string,
    reflectee: Type | Function,
    module: Module
  ) {
    const handlerMetadata = this.scanner.getArrayMetadata<
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

  public getEventProxy(event: WatsonEvent) {
    return this.eventProxies.get(event);
  }

  private bindHandler(
    event: WatsonEvent,
    route: IBaseRoute,
    proxyType: Type,
    handler: LifecycleFunction,
    exceptionHandler: ExceptionHandler,
    proxyArgs: unknown[]
  ) {
    if (!this.eventProxies.has(event)) {
      this.eventProxies.set(event, new proxyType(...proxyArgs));
    }

    const proxyRef = this.eventProxies.get(event);
    proxyRef.bind(route, handler, exceptionHandler);
  }

  private createExceptionHandler(
    receiver: Type,
    method: Function,
    module: Module
  ) {
    const defaultHandlers = [new CommonExceptionHandler()];
    const customGlobalHandlers = this.container.getGlobalExceptionHandlers();
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
