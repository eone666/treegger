# Documentation guidelines

Keep user documentation and examples current when changing behavior. Run `npm run docs:build` after editing `docs/md/` or the documentation website sources.

## Files and navigation

- Put user-facing Markdown in `docs/md/`; website source files belong in `docs/web/`.
- Name pages with consecutive two-digit prefixes from `01_` to `99_`, such as `01_getting-started.md` and `02_rendering.md`. The builder derives the navigation order from those numbers and removes prefixes from HTML filenames.
- Keep `index.md` as the unnumbered entry page.
- Update Markdown links when renaming pages. Link to existing source pages rather than generated HTML from Markdown.
- Link example files on GitHub, using the repository's `master` branch.
- Keep contributor-only guidance in `.github/`, outside the public documentation navigation.

## Examples and formatting

- Use `from "treegger"` in examples. Browser examples need an import map; JSX examples need the standard automatic runtime with `jsxImportSource: "treegger"`.
- Make setup examples runnable and distinguish application setup from developing the library.
- Prefer `derive()` in new examples; document `computed()` only as its deprecated compatibility alias.
- Give fenced code blocks a language, such as `js`, `tsx`, `html`, or `sh`.
- Escape literal `|` characters inside Markdown table cells as `\|`, including inside inline code. The build validates row widths.

Shiki generates syntax highlighting at build time using the theme in `scripts/build-docs.mjs`. Code block layout and typography live in `docs/web/input.css`. No syntax highlighting JavaScript is shipped to the browser. Follow the [design guidelines](DESIGN_GUIDELINES.md) when changing presentation.
