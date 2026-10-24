import { computed } from '../src/index.ts';
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { setup, nextFlush, textContent } from './helpers.js';

test('DOM event props reject invalid static values and accept callbacks or nullish values', () => {
  const { jsx, mount, document } = setup();
  const callback = () => {};
  for (const onClick of ['handler', false, 42, {}]) {
    assert.throws(() => mount(jsx('button', { onClick }), document.createElement('root')), /must be an event callback/);
  }
  const target = document.createElement('root');
  const stop = mount(jsx('button', { onClick: callback, onChange: null, onInput: undefined }), target);
  assert.equal(target.childNodes[0].listeners.size, 1);
  stop();
});

test('store leaves built-in objects, class instances, and callbacks intact', async () => {
  const { store, effect } = setup();
  class Counter {
    count = 0;
    increment() { return ++this.count; }
  }
  const date = new Date(0);
  const map = new Map([['key', 1]]);
  const set = new Set(['key']);
  const callback = value => value * 2;
  const instance = new Counter();
  const state = store({ nested: { date, map, set, callback, instance } });
  assert.equal(state.nested.date, date);
  assert.equal(state.nested.date.getTime(), 0);
  assert.equal(state.nested.map, map);
  assert.equal(state.nested.map.get('key'), 1);
  assert.equal(state.nested.set, set);
  assert.equal(state.nested.set.has('key'), true);
  assert.equal(state.nested.callback, callback);
  assert.equal(state.nested.callback(3), 6);
  assert.equal(state.nested.instance, instance);
  assert.equal(state.nested.instance.increment(), 1);
  const seen = [];
  const job = effect(() => { seen.push(state.nested.date.getTime()); });
  date.setTime(1);
  await nextFlush();
  assert.deepEqual(seen, [0]);
  state.nested.date = new Date(2);
  await nextFlush();
  assert.deepEqual(seen, [0, 2]);
  job.stop();
});

test('debug highlights updates only in its mounted tree', async () => {
  const { signal, createElement, debug, mount, document } = setup();
  const animations = [];
  const create = document.createElement;
  document.createElement = tag => {
    const element = create(tag);
    element.animate = () => { animations.push(element); };
    return element;
  };

  const highlighted = signal('first');
  const plain = signal('first');
  const disabled = signal('first');
  const target = document.createElement('root');
  const stopHighlighted = mount(debug(createElement('p', {}, highlighted)), target);
  const stopPlain = mount(createElement('p', {}, plain), target);
  const stopDisabled = mount(debug(createElement('p', {}, disabled), { showUpdates: false }), target);
  assert.equal(animations.length, 0);

  highlighted.value = 'second';
  plain.value = 'second';
  disabled.value = 'second';
  await nextFlush();
  assert.deepEqual(animations, [target.childNodes[0]]);

  stopHighlighted();
  stopPlain();
  stopDisabled();
});

test('effect cleans up before rerun and on stop', async () => {
  const { signal, effect } = setup();
  const count = signal(0);
  const calls = [];
  const job = effect(() => {
    const value = count.value;
    calls.push(`run ${value}`);
    return () => calls.push(`cleanup ${value}`);
  });

  count.value = 1;
  await nextFlush();
  job.stop();
  assert.deepEqual(calls, ['run 0', 'cleanup 0', 'run 1', 'cleanup 1']);
});

test('store tracks nested fields independently and follows replacement objects', async () => {
  const { store, effect } = setup();
  const state = store({ user: { name: 'Ada', age: 30 }, theme: 'light' });
  const names = [];
  const job = effect(() => { names.push(state.user.name); });

  state.user.age++;
  state.theme = 'dark';
  await nextFlush();
  assert.deepEqual(names, ['Ada']);

  state.user.name = 'Grace';
  await nextFlush();
  assert.deepEqual(names, ['Ada', 'Grace']);

  const oldUser = state.user;
  state.user = { name: 'Lin', age: 25 };
  await nextFlush();
  assert.deepEqual(names, ['Ada', 'Grace', 'Lin']);
  oldUser.name = 'Ignored';
  await nextFlush();
  assert.deepEqual(names, ['Ada', 'Grace', 'Lin']);
  job.stop();
});

test('store unwraps signal fields and writes through to the original signal', async () => {
  const { signal, store, effect } = setup();
  const count = signal(1);
  const state = store({ count });
  const values = [];
  const job = effect(() => { values.push(state.count); });

  assert.equal(state.count, 1);
  state.count = 2;
  await nextFlush();
  assert.equal(count.value, 2);
  assert.deepEqual(values, [1, 2]);

  const replacement = signal(5);
  state.count = replacement;
  await nextFlush();
  assert.equal(state.count, 5);
  count.value = 10;
  await nextFlush();
  assert.deepEqual(values, [1, 2, 5]);
  replacement.value = 6;
  await nextFlush();
  assert.deepEqual(values, [1, 2, 5, 6]);
  job.stop();
});

test('store leaves array signal elements and DOM refs wrapped as their original objects', () => {
  const { signal, store, ref } = setup();
  const count = signal(1);
  const input = ref();
  const state = store({ items: [count], input });
  assert.equal(state.items[0], count);
  assert.equal(state.input, input);
  state.items[0] = 2;
  assert.equal(count.value, 1);
  assert.equal(state.items[0], 2);
  const node = {};
  state.input.refCallback(node);
  assert.equal(state.input.element, node);
});

test('store tracks array length, indexed values, membership, and keys', async () => {
  const { store, effect } = setup();
  const state = store({ items: [{ title: 'A' }] });
  const snapshots = [];
  const job = effect(() => {
    snapshots.push([state.items.length, state.items[0]?.title, '1' in state.items, Object.keys(state.items).length]);
  });

  state.items.push({ title: 'B' });
  await nextFlush();
  assert.deepEqual(snapshots.at(-1), [2, 'A', true, 2]);
  state.items[0].title = 'Updated';
  await nextFlush();
  assert.deepEqual(snapshots.at(-1), [2, 'Updated', true, 2]);
  state.items.length = 0;
  await nextFlush();
  assert.deepEqual(snapshots.at(-1), [0, undefined, false, 0]);
  job.stop();
});

test('store rejects non-objects and tracks added or deleted fields', async () => {
  const { store, effect } = setup();
  assert.throws(() => store(null), /plain object or array/);
  assert.throws(() => store(new Date()), /plain object or array/);
  const state = store({});
  const values = [];
  const job = effect(() => { values.push([state.name, 'name' in state, Object.keys(state).length]); });
  state.name = 'Treegger';
  await nextFlush();
  assert.deepEqual(values.at(-1), ['Treegger', true, 1]);
  delete state.name;
  await nextFlush();
  assert.deepEqual(values.at(-1), [undefined, false, 0]);
  job.stop();
});

test('store exposes computed fields and warns on writes to read-only values', async () => {
  const { store, effect, createElement: h, mount, document } = setup();
  let calculations = 0;
  const state = store({
    value: 1,
    doubled: computed(() => { calculations++; return state.value * 2; })
  });
  const target = document.createElement('root');
  const stop = mount(h('p', {}, computed(() => state.doubled)), target);
  const values = [];
  const job = effect(() => { values.push(state.doubled); });

  assert.equal(state.doubled, 2);
  assert.equal(calculations, 1);
  state.value = 3;
  await nextFlush();
  assert.equal(state.doubled, 6);
  assert.equal(target.childNodes[0].childNodes[0].data, '6');
  assert.deepEqual(values, [2, 6]);
  assert.equal(calculations, 2);
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = message => warnings.push(message);
  try {
    state.doubled = 10;
    assert.equal(state.doubled, 6);
    assert.deepEqual(warnings, ['Cannot assign to a read-only computed value']);
  } finally {
    console.warn = originalWarn;
  }
  delete state.doubled;
  assert.equal('doubled' in state, false);
  stop();
  job.stop();
});

test('writable computed accepts writes through a store', async () => {
  const { store, effect } = setup();
  const state = store({
    value: 2,
    doubled: computed({
      get: () => state.value * 2,
      set: next => { state.value = next / 2; }
    })
  });
  const values = [];
  const job = effect(() => { values.push(state.doubled); });
  state.doubled = 10;
  await nextFlush();
  assert.equal(state.value, 5);
  assert.equal(state.doubled, 10);
  assert.deepEqual(values, [4, 10]);
  job.stop();
});

test('computed is lazy, cached, and reactive inside JSX-style children', async () => {
  const { signal, createElement: h, mount, document } = setup();
  const count = signal(2);
  let calculations = 0;
  const doubled = computed(() => { calculations++; return count.value * 2; });
  assert.equal(calculations, 0);
  const target = document.createElement('root');
  const stop = mount(h('p', {}, doubled), target);
  assert.equal(target.childNodes[0].childNodes[0].data, '4');
  assert.equal(doubled.value, 4);
  assert.equal(calculations, 1);
  count.value = 3;
  assert.equal(doubled.value, 6);
  await nextFlush();
  assert.equal(target.childNodes[0].childNodes[0].data, '6');
  assert.equal(calculations, 2);
  stop();
  doubled.dispose();
});

test('computed compares results with Object.is for every JavaScript value kind', async () => {
  const { signal, effect } = setup();
  const object = {};
  const array = [];
  const fn = () => {};
  const symbol = Symbol('same');
  for (const value of [undefined, null, false, true, 0, -0, NaN, 1n, 'text', symbol, object, array, fn]) {
    const source = signal(0);
    let result = value;
    let calculations = 0;
    let runs = 0;
    let cleanups = 0;
    const derived = computed(() => { void source.value; calculations++; return result; });
    const job = effect(() => { assert.ok(Object.is(derived.value, result)); runs++; return () => { cleanups++; }; });
    source.value++;
    await nextFlush();
    assert.equal(calculations, 2);
    assert.equal(runs, 1);
    assert.equal(cleanups, 0);
    result = Symbol('changed');
    source.value++;
    await nextFlush();
    assert.equal(runs, 2);
    assert.equal(cleanups, 1);
    job.stop();
    derived.dispose();
    assert.equal(cleanups, 2);
  }
  const source = signal(0);
  const signedZero = computed(() => source.value ? -0 : 0);
  const seen = [];
  const job = effect(() => { seen.push(signedZero.value); });
  source.value = 1;
  await nextFlush();
  assert.ok(Object.is(seen[0], 0));
  assert.ok(Object.is(seen[1], -0));
  job.stop();
  signedZero.dispose();
});

test('computed stays lazy, batches changes, and preserves notifications after a synchronous read', async () => {
  const { signal, effect } = setup();
  const source = signal(0);
  let calculations = 0;
  const parity = computed(() => { calculations++; return source.value % 2; });
  source.value = 2;
  await nextFlush();
  assert.equal(calculations, 0);
  const seen = [];
  const job = effect(() => { seen.push(parity.value); });
  source.value = 4;
  assert.equal(parity.value, 0);
  await nextFlush();
  assert.deepEqual(seen, [0]);
  source.value = 5;
  assert.equal(parity.value, 1);
  await nextFlush();
  assert.deepEqual(seen, [0, 1]);
  source.value = 6;
  source.value = 7;
  await nextFlush();
  assert.deepEqual(seen, [0, 1]);
  assert.equal(calculations, 4);
  job.stop();
  parity.dispose();
});

test('computed switches equal branches and updates chains and diamonds consistently', async () => {
  const { signal, effect } = setup();
  const chooseFirst = signal(true);
  const first = signal(1);
  const second = signal(1);
  const selected = computed(() => chooseFirst.value ? first.value : second.value);
  let outerRuns = 0;
  const left = computed(() => { outerRuns++; return selected.value * 2; });
  const right = computed(() => selected.value * 3);
  const total = computed(() => left.value + right.value);
  const seen = [];
  const job = effect(() => { seen.push([selected.value, total.value]); });
  chooseFirst.value = false;
  await nextFlush();
  assert.equal(outerRuns, 1);
  assert.deepEqual(seen, [[1, 5]]);
  first.value = 10;
  await nextFlush();
  assert.deepEqual(seen, [[1, 5]]);
  second.value = 2;
  await nextFlush();
  assert.deepEqual(seen, [[1, 5], [2, 10]]);
  assert.equal(outerRuns, 2);
  job.stop();
  for (const value of [total, left, right, selected]) value.dispose();
});

test('computed tracks direct dependencies and effects can update their own dependency', async () => {
  const { signal, effect } = setup();
  const source = signal(0);
  const parity = computed(() => source.value % 2);
  const seen = [];
  const job = effect(() => { seen.push([parity.value, source.value]); });
  source.value = 2;
  await nextFlush();
  assert.deepEqual(seen, [[0, 0], [0, 2]]);
  job.stop();
  parity.dispose();
  const count = signal(0);
  const selfUpdating = effect(() => { if (count.value < 2) count.value++; });
  await nextFlush();
  assert.equal(count.value, 2);
  selfUpdating.stop();
});

test('a failed computed getter retries without returning a stale cached result', () => {
  const { signal} = setup();
  const source = signal(1);
  let failing = false;
  const value = computed(() => {
    const current = source.value;
    if (failing) throw new Error('retry');
    return current;
  });
  assert.equal(value.value, 1);
  failing = true;
  source.value = 2;
  assert.throws(() => value.value, /retry/);
  assert.throws(() => value.value, /retry/);
  failing = false;
  assert.equal(value.value, 2);
  value.dispose();
});

test('computed switches dependencies and ignores plain objects with value', async () => {
  const { signal, createElement: h, mount, document } = setup();
  const chooseFirst = signal(true);
  const first = signal('A');
  const second = signal('B');
  let runs = 0;
  const current = computed(() => { runs++; return chooseFirst.value ? first.value : second.value; });
  const target = document.createElement('root');
  const stop = mount(h('p', { title: { value: 'plain' } }, current), target);
  assert.equal(target.childNodes[0].attributes.get('title'), '[object Object]');
  chooseFirst.value = false;
  await nextFlush();
  assert.equal(target.childNodes[0].childNodes[0].data, 'B');
  const before = runs;
  first.value = 'X';
  await nextFlush();
  assert.equal(runs, before);
  second.value = 'C';
  await nextFlush();
  assert.equal(target.childNodes[0].childNodes[0].data, 'C');
  stop();
  current.dispose();
});

test('a throwing effect unsubscribes and pending work stops on unmount', async () => {
  const { signal, effect, createElement: h, mount, document } = setup();
  const value = signal(0);
  let calls = 0;
  assert.throws(() => effect(() => { calls++; void value.value; throw new Error('boom'); }), /boom/);
  value.value = 1;
  await nextFlush();
  assert.equal(calls, 1);

  const target = document.createElement('root');
  const stop = mount(h('p', {}, value), target);
  value.value = 2;
  stop();
  await nextFlush();
  assert.equal(target.childNodes.length, 0);
});

test('cleanup updates other effects and unmount continues after a cleanup error', async () => {
  const { signal, effect, onUnmount, createElement: h, component, mount, document } = setup();
  const source = signal(0);
  const side = signal(0);
  const seen = [];
  const watcher = effect(() => { seen.push(side.value); });
  const target = document.createElement('root');
  const stop = mount(component(() => {
    effect(() => {
      const current = source.value;
      return () => { if (current === 0) side.value = 1; };
    });
    onUnmount(() => { throw new Error('cleanup failed'); });
    onUnmount(() => seen.push('unmounted'));
    return h('div');
  }), target);
  source.value = 1;
  await nextFlush();
  assert.deepEqual(seen, [0, 1]);
  assert.throws(stop, /cleanup failed/);
  assert.deepEqual(seen, [0, 1, 'unmounted']);
  assert.equal(target.childNodes.length, 0);
  watcher.stop();
});

test('Fragment mounts multiple roots and removes them together', () => {
  const { Fragment, createElement: h, jsx, mount, document } = setup();
  const target = document.createElement('root');
  const stop = mount(h(Fragment, null, h('span', {}, 'A'), h('span', {}, 'B')), target);
  assert.deepEqual(target.childNodes.filter(node => node.name === 'span').map(node => node.childNodes[0].data), ['A', 'B']);
  stop();
  assert.equal(target.childNodes.length, 0);
  const stopJsx = mount(jsx(Fragment, { children: [h('i', {}, 'C'), h('i', {}, 'D')] }), target);
  assert.deepEqual(target.childNodes.filter(node => node.name === 'i').map(node => node.childNodes[0].data), ['C', 'D']);
  stopJsx();
  assert.equal(target.childNodes.length, 0);
});

test('ErrorBoundary shows fallback for initial render errors and can reset', () => {
  const { ErrorBoundary, createElement: h, component, mount, document } = setup();
  let shouldFail = true;
  const target = document.createElement('root');
  const stop = mount(h(ErrorBoundary, {
    fallback: (error, reset) => h('button', { onClick: reset }, error.message)
  }, component(() => {
    if (shouldFail) throw new Error('render failed');
    return h('span', {}, 'Recovered');
  })), target);
  const visible = () => target.childNodes.filter(node => node.name === 'button' || node.name === 'span');
  assert.equal(visible()[0].childNodes[0].data, 'render failed');
  shouldFail = false;
  visible()[0].listeners.get('click')({});
  assert.equal(visible()[0].childNodes[0].data, 'Recovered');
  stop();
  assert.equal(target.childNodes.length, 0);
});

test('ErrorBoundary catches a reactive child error and disposes the failed branch', async () => {
  const { signal, effect, onUnmount, ErrorBoundary, createElement: h, component, mount, document } = setup();
  const value = signal(0);
  const calls = [];
  const target = document.createElement('root');
  const stop = mount(h(ErrorBoundary, {
    fallback: error => h('strong', {}, error.message)
  }, component(() => {
    effect(() => { if (value.value === 1) throw new Error('update failed'); });
    onUnmount(() => calls.push('child disposed'));
    return h('span', {}, 'Healthy');
  })), target);
  assert.equal(target.childNodes.find(node => node.name === 'span').childNodes[0].data, 'Healthy');
  value.value = 1;
  await nextFlush();
  assert.deepEqual(calls, ['child disposed']);
  assert.equal(target.childNodes.find(node => node.name === 'strong').childNodes[0].data, 'update failed');
  stop();
});

test('ErrorBoundary catches synchronous event errors', () => {
  const { ErrorBoundary, createElement: h, mount, document } = setup();
  const target = document.createElement('root');
  const stop = mount(h(ErrorBoundary, {
    fallback: error => h('span', {}, error.message)
  }, h('button', { onClick() { throw new Error('click failed'); } }, 'Crash')), target);
  target.childNodes.find(node => node.name === 'button').listeners.get('click')({});
  assert.equal(target.childNodes.find(node => node.name === 'span').childNodes[0].data, 'click failed');
  stop();
});

test('ErrorBoundary catches rejected event-handler promises', async () => {
  const { ErrorBoundary, createElement: h, mount, document } = setup();
  const target = document.createElement('root');
  const stop = mount(h(ErrorBoundary, {
    fallback: error => h('span', {}, error.message)
  }, h('button', { onClick() { return Promise.reject(new Error('async failed')); } }, 'Crash')), target);
  target.childNodes.find(node => node.name === 'button').listeners.get('click')({});
  await nextFlush();
  assert.equal(target.childNodes.find(node => node.name === 'span').childNodes[0].data, 'async failed');
  stop();
});

test('an outer ErrorBoundary handles an error thrown by an inner fallback', () => {
  const { ErrorBoundary, createElement: h, mount, document } = setup();
  const target = document.createElement('root');
  const stop = mount(h(ErrorBoundary, {
    fallback: error => h('strong', {}, error.message)
  }, h(ErrorBoundary, {
    fallback() { throw new Error('fallback failed'); }
  }, h('button', { onClick() { throw new Error('original failure'); } }, 'Crash'))), target);
  target.childNodes.find(node => node.name === 'button').listeners.get('click')({});
  assert.equal(target.childNodes.find(node => node.name === 'strong').childNodes[0].data, 'fallback failed');
  stop();
});

test('onUnmount runs once after component effects stop', () => {
  const { effect, onUnmount, createElement: h, component, mount, document } = setup();
  const calls = [];
  const stop = mount(component(() => {
    effect(() => {
      calls.push('effect');
      return () => calls.push('effect cleanup');
    });
    onUnmount(() => calls.push('unmount'));
    return h('div');
  }), document.createElement('root'));

  stop();
  stop();
  assert.deepEqual(calls, ['effect', 'effect cleanup', 'unmount']);
});

test('components can return primitive, empty, and reactive child values', async () => {
  const { signal, onUnmount, jsx, mount, document } = setup();
  const count = signal(0);
  const lifecycle = [];
  let renders = 0;

  function ReactiveText() {
    renders++;
    onUnmount(() => lifecycle.push('unmounted'));
    return computed(() => `Count: ${count.value}`);
  }

  const target = document.createElement('root');
  const stop = mount(jsx('div', { children: [
    jsx(() => 'Hello', {}),
    jsx(() => 42, {}),
    jsx(() => true, {}),
    jsx(() => null, {}),
    jsx(ReactiveText, {})
  ] }), target);
  const texts = () => target.childNodes[0].childNodes
    .filter(node => node.nodeType === 3 && node.data)
    .map(node => node.data);

  assert.deepEqual(texts(), ['Hello', '42', 'Count: 0']);
  count.value = 1;
  await nextFlush();
  assert.deepEqual(texts(), ['Hello', '42', 'Count: 1']);
  assert.equal(renders, 1);

  stop();
  assert.deepEqual(lifecycle, ['unmounted']);
  assert.equal(target.childNodes.length, 0);
});

test('conditional branch and list replace DOM and dispose refs', async () => {
  const { signal, ref, createElement: h, component, mount, document } = setup();
  const visible = signal(true);
  const items = signal(['A']);
  const itemRef = ref();
  const target = document.createElement('root');
  const stop = mount(component(() => h('ul', {}, computed(() => visible.value &&
    items.value.map((item, index) => h('li', index === 0 ? { ref: itemRef } : {}, item)))
  )), target);
  const list = target.childNodes[0];

  assert.equal(itemRef.element?.name, 'li');
  items.value = ['A', 'B'];
  await nextFlush();
  assert.deepEqual(list.childNodes.filter(node => node.name === 'li').map(node => node.childNodes[0].data), ['A', 'B']);

  visible.value = false;
  await nextFlush();
  assert.equal(itemRef.element, null);
  assert.equal(list.childNodes.filter(node => node.name === 'li').length, 0);

  visible.value = true;
  await nextFlush();
  assert.equal(itemRef.element?.name, 'li');
  stop();
  assert.equal(itemRef.element, null);
});

test('JSX conditional rendering switches branches and disposes the hidden component', async () => {
  const { signal, ref, onUnmount, jsx, mount, document } = setup();
  const visible = signal(true);
  const input = ref();
  const lifecycle = [];
  let instances = 0;

  function Editor() {
    instances++;
    onUnmount(() => lifecycle.push('editor removed'));
    return jsx('input', { ref: input });
  }

  const target = document.createElement('root');
  const stop = mount(jsx('section', {
    children: computed(() => visible.value
      ? jsx(Editor, {})
      : jsx('p', { children: 'Editor is hidden' }))
  }), target);
  const section = target.childNodes[0];
  const firstInput = input.element;

  assert.equal(firstInput?.name, 'input');
  assert.equal(instances, 1);

  visible.value = false;
  await nextFlush();
  assert.equal(input.element, null);
  assert.equal(firstInput.parentNode, null);
  assert.equal(section.childNodes.find(node => node.name === 'p')?.childNodes[0].data, 'Editor is hidden');
  assert.deepEqual(lifecycle, ['editor removed']);

  visible.value = true;
  await nextFlush();
  assert.equal(instances, 2);
  assert.equal(input.element?.name, 'input');
  assert.notEqual(input.element, firstInput);
  assert.equal(section.childNodes.some(node => node.name === 'p'), false);

  stop();
  assert.equal(input.element, null);
  assert.deepEqual(lifecycle, ['editor removed', 'editor removed']);
});

test('computed JSX branches preserve DOM and state while the derived condition is unchanged', async () => {
  const { signal, ref, onUnmount, jsx, mount, document } = setup();
  const age = signal(20);
  const eligible = computed(() => age.value >= 18);
  const input = ref();
  let instances = 0;
  let cleanups = 0;
  function Editor() {
    instances++;
    onUnmount(() => { cleanups++; });
    return jsx('input', { ref: input });
  }
  const branch = computed(() => eligible.value ? jsx(Editor, {}) : null);
  const target = document.createElement('root');
  const stop = mount(jsx('section', { children: branch }), target);
  const original = input.element;
  original.value = 'unsaved draft';
  age.value = 21;
  await nextFlush();
  assert.equal(input.element, original);
  assert.equal(input.element.value, 'unsaved draft');
  assert.equal(instances, 1);
  assert.equal(cleanups, 0);
  age.value = 17;
  await nextFlush();
  assert.equal(input.element, null);
  assert.equal(cleanups, 1);
  age.value = 18;
  await nextFlush();
  assert.notEqual(input.element, original);
  assert.equal(instances, 2);
  stop();
  assert.equal(input.element, null);
  assert.equal(cleanups, 2);
  branch.dispose();
  eligible.dispose();
});

test('a boolean computed also preserves a derived conditional branch with an unchanged result', async () => {
  const { signal, jsx, mount, document } = setup();
  const count = signal(1);
  const visible = computed(() => count.value > 0);
  const target = document.createElement('root');
  const stop = mount(jsx('section', { children: computed(() => visible.value ? jsx('input', {}) : null) }), target);
  const input = target.childNodes[0].childNodes.find(node => node.name === 'input');
  count.value = 2;
  await nextFlush();
  assert.equal(target.childNodes[0].childNodes.find(node => node.name === 'input'), input);
  stop();
  visible.dispose();
});

test('computed switches between multiple components and cleans up every replaced branch', async () => {
  const { signal, jsx, mount, onUnmount, document } = setup();
  const status = signal('loading');
  const calls = [];
  function Loading() {
    calls.push('mount loading');
    onUnmount(() => calls.push('unmount loading'));
    return jsx('p', { children: 'Loading' });
  }
  function ErrorMessage() {
    calls.push('mount error');
    onUnmount(() => calls.push('unmount error'));
    return jsx('strong', { children: 'Error' });
  }
  function Content() {
    calls.push('mount content');
    onUnmount(() => calls.push('unmount content'));
    return jsx('article', { children: 'Content' });
  }
  const screen = computed(() => {
    switch (status.value) {
      case 'loading': return jsx(Loading, {});
      case 'error': return jsx(ErrorMessage, {});
      default: return jsx(Content, {});
    }
  });
  const target = document.createElement('root');
  const stop = mount(jsx('main', { children: screen }), target);
  const main = target.childNodes[0];
  for (const [state, tag, label] of [['error', 'strong', 'Error'], ['ready', 'article', 'Content'], ['loading', 'p', 'Loading']]) {
    status.value = state;
    await nextFlush();
    const elements = main.childNodes.filter(node => node.nodeType === 1);
    assert.equal(elements.length, 1);
    assert.equal(elements[0].name, tag);
    assert.equal(elements[0].childNodes[0].data, label);
  }
  stop();
  assert.deepEqual(calls, ['mount loading', 'unmount loading', 'mount error', 'unmount error', 'mount content', 'unmount content', 'mount loading', 'unmount loading']);
  screen.dispose();
});

test('computed renders primitives, JSX, fragments, arrays, lists, nested reactive values, and DOM nodes', async () => {
  const { signal, jsx, Fragment, Each, mount, document } = setup();
  const selected = signal(0);
  const nested = signal('nested');
  const items = signal(['one', 'two']);
  const native = document.createElement('strong');
  native.append(document.createTextNode('native'));
  const variants = [
    ['text', 'text'], [42, '42'], [0, '0'], [3n, '3'],
    [true, ''], [false, ''], [null, ''], [undefined, ''],
    [jsx('p', { children: 'jsx' }), 'jsx'],
    [jsx(Fragment, { children: [jsx('b', { children: 'A' }), jsx('i', { children: 'B' })] }), 'AB'],
    [[jsx('b', { children: 'array' }), nested], 'arraynested'],
    [jsx(Each, { items, children: item => jsx('span', { key: item, children: item }) }), 'onetwo'],
    [computed(() => jsx('p', { children: nested })), 'nested'],
    [nested, 'nested'],
    [native, 'native'],
    [jsx(() => 'component text', {}), 'component text']
  ];
  const content = computed(() => variants[selected.value][0]);
  const target = document.createElement('root');
  const stop = mount(jsx('section', { children: content }), target);
  const section = target.childNodes[0];
  for (let index = 0; index < variants.length; index++) {
    selected.value = index;
    await nextFlush();
    assert.equal(textContent(section), variants[index][1], `variant ${index}`);
    assert.equal(target.childNodes[0], section);
  }
  selected.value = 11;
  await nextFlush();
  items.value = ['three'];
  await nextFlush();
  assert.equal(textContent(section), 'three');
  selected.value = 12;
  await nextFlush();
  nested.value = 'updated';
  await nextFlush();
  assert.equal(textContent(section), 'updated');
  stop();
  content.dispose();
  assert.equal(target.childNodes.length, 0);
});

test('shared computed JSX creates independent component scopes and owned computed values stop on unmount', async () => {
  const { signal, onUnmount, jsx, mount, document } = setup();
  const visible = signal(true);
  const count = signal(0);
  let instances = 0;
  let cleanups = 0;
  let calculations = 0;
  const branch = computed(() => visible.value ? jsx(Editor, {}) : null);
  function Editor() {
    instances++;
    const label = computed(() => { calculations++; return `Count: ${count.value}`; });
    onUnmount(() => { cleanups++; });
    return jsx('p', { children: label });
  }
  const first = document.createElement('root');
  const second = document.createElement('root');
  const stopFirst = mount(jsx('section', { children: branch }), first);
  const stopSecond = mount(jsx('section', { children: branch }), second);
  assert.equal(instances, 2);
  assert.notEqual(first.childNodes[0].childNodes[0], second.childNodes[0].childNodes[0]);
  stopFirst();
  count.value = 1;
  await nextFlush();
  assert.equal(calculations, 3);
  assert.equal(cleanups, 1);
  visible.value = false;
  await nextFlush();
  assert.equal(cleanups, 2);
  count.value = 2;
  await nextFlush();
  assert.equal(calculations, 3);
  stopSecond();
  branch.dispose();
});

test('computed validation errors reach ErrorBoundary and cycles remain rejected', async () => {
  const { signal, jsx, ErrorBoundary, mount, document } = setup();
  const fail = signal(false);
  const branch = computed(() => {
    if (fail.value) throw new Error('computed failed');
    return jsx('p', { children: 'safe' });
  });
  const target = document.createElement('root');
  let reset;
  const stop = mount(jsx(ErrorBoundary, {
    fallback: (error, retry) => { reset = retry; return jsx('strong', { children: error.message }); },
    children: jsx('section', { children: branch })
  }), target);
  fail.value = true;
  await nextFlush();
  assert.equal(target.childNodes.find(node => node.name === 'strong').childNodes[0].data, 'computed failed');
  fail.value = false;
  reset();
  assert.equal(target.childNodes.find(node => node.name === 'section').childNodes[0].childNodes[0].data, 'safe');
  stop();
  branch.dispose();
  const cycle = computed(() => cycle.value);
  assert.throws(() => cycle.value, /computed cannot depend on itself/);
  cycle.dispose();
});

test('computed preserves an identical tree factory and replaces a newly returned JSX tree', async () => {
  const { signal, jsx, mount, document } = setup();
  const source = signal(0);
  const stableTree = jsx('input', {});
  const stable = computed(() => { void source.value; return stableTree; });
  const fresh = computed(() => jsx('input', { value: source.value }));
  const target = document.createElement('root');
  const stop = mount(jsx('section', { children: [stable, fresh] }), target);
  const inputs = () => target.childNodes[0].childNodes.filter(node => node.name === 'input');
  const before = inputs();
  source.value++;
  await nextFlush();
  assert.equal(inputs()[0], before[0]);
  assert.notEqual(inputs()[1], before[1]);
  assert.equal(inputs()[1].value, '1');
  stop();
  stable.dispose(); fresh.dispose();
});

test('Preserve detaches a branch without replacing its DOM or disposing its scope', async () => {
  const { signal, ref, effect, onUnmount, jsx, Preserve, mount, document } = setup();
  const visible = signal(false);
  const count = signal(0);
  const input = ref();
  const calls = [];
  let instances = 0;

  function Editor() {
    instances++;
    effect(() => { calls.push(`count ${count.value}`); });
    onUnmount(() => calls.push('unmount'));
    return jsx('input', { ref: input, value: count });
  }

  const target = document.createElement('root');
  const stop = mount(jsx(Preserve, {
    when: visible,
    children: jsx(Editor, {})
  }), target);
  const firstInput = input.element;

  assert.equal(target.childNodes.filter(node => node.nodeType === 1).length, 0);
  assert.equal(firstInput.parentNode.nodeType, 11);
  assert.equal(firstInput?.name, 'input');
  assert.equal(instances, 1);
  assert.deepEqual(calls, ['count 0']);

  count.value = 1;
  await nextFlush();
  assert.equal(firstInput.value, '1');
  assert.deepEqual(calls, ['count 0', 'count 1']);

  visible.value = true;
  await nextFlush();
  assert.equal(firstInput.parentNode, target);
  assert.equal(input.element, firstInput);
  assert.equal(instances, 1);
  assert.deepEqual(calls, ['count 0', 'count 1']);

  visible.value = false;
  await nextFlush();
  assert.equal(firstInput.parentNode.nodeType, 11);
  assert.equal(target.childNodes.filter(node => node.nodeType === 1).length, 0);
  assert.equal(input.element, firstInput);
  assert.deepEqual(calls, ['count 0', 'count 1']);

  stop();
  assert.equal(input.element, null);
  assert.equal(firstInput.parentNode, null);
  assert.equal(target.childNodes.length, 0);
  assert.deepEqual(calls, ['count 0', 'count 1', 'unmount']);
});

test('nested Preserve branches update while detached and restore the same nodes in order', async () => {
  const { signal, ref, jsx, Fragment, Preserve, mount, document } = setup();
  const outer = signal(true);
  const inner = signal(true);
  const showLabel = signal(true);
  const label = signal('first');
  const input = ref();
  const target = document.createElement('root');
  const stop = mount(jsx(Fragment, { children: [
    jsx('b', { children: 'before' }),
    jsx(Preserve, { when: computed(() => outer.value), children: [
      computed(() => showLabel.value ? jsx('span', { children: label }) : null),
      jsx(Preserve, { when: computed(() => inner.value), children: jsx('input', { ref: input }) })
    ] }),
    jsx('b', { children: 'after' })
  ] }), target);
  const firstInput = input.element;
  const names = () => target.childNodes.filter(node => node.nodeType === 1).map(node => node.name);
  assert.deepEqual(names(), ['b', 'span', 'input', 'b']);
  outer.value = false;
  await nextFlush();
  assert.deepEqual(names(), ['b', 'b']);
  inner.value = false;
  showLabel.value = false;
  await nextFlush();
  label.value = 'updated';
  showLabel.value = true;
  await nextFlush();
  outer.value = true;
  await nextFlush();
  assert.deepEqual(names(), ['b', 'span', 'b']);
  assert.equal(target.childNodes.find(node => node.name === 'span').childNodes[0].data, 'updated');
  inner.value = true;
  await nextFlush();
  assert.deepEqual(names(), ['b', 'span', 'input', 'b']);
  assert.equal(input.element, firstInput);
  stop();
  assert.equal(input.element, null);
  assert.equal(target.childNodes.length, 0);
});

test('Each moves, replaces, and removes complete component fragments including reactive children', async () => {
  const { signal, jsx, Fragment, Each, onUnmount, mount, document } = setup();
  const a = { id: 'a' }, b = { id: 'b' }, c = { id: 'c' }, d = { id: 'd' };
  const items = signal([a, b, c, d]);
  const expanded = signal(true);
  const disposed = [];
  function Row({ item }) {
    onUnmount(() => disposed.push(item));
    return jsx(Fragment, { children: [
      jsx('li', { children: item.id }),
      computed(() => expanded.value ? jsx('li', { children: `${item.id}+` }) : null)
    ] });
  }
  const target = document.createElement('root');
  const stop = mount(jsx('ul', { children: [
    jsx('li', { children: 'before' }),
    jsx(Each, { items, children: item => jsx(Row, { key: item.id, item }) }),
    jsx('li', { children: 'after' })
  ] }), target);
  const list = target.childNodes[0];
  const labels = () => list.childNodes.filter(node => node.name === 'li').map(node => node.childNodes[0].data);
  assert.deepEqual(labels(), ['before', 'a', 'a+', 'b', 'b+', 'c', 'c+', 'd', 'd+', 'after']);
  const firstA = list.childNodes.find(node => node.name === 'li' && node.childNodes[0].data === 'a');
  items.value = [d, b, c, a];
  await nextFlush();
  assert.deepEqual(labels(), ['before', 'd', 'd+', 'b', 'b+', 'c', 'c+', 'a', 'a+', 'after']);
  assert.equal(disposed.length, 0);
  expanded.value = false;
  await nextFlush();
  items.value = [b, c, a, d];
  await nextFlush();
  assert.deepEqual(labels(), ['before', 'b', 'c', 'a', 'd', 'after']);
  expanded.value = true;
  await nextFlush();
  items.value = [b, a, d];
  await nextFlush();
  assert.deepEqual(labels(), ['before', 'b', 'b+', 'a', 'a+', 'd', 'd+', 'after']);
  assert.deepEqual(disposed, [c]);
  assert.ok(list.childNodes.includes(firstA));
  items.value = [b, { id: 'a' }, d];
  await nextFlush();
  assert.deepEqual(labels(), ['before', 'b', 'b+', 'a', 'a+', 'd', 'd+', 'after']);
  assert.equal(firstA.parentNode, null);
  assert.deepEqual(disposed, [c, a]);
  items.value = [...items.value, { id: 'e' }];
  await nextFlush();
  assert.deepEqual(labels().slice(-3), ['e', 'e+', 'after']);
  items.value = [];
  await nextFlush();
  assert.deepEqual(labels(), ['before', 'after']);
  assert.equal(disposed.length, 6);
  assert.equal(list.childNodes.length, 3);
  stop();
});

test('Each supports initially empty component results and removes updated fallback fragments', async () => {
  const { signal, jsx, Each, mount, document } = setup();
  const visible = signal(false);
  const items = signal([1, 2]);
  function Row({ item }) { return computed(() => visible.value ? jsx('li', { children: item }) : null); }
  const target = document.createElement('root');
  const stop = mount(jsx('ul', { children: jsx(Each, {
    items,
    children: item => jsx(Row, { key: item, item }),
    fallback: computed(() => visible.value ? jsx('li', { children: 'empty' }) : null)
  }) }), target);
  const list = target.childNodes[0];
  const labels = () => list.childNodes.filter(node => node.name === 'li').map(node => node.childNodes[0].data);
  visible.value = true;
  await nextFlush();
  assert.deepEqual(labels(), ['1', '2']);
  items.value = [2, 1];
  await nextFlush();
  assert.deepEqual(labels(), ['2', '1']);
  items.value = [];
  await nextFlush();
  assert.deepEqual(labels(), ['empty']);
  visible.value = false;
  await nextFlush();
  visible.value = true;
  await nextFlush();
  items.value = [3];
  await nextFlush();
  assert.deepEqual(labels(), ['3']);
  stop();
});

test('SVG namespaces survive components, reactive branches, lists, and foreignObject', async () => {
  const { signal, jsx, Each, ErrorBoundary, mount, document } = setup();
  const svgNS = 'http://www.w3.org/2000/svg';
  const htmlNS = 'http://www.w3.org/1999/xhtml';
  const show = signal(false);
  const items = signal([1]);
  const bad = signal(false);
  function Circle() { return jsx('circle', { r: 5, strokeWidth: 2, className: 'dot' }); }
  const target = document.createElement('root');
  const stop = mount(jsx('svg', { viewBox: '0 0 10 10', children: [
    jsx(Circle, {}),
    computed(() => show.value ? jsx('path', { d: 'M0 0L1 1' }) : null),
    jsx(Each, { items, children: item => jsx('circle', { key: item, r: item }) }),
    jsx('foreignObject', { children: jsx('div', { children: jsx('svg', { children: jsx('circle', {}) }) }) }),
    jsx(ErrorBoundary, { fallback: jsx('text', { children: 'error' }), children: computed(() => {
      if (bad.value) throw new Error('svg error');
      return jsx('g', {});
    }) })
  ] }), target);
  const svg = target.childNodes[0];
  assert.equal(svg.namespaceURI, svgNS);
  assert.equal(svg.attributes.get('viewBox'), '0 0 10 10');
  assert.equal(svg.childNodes[0].attributes.get('stroke-width'), '2');
  assert.equal(svg.childNodes[0].attributes.get('class'), 'dot');
  const foreignObject = svg.childNodes.find(node => node.name === 'foreignObject');
  assert.equal(foreignObject.namespaceURI, svgNS);
  assert.equal(foreignObject.childNodes[0].namespaceURI, htmlNS);
  assert.equal(foreignObject.childNodes[0].childNodes[0].namespaceURI, svgNS);
  show.value = true;
  items.value = [1, 2];
  bad.value = true;
  await nextFlush();
  for (const node of svg.childNodes.filter(node => node.nodeType === 1)) assert.equal(node.namespaceURI, svgNS);
  assert.equal(svg.childNodes.find(node => node.name === 'path').namespaceURI, svgNS);
  assert.equal(svg.childNodes.find(node => node.name === 'text').namespaceURI, svgNS);
  const svgTarget = document.createElementNS(svgNS, 'svg');
  const stopNested = mount(jsx('lineargradient', { gradientunits: 'userSpaceOnUse' }), svgTarget);
  assert.equal(svgTarget.childNodes[0].name, 'linearGradient');
  assert.equal(svgTarget.childNodes[0].attributes.get('gradientUnits'), 'userSpaceOnUse');
  stopNested(); stop();
});

test('removed component stops its effects', async () => {
  const { signal, effect, createElement: h, component, mount, document } = setup();
  const visible = signal(true);
  const value = signal(0);
  const calls = [];

  function Child() {
    effect(() => {
      const current = value.value;
      calls.push(`run ${current}`);
      return () => calls.push(`cleanup ${current}`);
    });
    return h('span', {}, computed(() => value.value));
  }

  const stop = mount(h('div', {}, computed(() => visible.value && component(Child))), document.createElement('root'));
  visible.value = false;
  await nextFlush();
  value.value = 1;
  await nextFlush();

  assert.deepEqual(calls, ['run 0', 'cleanup 0']);
  stop();
});

test('removed branch releases event listeners', async () => {
  const { signal, createElement: h, mount, document } = setup();
  const visible = signal(true);
  const target = document.createElement('root');
  const stop = mount(h('div', {}, computed(() => visible.value && h('button', { onClick() {} }, 'Click'))), target);
  const button = target.childNodes[0].childNodes.find(node => node.name === 'button');

  assert.equal(button.listeners.has('click'), true);
  visible.value = false;
  await nextFlush();
  assert.equal(button.listeners.has('click'), false);
  stop();
});

test('reactive text updates the same text node', async () => {
  const { signal, createElement: h, mount, document } = setup();
  const count = signal(1);
  const target = document.createElement('root');
  const stop = mount(h('p', {}, computed(() => `Count: ${count.value}`)), target);
  const text = target.childNodes[0].childNodes[0];

  count.value = 2;
  await nextFlush();
  assert.equal(target.childNodes[0].childNodes[0], text);
  assert.equal(text.data, 'Count: 2');
  stop();
});

test('updating a reactive prop does not rewrite static props', async () => {
  const { signal, createElement: h, mount, document } = setup();
  const value = signal('first');
  const target = document.createElement('root');
  const stop = mount(h('div', { id: 'fixed', title: computed(() => value.value) }), target);
  const element = target.childNodes[0];
  let staticWrites = 0;
  const original = element.setAttribute.bind(element);
  element.setAttribute = (name, next) => {
    if (name === 'id') staticWrites++;
    original(name, next);
  };

  value.value = 'second';
  await nextFlush();
  assert.equal(element.attributes.get('title'), 'second');
  assert.equal(staticWrites, 0);
  stop();
});

test('reactive attributes subscribe independently', async () => {
  const { signal, createElement: h, mount, document } = setup();
  const title = signal('first');
  const className = signal('one');
  const target = document.createElement('root');
  const stop = mount(h('div', { title, className }), target);
  const element = target.childNodes[0];
  let titleWrites = 0;
  let classWrites = 0;
  const setAttribute = element.setAttribute.bind(element);
  element.setAttribute = (name, value) => { if (name === 'title') titleWrites++; setAttribute(name, value); };
  Object.defineProperty(element, 'className', { set() { classWrites++; }, configurable: true });
  title.value = 'second';
  await nextFlush();
  assert.equal(titleWrites, 1);
  assert.equal(classWrites, 0);
  className.value = 'two';
  await nextFlush();
  assert.equal(titleWrites, 1);
  assert.equal(classWrites, 1);
  stop();
});

test('keyed list preserves rows on append and reorder', async () => {
  const { signal, Each, createElement: h, mount, document } = setup();
  const first = { id: 1, label: 'A' };
  const second = { id: 2, label: 'B' };
  const items = signal([first]);
  const target = document.createElement('root');
  let renderCalls = 0;
  const stop = mount(h('ul', {}, h(Each, { items }, item => {
    renderCalls++;
    return h('li', { key: item.id }, item.label);
  })), target);
  const list = target.childNodes[0];
  const rows = () => list.childNodes.filter(node => node.name === 'li');
  const original = rows()[0];
  assert.equal(original.attributes.has('key'), false);

  items.value = [first, second];
  await nextFlush();
  assert.equal(rows()[0], original);
  assert.equal(renderCalls, 2);
  const added = rows()[1];

  items.value = [second, first];
  await nextFlush();
  assert.equal(rows()[0], added);
  assert.equal(rows()[1], original);
  assert.equal(renderCalls, 2);

  items.value = [second, { id: 1, label: 'Updated' }];
  await nextFlush();
  assert.equal(rows()[0], added);
  assert.notEqual(rows()[1], original);
  assert.equal(rows()[1].childNodes[0].data, 'Updated');
  assert.equal(renderCalls, 3);

  items.value = [second, { id: 3, label: 'C' }];
  await nextFlush();
  assert.equal(rows()[0], added);
  assert.equal(rows()[1].childNodes[0].data, 'C');
  assert.equal(renderCalls, 4);
  stop();
});

test('keyed list swaps distant rows without moving the rows between them', async () => {
  const { signal, Each, createElement: h, mount, document } = setup();
  const data = Array.from({ length: 5 }, (_, index) => ({ id: index + 1 }));
  const items = signal(data);
  const target = document.createElement('root');
  const stop = mount(h('ul', {}, h(Each, { items }, item => h('li', { key: item.id }, item.id))), target);
  const list = target.childNodes[0];
  const rows = () => list.childNodes.filter(node => node.name === 'li');
  const original = rows();
  let moves = 0;
  const insertBefore = list.insertBefore.bind(list);
  list.insertBefore = (...args) => { moves++; return insertBefore(...args); };

  items.value = [data[0], data[4], data[2], data[3], data[1]];
  await nextFlush();
  assert.deepEqual(rows(), [original[0], original[4], original[2], original[3], original[1]]);
  assert.equal(moves, 2);
  stop();
});

test('keyed list moves only rows outside the longest stable order', async () => {
  const { signal, Each, createElement: h, mount, document } = setup();
  const data = Array.from({ length: 100 }, (_, index) => ({ id: index }));
  const items = signal(data);
  const target = document.createElement('root');
  const stop = mount(h('ul', {}, h(Each, { items }, item => h('li', { key: item.id }, item.id))), target);
  const list = target.childNodes[0];
  const rows = () => list.childNodes.filter(node => node.name === 'li');
  const original = rows();
  let moves = 0;
  const insertBefore = list.insertBefore.bind(list);
  list.insertBefore = (...args) => { moves++; return insertBefore(...args); };
  items.value = [...data.slice(2), ...data.slice(0, 2)];
  await nextFlush();
  assert.deepEqual(rows(), [...original.slice(2), ...original.slice(0, 2)]);
  assert.equal(moves, 2);
  stop();
});

test('keyed list preserves node identity across large mixed permutations', async () => {
  const { signal, Each, createElement: h, mount, document } = setup();
  const data = Array.from({ length: 300 }, (_, index) => ({ id: index }));
  const items = signal(data);
  const target = document.createElement('root');
  const stop = mount(h('ul', {}, h(Each, { items }, item => h('li', { key: item.id }, item.id))), target);
  const list = target.childNodes[0];
  const rows = () => list.childNodes.filter(node => node.name === 'li');
  const originalById = new Map(rows().map((node, index) => [data[index].id, node]));
  let seed = 42;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let round = 0; round < 8; round++) {
    const shuffled = [...data];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
    }
    items.value = shuffled;
    await nextFlush();
    assert.deepEqual(rows(), shuffled.map(item => originalById.get(item.id)));
  }
  stop();
});

test('clearing a keyed list disposes effects and refs inside its rows', async () => {
  const { signal, Each, ref, createElement: h, mount, document } = setup();
  const items = signal([{ id: 1 }]);
  const label = signal('A');
  const rowRef = ref();
  const target = document.createElement('root');
  const stop = mount(h('ul', {}, h(Each, { items }, item =>
    h('li', { key: item.id, ref: rowRef }, computed(() => label.value))
  )), target);
  const oldRow = rowRef.element;
  const oldText = oldRow.childNodes[0];

  items.value = [];
  await nextFlush();
  assert.equal(rowRef.element, null);
  assert.equal(oldRow.parentNode, null);
  label.value = 'B';
  await nextFlush();
  assert.equal(oldText.data, 'A');
  stop();
});

test('nullable list shows fallback and clears its ref when items appear', async () => {
  const { signal, ref, Each, createElement: h, mount, document } = setup();
  const items = signal(null);
  const fallbackRef = ref();
  const target = document.createElement('root');
  const stop = mount(h('ul', {}, h(Each,
    { items, fallback: computed(() => h('li', { ref: fallbackRef }, 'Empty')) },
    item => h('li', { key: item.id }, item.label)
  )), target);
  const rows = () => target.childNodes[0].childNodes.filter(node => node.name === 'li');

  assert.equal(rows()[0], fallbackRef.element);
  items.value = [{ id: 1, label: 'A' }];
  await nextFlush();
  assert.equal(fallbackRef.element, null);
  assert.equal(rows()[0].childNodes[0].data, 'A');

  items.value = [];
  await nextFlush();
  assert.equal(rows()[0], fallbackRef.element);
  stop();
  assert.equal(fallbackRef.element, null);
});

test('Each accepts a JSX render child and switches its fallback', async () => {
  const { signal, Each, jsx, createElement: h, mount, document } = setup();
  const items = signal(null);
  const target = document.createElement('root');
  const list = jsx(Each, {
    items,
    fallback: computed(() => h('li', {}, 'Empty')),
    children: item => h('li', { key: item.id }, item.label)
  });
  const stop = mount(h('ul', {}, list), target);
  const rows = () => target.childNodes[0].childNodes.filter(node => node.name === 'li');
  assert.equal(rows()[0].childNodes[0].data, 'Empty');
  items.value = [{ id: 1, label: 'A' }];
  await nextFlush();
  assert.equal(rows()[0].childNodes[0].data, 'A');
  stop();
});

test('a signal outside the component scope unmounts a listener and remounts it', async () => {
  const { signal, onUnmount, component, createElement: h, mount, document } = setup();
  const visible = signal(true);
  const listeners = new Set();
  let removed = 0;

  function KeyListener() {
    const lastKey = signal('none');
    const handler = key => { lastKey.value = key; };
    listeners.add(handler);
    onUnmount(() => { listeners.delete(handler); removed++; });
    return h('p', {}, lastKey);
  }

  const target = document.createElement('root');
  const stop = mount(h('div', {}, computed(() => visible.value ? component(KeyListener) : null)), target);
  const paragraph = () => target.childNodes[0].childNodes.find(node => node.name === 'p');

  assert.equal(listeners.size, 1);
  for (const listener of listeners) listener('A');
  await nextFlush();
  assert.equal(paragraph().childNodes[0].data, 'A');

  visible.value = false;
  await nextFlush();
  assert.equal(listeners.size, 0);
  assert.equal(removed, 1);
  assert.equal(paragraph(), undefined);

  visible.value = true;
  await nextFlush();
  assert.equal(listeners.size, 1);
  assert.equal(paragraph().childNodes[0].data, 'none');

  stop();
  assert.equal(listeners.size, 0);
  assert.equal(removed, 2);
});

test('store getters and setters read and update reactive properties through this', async () => {
  const { store, effect } = setup();
  const state = store({
    count: 1,
    get doubled() { return this.count * 2; },
    set doubled(value) { this.count = value / 2; }
  });
  const seen = [];
  const job = effect(() => { seen.push(state.doubled); });
  state.count = 2;
  await nextFlush();
  assert.equal(seen.at(-1), 4);
  state.doubled = 10;
  await nextFlush();
  assert.equal(seen.at(-1), 10);
  assert.equal(state.count, 5);
  job.stop();
});
