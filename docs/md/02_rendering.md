# Rendering

Treegger creates real DOM nodes. Reactive bindings update the affected text or property; a component function is called when its instance is created, not on every signal change.

For showing and hiding branches, see [Conditional rendering](05_conditional-rendering.md).
For hiding without disposing a branch, see [Preserve](06_preserve.md).

## `html` tagged templates

`html` turns a tagged template into a Treegger tree:

```js
import { html, mount, signal } from "treegger";

const name = signal("Ada");
mount(html`<p>Hello, ${name}</p>`, document.querySelector("#app"));
```

Pass the signal itself to a text binding. `${name.value}` evaluates once while constructing the template and does not subscribe to later changes. For a derived value, pass `${derive(() => name.value.toUpperCase())}`.

Interpolations can contain text, numbers, nodes, Treegger trees, signals, derived values, and arrays of children. A signal or derived value in child position updates its text when its value changes. Use an explicit derived value to select reactive content:

```js
const visible = signal(true);
html`<div>${derive(() => visible.value ? html`<span>Ready</span>` : null)}</div>`;
```

Use `derive()` when a binding reads a field from a store or combines values:

```js
html`<p class=${derive(() => state.active ? "active" : "")}>${derive(() => state.user.name)}</p>`;
```

Templates may have multiple root nodes. `<>…</>` and `<Fragment>…</Fragment>` also create fragments without a visible wrapper.

HTML templates recognize built-in `<Each>`, `<ErrorBoundary>`, `<Preserve>`, and `<Fragment>` tags without importing them separately. Pass a user component through an interpolation in the tag name:

```js
function Greeting({ name }) {
  return html`<p>Hello, ${name}</p>`;
}

html`<${Greeting} name="Ada" />`;
```

A bare `<Greeting>` tag needs an explicit component registry; the template cannot resolve a JavaScript identifier from its name.

### Named components

Register components once to use their names directly in markup:

```js
import { html, mount, signal } from "treegger";

function Counter({ title, initial = 0 }) {
  const count = signal(initial);
  return html`<button onClick=${() => count.value++}>${title}: ${count}</button>`;
}

const view = html.with({ Counter });
mount(view`
  <Counter title="Counter A" initial=${0} />
  <Counter title="Counter B" initial=${10} />
`, document.querySelector("#app"));
```

`html.with(components)` returns a new template tag. It copies the registry and leaves the original tag unchanged. You can extend or override registrations with `view.with({ AnotherComponent })`; changing the object originally passed to `.with()` does not change an existing tag's registry.

Names are case-sensitive, must be identifier names starting with an uppercase letter, and must refer to functions. Built-in components remain available without registration; an explicitly registered name takes precedence over a built-in name. An unregistered capitalized tag throws an error when the template is constructed. Register components at module level when their definitions are shared.

The scoped tag accepts the same props, children, reactive bindings, and interpolated component tags as `html`. Named components have the same lifecycle and cleanup behavior as JSX components and `<${Component} />` interpolations. The template cache does not mix component registries. TypeScript checks registry entries as component functions. Component names in template strings are resolved at runtime; template strings do not provide JSX-style prop type checking.

You can freely mix both forms:

```js
const view = html.with({ Counter });
view`<Counter initial=${0} /><${Greeting} name="Ada" />`;
```

## JSX

```jsx
import { mount, signal } from "treegger";

const count = signal(0);
mount(<button onClick={() => count.value++}>{count}</button>, document.querySelector("#app"));
```

In JSX, `{count}` creates a reactive binding; `{count.value}` inserts only the current value. Use `{derive(() => count.value * 2)}` when the displayed value depends on a calculation. Reading `.value` inside an event handler is fine: the handler runs when the event occurs.

Only signals and derived values create reactive bindings. Plain functions in child position or ordinary DOM props are rejected; callbacks remain supported in event, ref, and documented render-callback positions. See [Reactive rendering](03_reactivity.md).

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

The component function runs once per instance. Returning a primitive directly renders its current value. For reactive text, return a derived value that reads the signal:

```jsx
function CountLabel({ count }) {
  return derive(() => `Count: ${count.value}`);
}
```

`null` and boolean results render no visible content. Strings and numbers render as text. Reading `count.value` while constructing a string directly in the component body does not subscribe the component to updates.

### Plain and reactive component props

Component props are passed unchanged. Opt into reactive inputs only where a component needs them, using `Reactive<T>` and the shared `.value` property:

```tsx
import { derive, signal, type Reactive } from "treegger";

type CounterProps = {
  label: Reactive<string>;
  initial?: number;
  onSave: (count: number) => void;
};

function Counter({ label, initial = 0, onSave }: CounterProps) {
  const count = signal(initial);
  return <button onClick={() => onSave(count.value)}>
    {derive(() => `${label.value}: ${count.value}`)}
  </button>;
}

const title = signal("Clicks");
const counter = <Counter label={title} initial={10} onSave={console.log} />;
```

`label` accepts a signal or derived value. `initial` accepts an ordinary number and initializes local state once per component instance. `onSave` remains an ordinary callback. Pass an explicit computation for derived labels, such as `label={derive(() => title.value.toUpperCase())}`.

Read `label.value` inside `derive` or `effect` to track changes. Reading it directly in the component body captures a value for initialization and does not set up future updates. You can also render a signal or derived object directly, for example `<h2>{label}</h2>`.

The same component can be used through either HTML syntax:

```js
const view = html.with({ Counter });
view`<Counter label=${title} initial=${10} onSave=${console.log} />`;
html`<${Counter} label=${derive(() => title.value.toUpperCase())} onSave=${console.log} />`;
```

Destructuring these props retains the signal or derived reference. Reading `.value` later inside a computation or effect creates the subscription. Plain values remain plain values. No automatic prop unwrapping or callback detection is performed for user components. See the [counter examples](11_examples.md) for matching HTML and TSX snippets.

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

Static props are set when the element is created. Signals and derived values in ordinary DOM props form reactive bindings. Static values are applied once. Plain functions are rejected in ordinary DOM props. Event handlers follow the separate rule below. Treegger handles `className`, `style`, `value`, and `checked` as DOM properties; other values become attributes. `null` and `undefined` remove an attribute. For HTML boolean attributes such as `disabled`, `false` removes the attribute and `true` creates an empty attribute. Other attributes, including `aria-*`, `data-*`, and enumerated attributes such as `draggable`, serialize boolean values as `"true"` or `"false"`.

JSX and HTML templates use the same prop names and casing: `onClick`, `className`, `viewBox`, and `strokeWidth` work in both. Native names such as `class`, `onclick`, and `stroke-width` are also supported in both. Custom component props retain their exact spelling, including names such as `initialCount` and `onSave`. A prop without a value is `true` in either syntax: `<input disabled />` and `<${Input} isActive />` in an HTML template follow the same rule as JSX.

Event handlers use props such as `onClick`, `onChange`, and `onInput`. The handler is attached when the element is created and removed when its owner is disposed. The `key` and `ref` props are reserved for Treegger and are not written as HTML attributes.

### Event callbacks

An event prop accepts an ordinary callback, a signal or derived value containing a callback, or a nullish value to disable handling. Treegger reads a reactive handler's `.value` when the event occurs, then invokes the selected callback with the browser event. It installs one DOM listener and does not resubscribe when the selected callback changes.

```jsx
import { derive, signal } from "treegger";

const editing = signal(false);
const handler = derive(() => editing.value ? save : startEditing);

const view = <button onClick={handler}>Edit or save</button>;
```

The same explicit source works in HTML templates:

```js
html`<button onClick=${handler}>Edit or save</button>`;
```

Signal handlers can be assigned directly. A nullish current value disables handling while retaining the listener so it can be enabled again later:

```ts
import { signal, type EventHandler } from "treegger";

const handler = signal<EventHandler<MouseEvent> | null>(null);
handler.value = event => console.log(event.clientX);
handler.value = null;
```

The latest value is used even if a signal changes immediately before the event, before queued DOM updates run. Selection through `derive()` is lazy: mounting the element does not evaluate the handler source. The callback and selection execute outside the enclosing effect's dependency tracking. Derivation getters still track their own dependencies normally.

An ordinary function is always the callback itself. `onClick={() => editing.value ? save : startEditing}` only returns a function when clicked; it does not invoke that function or select a handler reactively. Use a derived value as shown above, or put the conditional call inside the callback:

```jsx
<button onClick={event => {
  if (editing.value) save(event);
  else startEditing(event);
}}>Edit or save</button>
```

A non-nullish reactive value that is not a function throws when the event is dispatched. Selection errors, synchronous callback errors, and rejected native Promises are handled by the nearest [`ErrorBoundary`](09_error-boundaries.md). Unmounting removes the listener.

`EventHandler<E>` describes a plain callback. `EventProp<E>` accepts that callback, a reactive source, or a nullish value. Custom components receive their props unchanged and can forward an `EventProp` directly to a DOM event prop:

```tsx
import { type EventProp } from "treegger";

function Action({ onClick }: { onClick: EventProp<MouseEvent> }) {
  return <button onClick={onClick}>Action</button>;
}
```

See the [events examples](11_examples.md) for matching HTML and TSX snippets.

## SVG

SVG elements use the SVG namespace in JSX and HTML templates. Components, reactive branches, and `Each` rows inherit their surrounding SVG context. Children of `foreignObject` use HTML; a nested `svg` starts SVG context again. Mounting into an existing SVG element also preserves that context.

```jsx
const view = <svg viewBox="0 0 24 24" width={24} height={24}>
  <circle cx={12} cy={12} r={8} fill="none" stroke="green" strokeWidth={2} />
</svg>;
```

```js
const view = html`<svg viewBox="0 0 24 24" width="24" height="24">
  <circle cx="12" cy="12" r="8" fill="none" stroke="green" strokeWidth=${2} />
</svg>`;
```

Case-sensitive SVG names such as `viewBox`, `linearGradient`, and `gradientUnits` are preserved. In either syntax, aliases such as `strokeWidth` and `fillRule` are written to the DOM as `stroke-width` and `fill-rule`. Namespaced attributes such as `xlink:href` use their attribute namespace.

## Mount and unmount

```js
const unmount = mount(tree, target);
// Later:
unmount();
```

`mount` appends to the target; it does not replace its existing children. Its return value removes this mount's nodes and disposes its owned work. Call it once for a given mount.
