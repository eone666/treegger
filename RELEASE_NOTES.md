# v0.2.0

Explicit reactive values, named HTML components, reactive event handlers, and rendering fixes.

## Breaking changes

- Plain functions no longer create reactive children, DOM props, `Preserve` conditions, or `Each` sources and fallbacks. Use a signal or an explicit `computed(() => ...)` instead. Event callbacks, refs, component functions, row render callbacks, and error-boundary fallbacks remain functions.
- `Reactive<T>` is now `Signal<T> | Computed<T>`. Read either through `.value`. `MaybeReactive<T>` also accepts a static value for DOM props and control inputs.
- `Preserve` detaches its branch from the document instead of hiding it with CSS. Component state, effects, refs, and DOM nodes survive until the branch is disposed.
- Build commands use module-first names: `package:build` and `docs:build` replace `build:package` and `build:docs`.

## New features

- `html.with({ Counter })` creates a scoped template tag supporting `<Counter />`. Registries can be extended without changing the original tag, and built-in components remain available.
- DOM event props accept callbacks, signals, or computed values. Reactive handlers are read at dispatch without replacing the DOM listener; nullish values disable handling. Selection errors and callback failures use `ErrorBoundary`.
- `EventProp<E>` describes static or reactive event props; `EventHandler<E>` remains the plain callback type.
- Computed children support conditional JSX and HTML branches, fragments, arrays, lists, nested reactive values, and native DOM nodes. Unchanged computed results preserve existing DOM and cleanup state.

## Fixes

- Preserve SVG namespaces, case-sensitive names, and attributes through components and reactive branches.
- Move and remove complete keyed component fragments, including roots that change after mounting.
- Keep HTML template prop casing and boolean component props consistent with JSX.
- Serialize boolean ARIA, data, and enumerated attributes correctly, and apply initial select values after mounting options.
- Preserve built-in values in stores and support reactive object getters and setters through `this`.
- Improve cleanup and computed error handling, dependency tracking, and disposal behavior.

## Documentation and tooling

- Update guides and paired HTML/TSX examples for explicit computed values, scoped templates, reactive events, stores, and detached branches.
- Add Shiki syntax highlighting, language labels, and code copying to static documentation, with self-hosted Onest and Iosevka fonts and improved contrast and spacing.
- Add Oxlint to push and pull-request checks alongside type checking and tests. The test suite includes real DOM coverage with jsdom.
- Add `docs:preview` using `serve`; GitHub Pages builds the documentation from source.

## Migration example

```tsx
// Before
<span>{() => count.value * 2}</span>

// After
<span>{computed(() => count.value * 2)}</span>
```

Pass signals and computed objects directly to reactive bindings. Reading `.value` while constructing a tree captures a snapshot; read it inside `computed` or `effect` when tracking is needed.
