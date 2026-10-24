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

If you prefer mutating an array with `push`, put it in a [`store`](4_stores.md).

Effects run immediately when created. Later updates are queued in a microtask, so several synchronous writes can be handled in one pass. Dependencies are collected again on each run: a conditional effect stops following branches it no longer reads.

## Computed values

`computed(() => expression)` returns a lazy, cached derived value:

```js
import { computed, signal } from "treegger";

const price = signal(10);
const doubled = computed(() => price.value * 2);
console.log(doubled.value); // 20
price.value = 12;
console.log(doubled.value); // 24
doubled.dispose();
```

Like a signal, a computed value has a `.value` property. Read it in ordinary JavaScript or inside an effect. The calculation runs when `.value` is read and recalculates after a dependency changes. Reading a computed value inside an effect or rendering binding subscribes that consumer to updates. Read-only computed values warn if assigned at runtime; their TypeScript `.value` property is read-only.

Computed results are compared with `Object.is`. Effects, rendering bindings, and downstream computations skip their work when the result stays the same; their existing cleanup and DOM remain intact. This also applies to chains of computed values. A consumer that reads another changed signal directly still reruns for that signal.

Computed values can contain primitives, objects, arrays, functions, or renderable trees. Objects, arrays, functions, and trees are compared by reference. Functions can be held as data but cannot be rendered as children; use a component or return a Treegger tree from the computed getter. Mutating an ordinary object returned by a computed value does not make its fields reactive; use signals or a store for reactive state. Keep computed getters free of subscriptions and other side effects.

To render a computed value, pass the computed object as a child, such as `{doubled}` or `${doubled}`. It can also return JSX, an HTML template, an array of children, or `null`; see [conditional rendering with computed values](5_conditional-rendering.md#using-computed).

A computed value can also define a setter:

```js
const amount = signal(10);
const doubled = computed({
  get: () => amount.value * 2,
  set: next => { amount.value = next / 2; }
});
doubled.value = 30; // amount.value is 15
```

Computed values created inside a component or scope are disposed with their owner. A standalone computed value has a `dispose()` method.

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

This cleanup belongs to a single execution of the effect. For a subscription that lasts for the lifetime of a component, register it once and use [`onUnmount`](8_refs-and-lifecycle.md).

An effect created inside a component or `scope` is stopped when that owner is disposed. An effect created outside a scope remains active until `stop()` is called.

## Reactive rendering

Insert a signal or computed object as a child. Wrap derived expressions in `computed()` explicitly. Plain functions are not reactive children or DOM props; passing one there throws a `TypeError` without invoking it.

```jsx
<p>{count}</p>                            {/* updates */}
<p>{count.value}</p>                      {/* snapshot; does not update */}
<p>{computed(() => `Count: ${count.value}`)}</p>    {/* updates */}
<p>{doubled}</p>                          {/* computed value updates */}
<p>{doubled.value}</p>                    {/* snapshot; does not update */}
<p>{count} × 2 = {computed(() => count.value * 2)}</p>
```

```js
html`<p>${count}</p>`;                           // updates
html`<p>${count.value}</p>`;                     // snapshot; does not update
html`<p>${computed(() => `Count: ${count.value}`)}</p>`;   // updates
html`<p>${doubled}</p>`;                         // computed value updates
html`<p>${doubled.value}</p>`;                   // snapshot; does not update
html`<p>${count} × 2 = ${computed(() => count.value * 2)}</p>`;
```

Reading `.value` creates a subscription only while a reactive function runs, such as an effect, computed getter, or a rendering binding reading a signal or computed. JSX expressions and template interpolations are evaluated while constructing the tree, so passing their already-read values does not make them reactive.

When `doubled` changes, each binding displaying it updates its own real DOM text node. Treegger does not recreate the parent element or rerun its component. If an expression returns different elements instead of text, Treegger replaces that branch.

For conditional rendering, return a branch or `null` from a computed getter:

```jsx
<section>{computed(() => visible.value ? <Panel /> : null)}</section>
```

The computed getter reruns when `visible` changes. The mounted branch is disposed when it is replaced. Writing `{visible.value ? <Panel /> : null}` instead evaluates the condition only while constructing the tree.

Reactive props work the same way: `class={computed(() => active.value ? "on" : "off")}` in JSX, or `class=${computed(() => active.value ? "on" : "off")}` in an HTML template. A plain value is applied once.

DOM event props accept callbacks or explicit signal/computed sources of callbacks. A plain function is invoked as an event callback; a reactive source is read when the event occurs to select the current callback. Nullish values disable handling. This does not resubscribe the DOM listener. See [Event callbacks](2_rendering.md#event-callbacks) for JSX and HTML examples.

For nested state, see [Stores](4_stores.md).

## Reactive input types

`Reactive<T>` means `Signal<T> | Computed<T>`. Both expose `.value`, so components and effects can read them through one API:

```ts
import { computed, effect, type Reactive } from "treegger";

function observeCount(count: Reactive<number>) {
  const doubled = computed(() => count.value * 2);
  const watcher = effect(() => console.log(count.value, doubled.value));
  return () => { watcher.stop(); doubled.dispose(); };
}
```

Use ordinary types for values that are only needed when a component instance is created. `MaybeReactive<T>` means `T | Reactive<T>` and is used by DOM props and control inputs that accept both static and reactive values. If a custom component chooses to accept that union, narrow it explicitly; there is no automatic prop unwrapping. See [Plain and reactive component props](2_rendering.md#plain-and-reactive-component-props).
