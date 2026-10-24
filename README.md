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
mount(html`<button onClick=${() => { count.value++; }}>Count: ${count}</button>`,
  document.getElementById("app"));
```

For named components in HTML templates, register them with `html.with()`:

```js
const view = html.with({ Counter });
view`<Counter initial=${0} /><Counter initial=${10} />`;
```

See [named components](docs/md/2_rendering.md#named-components-with-html-with) for a complete example.

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

Pass the signal itself for reactive text: `{count}` in JSX or `${count}` in `html`. Reading `{count.value}` or `${count.value}` there captures a value once. Wrap derived expressions in `computed`, such as `{computed(() => count.value * 2)}`. Plain functions are callbacks, not reactive values.

Continue with the [Markdown documentation](docs/md/index.md) or the [documentation website](https://eone666.github.io/treegger/). Browse [examples/](examples/) for paired `html` and TSX snippets.

### Without a bundler

Copy `dist/treegger.browser.min.js` from the package to your site and map the package name to its URL with an import map:

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
    document.getElementById("app"));
</script>
```

The minified browser file contains the whole library and needs no other package files. Define the import map before any module script that imports Treegger. It lets the same `from "treegger"` imports work without a bundler; adjust the mapped URL to match where you host the file. Use a bundler when you want unused exports removed.

## Build the package

```sh
npm ci
npm run package:build
```

`package:build` runs separate Rolldown builds: tree-shakeable ESM modules for bundlers, a minified, single-file browser ESM bundle at `dist/treegger.browser.min.js`, and bundled `.d.ts` files via `rolldown-plugin-dts`. The package exports the ESM entry points from `dist/`.

## Development

```sh
npm run typecheck        # check source and JSX types without building
npm run typecheck:watch  # check again when files change
npm test                 # run runtime tests directly from src/
npm run lint             # lint TypeScript and JavaScript with Oxlint
npm run lint:fix         # apply available automatic fixes
```

Build the static documentation website from `docs/md/` with `npm run docs:build`. The generated pages are in `docs/web/dist/`. Run `npm run docs:preview` to preview that build with `serve` (port 3000 by default). To select a local address and port, use `npm run docs:preview -- --listen tcp://127.0.0.1:5192`.

## Contributing

Issues and pull requests are welcome. Please keep the documentation up to date with any changes you make. If you change the Markdown documentation in `docs/md/`, run `npm run docs:build` to check that the static HTML site builds successfully.

See the [contributing guide](.github/CONTRIBUTING.md) for the repository layout, JSX configuration, and checks. For visual changes, follow the [design guidelines](.github/DESIGN_GUIDELINES.md).

## License

MIT. See [LICENSE](LICENSE).
