import { computed, mount, signal, store } from "treegger";

// Module-level state can be shared by importing it from another file.
const visits = signal(0);
export const app = store({
  profile: { name: "Ada" },
  visits,
  doubled: computed(() => visits.value * 2),
  remaining: computed({
    get: () => 10 - visits.value,
    set: (next: number) => { visits.value = 10 - next; }
  })
});

mount(<>
  <p>Hello, {() => app.profile.name}. Visits: {() => app.visits}. Double: {() => app.doubled}. Remaining: {() => app.remaining}</p>
  <button onClick={() => { app.profile.name = "Grace"; app.visits++; }}>Add visit</button>
  <button onClick={() => { app.remaining = 0; }}>Complete 10 visits</button>
</>, document.getElementById("app")!);
