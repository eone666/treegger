# Preserving a hidden branch

`Preserve` hides and shows a branch without replacing its DOM or recreating its components. It is useful for tabs, drafts, or panels whose local state should survive a temporary hide.

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

`when` accepts a boolean, signal, computed value, or function returning a boolean. It defaults to `true`. When false, Treegger sets `display: none` on a container around the children. When true, it uses `display: contents`, so the container adds no layout box. The container remains in the DOM in both states.

The child nodes, component instances, signal state, uncontrolled input values, and refs stay intact while hidden. `onUnmount` runs only when the branch is actually removed or the mount is disposed.

**Reactive work continues while hidden.** The children are created and their effects run even if `when` is initially false. Later, effects and DOM bindings still respond to signals, and browser subscriptions registered by components remain active. This differs from [React Activity](https://react.dev/reference/react/Activity), which cleans up effects while hidden and schedules hidden updates at lower priority. `Preserve` deliberately promises only DOM and state preservation.

Use [conditional rendering](5_conditional-rendering.md) when a hidden branch should be disposed and its subscriptions stopped. That branch will start with fresh component state when shown again.

See [preserve.js](https://github.com/eone666/treegger/blob/main/examples/preserve.js) and [preserve.tsx](https://github.com/eone666/treegger/blob/main/examples/preserve.tsx) for a draft that keeps the same `textarea` and its typed value across hide/show cycles.
