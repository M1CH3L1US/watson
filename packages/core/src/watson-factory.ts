import { NewableTo } from '@core/di';
import { isNil, Type, ValueProvider } from '@watsonjs/common';

import { AdapterRef, Injector } from '.';
import { ModuleLoader } from './di/module-loader';
import { BootstrappingHandler } from './exceptions/revisit/bootstrapping-handler';
import { WatsonClientBase } from './interfaces';
import { LifecycleHost } from './lifecycle/hooks';
import { CREATE_APP_CONTEXT, Logger } from './logger';
import { ApplicationRef, WatsonApplication } from './watson-application';

const DEFAULT_ADAPTER_PACKAGE = "@watsonjs/platform-discordjs";

export class WatsonFactory {
  private static logger = new Logger("WatsonFactory");

  private static async getAdapterOrDefault(
    adapter: NewableTo<AdapterRef> | undefined
  ): Promise<NewableTo<AdapterRef>> {
    if (!isNil(adapter)) {
      return adapter as NewableTo<AdapterRef>;
    }

    try {
      const { DiscordJsAdapter } = await import(DEFAULT_ADAPTER_PACKAGE);

      return DiscordJsAdapter as NewableTo<AdapterRef>;
    } catch (err: unknown) {
      this.logger.logException(
        "Could not import the default discord adapter from '@watsonjs/platform-discordjs'. Make sure that either this package is installed or provide a different adapter implementation.",
        err
      );
      throw err;
    }
  }

  public static async create<T extends WatsonClientBase>(
    module: Type,
    options?: WatsonClientBase,
    adapter?: NewableTo<AdapterRef>
  ): Promise<WatsonApplication> {
    this.logger.logMessage(CREATE_APP_CONTEXT());
    const AdapterCtor = await this.getAdapterOrDefault(adapter);
    const adapterRef = new AdapterCtor(options);

    const rootInjector = Injector.create(
      this.GET_APPLICATION_PROVIDERS(adapterRef),
      Injector.NULL
    );

    await this.initialize(module, rootInjector);

    const applicationRef = new WatsonApplication(rootInjector);

    rootInjector.bind({
      provide: ApplicationRef,
      useValue: applicationRef,
    } as ValueProvider);

    return applicationRef;
  }

  private static GET_APPLICATION_PROVIDERS(
    adapter: AdapterRef
  ): ValueProvider[] {
    return [
      {
        provide: AdapterRef,
        useValue: adapter,
      },
    ];
  }

  private static async initialize(module: Type, injector: Injector) {
    const loader = new ModuleLoader(injector);
    const lifecycleHost = new LifecycleHost(injector);

    await BootstrappingHandler.run(async () => {
      await loader.resolveRootModule(module);
      await lifecycleHost.callOnModuleInitHook();
    });
  }
}
