# Conditional rendering

Use `computed()` to choose what to render from reactive state. Treegger tracks the signals and store fields read by the computed getter, then replaces its branch when the result changes.

```jsx
import { computed, signal } from "treegger";

const visible = signal(true);

const view = <div>
  {computed(() => visible.value
    ? <p>Visible</p>
    : <p>Hidden</p>)}
</div>;
```

The equivalent HTML template interpolates a computed value:

```js
const view = html`<div>
  ${computed(() => visible.value
    ? html`<p>Visible</p>`
    : html`<p>Hidden</p>`)}
</div>`;
```

Return `null`, `undefined`, or `false` for an empty branch:

```jsx
<section>{computed(() => visible.value ? <Editor /> : null)}</section>
```

When switching away from a branch, Treegger removes its DOM nodes and disposes owned effects, event listeners, refs, and `onUnmount` callbacks. Switching back creates a new component instance; local state inside that component starts again. State declared outside the branch, such as the `visible` signal above, persists.

Keep the reactive read **inside** the computed getter. `visible.value ? <Editor /> : null` without `computed()` evaluates once while the tree is constructed and does not subscribe the branch to later changes.

## Using computed

A computed value can select between JSX branches. Pass the computed object directly as a child:

```jsx
import { computed, signal } from "treegger";

const visible = signal(true);
const content = computed(() => visible.value ? <Editor /> : <Preview />);

const view = <section>{content}</section>;
```

The same pattern works with HTML templates:

```js
import { computed, html, signal } from "treegger";

const visible = signal(true);
const content = computed(() => visible.value
  ? html`<${Editor} />`
  : html`<${Preview} />`);

const view = html`<section>${content}</section>`;
```

Use `{content}` or `${content}` for reactive rendering. Reading `content.value` while constructing the surrounding tree captures a snapshot.

The getter can use a ternary, `if`, or `switch` to return any number of branches. For example, a request screen can choose loading, error, or content:

```jsx
const status = signal("loading");
const screen = computed(() => {
  switch (status.value) {
    case "loading": return <Loading />;
    case "error": return <ErrorMessage />;
    default: return <Content />;
  }
});

const view = <main>{screen}</main>;
```

Return `null`, `undefined`, or `false` when one of the branches should render nothing, such as `computed(() => visible.value ? <Editor /> : null)`.

When the condition is derived from other state, a separate boolean computed keeps the mounted branch stable while that boolean stays the same:

```jsx
const age = signal(20);
const eligible = computed(() => age.value >= 18);
const content = computed(() => eligible.value ? <Editor /> : <AccessDenied />);

const view = <section>{content}</section>;

age.value = 21; // eligible remains true: same Editor, DOM, focus, and local state
age.value = 17; // after the update flush: Editor is cleaned up; AccessDenied is mounted
```

For an inline binding, use `{computed(() => eligible.value ? <Editor /> : <AccessDenied />)}`. Plain function children are unsupported.

Computed results use `Object.is`. Every newly evaluated JSX expression or `html` template creates a new tree factory. For example, `computed(() => age.value >= 18 ? <Editor /> : null)` creates a new `Editor` tree whenever `age` changes while eligible, so the old instance is replaced. Use the separate boolean computation above when only crossing the threshold should replace the branch. Pass signals into children for updates that should happen inside the existing branch.

Returning the same tree reference preserves its mounted instance in each location. Sharing a computed tree across locations creates separate DOM and component instances; a raw DOM node can only belong to one location. Switching to `null` still disposes the old branch, and switching back creates a new instance. Use [`Preserve`](6_preserve.md) to retain a branch while it is hidden.

See [conditional.js](https://github.com/eone666/treegger/blob/master/examples/conditional.js) and [conditional.tsx](https://github.com/eone666/treegger/blob/master/examples/conditional.tsx) for a toggle with an input ref and component cleanup. For collections, use [`Each`](7_lists.md) instead of building a conditional array of rows.

If the hidden branch should keep its DOM and state, use [`Preserve`](6_preserve.md).
