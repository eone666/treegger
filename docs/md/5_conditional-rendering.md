# Conditional rendering

Use a function in child position to choose what to render from reactive state. Treegger tracks the signals and store fields read by that function, then replaces its branch when they change.

```jsx
import { signal } from "treegger";

const visible = signal(true);

const view = <div>
  {() => visible.value
    ? <p>Visible</p>
    : <p>Hidden</p>}
</div>;
```

The equivalent HTML template uses an interpolated function:

```js
const view = html`<div>
  ${() => visible.value
    ? html`<p>Visible</p>`
    : html`<p>Hidden</p>`}
</div>`;
```

Return `null`, `undefined`, or `false` for an empty branch:

```jsx
{() => visible.value ? <Editor /> : null}
```

When switching away from a branch, Treegger removes its DOM nodes and disposes owned effects, event listeners, refs, and `onUnmount` callbacks. Switching back creates a new component instance; local state inside that component starts again. State declared outside the branch, such as the `visible` signal above, persists.

Keep the reactive read **inside** the function. `visible.value ? <Editor /> : null` without an enclosing function evaluates once while the tree is constructed and does not subscribe the branch to later changes.

See [conditional.js](https://github.com/eone666/treegger/blob/main/examples/conditional.js) and [conditional.tsx](https://github.com/eone666/treegger/blob/main/examples/conditional.tsx) for a toggle with an input ref and component cleanup. For collections, use [`Each`](7_lists.md) instead of building a conditional array of rows.

If the hidden branch should keep its DOM and state, use [`Preserve`](6_preserve.md).
