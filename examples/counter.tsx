import { computed, effect, mount, signal } from "treegger";

function Counter({ label }: { label: string }) {
  const count = signal(0);
  const doubled = computed(() => count.value * 2);

  effect(() => {
    const value = count.value;
    console.log(`${label}: ${value}`);
    return () => console.log(`${label}: cleanup for ${value}`);
  });

  return <div>
    <h2>{label}</h2>
    <button onClick={() => { count.value--; }}>−</button>
    <strong>{count}</strong>
    <button onClick={() => { count.value++; }}>+</button>
    <p>Double: {doubled}</p>
  </div>;
}

mount(<><Counter label="A" /><Counter label="B" /></>, document.getElementById("app")!);
