# Getting started

## Requirements

Treegger needs a browser DOM. The package exposes tree-shakeable ESM for bundlers and a standalone browser ES module. It has no runtime dependencies. The steps below use a local checkout.

For development in this repository:

```sh
npm ci
npm run build:package
```

The build creates `dist/`. HTML template examples import `../dist/index.js`. An app consuming the package imports from `treegger`.

## First counter

Add `<div id="app"></div>` to your page and load this module:

```js
import { html, mount, signal } from "../dist/index.js";

const count = signal(0);

const unmount = mount(html`
  <button onclick=${() => count.value++}>Count: ${count}</button>
`, document.querySelector("#app"));
```

`signal(0)` holds the number. Reading `count.value` inside a reactive expression subscribes to changes. In the template, inserting the signal itself creates a reactive text binding. Calling `unmount()` removes the mounted nodes and disposes their effects, listeners, and refs.

In an application that installs Treegger as a package, change the import to `from "treegger"`.

## Without a bundler

Copy `dist/treegger.browser.min.js` to your site and import it from a module script:

```html
<div id="app"></div>
<script type="module">
  import { html, mount, signal } from "./treegger.browser.min.js";
  const count = signal(0);
  mount(html`<button onclick=${() => count.value++}>Count: ${count}</button>`,
    document.querySelector("#app"));
</script>
```

The minified browser file contains the whole library. A browser imports it by URL; the bare specifier `"treegger"` requires a bundler or import map. Use the npm package with a bundler when you want unused exports removed.

## JSX option

JSX requires a transform configured for the **automatic** runtime. For example, Vite can use:

```js
export default {
  esbuild: { jsx: "automatic", jsxImportSource: "treegger" }
};
```

```jsx
import { mount, signal } from "treegger";

const count = signal(0);
mount(
  <button onClick={() => count.value++}>Count: {count}</button>,
  document.querySelector("#app")
);
```

With the automatic runtime, you do not import `createElement` just to write JSX. For TypeScript JSX, set `jsx` to `react-jsx` and `jsxImportSource` to `treegger`. See [Rendering](2_rendering.md).

If your IDE says that `Each` is not a valid JSX component and mentions `ReactNode`, it is checking the file with React's JSX types. Make sure the TSX file belongs to a `tsconfig.json` with `jsxImportSource: "treegger"`.

## Next steps

- Use [computed values and effects](3_reactivity.md) for derived state and side effects.
- Use [`store`](4_stores.md) for nested state.
- Use [`Each`](7_lists.md) for changing collections.
