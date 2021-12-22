import { Binding, createBinding, getInjectableDef } from "@di/core/binding";
import {
  Injector,
  InjectorGetResult,
  NOT_FOUND,
  ProviderResolvable,
} from "@di/core/injector";
import { ModuleRef } from "@di/core/module-ref";
import { UniqueTypeArray } from "@di/data-structures";
import { Providable, ValueProvider } from "@di/providers";
import { Type } from "@di/types";
import { isNil } from "@di/utils/common";

export abstract class WatsonComponentRef<T = any> implements Injector {
  public parent: ModuleRef | null;
  public readonly metatype: Type;

  public instance: T | null = null;

  public get name() {
    return this.metatype.name;
  }

  protected _injector: Injector;

  /**
   * Context providers are not bound to the injector of the
   * component or the module but instead are bound to
   * every context injector created for- an event bound in this
   * router.
   */
  private _contextProviders = new UniqueTypeArray<Binding>();
  constructor(
    metatype: Type,
    providers: ProviderResolvable[],
    moduleRef: ModuleRef
  ) {
    this.metatype = metatype;
    this.parent = moduleRef;

    const injectorProviders = this._bindProviders(providers);
    this._injector = Injector.create(
      [
        ...injectorProviders,
        metatype,
        {
          provide: WatsonComponentRef,
          useValue: this,
          multi: false,
        } as ValueProvider,
      ],
      moduleRef,
      moduleRef
    );
  }

  protected _bindProviders(
    providers: ProviderResolvable[]
  ): ProviderResolvable[] {
    return providers
      .map((provider) => {
        const { providedIn } = getInjectableDef(provider);

        if (providedIn === "ctx") {
          this._contextProviders.add(createBinding(provider));
          return false;
        }
        return provider;
      })
      .filter(Boolean) as ProviderResolvable[];
  }

  public async getInstance(ctx?: Injector): Promise<T> {
    if (!isNil(this.instance)) {
      return this.instance;
    }

    return this._injector.get(this.metatype, null, ctx);
  }

  public async get<T extends Providable, R extends InjectorGetResult<T>>(
    typeOrToken: T,
    notFoundValue?: any,
    ctx?: Injector
  ): Promise<R> {
    const resolved = await this._injector.get(typeOrToken, NOT_FOUND, ctx);

    /**
     * It's okay for router injectors not to
     * have all providers that they require
     * to resolve a given value. Usually we
     * need to use the module injector which
     * holds all resolvable providers available
     * to routers in their module scope.
     */
    if (resolved === NOT_FOUND) {
      return (
        this.parent?.get(typeOrToken, notFoundValue, ctx) ??
        // If the router isn't part of a module, throw a NullInjector error.
        Injector.NULL.get(typeOrToken, notFoundValue)
      );
    }

    return resolved as R;
  }
}

export class ɵComponentRefImpl extends WatsonComponentRef {}