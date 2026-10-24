import { Preserve, mount, onUnmount, signal } from "treegger";

const visible = signal(true);

function Draft() {
  onUnmount(() => console.log("Draft disposed"));
  return <textarea placeholder="Type a draft, then hide and show it" />;
}

mount(<>
  <button onClick={() => { visible.value = !visible.value; }}>
    {() => visible.value ? "Hide draft" : "Show draft"}
  </button>
  <Preserve when={visible}><Draft /></Preserve>
</>, document.getElementById("app")!);
