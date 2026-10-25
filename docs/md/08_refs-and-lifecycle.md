# Refs and lifecycle

## DOM refs

`ref<E>()` creates a small object whose `element` field points to a mounted DOM element. It starts as `null`:

```jsx
import { mount, ref } from "treegger";

const input = ref();
const unmount = mount(<>
  <input ref={input} />
  <button onClick={() => input.element?.focus()}>Focus</button>
</>, document.querySelector("#app"));

unmount();
console.log(input.element); // null
```

In TypeScript, specify the element type when needed: `ref<HTMLInputElement>()`. The `element` field is a normal reference, not a reactive signal. Reading it inside an effect does not subscribe the effect to mount or unmount.

The ref object has a `refCallback` field used by the renderer. Pass the object itself as the `ref` prop; application code normally reads only `element`. You can also pass a callback directly as `ref`: `ref={(element, previous) => { ... }}`. It receives the element on mount and `null` with the previous element on disposal.

When an element is removed by a conditional branch, a list change, an error boundary, or `unmount()`, its ref is cleared.

## `onUnmount`

`onUnmount(cleanup)` registers work to run once when the current component or explicit scope is disposed. Call it while a component or `scope` is running:

```jsx
import { onUnmount, signal } from "treegger";

function KeyListener() {
  const lastKey = signal("Press a key");
  const handleKeydown = event => { lastKey.value = event.key; };

  window.addEventListener("keydown", handleKeydown);
  onUnmount(() => window.removeEventListener("keydown", handleKeydown));

  return <p>Last key: {lastKey}</p>;
}
```

`onUnmount` throws if there is no active component or scope. It also cannot be called from inside an effect. For per-run cleanup, return a function from the [effect](03_reactivity.md#effects-and-cleanup) instead.

## Explicit scopes

`scope(run)` groups effects, derived values, nested scopes, and `onUnmount` callbacks created while `run` executes:

```js
import { effect, onUnmount, scope, signal } from "treegger";

const value = signal(0);
const group = scope(() => {
  effect(() => console.log(value.value));
  onUnmount(() => console.log("group disposed"));
  return "ready";
});

console.log(group.value); // "ready"
group.owner.dispose();
```

`group.owner.active` becomes `false` after disposal. Components and mounts use scopes internally. Disposing a parent disposes its nested scopes and effects before its `onUnmount` callbacks.

## Choosing a cleanup mechanism

| Work | Cleanup |
| --- | --- |
| A DOM event handler passed as an element prop | Treegger removes it with the element |
| A browser subscription created once in a component | `onUnmount(() => unsubscribe())` |
| Work recreated when reactive dependencies change | Return cleanup from `effect()` |
| A standalone effect or derived value | Call `stop()` or `dispose()` |
| An entire mounted tree | Call the function returned by `mount()` |
