import { computed, html, mount, onUnmount, ref, signal } from "treegger";

const visible = signal(true);
const draft = ref();

function Draft() {
  onUnmount(() => console.log("Draft disposed"));
  return html`<textarea ref=${draft} placeholder="Type a draft, then detach and restore it"></textarea>`;
}

mount(html`
  <button onClick=${() => { visible.value = !visible.value; }}>
    ${computed(() => visible.value ? "Hide draft" : "Show draft")}
  </button>
  <Preserve when=${visible}><${Draft} /></Preserve>
`, document.querySelector("#app"));

// After a hide update, draft.element is retained but draft.element.isConnected is false.
// Showing the draft restores the same textarea and its value. No wrapper element is added.
