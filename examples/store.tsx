import { computed, mount, signal, store } from "treegger";

// Module-level state can be shared by importing it from another file.
const visits = signal(0);
export const app = store({
  profile: {
    name: "Ada",
    settings: { theme: { color: "green" } }
  },
  visits,
  doubled: computed(() => visits.value * 2),
  remaining: computed({
    get: () => 10 - visits.value,
    set: (next: number) => { visits.value = 10 - next; }
  })
});

mount(<>
  <p>Hello, {computed(() => app.profile.name)}. Visits: {computed(() => app.visits)}. Double: {computed(() => app.doubled)}. Remaining: {computed(() => app.remaining)}</p>
  <p>Theme color: {computed(() => app.profile.settings.theme.color)}</p>
  <button onClick={() => {
    app.profile.settings.theme.color = app.profile.settings.theme.color === "green" ? "blue" : "green";
  }}>Toggle theme color</button>
  <button onClick={() => { app.profile.name = "Grace"; app.visits++; }}>Add visit</button>
  <button onClick={() => { app.remaining = 0; }}>Complete 10 visits</button>
</>, document.getElementById("app")!);
