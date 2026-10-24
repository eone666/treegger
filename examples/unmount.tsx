import { mount, onUnmount, signal } from "treegger";

const visible = signal(true);

function KeyListener() {
  const lastKey = signal("Press a key");
  const handleKeydown = (event: KeyboardEvent) => { lastKey.value = event.key; };

  window.addEventListener("keydown", handleKeydown);
  onUnmount(() => window.removeEventListener("keydown", handleKeydown));

  return <p>Last key: {lastKey}</p>;
}

mount(<>
  <button onClick={() => { visible.value = !visible.value; }}>
    {() => visible.value ? "Stop listening" : "Start listening"}
  </button>
  {() => visible.value ? <KeyListener /> : null}
</>, document.getElementById("app")!);
