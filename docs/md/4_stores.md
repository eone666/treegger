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

Nested plain objects and arrays are wrapped when accessed. Reading a field inside an effect or computed calculation tracks that field. Reading array length, indexed items, membership with `in`, and keys with `Object.keys` can also create dependencies. Replacing a nested object causes consumers to follow the replacement on their next run.

`state.tasks.push(item)` goes through the array proxy: it writes a new index and changes `length`, so effects that read the affected array properties run again. A plain array inside `signal` behaves differently: `items.value.push(item)` does not assign to `.value` and does not notify effects. Use `items.value = [...items.value, item]` with a signal.

`store` accepts plain objects and arrays. Other objects such as `Date` and `Map` are kept as ordinary values, not deep reactive proxies. A module-level store can be imported by multiple components as shared state.

## Signals and computed fields

For object properties, a store unwraps signals and computed values when read. Assigning to a signal field updates its original signal:

```js
import { computed, signal, store } from "treegger";

const visits = signal(0);
const app = store({
  visits,
  doubled: computed(() => app.visits * 2)
});

app.visits = 3;
console.log(visits.value); // 3
console.log(app.doubled);  // 6
```

`app.doubled` is read-only. An assignment warns and does not change its computed value. To allow writes, use a computed getter and setter:

```js
const price = store({
  amount: 10,
  withTax: computed({
    get: () => price.amount * 1.2,
    set: next => { price.amount = next / 1.2; }
  })
});
price.withTax = 24; // price.amount is 20
```

The computed getter is lazy, so referring to `app` or `price` inside it is valid after the store declaration finishes.

Signals and computed values in **array slots** stay wrapped; access their `.value`. This differs from object fields:

```js
const rows = store([signal(1)]);
console.log(rows[0].value); // 1
```

DOM refs also remain objects when stored in a store.

## Rendering store fields

Wrap store field reads in a function so Treegger can subscribe:

```jsx
<p>{() => app.visits}</p>
```

```js
html`<p>${() => app.visits}</p>`;
```

Passing `app.visits` directly evaluates it while constructing the tree, before the reactive rendering effect reads it. See [Reactivity](3_reactivity.md) for the dependency model.
