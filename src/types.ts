/** A mutable reactive value. */
export interface Signal<T> {
  value: T;
}

/** A cached, read-only derived value. */
export interface Derived<T> {
  readonly value: T;
  dispose(): void;
}

/** Result equality: false reports every actual reevaluation as changed. */
export type Equality<T> = false | ((previous: T, next: T) => boolean);
export interface DeriveOptions<T> {
  /** Defaults to Object.is. Equal results retain the previous cached value. */
  equals?: Equality<T>;
}

export const writableComputedBrand: unique symbol = Symbol("treegger.writable-computed");
/** A derived value whose writes are handled by a setter. */
export interface WritableDerived<T> extends Derived<T> {
  readonly [writableComputedBrand]: true;
  value: T;
}

/** @deprecated Use Derived<T> instead. */
export type Computed<T> = Derived<T>;
/** @deprecated Use WritableDerived<T> instead. */
export type WritableComputed<T> = WritableDerived<T>;

type ReadonlyDerivedKeys<T> = {
  [K in keyof T]-?: T[K] extends WritableDerived<unknown> ? never : T[K] extends Derived<unknown> ? K : never;
}[keyof T];

type StoreAtomic = Date | RegExp | ReadonlyMap<unknown, unknown> | ReadonlySet<unknown>
  | WeakMap<object, unknown> | WeakSet<object> | PromiseLike<unknown> | ArrayBuffer | ArrayBufferView | Node
  | ((...arguments_: never[]) => unknown) | (abstract new (...arguments_: never[]) => object);

type StoreValue<T> = T extends WritableDerived<infer V> ? V
  : T extends Derived<infer V> ? V
  : T extends Signal<infer V> ? V
  : T extends StoreAtomic ? T
  : T extends DomRef<infer E> ? DomRef<E>
  : T extends Array<infer U> ? Array<U extends Signal<unknown> | Derived<unknown> ? U : StoreValue<U>>
  : T extends object ? Store<T>
  : T;

/** Deep reactive view. Derived fields are read-only; signals in array slots stay wrapped. */
export type Store<T extends object> = T extends StoreAtomic ? T : T extends Array<infer U>
  ? Array<U extends Signal<unknown> | Derived<unknown> ? U : StoreValue<U>>
  : { [K in Exclude<keyof T, ReadonlyDerivedKeys<T>>]: StoreValue<T[K]> }
    & { readonly [K in ReadonlyDerivedKeys<T>]: StoreValue<T[K]> };

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
export type Child = PrimitiveChild | Node | TreeggerElement | Signal<unknown> | Derived<unknown>
  | readonly Child[];
export type Component<P = Record<string, unknown>> = (props: P) => TreeggerNode;
/** An explicit reactive source. Both signals and computed values expose .value. */
export type Reactive<T> = Signal<T> | Derived<T>;
/** A static value or an explicit reactive source, for DOM props and control inputs. */
export type MaybeReactive<T> = T | Reactive<T>;
export type RefProp<E extends Element> = DomRef<E> | ((element: E | null, previous?: E) => void);
/** A callback whose return value is ignored; asynchronous rejections are handled by ErrorBoundary. */
export type EventHandler<E extends Event> = (event: E) => void;
/** A callback or an explicit reactive source of callbacks; nullish values disable handling. */
export type EventProp<E extends Event> = MaybeReactive<EventHandler<E> | null | undefined>;

export type ElementProps<E extends Element = Element> = {
  key?: Key;
  ref?: RefProp<E>;
  children?: Child;
  class?: MaybeReactive<string>;
  className?: MaybeReactive<string>;
  style?: MaybeReactive<string | Partial<CSSStyleDeclaration>>;
  id?: MaybeReactive<string>;
  title?: MaybeReactive<string>;
  role?: MaybeReactive<string>;
  type?: MaybeReactive<string>;
  name?: MaybeReactive<string>;
  placeholder?: MaybeReactive<string>;
  value?: MaybeReactive<string | number>;
  checked?: MaybeReactive<boolean>;
  disabled?: MaybeReactive<boolean>;
  href?: MaybeReactive<string>;
  src?: MaybeReactive<string>;
  alt?: MaybeReactive<string>;
  width?: MaybeReactive<string | number>;
  height?: MaybeReactive<string | number>;
  onClick?: EventProp<MouseEvent>;
  onclick?: EventProp<MouseEvent>;
  onInput?: EventProp<InputEvent>;
  oninput?: EventProp<InputEvent>;
  onChange?: EventProp<Event>;
  onchange?: EventProp<Event>;
  onSubmit?: EventProp<SubmitEvent>;
  onsubmit?: EventProp<SubmitEvent>;
  onKeyDown?: EventProp<KeyboardEvent>;
  onkeydown?: EventProp<KeyboardEvent>;
  [attribute: `data-${string}`]: MaybeReactive<string | number | boolean | null | undefined>;
  [attribute: `aria-${string}`]: MaybeReactive<string | number | boolean | null | undefined>;
} & (E extends SVGElement ? {
  xmlns?: MaybeReactive<string>;
  viewBox?: MaybeReactive<string>;
  preserveAspectRatio?: MaybeReactive<string>;
  d?: MaybeReactive<string>;
  x?: MaybeReactive<string | number>;
  y?: MaybeReactive<string | number>;
  x1?: MaybeReactive<string | number>;
  y1?: MaybeReactive<string | number>;
  x2?: MaybeReactive<string | number>;
  y2?: MaybeReactive<string | number>;
  cx?: MaybeReactive<string | number>;
  cy?: MaybeReactive<string | number>;
  r?: MaybeReactive<string | number>;
  rx?: MaybeReactive<string | number>;
  ry?: MaybeReactive<string | number>;
  points?: MaybeReactive<string>;
  transform?: MaybeReactive<string>;
  fill?: MaybeReactive<string>;
  stroke?: MaybeReactive<string>;
  strokeWidth?: MaybeReactive<string | number>;
  strokeLinecap?: MaybeReactive<string>;
  strokeLinejoin?: MaybeReactive<string>;
  strokeDasharray?: MaybeReactive<string | number>;
  strokeDashoffset?: MaybeReactive<string | number>;
  strokeMiterlimit?: MaybeReactive<string | number>;
  strokeOpacity?: MaybeReactive<string | number>;
  fillOpacity?: MaybeReactive<string | number>;
  fillRule?: MaybeReactive<string>;
  clipRule?: MaybeReactive<string>;
  clipPath?: MaybeReactive<string>;
  markerStart?: MaybeReactive<string>;
  markerMid?: MaybeReactive<string>;
  markerEnd?: MaybeReactive<string>;
  fontSize?: MaybeReactive<string | number>;
  fontFamily?: MaybeReactive<string>;
  textAnchor?: MaybeReactive<string>;
  dominantBaseline?: MaybeReactive<string>;
  vectorEffect?: MaybeReactive<string>;
  pathLength?: MaybeReactive<string | number>;
  gradientUnits?: MaybeReactive<string>;
  gradientTransform?: MaybeReactive<string>;
  offset?: MaybeReactive<string | number>;
  stopColor?: MaybeReactive<string>;
  stopOpacity?: MaybeReactive<string | number>;
  'xlink:href'?: MaybeReactive<string>;
} : object);

export type ListSource<T> = readonly T[] | null | undefined
  | Signal<readonly T[] | null | undefined>
  | Derived<readonly T[] | null | undefined>;
export interface EachProps<T> {
  items: ListSource<T>;
  children: (item: T) => TreeggerElement;
  fallback?: Child;
}
export interface ErrorBoundaryProps {
  children?: Child;
  fallback?: Child | ((error: unknown, reset: () => void) => Child);
}

/** Detach and reattach the same DOM nodes while keeping the branch's state and effects alive. */
export interface PreserveProps {
  when?: MaybeReactive<boolean>;
  children?: Child;
}

/** Named component functions available to an HTML template tag. */
export type HtmlComponentRegistry = Readonly<Record<string, (props: never) => TreeggerNode>>;
/** HTML template tag with an immutable, extendable component registry. */
export interface HtmlTemplate {
  (strings: TemplateStringsArray, ...values: unknown[]): Tree;
  with(components: HtmlComponentRegistry): HtmlTemplate;
}
