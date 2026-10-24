import { computed, html, mount, signal, store } from "../dist/index.js";

// Module-level state can be shared by importing it from another file.
const visits = signal(0);
export const app = store({
  profile: { name: "Ada" },
  visits,
  doubled: computed(() => app.visits * 2),
  remaining: computed({
    get: () => 10 - app.visits,
    set: next => { app.visits = 10 - next; }
  })
});

mount(html`
  <p>Hello, ${() => app.profile.name}. Visits: ${() => app.visits}. Double: ${() => app.doubled}. Remaining: ${() => app.remaining}</p>
  <button onclick=${() => { app.profile.name = "Grace"; app.visits++; }}>Add visit</button>
  <button onclick=${() => { app.remaining = 0; }}>Complete 10 visits</button>
`, document.querySelector("#app"));
