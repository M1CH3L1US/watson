import { Injectable } from "@di/decorators";
import { Type } from "@di/types";

import { DependencyGraph } from "./dependency-graph";
import { Injector } from "./injector";

import type { Binding } from "./binding";
/**
 * Provides metadata information about
 * the inquirer who requested a provider
 * from an injector.
 */
@Injectable({ providedIn: InjectorInquirerContext })
export class InjectorInquirerContext<
  T extends Binding | typeof Injector | Type = Binding | typeof Injector | Type
> {
  /**
   * The {@link Binding} from which the current
   * provider was requested. If the provider was not
   * resolved using constructor injection,
   * it will have the type {@link Injector}.
   */
  inquirer: T;
  /**
   * The parameter index the current provider
   * will be injected into.
   *
   * `null` if it was not requested
   * by a factory or constructor function
   * through constructor injection.
   */
  parameterIdx: number | null;
  /**
   * The dependency resolution graph that
   * lead to the resolution of this provider.
   *
   * `null` if there are no prior
   * dependencies.
   */
  dependencyGraph: DependencyGraph | null;

  constructor(
    inquirer: T = <T>Injector,
    parameterIdx: number | null = null,
    dependencyGraph: DependencyGraph | null = null
  ) {
    this.inquirer = inquirer;
    this.parameterIdx = parameterIdx;
    this.dependencyGraph = dependencyGraph;
  }

  public clone(inquirer: Binding, parameterIdx: number | null = null) {
    return new InjectorInquirerContext(
      inquirer,
      parameterIdx,
      this.dependencyGraph
    );
  }

  public seal() {
    let graph = null;

    if (this.dependencyGraph) {
      graph = new DependencyGraph();
      graph.dependencies = this.dependencyGraph!.dependencies;
    }

    return new InjectorInquirerContext(this.inquirer, this.parameterIdx, graph);
  }
}