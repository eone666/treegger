import { computed, component, html, mount, onUnmount, signal } from "treegger";

const visible = signal(true);

function KeyListener() {
  const lastKey = signal("Press a key");
  const handleKeydown = event => { lastKey.value = event.key; };

  window.addEventListener("keydown", handleKeydown);
  onUnmount(() => window.removeEventListener("keydown", handleKeydown));

  return html`<p>Last key: ${lastKey}</p>`;
}

mount(html`
  <button onClick=${() => { visible.value = !visible.value; }}>
    ${computed(() => visible.value ? "Stop listening" : "Start listening")}
  </button>
  ${computed(() => visible.value ? component(KeyListener) : null)}
`, document.querySelector("#app"));
