/** A mutable reactive value. */
export interface Signal<T> {
  value: T;
}

/** A cached, read-only derived value. */
export interface Computed<T> {
  readonly value: T;
  dispose(): void;
}

export const writableComputedBrand: unique symbol = Symbol("treegger.writable-computed");
/** A derived value whose writes are handled by a setter. */
export interface WritableComputed<T> extends Computed<T> {
  readonly [writableComputedBrand]: true;
  value: T;
}


type ReadonlyComputedKeys<T> = {
  [K in keyof T]-?: T[K] extends WritableComputed<unknown> ? never : T[K] extends Computed<unknown> ? K : never;
}[keyof T];

type StoreValue<T> = T extends WritableComputed<infer V> ? V
  : T extends Computed<infer V> ? V
  : T extends Signal<infer V> ? V
  : T extends Array<infer U> ? Array<U extends Signal<unknown> | Computed<unknown> ? U : StoreValue<U>>
  : T extends object ? Store<T>
  : T;

/** Deep reactive view. Computed fields are read-only; signals in array slots stay wrapped. */
export type Store<T extends object> = T extends Array<infer U>
  ? Array<U extends Signal<unknown> | Computed<unknown> ? U : StoreValue<U>>
  : { [K in Exclude<keyof T, ReadonlyComputedKeys<T>>]: StoreValue<T[K]> }
    & { readonly [K in ReadonlyComputedKeys<T>]: StoreValue<T[K]> };

export interface EffectHandle {
  readonly active: boolean;
  stop(): void;
}
export interface ScopeHandle {
  readonly active: boolean;
  dispose(): void;
}

export interface DomRef<E extends Element = HTMLElement> {
  element: E | null;
  readonly refCallback: (element: E | null, previous?: E) => void;
}

export type Key = string | number | symbol;
export type PrimitiveChild = string | number | bigint | boolean | null | undefined;
export type Tree = () => Node;
/** A tree whose reactive DOM updates are highlighted when mounted. */
export interface DebugTree {
  readonly tree: Tree | ListTree | Node;
}
export interface DebugOptions {
  showUpdates?: boolean;
}
export interface ListTree {
  readonly source: unknown;
  readonly render: (item: unknown) => unknown;
  readonly fallback: unknown;
}
/** A Treegger element or list produced by JSX or an HTML template. */
export type TreeggerElement = Tree | ListTree;
/** Any value accepted as an element child or component result. */
export type TreeggerNode = Child;
export type Child = PrimitiveChild | Node | TreeggerElement | Signal<unknown> | Computed<unknown>
  | (() => Child) | readonly Child[];
export type Component<P = Record<string, unknown>> = (props: P) => TreeggerNode;
export type Reactive<T> = T | Signal<T> | Computed<T> | (() => T);
export type RefProp<E extends Element> = DomRef<E> | ((element: E | null, previous?: E) => void);
export type EventHandler<E extends Event> = (event: E) => void | Promise<void>;

export type ElementProps<E extends Element = Element> = {
  key?: Key;
  ref?: RefProp<E>;
  children?: Child;
  class?: Reactive<string>;
  className?: Reactive<string>;
  style?: Reactive<string | Partial<CSSStyleDeclaration>>;
  id?: Reactive<string>;
  title?: Reactive<string>;
  role?: Reactive<string>;
  type?: Reactive<string>;
  name?: Reactive<string>;
  placeholder?: Reactive<string>;
  value?: Reactive<string | number>;
  checked?: Reactive<boolean>;
  disabled?: Reactive<boolean>;
  href?: Reactive<string>;
  src?: Reactive<string>;
  alt?: Reactive<string>;
  onClick?: EventHandler<MouseEvent>;
  onclick?: EventHandler<MouseEvent>;
  onInput?: EventHandler<InputEvent>;
  oninput?: EventHandler<InputEvent>;
  onChange?: EventHandler<Event>;
  onchange?: EventHandler<Event>;
  onSubmit?: EventHandler<SubmitEvent>;
  onsubmit?: EventHandler<SubmitEvent>;
  onKeyDown?: EventHandler<KeyboardEvent>;
  onkeydown?: EventHandler<KeyboardEvent>;
  [attribute: `data-${string}`]: Reactive<string | number | boolean | null | undefined>;
  [attribute: `aria-${string}`]: Reactive<string | number | boolean | null | undefined>;
};

export type ListSource<T> = readonly T[] | null | undefined
  | Signal<readonly T[] | null | undefined>
  | Computed<readonly T[] | null | undefined>
  | (() => readonly T[] | null | undefined);
export interface EachProps<T> {
  items: ListSource<T>;
  children: (item: T) => TreeggerElement;
  fallback?: Child;
}
export interface ErrorBoundaryProps {
  children?: Child;
  fallback?: Child | ((error: unknown, reset: () => void) => Child);
}

/** Keep a mounted branch in the DOM while toggling its visibility. */
export interface PreserveProps {
  when?: Reactive<boolean>;
  children?: Child;
}
