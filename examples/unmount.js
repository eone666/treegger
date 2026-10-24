import { component, html, mount, onUnmount, signal } from "../dist/index.js";

const visible = signal(true);

function KeyListener() {
  const lastKey = signal("Press a key");
  const handleKeydown = event => { lastKey.value = event.key; };

  window.addEventListener("keydown", handleKeydown);
  onUnmount(() => window.removeEventListener("keydown", handleKeydown));

  return html`<p>Last key: ${lastKey}</p>`;
}

mount(html`
  <button onclick=${() => { visible.value = !visible.value; }}>
    ${() => visible.value ? "Stop listening" : "Start listening"}
  </button>
  ${() => visible.value ? component(KeyListener) : null}
`, document.querySelector("#app"));
