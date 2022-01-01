import { Binding, createBinding, FactoryFnWithoutDeps } from '@di/core/binding';
import { DependencyGraph } from '@di/core/dependency-graph';
import { Injector, InjectorGetResult, NOT_FOUND, ProviderResolvable } from '@di/core/injector';
import { InquirerContext } from '@di/core/inquirer-context';
import { ModuleRef } from '@di/core/module-ref';
import { AfterResolution } from '@di/hooks';
import { isUseExistingProvider } from '@di/providers/custom-provider';
import { CustomProvider, FactoryProvider, UseExistingProvider } from '@di/providers/custom-provider.interface';
import { InjectFlag } from '@di/providers/inject-flag';
import { getInjectableDef, getProviderToken } from '@di/providers/injectable-def';
import { InjectorLifetime, Providable } from '@di/providers/injection-token';
import { resolveAsyncValue, stringify } from '@di/utils';
import { isFunction, isNil } from '@di/utils/common';

// @internal
// Shared implementation of internal injector
// capabilities.
// DO NOT use these functions outside
// of the core API.

/**
 * Binds a set of providers to an injector.
 */
export function ɵbindProviders(
  injector: Injector,
  /** The records map of the injector */
  records: Map<Providable, Binding | Binding[]>,
  providers: ProviderResolvable[]
): void {
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const token = getProviderToken(provider);
    const hasBinding = records.get(token);
    let binding: Binding;

    if (isUseExistingProvider(<CustomProvider>provider)) {
      const { provide, useExisting, multi } = <UseExistingProvider>provider;

      binding = createBinding({
        provide: provide,
        useFactory: () => injector.get(useExisting),
        multi,
      } as FactoryProvider);
    } else {
      binding = createBinding(provider);
    }

    const { multi } = binding;

    if (!isNil(hasBinding) && !multi) {
      const { providedIn } = getInjectableDef(token);
      /**
       * If this injector is the root injector,
       * it is likely that some providers are
       * added to this injector's provider scope
       * multiple times via modules or through
       * providedIn "root" `@Injectable` declarations.
       *
       * We can just skip over them as they were added
       * to the root injector already.
       */
      if (providedIn === "root") {
        continue;
      }

      throw `Found multiple providers with the same token: "${stringify(
        token
      )}" that are not \`multi\``;
    }

    const record = multi
      ? [...((hasBinding as Binding[]) ?? []), binding]
      : binding;
    records.set(token, record);
  }
}

/**
 * Checks the dependency graph for circular
 * dependencies in the current provider
 * resolution. Calls `Injector.get` continuing
 * the provider lookup.
 */
export function ɵresolveProvider<
  T extends Providable,
  R extends InjectorGetResult<T>
>(
  typeOrToken: T,
  injector: Injector,
  ctx: Injector | null,
  inquirerContext: InquirerContext,
  injectFlags: InjectFlag
): Promise<R> {
  const { dependencyGraph } = inquirerContext;
  dependencyGraph!.checkAndThrow(typeOrToken);
  dependencyGraph!.add(typeOrToken);
  return injector.get(
    typeOrToken,
    NOT_FOUND,
    ctx,
    inquirerContext,
    injectFlags
  );
}

/**
 * Fully resolves an instance using the
 * binding provided. Recursively looks
 * up all provider dependencies and
 * creates them as well.
 */
export async function ɵcreateBindingInstance<
  T extends Providable,
  D extends Providable[] | [],
  I extends InjectorGetResult<T>,
  B extends Binding<T, D, I> | Binding<T, D, I>[],
  R extends B extends Binding[] ? I[] : I
>(
  binding: B,
  injector: Injector,
  ctx: Injector | null,
  inquirerContext: InquirerContext
): Promise<R> {
  // MultiProviders return an array of bindings.
  if (Array.isArray(binding)) {
    const instances: I[] = [];
    for (let i = 0; i < binding.length; i++) {
      const instance = await ɵcreateBindingInstance(
        <Binding>binding[i],
        injector,
        ctx,
        inquirerContext
      );
      instances.push(<I>instance);
    }

    return instances as R;
  }

  const { deps, token, lifetime, injectFlags } = <Binding<T, D, I>>binding;
  const dependencyGraph = (inquirerContext.dependencyGraph ??=
    new DependencyGraph());
  let lookupCtx = ctx;

  /**
   * When dealing with module scoped dependencies
   * we're using the module injector as the key
   * for the binding instance map. Components are
   * treated as their own module as well.
   */
  if (lifetime & InjectorLifetime.Scoped) {
    lookupCtx = injector;
  }

  const instance = binding.getInstance(lookupCtx);

  if (
    !isNil(instance) &&
    // The binding only has static dependencies
    (binding.isDependencyTreeStatic() ||
      // We have a ContextInjector and the binding
      // we're looking for has an instance for that
      // context PLUS the binding doesn't have
      // purely transient dependencies
      (ctx === lookupCtx && !binding.isTransientByDependency()))
  ) {
    return <R>instance;
  }

  if (!binding.hasDependencies()) {
    const instance = await resolveAsyncValue(
      (<FactoryFnWithoutDeps>binding.factory)()
    );

    if (!binding.isTransient()) {
      binding.setInstance(<I>instance, lookupCtx);
    }

    return <R>instance;
  }

  dependencyGraph.add(token);
  const dependencies: unknown[] = [];

  for (let i = 0; i < (<D>deps).length; i++) {
    const dep = deps![i];
    const flags = injectFlags[i];
    let depInjector: Injector = injector;

    // In this instance skip
    if (dep === InquirerContext) {
      dependencies.push(<any>inquirerContext.seal());
      continue;
    }

    if (flags & InjectFlag.SkipSelf) {
      depInjector = injector.parent ?? Injector.NULL;
    } else if (flags & InjectFlag.Host) {
      depInjector = await injector.get(ModuleRef);
    }

    const dependencyContext = inquirerContext.clone(<Binding>binding, i);
    let depInstance = await ɵresolveProvider(
      dep,
      depInjector,
      ctx,
      dependencyContext,
      flags
    );

    if (depInstance === NOT_FOUND) {
      if (flags & InjectFlag.Optional) {
        depInstance = null;
      } else {
        await Injector.NULL.get(dep);
      }
    }

    dependencyGraph.remove(dep);
    dependencies.push(depInstance);
  }

  dependencyGraph.remove(token);

  const updatedDependencies = await binding.callBeforeResolutionHook(
    injector,
    <D>dependencies,
    inquirerContext
  );

  const _instance = await resolveAsyncValue(
    binding.factory(...(<D>updatedDependencies))
  );

  const { afterResolution } = <AfterResolution>_instance ?? {};

  if (isFunction(afterResolution)) {
    await resolveAsyncValue(afterResolution.call(_instance, injector));
  }

  if (!binding.isTransient()) {
    binding.setInstance(<I>_instance, lookupCtx);
  }

  return <R>_instance;
}
