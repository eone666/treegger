# Getting started

## Requirements

Treegger needs a browser DOM. The package exposes tree-shakeable ESM for bundlers and a standalone browser ES module. It has no runtime dependencies. Install the package in your application:

```sh
npm install treegger
```

The examples import from `treegger`. A bundler resolves this package name; for native browser modules, see [Without a bundler](#without-a-bundler). For development from a local checkout, see the [contributing guide](https://github.com/eone666/treegger/blob/master/.github/CONTRIBUTING.md).

## First counter

Add `<div id="app"></div>` to your page and load this module:

```js
import { html, mount, signal } from "treegger";

const count = signal(0);

const unmount = mount(html`
  <button onClick=${() => count.value++}>Count: ${count}</button>
`, document.querySelector("#app"));
```

`signal(0)` holds the number. Reading `count.value` inside a reactive expression subscribes to changes. In the template, inserting the signal itself creates a reactive text binding. Calling `unmount()` removes the mounted nodes and disposes their effects, listeners, and refs.


## Without a bundler

Copy `dist/treegger.browser.min.js` to your site and map `"treegger"` to its URL with an import map:

```html
<div id="app"></div>
<script type="importmap">
  {
    "imports": {
      "treegger": "./treegger.browser.min.js"
    }
  }
</script>
<script type="module">
  import { html, mount, signal } from "treegger";
  const count = signal(0);
  mount(html`<button onClick=${() => count.value++}>Count: ${count}</button>`,
    document.querySelector("#app"));
</script>
```

The minified browser file contains the whole library. Define the import map before module scripts that import Treegger, and adjust the mapped URL to match where you host the file. All examples use `from "treegger"`: a bundler resolves the installed package, while the browser uses the import map. Use a bundler when you want unused exports removed.

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
