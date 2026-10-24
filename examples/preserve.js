import { html, mount, onUnmount, signal } from "../dist/index.js";

const visible = signal(true);

function Draft() {
  onUnmount(() => console.log("Draft disposed"));
  return html`<textarea placeholder="Type a draft, then hide and show it"></textarea>`;
}

mount(html`
  <button onclick=${() => { visible.value = !visible.value; }}>
    ${() => visible.value ? "Hide draft" : "Show draft"}
  </button>
  <Preserve when=${visible}><${Draft} /></Preserve>
`, document.querySelector("#app"));
