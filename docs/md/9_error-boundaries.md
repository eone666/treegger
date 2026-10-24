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
    <button onclick=${reset}>Retry</button>
  `}>
    <button onclick=${() => { throw new Error("Failed"); }}>Throw</button>
  </ErrorBoundary>
`;
```

The failing branch is disposed before the fallback is mounted. Errors thrown by a fallback can reach an outer boundary. If there is no boundary, they propagate as errors.

An event handler that returns a rejected native Promise is also reported to its boundary. Errors from unrelated browser callbacks or asynchronous work outside Treegger's handlers are outside the boundary's scope; handle those where they occur.

See [error-boundary.js](https://github.com/eone666/treegger/blob/master/examples/error-boundary.js) and [error-boundary.tsx](https://github.com/eone666/treegger/blob/master/examples/error-boundary.tsx).
