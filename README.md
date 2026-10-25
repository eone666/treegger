# Treegger

![Treegger logo](assets/treegger-readme.svg)

Treegger is a **proof of concept** demonstrating how signals can update individual DOM bindings without a framework-specific compiler. It combines runtime dependency tracking, native DOM operations, HTML templates, and a standard JSX runtime.

There is no virtual DOM or runtime dependency. HTML templates run as native JavaScript; JSX needs a standard syntax transform.

## A small example

Given `<div id="app"></div>`, this module renders a counter and its derived value:

```js
import { derive, html, mount, signal } from "treegger";

const count = signal(0);
const doubled = derive(() => count.value * 2);

mount(html`
  <button onClick=${() => count.value++}>Count: ${count}</button>
  <p>Double: ${doubled}</p>
`, document.getElementById("app"));
```

Pass `count` and `doubled` directly to markup for updates. Use `.value` inside `derive()` or `effect()` to track reads. Reading `.value` while constructing markup inserts a snapshot. Ordinary functions are callbacks, not reactive expressions.

## Getting started

Treegger is not published to npm yet. Build the checkout, then use the browser module or install the local package in your app.

### Without a bundler

[Build the package](#build-the-package), copy `dist/treegger.browser.min.js` into your site, and save the module above as `main.js`. Put both files beside this HTML page:

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

Serve the directory over HTTP. The import map must appear before scripts that import Treegger. The minified browser module contains the whole library and has no other runtime files to copy.

### With JSX / TSX

Build Treegger, then install the local checkout in your application. If your app and the `treegger` checkout are sibling directories, run this from your app:

```sh
npm install ../treegger
```

In a TypeScript application with a JSX transform, such as Vite, merge these settings into `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "treegger"
  }
}
```

The same example in TSX:

```tsx
import { derive, mount, signal } from "treegger";

const count = signal(0);
const doubled = derive(() => count.value * 2);

mount(<>
  <button onClick={() => count.value++}>Count: {count}</button>
  <p>Double: {doubled}</p>
</>, document.getElementById("app")!);
```

The transform imports Treegger's JSX runtime automatically. A bundler can remove unused exports from the package's ESM build.

## Documentation

Read the [Markdown documentation](docs/md/index.md), visit the [documentation website](https://eone666.github.io/treegger/), or browse paired [HTML and TSX examples](examples/). The website reflects the deployed revision; local documentation describes this checkout.

The guides cover [named components with `html.with()`](docs/md/02_rendering.md#named-components), stores, keyed lists, conditional rendering, refs, effects, error boundaries, and preserving detached branches.

## How is Treegger different from SolidJS?

Both use fine-grained reactivity and direct DOM updates. Treegger performs template parsing and binding at runtime; Solid's main JSX path uses a framework-specific compiler. Treegger makes derived expressions explicit with `derive()`.

| | Treegger | SolidJS |
| --- | --- | --- |
| Rendering | Runtime DOM factories | Compiler-optimized DOM operations for JSX |
| JSX | Standard automatic JSX runtime | Solid-specific JSX compilation |
| HTML templates | Built-in `html` and `html.with()` | Also available through a tagged-template runtime |
| Without a build step | Native JavaScript with HTML templates | Available through the HTML template runtime |
| Ecosystem | Small and experimental | Established framework and tooling |
| SSR and hydration | Not supported | Supported |

Solid documents its [JSX approach](https://docs.solidjs.com/concepts/understanding-jsx), [HTML template runtime](https://github.com/solidjs/solid/blob/main/packages/solid/html/README.md), and [hydration API](https://docs.solidjs.com/reference/rendering/hydrate).

Treegger explores a small runtime for experiments and interactive elements in existing pages. Runtime parsing and binding do work that a framework compiler could optimize ahead of time; this is an architectural trade-off, not a performance claim.

## Status and limitations

This is an experimental proof of concept. There is no SSR or hydration, and JSX still needs a syntax transform. The repository contains code snippets, not a project scaffold or example app. APIs may change between minor releases while the project is in `0.x`.

## Build the package

From a checkout:

```sh
npm ci
npm run package:build
```

The output in `dist/` includes ESM modules for bundlers, a standalone minified browser module, and TypeScript declarations. See the [contributing guide](.github/CONTRIBUTING.md) for build details and development commands.

Build and preview the static documentation:

```sh
npm run docs:build
npm run docs:preview
```

## Contributing

Issues and pull requests are welcome. Keep documentation current with behavior changes, and run `npm run docs:build` after editing `docs/md/`.

See the [contributing guide](.github/CONTRIBUTING.md) and [design guidelines](.github/DESIGN_GUIDELINES.md).

The project's ideas and design decisions are the author's. The code was written with the help of Codex.

## License

MIT. See [LICENSE](LICENSE).
