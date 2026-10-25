# Getting started

Treegger needs a browser DOM. HTML templates work without a bundler; JSX and TSX need a standard automatic JSX transform. There are no runtime dependencies.

## Get the current package

Treegger is not published to npm yet. Build the checkout to use the browser module or install the local package in your application.

From the Treegger checkout:

```sh
npm ci
npm run package:build
```

The build creates `dist/`, containing ESM modules for bundlers, TypeScript declarations, and the standalone `treegger.browser.min.js` module. For a packaged archive, run `npm pack` and install the resulting `.tgz` in your app.

## Without a bundler

Create a site directory with these files:

```text
my-site/
  index.html
  main.js
  treegger.browser.min.js
```

Copy `dist/treegger.browser.min.js` from the build into that directory. In `index.html`, define an import map before loading the application module:

```html
<div id="app"></div>
<script type="importmap">
  {
    "imports": {
      "treegger": "./treegger.browser.min.js"
    }
  }
</script>
<script type="module" src="./main.js"></script>
```

Save this as `main.js`:

```js
import { derive, html, mount, signal } from "treegger";

const count = signal(0);
const doubled = derive(() => count.value * 2);

mount(html`
  <button onClick=${() => count.value++}>Count: ${count}</button>
  <p>Double: ${doubled}</p>
`, document.getElementById("app"));
```

Serve `my-site/` with a static HTTP server and open the page. Clicking the button updates both the count and its doubled value. See [Reactivity](03_reactivity.md) for how signals and derived values work.

## With a bundler

Build Treegger as above, then install the checkout into your application. If your app and the `treegger` checkout are sibling directories, run this from your app:

```sh
npm install ../treegger
```

The same `main.js` works without an import map: your bundler resolves `"treegger"` from the local package and can remove unused exports. You can also install the archive produced by `npm pack` instead of linking the checkout.

## JSX and TSX

JSX requires a transform configured for the **automatic** runtime. For a TypeScript application using a tool such as Vite, merge these settings into its existing `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "treegger"
  }
}
```

Add `<div id="app"></div>` to your page and use this TSX module:

```tsx
import { derive, mount, signal } from "treegger";

const count = signal(0);
const doubled = derive(() => count.value * 2);

mount(<>
  <button onClick={() => count.value++}>Count: {count}</button>
  <p>Double: {doubled}</p>
</>, document.getElementById("app")!);
```

The transform imports Treegger's JSX runtime automatically; `createElement` and React imports are unnecessary. For JavaScript JSX, configure the same automatic runtime and `jsxImportSource` in your transform's settings. See [Rendering](02_rendering.md).

If your IDE reports that `Each` is not a valid JSX component and mentions `ReactNode`, check that the file belongs to the `tsconfig.json` with `jsxImportSource: "treegger"`.

## Next steps

- Use [derived values and effects](03_reactivity.md) for derived state and side effects.
- Register [named components with `html.with()`](02_rendering.md#named-components).
- Use [`store`](04_stores.md) for nested state and [`Each`](07_lists.md) for changing collections.
- See the [contributing guide](https://github.com/eone666/treegger/blob/master/.github/CONTRIBUTING.md) for repository development.
