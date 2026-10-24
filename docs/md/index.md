# Treegger

Treegger is a small reactive DOM library for adding interactive UI to a page or building a larger client-side application. It uses signals and direct DOM bindings: there is no virtual DOM or component-wide rerender on every state change.

Write markup with `html` tagged templates in native JavaScript, or use JSX with an automatic JSX transform. The runtime has no dependencies.

Project source: [github.com/eone666/treegger](https://github.com/eone666/treegger).

```js
import { html, mount, signal } from "treegger";

const count = signal(0);

mount(html`
  <button onclick=${() => count.value++}>
    Clicks: ${count}
  </button>
`, document.querySelector("#app"));
```

The library includes computed values, nested reactive stores, components, keyed lists, lifecycle cleanup, error boundaries, and `Preserve` for hiding a branch while retaining its DOM and state.

## Start here

1. [Getting started](1_getting-started.md) — installation, mounting, and the first counter.
2. [Rendering](2_rendering.md) — `html`, JSX, components, fragments, props, and events.
3. [Reactivity](3_reactivity.md) — signals, computed values, effects, scheduling, and cleanup.
4. [Stores](4_stores.md) — nested reactive objects, arrays, and computed fields.
5. [Conditional rendering](5_conditional-rendering.md) — switching branches and disposing removed components.
6. [Preserve](6_preserve.md) — hide a branch while keeping its DOM and state.
7. [Lists](7_lists.md) — `Each`, keys, nullable items, and fallback content.
8. [Refs and lifecycle](8_refs-and-lifecycle.md) — DOM refs, `scope`, `onUnmount`, and disposal.
9. [Error boundaries](9_error-boundaries.md) — fallback and reset.
10. [API reference](10_api.md) — all public runtime exports and TypeScript types.
11. [Examples](11_examples.md) — paired code snippets for `html` and JSX.

The examples are code snippets, not a standalone app; this repository does not include an example page or JSX build setup.
