import { mount, onUnmount, ref, signal } from "treegger";

const visible = signal(true);
const input = ref<HTMLInputElement>();

function Editor() {
  onUnmount(() => console.log("Editor removed"));
  return <input ref={input} placeholder="Write something" />;
}

mount(<>
  <button onClick={() => { visible.value = !visible.value; }}>
    {() => visible.value ? "Hide editor" : "Show editor"}
  </button>
  {() => visible.value
    ? <Editor />
    : <p>Editor is hidden</p>}
</>, document.getElementById("app")!);

// input.element is null while the Editor branch is hidden.
