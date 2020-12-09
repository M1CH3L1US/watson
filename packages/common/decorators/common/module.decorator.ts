import { MODULE_IMPORT_METADTA, MODULE_PROVIDER_METADTA, MODULE_RECEIVER_METADTA } from 'packages/common/constants';
import { isNil } from 'packages/common/utils';

import { Type } from '../../types';

export interface IModuleOptions {
  imports?: Type<any>[];
  receivers?: Type<any>[];
  providers?: Type<any>[];
}

export function Module(moduleOptions?: IModuleOptions): ClassDecorator {
  const [imports, receivers, providers] = isNil(moduleOptions)
    ? [undefined, undefined, undefined]
    : [moduleOptions.imports, moduleOptions.receivers, moduleOptions.providers];

  return (target: Object) => {
    Reflect.defineMetadata(MODULE_IMPORT_METADTA, imports, target);
    Reflect.defineMetadata(MODULE_RECEIVER_METADTA, receivers, target);
    Reflect.defineMetadata(MODULE_PROVIDER_METADTA, providers, target);
  };
}