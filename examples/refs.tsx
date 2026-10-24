import { mount, ref } from "treegger";

const input = ref<HTMLInputElement>();
mount(<>
  <input ref={input} placeholder="Focus me" />
  <button onClick={() => input.element?.focus()}>Focus input</button>
</>, document.getElementById("app")!);
