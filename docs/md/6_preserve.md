# Preserving a detached branch

`Preserve` temporarily removes a branch from the document and later inserts the same DOM nodes back into their original position. Its component instances and local state survive the detachment. It is useful for tabs, drafts, or panels.

```jsx
import { Preserve, signal } from "treegger";

const visible = signal(true);

const view = <Preserve when={visible}>
  <textarea placeholder="Your draft" />
</Preserve>;
```

With an HTML template:

```js
import { html, signal } from "treegger";

const visible = signal(true);

const view = html`
  <Preserve when=${visible}>
    <textarea placeholder="Your draft"></textarea>
  </Preserve>
`;
```

`when` accepts a boolean, signal, or computed value. It defaults to `true`. When false, Treegger moves the children into a detached `DocumentFragment`. When true, it inserts those same nodes back. There is no wrapper element; only comment markers remain in the document while the branch is detached.

The child nodes, component instances, signal state, uncontrolled input values, and refs stay intact while detached. A ref still points to its element, but `ref.element.isConnected` is false. Detaching a focused control loses browser focus; `Preserve` does not automatically restore focus when reconnecting it. `onUnmount` runs when the preserved branch is disposed, rather than on each detachment.

**Reactive work continues while detached.** The children are created and their effects run even if `when` is initially false. Effects and DOM bindings still respond to signals and update the detached nodes, and browser subscriptions registered by components remain active. Disposing the preserved branch cleans up both attached and detached content.

Use [conditional rendering](5_conditional-rendering.md) when a hidden branch should be disposed and its subscriptions stopped. That branch will start with fresh component state when shown again.

See [preserve.js](https://github.com/eone666/treegger/blob/master/examples/preserve.js) and [preserve.tsx](https://github.com/eone666/treegger/blob/master/examples/preserve.tsx) for a draft that keeps the same `textarea` and its typed value across hide/show cycles.
