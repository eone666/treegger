# Code guidelines

- Write the library source in TypeScript under `src/`.
- Keep TypeScript strict mode enabled and provide types for the public API and internal code.
- Do not use `any`, including implicit `any`.
- Do not bypass the type system with double assertions such as `as unknown as SomeType`.
- Generate JavaScript and declaration files from the TypeScript source. Do not maintain handwritten `.d.ts` files for library code.

## Checks

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run package:build` before sharing code changes.

Oxlint checks JavaScript and TypeScript correctness without React-specific rules. Type checking stays in `npm run typecheck`. The `no-useless-spread` rule is disabled because reactive subscriber sets and DOM child lists require snapshots when iteration mutates the original collection. Generated output is excluded from linting.

Keep behavior changes documented according to the [documentation guidelines](DOCUMENTATION_GUIDELINES.md). Follow the [design guidelines](DESIGN_GUIDELINES.md) for visual changes and the [release workflow](RELEASING.md) when preparing a release.
