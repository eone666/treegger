# Lists

`Each` renders a collection with keyed rows. Its `items` prop accepts an array, a signal or computed value containing an array, or a nullish value. Use `computed(() => ...)` for a derived array; plain getter functions are rejected. The child is a render function.

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

Every row must return an element or component with a `key` prop. Keys must be unique among current rows. A fragment cannot be the keyed row root directly, but a keyed component may return a fragment, reactive content, or an empty result. All of that component's DOM nodes move and are removed together. The key is used by the reconciler and is not written to the DOM.

```jsx
function Row({ item }) {
  return <>
    <li>{item.label}</li>
    <li>Details for {item.label}</li>
  </>;
}

const view = <ul>
  <Each items={items}>
    {item => <Row key={item.id} item={item} />}
  </Each>
</ul>;
```

When items are appended or reordered, Treegger reuses existing keyed DOM rows where possible. Removing a row disposes its effects, event listeners, refs, and lifecycle cleanups. If a row's content depends on a changed item object, supply a new item and key as appropriate; the list's reuse rules are based on row identity and key.

`null`, `undefined`, and an empty array show `fallback` when provided. Fallback content is disposed when rows appear and recreated if the list becomes empty again. The fallback can be a Treegger child, signal, or computed value. Use an explicit computed value for reactive fallback content; a plain fallback function is unsupported. The row render callback remains a function.

For a complete add/remove example, see [todo-list.js](https://github.com/eone666/treegger/blob/master/examples/todo-list.js) and [todo-list.tsx](https://github.com/eone666/treegger/blob/master/examples/todo-list.tsx).
