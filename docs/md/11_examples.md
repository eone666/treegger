# Examples

Each pair shows the same feature with an `html` tagged template and with JSX. These files are code snippets. Use the [Getting started setup](01_getting-started.md): HTML examples need a bundler that resolves the built package, or a browser import map pointing `"treegger"` to the standalone module. TSX examples additionally need an automatic JSX transform. Add `<div id="app"></div>` to your page and use one example module at a time.

| Feature | HTML template | JSX |
| --- | --- | --- |
| Counter and derived values | [counter.js](https://github.com/eone666/treegger/blob/master/examples/counter.js) | [counter.tsx](https://github.com/eone666/treegger/blob/master/examples/counter.tsx) |
| Conditional rendering | [conditional.js](https://github.com/eone666/treegger/blob/master/examples/conditional.js) | [conditional.tsx](https://github.com/eone666/treegger/blob/master/examples/conditional.tsx) |
| Preserving a hidden branch | [preserve.js](https://github.com/eone666/treegger/blob/master/examples/preserve.js) | [preserve.tsx](https://github.com/eone666/treegger/blob/master/examples/preserve.tsx) |
| Stores | [store.js](https://github.com/eone666/treegger/blob/master/examples/store.js) | [store.tsx](https://github.com/eone666/treegger/blob/master/examples/store.tsx) |
| Keyed todo list | [todo-list.js](https://github.com/eone666/treegger/blob/master/examples/todo-list.js) | [todo-list.tsx](https://github.com/eone666/treegger/blob/master/examples/todo-list.tsx) |
| Refs | [refs.js](https://github.com/eone666/treegger/blob/master/examples/refs.js) | [refs.tsx](https://github.com/eone666/treegger/blob/master/examples/refs.tsx) |
| Lifecycle cleanup | [unmount.js](https://github.com/eone666/treegger/blob/master/examples/unmount.js) | [unmount.tsx](https://github.com/eone666/treegger/blob/master/examples/unmount.tsx) |
| Error boundary | [error-boundary.js](https://github.com/eone666/treegger/blob/master/examples/error-boundary.js) | [error-boundary.tsx](https://github.com/eone666/treegger/blob/master/examples/error-boundary.tsx) |
| Reactive event handlers | [events.js](https://github.com/eone666/treegger/blob/master/examples/events.js) | [events.tsx](https://github.com/eone666/treegger/blob/master/examples/events.tsx) |
| Fragments | [fragments.js](https://github.com/eone666/treegger/blob/master/examples/fragments.js) | [fragments.tsx](https://github.com/eone666/treegger/blob/master/examples/fragments.tsx) |

For named component tags without JSX, see [html-with.js](https://github.com/eone666/treegger/blob/master/examples/html-with.js) and the [`html.with()` guide](02_rendering.md#named-components).
