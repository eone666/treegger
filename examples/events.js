import { computed, html, mount, signal } from "treegger";

const editing = signal(false);
const enabled = signal(true);
const saves = signal(0);
const edit = () => { editing.value = true; };
const save = () => { saves.value++; editing.value = false; };
const handler = computed(() => enabled.value ? (editing.value ? save : edit) : null);
const label = computed(() => editing.value ? "Save" : "Edit");

// The current handler is read at click time; changing it does not replace the DOM listener.
mount(html`
  <button onClick=${handler}>${label}</button>
  <button onClick=${() => { enabled.value = !enabled.value; }}>Toggle handling</button>
  <p>Enabled: ${computed(() => String(enabled.value))}. Saves: ${saves}</p>
`, document.getElementById("app"));
