# Rendering

Treegger creates real DOM nodes. Reactive bindings update the affected text or property; a component function is called when its instance is created, not on every signal change.

For showing and hiding branches, see [Conditional rendering](5_conditional-rendering.md).
For hiding without disposing a branch, see [Preserve](6_preserve.md).

## `html` tagged templates

`html` turns a tagged template into a Treegger tree:

```js
import { html, mount, signal } from "treegger";

const name = signal("Ada");
mount(html`<p>Hello, ${name}</p>`, document.querySelector("#app"));
```

Interpolations can contain text, numbers, nodes, Treegger trees, signals, computed values, functions, and arrays of children. A signal or computed value in child position updates its text when its value changes. A function in child position is evaluated reactively:

```js
const visible = signal(true);
html`<div>${() => visible.value ? html`<span>Ready</span>` : null}</div>`;
```

Use a function when a binding reads a field from a store or combines values:

```js
html`<p class=${() => state.active ? "active" : ""}>${() => state.user.name}</p>`;
```

Templates may have multiple root nodes. `<>…</>` and `<Fragment>…</Fragment>` also create fragments without a visible wrapper.

HTML templates recognize built-in `<Each>` and `<ErrorBoundary>` tags. Pass a user component through an interpolation in the tag name:

```js
function Greeting({ name }) {
  return html`<p>Hello, ${name}</p>`;
}

html`<${Greeting} name="Ada" />`;
```

A bare `<Greeting>` tag in an `html` template is rejected; the template cannot resolve a JavaScript identifier from its name.

## JSX

```jsx
import { mount, signal } from "treegger";

const count = signal(0);
mount(<button onClick={() => count.value++}>{count}</button>, document.querySelector("#app"));
```

JSX uses Treegger's automatic runtime exports `jsx`, `jsxs`, and `jsxDEV`. The transform imports these for you. JSX fragments work with `<>...</>` or `<Fragment>...</Fragment>`.

## Components

A component can return a Treegger element or another `TreeggerNode`, including a string, number, `boolean`, or `null`:

```jsx
import { signal } from "treegger";

function Counter({ initial = 0 }) {
  const count = signal(initial);
  return <button onClick={() => count.value++}>{count}</button>;
}

const view = <Counter initial={2} />;
```

In plain JavaScript, use `component(Counter, { initial: 2 })` or `html` with `<${Counter} initial=${2} />`. `createElement("button", props, ...children)` is available when constructing trees directly. JSX users generally do not need to call it.

Component state and effects created while the component runs belong to that component instance. When the instance is removed, its owned effects and lifecycle cleanups are disposed.

The component function runs once per instance. Returning a primitive directly renders its current value. For reactive text, return a function that reads the signal:

```jsx
function CountLabel({ count }) {
  return () => `Count: ${count.value}`;
}
```

`null` and boolean results render no visible content. Strings and numbers render as text. Reading `count.value` while constructing a string directly in the component body does not subscribe the component to updates.

## Direct `createElement` API

When writing plain JavaScript without a tagged template, call `createElement(tag, props, ...children)`. Components can be wrapped with `component(fn, props)`:

```js
import { component, createElement, mount, signal } from "treegger";

function Counter() {
  const count = signal(0);
  return createElement(
    "button",
    { onClick: () => count.value++ },
    count
  );
}

mount(component(Counter, {}), document.querySelector("#app"));
```

`createElement` also accepts a component function as its tag. Pass children as arguments after props. When rendering `Each` directly, pass its row function as the child argument and give each returned row a `key` prop.

## Props and events

Static props are set when the element is created. Function or signal props form reactive bindings. Treegger handles `className`, `style`, `value`, and `checked` as DOM properties; other values become attributes. `null` and `false` remove an attribute, and `true` creates an empty attribute.

Event props begin with `on`, such as `onClick` in JSX or `onclick` in an HTML template. The handler is attached when the element is created and removed when its owner is disposed. The `key` and `ref` props are reserved for Treegger and are not written as HTML attributes.

## Mount and unmount

```js
const unmount = mount(tree, target);
// Later:
unmount();
```

`mount` appends to the target; it does not replace its existing children. Its return value removes this mount's nodes and disposes its owned work. Call it once for a given mount.
