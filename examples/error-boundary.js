import { html, mount } from "treegger";

mount(html`
  <ErrorBoundary fallback=${(error, reset) => html`
    <p>${error.message}</p>
    <button onClick=${reset}>Try again</button>
  `}>
    <button onClick=${() => { throw new Error("Something broke"); }}>Throw error</button>
  </ErrorBoundary>
`, document.querySelector("#app"));
