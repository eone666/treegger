# v0.3.0

Explicit derivations with configurable result equality, updated public types, and clearer documentation.

## Reactive API

- Add `derive()` as the primary API for lazy, cached derived values, including writable derivations.
- Add `Derived<T>` and `WritableDerived<T>` as the primary public types. `Reactive<T>` now uses `Signal<T> | Derived<T>`.
- Keep `computed()`, `Computed<T>`, and `WritableComputed<T>` as deprecated compatibility aliases. Existing code remains supported.
- Add `DeriveOptions<T>` and `Equality<T>`. Equality defaults to `Object.is`; custom comparators retain the previous cached value when equal. `equals: false` notifies consumers after every actual reevaluation.
- Keep equality comparisons outside dependency tracking. Lazy evaluation, caching, ownership, and disposal remain unchanged.

## Documentation and tooling

- Update guides and HTML/TSX examples to use `derive()` and the new type names.
- Restructure the README around a working example, setup instructions, proof-of-concept status, and a comparison with Solid.
- Clarify local package installation and standalone browser usage with an import map.
- Use two-digit documentation filename prefixes and update navigation and links.
- Fix Markdown table formatting and validate table row widths during documentation builds.
- Consolidate contributor guidelines in `.github/`, including the tag-based release workflow.

## Migration

```ts
import { derive, type Derived } from "treegger";

const doubled: Derived<number> = derive(() => count.value * 2);
```

Replace `computed` with `derive`, `Computed` with `Derived`, and `WritableComputed` with `WritableDerived` when convenient. The old names still work.
