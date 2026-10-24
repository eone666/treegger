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

Insert a signal or computed value as a child for direct reactive text. Use a function for expressions that read reactive values:

A function passed as a child or reactive prop creates a **local reactive binding**. Treegger runs it, tracks the signals and computed values it reads, and reruns it when those dependencies change. It is similar to an implicit computation for that one DOM location. Each binding runs its own function; it does not expose a reusable `.value` or cache a result for other locations. Use `computed()` when several places need to share one cached derived value.

```jsx
<p>{count}</p>                            {/* updates */}
<p>{count.value}</p>                      {/* snapshot; does not update */}
<p>{() => `Count: ${count.value}`}</p>    {/* updates */}
<p>{doubled}</p>                          {/* computed value updates */}
<p>{doubled.value}</p>                    {/* snapshot; does not update */}
<p>{count} × 2 = {() => count.value * 2}</p>
```

```js
html`<p>${count}</p>`;                           // updates
html`<p>${count.value}</p>`;                     // snapshot; does not update
html`<p>${() => `Count: ${count.value}`}</p>`;   // updates
html`<p>${doubled}</p>`;                         // computed value updates
html`<p>${doubled.value}</p>`;                   // snapshot; does not update
html`<p>${count} × 2 = ${() => count.value * 2}</p>`;
```

Reading `.value` creates a subscription only while a reactive function runs, such as an effect, computed getter, or rendering function. JSX expressions and template interpolations are evaluated while constructing the tree, so passing their already-read values does not make them reactive.

When `doubled` changes, each binding displaying it updates its own real DOM text node. Treegger does not recreate the parent element or rerun its component. If an expression returns different elements instead of text, Treegger replaces that branch.

For conditional rendering, return a branch or `null` from the binding function:

```jsx
<section>{() => visible.value ? <Panel /> : null}</section>
```

The function reruns when `visible` changes. The mounted branch is disposed when it is replaced. Writing `{visible.value ? <Panel /> : null}` instead evaluates the condition only while constructing the tree.

Reactive props work the same way: `class={ () => active.value ? "on" : "off" }` in JSX, or `class=${() => active.value ? "on" : "off"}` in an HTML template. A plain value is applied once.

For nested state, see [Stores](4_stores.md).
