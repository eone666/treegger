# Contributing to Treegger

Issues and pull requests are welcome. The guidelines below describe the expectations for code, documentation, design, and releases.

## Guidelines

- [Code guidelines](CODE_GUIDELINES.md)
- [Documentation guidelines](DOCUMENTATION_GUIDELINES.md)
- [Design guidelines](DESIGN_GUIDELINES.md)
- [Release workflow](RELEASING.md)

## Repository layout

| Path | Purpose |
| --- | --- |
| `src/` | Strict TypeScript source for runtime, JSX entry points, and public types |
| `dist/` | Generated ESM and `.d.ts` files; ignored by Git |
| `examples/` | Paired `html` and JSX code snippets |
| `test/` | Runtime tests, jsdom rendering tests, shared helpers, and a TypeScript/JSX consumer type check |
| `docs/md/` | Markdown source for user documentation |
| `docs/web/` | Source files for the documentation website |
| `docs/web/dist/` | Generated static documentation website |

The package exports only `dist/`. Its `files` list includes the generated output; npm also includes `README.md`, `LICENSE`, and `package.json`.

## Commands

```sh
npm ci                 # install development dependencies
npm run package:build  # build package ESM, minified browser ESM, and declarations in dist/
npm run docs:build     # build the static documentation site into docs/web/dist/
npm run docs:preview   # preview the built documentation with serve (port 3000)
npm test               # run runtime tests directly from src/
npm run lint           # lint source, examples, scripts, and tests with Oxlint
npm run lint:fix       # apply available automatic fixes
npm run typecheck      # check source and the TypeScript/JSX consumer fixture
npm run typecheck:watch # keep checking as files change
```

`package:build` and `docs:build` are named for their outputs.
`docs:build` converts `docs/md/` with markdown-it and Tailwind CSS into static HTML pages. The site uses a small JavaScript helper for copying code blocks; it does not require a package build.
After building, `npm pack --dry-run` shows what the npm package would contain without publishing it.

## TypeScript and JSX

The library is authored in TypeScript with strict checking. Declaration files are generated from source; they are not edited by hand. Public types include `Signal`, `Derived`, `Store`, `Tree`, `ElementProps`, `EachProps`, and `DomRef`.

For a TypeScript consumer using JSX:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "treegger"
  }
}
```

The automatic JSX runtime resolves to `treegger/jsx-runtime` or `treegger/jsx-dev-runtime`. No explicit `createElement` import is required for JSX syntax.

Follow the [code guidelines](CODE_GUIDELINES.md) when changing the implementation, the [documentation guidelines](DOCUMENTATION_GUIDELINES.md) when editing guides and examples, and the [release workflow](RELEASING.md) when preparing a release.
