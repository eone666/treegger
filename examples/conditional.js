import { component, html, mount, onUnmount, ref, signal } from "../dist/index.js";

const visible = signal(true);
const input = ref();

function Editor() {
  onUnmount(() => console.log("Editor removed"));
  return html`<input ref=${input} placeholder="Write something">`;
}

mount(html`
  <button onclick=${() => { visible.value = !visible.value; }}>
    ${() => visible.value ? "Hide editor" : "Show editor"}
  </button>
  ${() => visible.value
    ? component(Editor)
    : html`<p>Editor is hidden</p>`}
`, document.querySelector("#app"));

// input.element is null while the Editor branch is hidden.
