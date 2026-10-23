(() => {
  const { signal, ref, html, component, mount, debug } = window.Treegger;
  debug.showRerenders = true;

  function Counter({ title, initial = 0 }) {
    const count = signal(initial);
    const color = signal("tomato");

    console.log(title, "initialized ONCE");

    return html`
      <div style="padding: 16px; margin: 12px 0; border: 1px solid #ccc; border-radius: 12px">
        <h2>${title}</h2>
        <p style=${() => ({ color: color.value, fontSize: "24px" })}>
          ${() => `Count: ${count.value}`}
        </p>
        <button onclick=${() => count.value++}>+</button>
        <button onclick=${() => count.value--}>-</button>
        <button onclick=${() => {
          color.value = color.value === "tomato" ? "royalblue" : "tomato";
        }}>Change color</button>
      </div>
    `;
  }

  function App() {
    console.log("App initialized ONCE");
    const inputRef = ref();
    const items = signal(["First", "Second"]);
    const showItems = signal(true);

    return html`
      <main style="max-width: 500px; margin: 40px auto; font-family: sans-serif">
        <h1>Treegger 🌳</h1>
        <input ref=${inputRef} placeholder="Focus me">
        <button onclick=${() => inputRef.element?.focus()}>Focus input</button>
        <button onclick=${() => { items.value = [...items.value, `Item ${items.value.length + 1}`]; }}>Add item</button>
        <button onclick=${() => { showItems.value = !showItems.value; }}>Toggle list</button>
        <ul>${() => showItems.value && items.value.map(item => html`<li>${item}</li>`)}</ul>
        ${component(Counter, { title: "Counter A", initial: 0 })}
        ${component(Counter, { title: "Counter B", initial: 10 })}
      </main>
    `;
  }

  function start() {
    const root = document.createElement("div");
    document.body.append(root);
    window.unmountTreegger = mount(component(App), root);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
