import { computed, effect, mount, signal, type Reactive } from "treegger";

function Counter({ label, initial = 0 }: { label: Reactive<string>; initial?: number }) {
  const count = signal(initial);
  const doubled = computed(() => count.value * 2);

  effect(() => {
    const value = count.value;
    const name = label.value;
    console.log(`${name}: ${value}`);
    return () => console.log(`${name}: cleanup for ${value}`);
  });

  return <div>
    <h2>{label}</h2>
    <button onClick={() => { count.value--; }}>−</button>
    <strong>{count}</strong>
    <button onClick={() => { count.value++; }}>+</button>
    <p>Double: {doubled}</p>
  </div>;
}

const label = signal("A");
// label can update; initial is only used when each Counter instance is created.
mount(<>
  <Counter label={label} initial={0} />
  <Counter label={signal("B")} initial={10} />
  <button onClick={() => { label.value = label.value === "A" ? "First counter" : "A"; }}>Rename A</button>
</>, document.getElementById("app")!);
