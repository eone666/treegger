# API reference

Import runtime functions from `treegger`. The package also exports `treegger/jsx-runtime` and `treegger/jsx-dev-runtime` for automatic JSX transforms. Application code normally uses the transform instead of importing those subpaths.

## Reactive state

| Export | Signature | Behavior |
| --- | --- | --- |
| `signal` | `signal<T>(initial: T): Signal<T>` | Mutable reactive `.value`; writes notify readers when the value changes according to `Object.is`. |
| `derive` | `derive<T>(() => T, options?: DeriveOptions<T>): Derived<T>` | Lazy, cached, read-only derived value; has `dispose()`. |
| `derive` | `derive<T>({ get, set }, options?: DeriveOptions<T>): WritableDerived<T>` | Derived value whose `.value` can be assigned through `set`. |
| `computed` | `typeof derive` | Deprecated compatibility alias. Prefer `derive`. |
| `store` | `store<T extends object>(initial: T): Store<T>` | Deep reactive proxy for a plain object or array. |
| `effect` | `effect(run: () => void \| (() => void)): EffectHandle` | Runs immediately and reruns after tracked dependencies change. Handle exposes `active` and `stop()`. |

Read [Reactivity](03_reactivity.md) and [Stores](04_stores.md) for dependency tracking, scheduling, and unwrapping rules.

## Rendering

| Export | Purpose |
| --- | --- |
| `html` | Tagged template: `html` followed by a template literal. Returns a Treegger tree. |
| `html.with(components)` | Returns a new HTML template tag with named components. Registries can be extended without changing the original tag. See [Rendering](02_rendering.md#named-components). |
| `createElement` | Creates an element or component tree from a tag, props, and children. JSX users normally do not call it. |
| `component` | Wraps a component function and props as a tree in plain JavaScript. |
| `Fragment` | Groups children without a visible wrapper. |
| `Preserve` | Detaches and reattaches the same DOM nodes according to `when`, retaining component state and effects. |
| `Each` | Renders a keyed list with optional fallback. |
| `ErrorBoundary` | Catches errors in its owned child branch and renders fallback content. |
| `mount` | `mount(tree, target)` appends a tree or DOM node and returns an unmount function. |
| `jsx`, `jsxs`, `jsxDEV` | Automatic JSX runtime entry points used by a JSX transform. |

The `key` prop identifies a row to `Each`. `ref` attaches a DOM reference. Neither is written as an HTML attribute. See [Rendering](02_rendering.md), [Preserve](06_preserve.md), [Lists](07_lists.md), and [Error boundaries](09_error-boundaries.md).

## Lifecycle and diagnostics

| Export | Signature | Behavior |
| --- | --- | --- |
| `ref` | `ref<E extends Element = HTMLElement>(): DomRef<E>` | Holds `element: E \| null`. Pass the ref object as an element's `ref` prop. |
| `onUnmount` | `onUnmount(() => void): void` | Registers cleanup in the current component or scope. |
| `scope` | `scope<T>(() => T): { value: T; owner: ScopeHandle }` | Runs code in an owned scope; `owner.dispose()` releases its work. |
| `debug` | `debug(tree, options?: DebugOptions): DebugTree` | Wraps one tree for update highlighting. `showUpdates` defaults to `true`. |

`debug` highlights reactive DOM updates in its mounted tree. Other mounted trees are unaffected. A component function does not rerun for every such update. The highlight uses the browser's `Element.animate` API when available.

```js
import { debug, html, mount, signal } from "treegger";

const count = signal(0);
mount(debug(html`<button onClick=${() => { count.value++; }}>${count}</button>`,
  { showUpdates: true }), document.getElementById("app"));
```

`mount(debug(tree), target)` enables the same highlight with the default config. Use `{ showUpdates: false }` to disable it. It does not report every browser paint or a count of component calls.

See [Refs and lifecycle](08_refs-and-lifecycle.md).

## Exported TypeScript types

| Type | Meaning |
| --- | --- |
| `Signal<T>` | Mutable `.value`. |
| `Equality<T>`, `DeriveOptions<T>` | Result comparison: `Object.is` by default, `false` to publish every reevaluation, or a custom comparator that retains equal cached results. |
| `Derived<T>` | Read-only `.value` and `dispose()`. |
| `WritableDerived<T>` | Derived value with assignable `.value`. |
| `Computed<T>`, `WritableComputed<T>` | Deprecated aliases of `Derived<T>` and `WritableDerived<T>`. |
| `Store<T>` | Type of the unwrapped deep reactive view returned by `store`. |
| `EffectHandle` | `active` and `stop()`. |
| `ScopeHandle` | `active` and `dispose()`. |
| `DebugTree`, `DebugOptions` | Debug wrapper and its optional update highlighting config. |
| `DomRef<E>`, `RefProp<E>` | DOM ref object and accepted `ref` prop values. |
| `TreeggerElement` | Tree from JSX or `html`; `Tree \| ListTree`. |
| `TreeggerNode` | Any value accepted as element content or a component result; alias of `Child`. |
| `Tree`, `ListTree`, `Child`, `PrimitiveChild` | Lower-level tree and child types. |
| `HtmlTemplate`, `HtmlComponentRegistry` | HTML template tag with `.with()` and its named component registry. |
| `Component<P>` | Function component type returning `TreeggerNode`. |
| `ElementProps<E>`, `Reactive<T>`, `MaybeReactive<T>` | `Reactive<T>` is `Signal<T> \| Derived<T>`; `MaybeReactive<T>` also allows a static `T`. |
| `EventHandler<E>`, `EventProp<E>` | A plain event callback, or a callback/reactive or nullish event prop. Reactive event sources are read at dispatch without resubscribing the listener. |
| `Key` | String, number, or symbol key. |
| `ListSource<T>`, `EachProps<T>` | Accepted list source and `Each` props. |
| `ErrorBoundaryProps` | Boundary children and fallback. |
| `PreserveProps` | `when` source and preserved children. |

For concrete TypeScript usage, see [the consumer type fixture](../../test/types.tsx).

```tsx
import { html, type TreeggerElement } from "treegger";

type MyComponent = () => TreeggerElement;

const HtmlComponent: MyComponent = () => html`<p>Hello</p>`;
const JsxComponent: MyComponent = () => <p>Hello</p>;
```

Use `TreeggerNode` for children, fallback content, and component return types. It includes `TreeggerElement`, primitives, signals, derived values, and arrays. Plain functions are not renderable children.
