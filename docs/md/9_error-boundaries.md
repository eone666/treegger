# Error boundaries

`ErrorBoundary` displays fallback content if its child tree throws during initial rendering, a reactive update, or a Treegger event handler.

```jsx
import { ErrorBoundary } from "treegger";

const view = <ErrorBoundary fallback={(error, reset) =>
  <button onClick={reset}>Retry: {String(error)}</button>
}>
  <Widget />
</ErrorBoundary>;
```

The fallback receives the caught error and a `reset()` function. Calling `reset()` disposes the fallback and tries the original children again. A fallback may also be a static Treegger child.

With `html` templates:

```js
import { html } from "treegger";

const view = html`
  <ErrorBoundary fallback=${(error, reset) => html`
    <p>${String(error)}</p>
    <button onClick=${reset}>Retry</button>
  `}>
    <button onClick=${() => { throw new Error("Failed"); }}>Throw</button>
  </ErrorBoundary>
`;
```

The failing branch is disposed before the fallback is mounted. Errors thrown by a fallback can reach an outer boundary. If there is no boundary, they propagate as errors.

Event handlers supplied directly or through a signal/computed source use the same error boundary. Errors thrown while selecting a reactive handler, an invalid selected value, synchronous callback errors, and rejected native Promises are reported to that boundary. Errors from unrelated browser callbacks or asynchronous work outside Treegger's handlers are outside the boundary's scope; handle those where they occur.

See [error-boundary.js](https://github.com/eone666/treegger/blob/master/examples/error-boundary.js) and [error-boundary.tsx](https://github.com/eone666/treegger/blob/master/examples/error-boundary.tsx).
