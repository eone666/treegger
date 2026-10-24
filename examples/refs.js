import { html, mount, ref } from "treegger";

const input = ref();
mount(html`
  <input ref=${input} placeholder="Focus me">
  <button onClick=${() => input.element?.focus()}>Focus input</button>
`, document.querySelector("#app"));
