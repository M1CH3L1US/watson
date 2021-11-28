import { Binding, DynamicInjector, Reflector } from '@core/di';
import {
  ClassProvider,
  CustomProvider,
  DIProvided,
  FactoryProvider,
  HasProv,
  InjectableOptions,
  InjectionToken,
  isNil,
  Providable,
  Type,
  UseExistingProvider,
  ValueProvider,
  W_BINDING_DEF,
  W_PROV,
  ɵdefineInjectable,
} from '@watsonjs/common';

import { NullInjector } from './null-injector';

export type ProviderResolvable<T = any> = CustomProvider<T> | Type<T>;

export const INJECTOR = new InjectionToken<Injector>(
  "The current module injector for a given module.",
  {
    providedIn: "module",
  }
);

export const ROOT_INJECTOR = new InjectionToken<Injector>(
  "The application root injector"
);

export type InjectorGetResult<T> = T extends InjectionToken<infer R>
  ? R
  : T extends new (...args: any[]) => infer R
  ? R
  : T extends abstract new (...args: any[]) => any
  ? InstanceType<T>
  : never;

/**
 * If it's okay for the injector to
 * not find a specific token, provide
 * this constant as the default value.
 * That way, if no provider is found,
 * it is returned by the `NullInjector`
 */
export const NOT_FOUND = {};

export abstract class Injector extends DIProvided({ providedIn: "module" }) {
  public static NULL = new NullInjector();

  public parent: Injector | null = null;

  public abstract get<T extends Providable, R extends InjectorGetResult<T>>(
    typeOrToken: T,
    notFoundValue?: any,
    ctx?: Injector
  ): Promise<R>;

  static create(
    providers: ProviderResolvable[],
    parent: Injector | null = null,
    scope: any | null = null,
    component: boolean = false
  ) {
    return new DynamicInjector(providers, parent, scope, component);
  }
}

export function getTokenFromProvider(provider: ProviderResolvable): Providable {
  if (!isCustomProvider(provider)) {
    return provider;
  }

  return provider.provide;
}

export function isCustomProvider(provider: any): provider is CustomProvider {
  return provider && "provide" in provider;
}

export function isUseExistingProvider(
  provider: CustomProvider
): provider is UseExistingProvider {
  return provider && "useExisting" in provider;
}

export function isClassProvider(
  provider: CustomProvider
): provider is ClassProvider {
  return provider && "useClass" in provider;
}

export function isFactoryProvider(
  provider: CustomProvider
): provider is FactoryProvider {
  return provider && "useFactory" in provider;
}

export function isValueProvider(
  provider: CustomProvider
): provider is ValueProvider {
  return provider && "useValue" in provider;
}

export function createResolvedBinding(provider: ValueProvider): Binding {
  const { provide, useValue, multi } = provider;
  const { lifetime, providedIn } = getInjectableDef(provider);

  const binding = new Binding(provide, lifetime, providedIn, () => useValue);

  binding.metatype = provider;
  binding.multi = multi ?? false;

  return binding;
}

export function getProviderType(
  provider: ProviderResolvable
): Type | InjectionToken {
  if (isCustomProvider(provider)) {
    return provider.provide;
  }

  return provider;
}

export function getInjectableDef(
  typeOrProvider: ProviderResolvable | Providable
): Required<InjectableOptions> {
  if (isNil(typeOrProvider)) {
    throw "Can't get injectable definition of null or undefined";
  }

  let typeOrToken: Type | InjectionToken = typeOrProvider as Type;

  if (isCustomProvider(typeOrProvider)) {
    const { provide } = typeOrProvider;
    typeOrToken = provide;
  }

  let injectableDef = (<HasProv>(<any>typeOrToken))[W_PROV];

  if (isNil(injectableDef)) {
    injectableDef = ɵdefineInjectable(typeOrToken);
  }

  return injectableDef;
}

export function createBinding(provider: ProviderResolvable): Binding {
  const { lifetime, providedIn } = getInjectableDef(provider);

  if (!isCustomProvider(provider)) {
    const deps = Reflector.reflectCtorArgs(provider);

    const binding = new Binding(provider, lifetime, providedIn);
    binding.metatype = provider;
    binding.deps = deps;
    binding.factory = (...args) => Reflect.construct(provider as Type, args);
    provider[W_BINDING_DEF] = binding;
    return binding;
  }

  const { provide, multi } = provider;
  const binding = new Binding(provide, lifetime, providedIn);
  provide[W_BINDING_DEF] = binding;
  binding.multi = multi ?? false;
  /**
   * UseExisting providers are handled
   * by the injector itself as they
   * point to a different binding.
   */
  if (isClassProvider(provider)) {
    const { useClass, deps } = provider;
    binding.metatype = useClass;
    binding.deps = deps;
    binding.factory = (...args) => Reflect.construct(useClass, args);
  } else if (isFactoryProvider(provider)) {
    const { useFactory, deps } = provider;
    binding.metatype = useFactory;
    binding.deps = deps;
    binding.factory = (...args) => useFactory(...args);
  } else {
    const { useValue } = provider as ValueProvider;
    binding.metatype = useValue;
    binding.factory = () => useValue;
  }

  return binding;
}
