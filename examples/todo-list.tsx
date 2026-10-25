import { derive, Each, mount, ref, signal } from "treegger";

interface Todo { id: number; title: string }

const todos = signal<Todo[]>([]);
const input = ref<HTMLInputElement>();
let nextId = 1;

function add(event: SubmitEvent) {
  event.preventDefault();
  const element = input.element;
  if (!element) return;
  const title = element.value.trim();
  if (!title) return;
  todos.value = [...todos.value, { id: nextId++, title }];
  element.value = "";
}

mount(<>
  <form onSubmit={add}>
    <input ref={input} placeholder="New todo" />
    <button>Add</button>
  </form>
  <ul><Each items={todos} fallback={derive(() => <li>No todos yet</li>)}>
    {todo => <li key={todo.id}>
      {todo.title}
      <button onClick={() => { todos.value = todos.value.filter(item => item.id !== todo.id); }}>Remove</button>
    </li>}
  </Each></ul>
</>, document.getElementById("app")!);
