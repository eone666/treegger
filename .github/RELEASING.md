# Release workflow

**Pushing a version tag creates the release.** Do not create a GitHub Release manually or run `gh release create` locally.

GitHub Actions runs lint, typecheck, and tests on pushes and pull requests. Pushing a `v*` tag runs those checks, builds the package, and creates a GitHub Release using `RELEASE_NOTES.md`. Assets include the minified browser module and npm package tarball. The workflow does not publish to npm.

## Prepare and publish

1. Update both `package.json` and `package-lock.json`. For example, use `npm version 0.3.0 --no-git-tag-version` when preparing version `0.3.0`.
2. Replace `RELEASE_NOTES.md`. Its first line must match the tag, such as `# v0.3.0`, followed by the release text.
3. Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run package:build`, and `npm run docs:build`.
4. Commit the release changes and push them to `master`.
5. Tag that commit with the matching version and push the tag, for example `git tag v0.3.0` followed by `git push origin v0.3.0`.
6. Verify the tag workflow, published GitHub Release, and uploaded assets.

[The workflow](workflows/ci.yml) validates that the tag matches the package version and the heading in `RELEASE_NOTES.md`. Release creation runs only after the checks pass.
