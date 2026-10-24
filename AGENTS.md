# Code Guidelines

- Write the library source in TypeScript under `src/`.
- Keep TypeScript strict mode enabled and provide types for the public API and internal code.
- Do not use `any`, including implicit `any`.
- Do not bypass the type system with double assertions such as `as unknown as SomeType`.
- Generate JavaScript and declaration files from the TypeScript source. Do not maintain handwritten `.d.ts` files for library code.

## Releases

- Update both `package.json` and `package-lock.json`, and replace `RELEASE_NOTES.md` before a release.
- Commit and push the release changes, then push a matching `v<version>` Git tag.
- Pushing the tag is the release action: `.github/workflows/ci.yml` runs the checks, builds the package, and creates the GitHub Release with assets and `RELEASE_NOTES.md`. Do not create the release manually or run `gh release create` locally.
- Verify the tag workflow and resulting release after pushing.
