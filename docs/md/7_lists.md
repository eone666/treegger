# Lists

`Each` renders a collection with keyed rows. Its `items` prop accepts an array, a signal or computed value containing an array, a function returning an array, or a nullish value. The child is a render function.

```jsx
import { Each, signal } from "treegger";

const items = signal([{ id: 1, label: "First" }]);

const view = <ul>
  <Each items={items} fallback={<li>Nothing here</li>}>
    {item => <li key={item.id}>{item.label}</li>}
  </Each>
</ul>;
```

```js
import { html, signal } from "treegger";

const items = signal([{ id: 1, label: "First" }]);

const view = html`<ul>
  <Each items=${items} fallback=${html`<li>Nothing here</li>`}>
    ${item => html`<li key=${item.id}>${item.label}</li>`}
  </Each>
</ul>`;
```

The rendered root of every row must be an element with a `key` prop. Keys must be unique among current rows. A fragment cannot be the keyed row root. The key is used by the reconciler and is not written to the DOM.

When items are appended or reordered, Treegger reuses existing keyed DOM rows where possible. Removing a row disposes its effects, event listeners, refs, and lifecycle cleanups. If a row's content depends on a changed item object, supply a new item and key as appropriate; the list's reuse rules are based on row identity and key.

`null`, `undefined`, and an empty array show `fallback` when provided. Fallback content is disposed when rows appear and recreated if the list becomes empty again. The fallback can be a Treegger tree or a function returning one.

For a complete add/remove example, see [todo-list.js](https://github.com/eone666/treegger/blob/main/examples/todo-list.js) and [todo-list.tsx](https://github.com/eone666/treegger/blob/main/examples/todo-list.tsx).
