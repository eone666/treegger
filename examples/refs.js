import { html, mount, ref } from "../dist/index.js";

const input = ref();
mount(html`
  <input ref=${input} placeholder="Focus me">
  <button onclick=${() => input.element?.focus()}>Focus input</button>
`, document.querySelector("#app"));
