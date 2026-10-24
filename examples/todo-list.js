import { html, mount, ref, signal } from "../dist/index.js";

const todos = signal([]);
const input = ref();
let nextId = 1;

function add(event) {
  event.preventDefault();
  const title = input.element.value.trim();
  if (!title) return;
  todos.value = [...todos.value, { id: nextId++, title }];
  input.element.value = "";
}

mount(html`
  <form onsubmit=${add}>
    <input ref=${input} placeholder="New todo">
    <button>Add</button>
  </form>
  <ul><Each items=${todos} fallback=${() => html`<li>No todos yet</li>`}>
    ${todo => html`<li key=${todo.id}>
      ${todo.title}
      <button onclick=${() => { todos.value = todos.value.filter(item => item.id !== todo.id); }}>Remove</button>
    </li>`}
  </Each></ul>
`, document.querySelector("#app"));
