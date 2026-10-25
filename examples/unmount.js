import { derive, component, html, mount, onUnmount, signal } from "treegger";

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
    ${derive(() => visible.value ? "Stop listening" : "Start listening")}
  </button>
  ${derive(() => visible.value ? component(KeyListener) : null)}
`, document.querySelector("#app"));
