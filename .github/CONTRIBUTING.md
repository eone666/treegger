# Contributing to Treegger

Issues and pull requests are welcome. Keep user documentation current when changing behavior. If you edit `docs/md/`, run `npm run docs:build` before submitting a pull request. For visual changes, follow the [design guidelines](DESIGN_GUIDELINES.md).

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
Name documentation pages with consecutive numeric prefixes, such as `1_getting-started.md` and `2_rendering.md`. The builder sorts by those numbers and removes them from the generated HTML filenames. `index.md` is the home page and has no prefix. Update local Markdown links when renaming a page.
After building, `npm pack --dry-run` shows what the npm package would contain without publishing it.

## TypeScript and JSX

The library is authored in TypeScript with strict checking. Declaration files are generated from source; they are not edited by hand. Public types include `Signal`, `Computed`, `Store`, `Tree`, `ElementProps`, `EachProps`, and `DomRef`.

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

The [Code Guidelines](../AGENTS.md) require strict TypeScript, no `any`, and no double assertion through `unknown`. Run `npm run lint`, `npm run typecheck`, `npm run package:build`, and `npm test` before sharing a change.

## Releases

GitHub Actions runs lint, typecheck, and tests on pushes and pull requests. A pushed `v*` tag runs the same checks, builds the package, and creates a GitHub Release with `RELEASE_NOTES.md` as its body. The Release includes the minified browser module and an npm package tarball. It does not publish to npm.

Before each release:

1. Update the version in `package.json` and `package-lock.json`, for example with `npm version 0.2.0 --no-git-tag-version`.
2. Replace the contents of `RELEASE_NOTES.md`. Its first line must be `# v0.2.0` for version `0.2.0`, followed by the release text.
3. Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run package:build`. Commit and push these changes to the default branch.
4. Tag that commit with the matching version and push the tag, for example `git tag v0.2.0` followed by `git push origin v0.2.0`.

The release job checks that the tag matches the package version and the heading in `RELEASE_NOTES.md`. It runs only after lint, typecheck, and tests pass.

Pushing the version tag is the release action. Let the workflow create the GitHub Release and upload its assets; do not create a separate release manually or run `gh release create` locally. Check the tag workflow and resulting release after pushing.

Oxlint checks JavaScript and TypeScript correctness without React-specific rules. Type checking stays in `npm run typecheck`. The `no-useless-spread` rule is disabled because reactive subscriber sets and DOM child lists require snapshots when iteration mutates the original collection. Generated output is excluded from linting.

Code fences in `docs/md/` should specify their language (`js`, `tsx`, `html`, `sh`, and so on). Shiki generates syntax highlighting at build time using the Treegger dark code theme in `scripts/build-docs.mjs`; code block layout and typography live in `docs/web/input.css`. No syntax highlighting JavaScript is shipped to the browser.
