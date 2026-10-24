import { computed, effect, html, mount, signal } from "../dist/index.js";

function Counter({ label }) {
  const count = signal(0);
  const doubled = computed(() => count.value * 2);

  effect(() => {
    const value = count.value;
    console.log(`${label}: ${value}`);
    return () => console.log(`${label}: cleanup for ${value}`);
  });

  return html`
    <div>
      <h2>${label}</h2>
      <button onclick=${() => count.value--}>−</button>
      <strong>${count}</strong>
      <button onclick=${() => count.value++}>+</button>
      <p>Double: ${doubled}</p>
    </div>
  `;
}

mount(html`<${Counter} label="A" /><${Counter} label="B" />`, document.querySelector("#app"));
