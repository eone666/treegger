import { ErrorBoundary, mount } from "treegger";

mount(
  <ErrorBoundary fallback={(error, reset) => <>
    <p>{error instanceof Error ? error.message : String(error)}</p>
    <button onClick={reset}>Try again</button>
  </>}>
    <button onClick={() => { throw new Error("Something broke"); }}>Throw error</button>
  </ErrorBoundary>,
  document.getElementById("app")!
);
