import { computed, component, html, mount, onUnmount, ref, signal } from "treegger";

const visible = signal(true);
const input = ref();

function Editor() {
  onUnmount(() => console.log("Editor removed"));
  return html`<input ref=${input} placeholder="Write something">`;
}

mount(html`
  <button onClick=${() => { visible.value = !visible.value; }}>
    ${computed(() => visible.value ? "Hide editor" : "Show editor")}
  </button>
  ${computed(() => visible.value
    ? component(Editor)
    : html`<p>Editor is hidden</p>`)}
`, document.querySelector("#app"));

// input.element is null while the Editor branch is hidden.
