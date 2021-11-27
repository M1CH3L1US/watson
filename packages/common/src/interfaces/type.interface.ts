/**
 * A Type is most likely a class definition provided by Reflect.
 */
export type Type<T = any> =
  | (new (...args: any[]) => T)
  | Function
  | FunctionConstructor;

export type Constructable<T = any> = abstract new (...args: any) =>
  | T
  | (new (...args: any) => T);
