import { html, mount, signal } from "treegger";

function Counter({ title, initial = 0 }) {
  const count = signal(initial);
  return html`<button onClick=${() => count.value++}>${title}: ${count}</button>`;
}

// Create once: built-in tags such as ErrorBoundary remain available.
const view = html.with({ Counter });

mount(view`
  <ErrorBoundary>
    <Counter title="Counter A" initial=${0} />
    <Counter title="Counter B" initial=${10} />
  </ErrorBoundary>
`, document.getElementById("app"));
