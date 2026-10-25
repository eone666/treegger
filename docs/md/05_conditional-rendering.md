# Conditional rendering

Use `derive()` to choose what to render from reactive state. Treegger tracks the signals and store fields read by the derivation getter, then replaces its branch when the result changes.

```jsx
import { derive, signal } from "treegger";

const visible = signal(true);

const view = <div>
  {derive(() => visible.value
    ? <p>Visible</p>
    : <p>Hidden</p>)}
</div>;
```

The equivalent HTML template interpolates a derived value:

```js
const view = html`<div>
  ${derive(() => visible.value
    ? html`<p>Visible</p>`
    : html`<p>Hidden</p>`)}
</div>`;
```

Return `null`, `undefined`, or `false` for an empty branch:

```jsx
<section>{derive(() => visible.value ? <Editor /> : null)}</section>
```

When switching away from a branch, Treegger removes its DOM nodes and disposes owned effects, event listeners, refs, and `onUnmount` callbacks. Switching back creates a new component instance; local state inside that component starts again. State declared outside the branch, such as the `visible` signal above, persists.

Keep the reactive read **inside** the derivation getter. `visible.value ? <Editor /> : null` without `derive()` evaluates once while the tree is constructed and does not subscribe the branch to later changes.

## Using derive

A derived value can select between JSX branches. Pass the derived object directly as a child:

```jsx
import { derive, signal } from "treegger";

const visible = signal(true);
const content = derive(() => visible.value ? <Editor /> : <Preview />);

const view = <section>{content}</section>;
```

The same pattern works with HTML templates:

```js
import { derive, html, signal } from "treegger";

const visible = signal(true);
const content = derive(() => visible.value
  ? html`<${Editor} />`
  : html`<${Preview} />`);

const view = html`<section>${content}</section>`;
```

Use `{content}` or `${content}` for reactive rendering. Reading `content.value` while constructing the surrounding tree captures a snapshot.

The getter can use a ternary, `if`, or `switch` to return any number of branches. For example, a request screen can choose loading, error, or content:

```jsx
const status = signal("loading");
const screen = derive(() => {
  switch (status.value) {
    case "loading": return <Loading />;
    case "error": return <ErrorMessage />;
    default: return <Content />;
  }
});

const view = <main>{screen}</main>;
```

Return `null`, `undefined`, or `false` when one of the branches should render nothing, such as `derive(() => visible.value ? <Editor /> : null)`.

When the condition is derived from other state, a separate boolean derivation keeps the mounted branch stable while that boolean stays the same:

```jsx
const age = signal(20);
const eligible = derive(() => age.value >= 18);
const content = derive(() => eligible.value ? <Editor /> : <AccessDenied />);

const view = <section>{content}</section>;

age.value = 21; // eligible remains true: same Editor, DOM, focus, and local state
age.value = 17; // after the update flush: Editor is cleaned up; AccessDenied is mounted
```

For an inline binding, use `{derive(() => eligible.value ? <Editor /> : <AccessDenied />)}`. Plain function children are unsupported.

Derived results use `Object.is`. Every newly evaluated JSX expression or `html` template creates a new tree factory. For example, `derive(() => age.value >= 18 ? <Editor /> : null)` creates a new `Editor` tree whenever `age` changes while eligible, so the old instance is replaced. Use the separate boolean computation above when only crossing the threshold should replace the branch. Pass signals into children for updates that should happen inside the existing branch.

Returning the same tree reference preserves its mounted instance in each location. Sharing a derived tree across locations creates separate DOM and component instances; a raw DOM node can only belong to one location. Switching to `null` still disposes the old branch, and switching back creates a new instance. Use [`Preserve`](06_preserve.md) to retain a branch while it is hidden.

See [conditional.js](https://github.com/eone666/treegger/blob/master/examples/conditional.js) and [conditional.tsx](https://github.com/eone666/treegger/blob/master/examples/conditional.tsx) for a toggle with an input ref and component cleanup. For collections, use [`Each`](07_lists.md) instead of building a conditional array of rows.

If the hidden branch should keep its DOM and state, use [`Preserve`](06_preserve.md).

`derive(getter, { equals: false })` treats every actual reevaluation as changed, so even the same returned factory is remounted. A custom comparator that reports equality retains the previous factory and its DOM. Compare actual results deliberately; JSX markup is not compared structurally. See [equality options](03_reactivity.md#equality-options).
