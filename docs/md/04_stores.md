# Stores

`store(initial)` wraps a plain object or array in a deep reactive proxy. Read and write fields with normal property syntax:

```js
import { effect, store } from "treegger";

const state = store({
  user: { name: "Ada" },
  tasks: [{ title: "Write docs" }]
});

effect(() => console.log(state.user.name));
state.user.name = "Grace";
state.tasks.push({ title: "Publish" });
```

There is no fixed nesting-depth limit in `store`. Nested plain objects and arrays are wrapped lazily when accessed, rather than traversing the entire state when the store is created. Reading a field inside an effect or derivation tracks that field at any depth. Reading array length, indexed items, membership with `in`, and keys with `Object.keys` can also create dependencies. Replacing a nested object causes consumers to follow the replacement on their next run.

`state.tasks.push(item)` goes through the array proxy: it writes a new index and changes `length`, so effects that read the affected array properties run again. A plain array inside `signal` behaves differently: `items.value.push(item)` does not assign to `.value` and does not notify effects. Use `items.value = [...items.value, item]` with a signal.

`store` accepts plain objects and arrays. Nested `Date`, `Map`, `Set`, and class instances remain ordinary values: their internal mutations are not tracked. Replacing the store field holding such a value is reactive. A module-level store can be imported by multiple components as shared state.

## Deep nesting

Use ordinary property access even when several objects or arrays separate a field from the store root:

```js
const preferences = store({
  profile: {
    settings: {
      theme: { color: "green" },
      shortcuts: [{ keys: ["Control", "K"] }]
    }
  }
});

effect(() => console.log(preferences.profile.settings.theme.color));
preferences.profile.settings.theme.color = "blue"; // effect logs the new color

effect(() => console.log(preferences.profile.settings.shortcuts[0].keys.length));
preferences.profile.settings.shortcuts[0].keys.push("Enter"); // effect logs 3
```

Write through the store proxy so changes are tracked. For rendering, keep the deep field read inside `derive`, such as `{derive(() => preferences.profile.settings.theme.color)}`. The [store examples](11_examples.md) demonstrate changing and rendering a deeply nested field in both HTML templates and TSX.

## Object getters and setters

Ordinary object accessors also work. Their `this` is the reactive store, so reads inside a getter and writes inside a setter are tracked:

```js
const state = store({
  count: 1,
  get doubled() { return this.count * 2; },
  set doubled(next) { this.count = next / 2; }
});

effect(() => console.log(state.doubled));
state.count = 2;   // effect logs 4
state.doubled = 10; // updates count to 5; effect logs 10
```

Unlike `derive`, an ordinary getter runs on every access and does not cache its result.

## Signals and derived fields

For object properties, a store unwraps signals and derived values when read. Assigning to a signal field updates its original signal:

```js
import { derive, signal, store } from "treegger";

const visits = signal(0);
const app = store({
  visits,
  doubled: derive(() => app.visits * 2)
});

app.visits = 3;
console.log(visits.value); // 3
console.log(app.doubled);  // 6
```

`app.doubled` is read-only. An assignment warns and does not change its derived value. To allow writes, use a derivation getter and setter:

```js
const price = store({
  amount: 10,
  withTax: derive({
    get: () => price.amount * 1.2,
    set: next => { price.amount = next / 1.2; }
  })
});
price.withTax = 24; // price.amount is 20
```

The derivation getter is lazy, so referring to `app` or `price` inside it is valid after the store declaration finishes.

Signals and derived values in **array slots** stay wrapped; access their `.value`. This differs from object fields:

```js
const rows = store([signal(1)]);
console.log(rows[0].value); // 1
```

DOM refs also remain objects when stored in a store.

## Rendering store fields

Wrap store field reads in `derive()` so Treegger can subscribe:

```jsx
<p>{derive(() => app.visits)}</p>
```

```js
html`<p>${derive(() => app.visits)}</p>`;
```

Passing `app.visits` directly evaluates it while constructing the tree, before the reactive rendering effect reads it. See [Reactivity](03_reactivity.md) for the dependency model.
