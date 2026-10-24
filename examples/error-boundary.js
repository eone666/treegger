import { html, mount } from "../dist/index.js";

mount(html`
  <ErrorBoundary fallback=${(error, reset) => html`
    <p>${error.message}</p>
    <button onclick=${reset}>Try again</button>
  `}>
    <button onclick=${() => { throw new Error("Something broke"); }}>Throw error</button>
  </ErrorBoundary>
`, document.querySelector("#app"));
