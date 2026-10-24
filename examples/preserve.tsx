import { computed, Preserve, mount, onUnmount, ref, signal } from "treegger";

const visible = signal(true);
const draft = ref<HTMLTextAreaElement>();

function Draft() {
  onUnmount(() => console.log("Draft disposed"));
  return <textarea ref={draft} placeholder="Type a draft, then detach and restore it" />;
}

mount(<>
  <button onClick={() => { visible.value = !visible.value; }}>
    {computed(() => visible.value ? "Hide draft" : "Show draft")}
  </button>
  <Preserve when={visible}><Draft /></Preserve>
</>, document.getElementById("app")!);

// After a hide update, draft.element is retained but draft.element.isConnected is false.
// Showing the draft restores the same textarea and its value. No wrapper element is added.
