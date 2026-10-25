# Treegger

Treegger is a **proof of concept** demonstrating how signals can update individual DOM bindings without a framework-specific compiler. Reactive reads are tracked at runtime, so state changes update the affected DOM nodes directly, without a virtual DOM or component-wide rerender.

Write markup with `html` tagged templates in native JavaScript without compilation, or use JSX with a standard automatic JSX transform. The runtime has no dependencies.

Start with [Getting started](01_getting-started.md) for the source build and setup. The package is not published to npm; these guides describe the current checkout.

Project source: [github.com/eone666/treegger](https://github.com/eone666/treegger).

Given `<div id="app"></div>`, a counter module looks like this:

```js
import { derive, html, mount, signal } from "treegger";

const count = signal(0);
const doubled = derive(() => count.value * 2);

mount(html`
  <button onClick=${() => count.value++}>
    Clicks: ${count}
  </button>
  <p>Double: ${doubled}</p>
`, document.querySelector("#app"));
```

The library includes derived values, nested reactive stores, components, keyed lists, lifecycle cleanup, error boundaries, and `Preserve` for detaching a branch while retaining its DOM nodes and state.

## Start here

1. [Getting started](01_getting-started.md) — installation, mounting, and the first counter.
2. [Rendering](02_rendering.md) — `html`, JSX, components, fragments, props, and events.
3. [Reactivity](03_reactivity.md) — signals, derived values, effects, scheduling, and cleanup.
4. [Stores](04_stores.md) — nested reactive objects, arrays, and derived fields.
5. [Conditional rendering](05_conditional-rendering.md) — switching branches and disposing removed components.
6. [Preserve](06_preserve.md) — detach and reattach a branch while retaining its nodes and state.
7. [Lists](07_lists.md) — `Each`, keys, nullable items, and fallback content.
8. [Refs and lifecycle](08_refs-and-lifecycle.md) — DOM refs, `scope`, `onUnmount`, and disposal.
9. [Error boundaries](09_error-boundaries.md) — fallback and reset.
10. [API reference](10_api.md) — all public runtime exports and TypeScript types.
11. [Examples](11_examples.md) — paired code snippets for `html` and JSX.

The examples are code snippets, not a standalone app; this repository does not include an example page or JSX build setup.
