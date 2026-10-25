# Reactivity

## Signals

`signal(initial)` returns an object with a mutable `.value` property:

```js
import { effect, signal } from "treegger";

const count = signal(0);
const watcher = effect(() => console.log(count.value));
count.value = 1;
watcher.stop();
```

An effect subscribes to the signals it reads during its latest run. Assigning the same value according to `Object.is` does not notify subscribers. Signal values can be shared at module scope across components.

A signal tracks assignments to `.value`, not mutations inside the value. For an array, `items.value.push(item)` changes the array without notifying effects. Assign a new array instead:

```js
const items = signal(["A"]);
items.value = [...items.value, "B"];
```

If you prefer mutating an array with `push`, put it in a [`store`](04_stores.md).

Effects run immediately when created. Later updates are queued in a microtask, so several synchronous writes can be handled in one pass. Dependencies are collected again on each run: a conditional effect stops following branches it no longer reads.

## Derived values

`derive(() => expression)` returns a lazy, cached derived value:

```js
import { derive, signal } from "treegger";

const price = signal(10);
const doubled = derive(() => price.value * 2);
console.log(doubled.value); // 20
price.value = 12;
console.log(doubled.value); // 24
doubled.dispose();
```

Like a signal, a derived value has a `.value` property. Read it in ordinary JavaScript or inside an effect. The calculation runs when `.value` is read and recalculates after a dependency changes. Reading a derived value inside an effect or rendering binding subscribes that consumer to updates. Read-only derived values warn if assigned at runtime; their TypeScript `.value` property is read-only.

Derived results are compared with `Object.is`. Effects, rendering bindings, and downstream computations skip their work when the result stays the same; their existing cleanup and DOM remain intact. This also applies to chains of derived values. A consumer that reads another changed signal directly still reruns for that signal.

Derived values can contain primitives, objects, arrays, functions, or renderable trees. Objects, arrays, functions, and trees are compared by reference. Functions can be held as data but cannot be rendered as children; use a component or return a Treegger tree from the derivation getter. Mutating an ordinary object returned by a derived value does not make its fields reactive; use signals or a store for reactive state. Keep derivation getters free of subscriptions and other side effects.

To render a derived value, pass the derived object as a child, such as `{doubled}` or `${doubled}`. It can also return JSX, an HTML template, an array of children, or `null`; see [conditional rendering with derived values](05_conditional-rendering.md#using-derive).

A derived value can also define a setter:

```js
const amount = signal(10);
const doubled = derive({
  get: () => amount.value * 2,
  set: next => { amount.value = next / 2; }
});
doubled.value = 30; // amount.value is 15
```

Derived values created inside a component or scope are disposed with their owner. A standalone derived value has a `dispose()` method.

### Equality options

`derive(getter, { equals })` controls whether a reevaluated result should update consumers. It does not change lazy evaluation, caching, or dependency tracking.

- Omitted `equals`: compare with `Object.is`.
- `equals: false`: every actual reevaluation counts as a change, even when it returns the same value or reference. Repeated reads without changed dependencies still use the cache.
- A comparison function: return `true` to treat the next result as equal. The previous cached value is retained and downstream consumers skip their work. Return `false` to cache and publish the next result.

```ts
const parity = derive(() => count.value % 2, { equals: false });

const selectedUser = derive(
  () => users.value.find(user => user.id === selectedId.value),
  { equals: (previous, next) => previous?.id === next?.id }
);
```

The comparator receives the last accepted cached value and the candidate result. It is not called for the first evaluation, and reads inside the comparator do not create dependencies. Keep comparison functions pure. Choose a comparator that covers every field consumers need: comparing only `id` deliberately ignores other changes for that same user and retains the previous object.

Use `equals: false` when consumers should run after each reevaluation, including unchanged results. It does not force evaluation when only an upstream derivation becomes dirty but ultimately keeps the same value. Changing an ordinary object in place still does not invalidate a derivation; a tracked dependency must change first.

Equality compares returned values or factory references, not JSX structure. Two independent JSX expressions produce different factories even when their markup is identical. Returning a stable factory reference preserves the current mounted branch by default; `equals: false` can force its replacement. See [conditional rendering](05_conditional-rendering.md).

> **Deprecated:** `computed()` remains available as a compatibility alias of `derive()`. Use `derive()` in new code. The corresponding types are `Derived<T>` and `WritableDerived<T>`, with `.value` and `.dispose()`. The old names `Computed<T>` and `WritableComputed<T>` remain as deprecated type aliases.

## Effects and cleanup

`effect(run)` is for work that should respond to reactive reads. It returns a handle with `active` and `stop()`. If `run` returns a function, Treegger calls that cleanup before the next run and when the effect stops:

```js
const query = signal("first");
const request = effect(() => {
  const controller = new AbortController();
  fetch(`/search?q=${encodeURIComponent(query.value)}`, {
    signal: controller.signal
  }).catch(error => {
    if (error.name !== "AbortError") console.error(error);
  });
  return () => controller.abort();
});

query.value = "second"; // abort the previous request before rerunning
request.stop();
```

This cleanup belongs to a single execution of the effect. For a subscription that lasts for the lifetime of a component, register it once and use [`onUnmount`](08_refs-and-lifecycle.md).

An effect created inside a component or `scope` is stopped when that owner is disposed. An effect created outside a scope remains active until `stop()` is called.

## Reactive rendering

Insert a signal or derived object as a child. Wrap derived expressions in `derive()` explicitly. Plain functions are not reactive children or DOM props; passing one there throws a `TypeError` without invoking it.

```jsx
<p>{count}</p>                            {/* updates */}
<p>{count.value}</p>                      {/* snapshot; does not update */}
<p>{derive(() => `Count: ${count.value}`)}</p>    {/* updates */}
<p>{doubled}</p>                          {/* derived value updates */}
<p>{doubled.value}</p>                    {/* snapshot; does not update */}
<p>{count} × 2 = {derive(() => count.value * 2)}</p>
```

```js
html`<p>${count}</p>`;                           // updates
html`<p>${count.value}</p>`;                     // snapshot; does not update
html`<p>${derive(() => `Count: ${count.value}`)}</p>`;   // updates
html`<p>${doubled}</p>`;                         // derived value updates
html`<p>${doubled.value}</p>`;                   // snapshot; does not update
html`<p>${count} × 2 = ${derive(() => count.value * 2)}</p>`;
```

Reading `.value` creates a subscription only while a reactive function runs, such as an effect, derivation getter, or a rendering binding reading a signal or derived value. JSX expressions and template interpolations are evaluated while constructing the tree, so passing their already-read values does not make them reactive.

When `doubled` changes, each binding displaying it updates its own real DOM text node. Treegger does not recreate the parent element or rerun its component. If an expression returns different elements instead of text, Treegger replaces that branch.

For conditional rendering, return a branch or `null` from a derivation getter:

```jsx
<section>{derive(() => visible.value ? <Panel /> : null)}</section>
```

The derivation getter reruns when `visible` changes. The mounted branch is disposed when it is replaced. Writing `{visible.value ? <Panel /> : null}` instead evaluates the condition only while constructing the tree.

Reactive props work the same way: `class={derive(() => active.value ? "on" : "off")}` in JSX, or `class=${derive(() => active.value ? "on" : "off")}` in an HTML template. A plain value is applied once.

DOM event props accept callbacks or explicit signal or derived sources of callbacks. A plain function is invoked as an event callback; a reactive source is read when the event occurs to select the current callback. Nullish values disable handling. This does not resubscribe the DOM listener. See [Event callbacks](02_rendering.md#event-callbacks) for JSX and HTML examples.

For nested state, see [Stores](04_stores.md).

## Reactive input types

`Reactive<T>` means `Signal<T> | Derived<T>`. Both expose `.value`, so components and effects can read them through one API:

```ts
import { derive, effect, type Reactive } from "treegger";

function observeCount(count: Reactive<number>) {
  const doubled = derive(() => count.value * 2);
  const watcher = effect(() => console.log(count.value, doubled.value));
  return () => { watcher.stop(); doubled.dispose(); };
}
```

Use ordinary types for values that are only needed when a component instance is created. `MaybeReactive<T>` means `T | Reactive<T>` and is used by DOM props and control inputs that accept both static and reactive values. If a custom component chooses to accept that union, narrow it explicitly; there is no automatic prop unwrapping. See [Plain and reactive component props](02_rendering.md#plain-and-reactive-component-props).
