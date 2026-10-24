# Treegger

![Treegger logo](assets/treegger-readme.svg)

Treegger is a small reactive DOM library with signals, components, keyed lists, lifecycle hooks, HTML templates, and JSX. It has no runtime dependencies.

Treegger has no virtual DOM. Signals track reactive reads, and bindings update the affected DOM nodes directly.

The project's ideas and design decisions are the author's. The code was written with the help of Codex.

## Getting started

With Vite or another bundler, install Treegger:

```sh
npm install treegger
```

Add `<div id="app"></div>` to your page, then mount a counter:

```js
import { html, mount, signal } from "treegger";

const count = signal(0);
mount(html`<button onclick=${() => { count.value++; }}>Count: ${count}</button>`,
  document.getElementById("app"));
```

For TSX, set the automatic JSX runtime in your project's `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "treegger"
  }
}
```

Then write the same counter as:

```tsx
import { mount, signal } from "treegger";

const count = signal(0);
mount(<button onClick={() => { count.value++; }}>Count: {count}</button>,
  document.getElementById("app")!);
```

Continue with the [Markdown documentation](docs/md/index.md) or the [documentation website](https://eone666.github.io/treegger/). Browse [examples/](examples/) for paired `html` and TSX snippets.

### Without a bundler

Copy `dist/treegger.browser.min.js` from the package to your site and import it in a browser module:

```html
<div id="app"></div>
<script type="module">
  import { html, mount, signal } from "./treegger.browser.min.js";
  const count = signal(0);
  mount(html`<button onclick=${() => count.value++}>Count: ${count}</button>`,
    document.getElementById("app"));
</script>
```

The minified browser file contains the whole library and needs no other package files. Use the npm import above when a bundler can tree shake unused exports. A browser needs a URL such as `./treegger.browser.min.js`; the bare specifier `"treegger"` requires a bundler or import map.

## Build the package

```sh
npm ci
npm run build:package
```

`build:package` runs separate Rolldown builds: tree-shakeable ESM modules for bundlers, a minified, single-file browser ESM bundle at `dist/treegger.browser.min.js`, and bundled `.d.ts` files via `rolldown-plugin-dts`. The package exports the ESM entry points from `dist/`.

## Development

```sh
npm run typecheck        # check source and JSX types without building
npm run typecheck:watch  # check again when files change
npm test                 # run runtime tests directly from src/
```

Build the static documentation website from `docs/md/` with `npm run build:docs`. The generated pages are in `docs/web/dist/`.

## Contributing

Issues and pull requests are welcome. Please keep the documentation up to date with any changes you make. If you change the Markdown documentation in `docs/md/`, run `npm run build:docs` to check that the static HTML site builds successfully.

See the [contributing guide](.github/CONTRIBUTING.md) for the repository layout, JSX configuration, and checks. For visual changes, follow the [design guidelines](.github/DESIGN_GUIDELINES.md).

## License

MIT. See [LICENSE](LICENSE).
