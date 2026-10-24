import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as Treegger from '../src/index.ts';

class MockNode {
  static TEXT_NODE = 3;
  static ELEMENT_NODE = 1;

  constructor(type, name = '', data = '') {
    this.nodeType = type;
    this.name = name;
    this.data = data;
    this.childNodes = [];
    this.parentNode = null;
    this.style = {};
    this.listeners = new Map();
    this.attributes = new Map();
  }

  get parentElement() {
    return this.parentNode?.nodeType === 1 ? this.parentNode : null;
  }

  get previousSibling() {
    return this.parentNode?.childNodes[this.parentNode.childNodes.indexOf(this) - 1] ?? null;
  }

  get nextSibling() {
    return this.parentNode?.childNodes[this.parentNode.childNodes.indexOf(this) + 1] ?? null;
  }

  append(...nodes) {
    for (const node of nodes) this.insertBefore(node, null);
  }

  insertBefore(node, before) {
    if (node.nodeType === 11) {
      for (const child of [...node.childNodes]) this.insertBefore(child, before);
      return;
    }
    node.remove();
    const index = before ? this.childNodes.indexOf(before) : this.childNodes.length;
    assert.notEqual(index, -1);
    this.childNodes.splice(index, 0, node);
    node.parentNode = this;
  }

  remove() {
    if (!this.parentNode) return;
    const siblings = this.parentNode.childNodes;
    siblings.splice(siblings.indexOf(this), 1);
    this.parentNode = null;
  }

  addEventListener(event, handler) {
    this.listeners.set(event, handler);
  }

  removeEventListener(event, handler) {
    if (this.listeners.get(event) === handler) this.listeners.delete(event);
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
}

function setup() {
  const document = {
    createElement: tag => new MockNode(1, tag),
    createTextNode: data => new MockNode(3, '', data),
    createComment: data => new MockNode(8, '', data),
    createDocumentFragment: () => new MockNode(11)
  };
  globalThis.document = document;
  globalThis.Node = MockNode;
  return { ...Treegger, document };
}

const nextFlush = () => new Promise(resolve => setImmediate(resolve));

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
  const { store, computed, effect, createElement: h, mount, document } = setup();
  let calculations = 0;
  const state = store({
    value: 1,
    doubled: computed(() => { calculations++; return state.value * 2; })
  });
  const target = document.createElement('root');
  const stop = mount(h('p', {}, () => state.doubled), target);
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
  const { store, computed, effect } = setup();
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
  const { signal, computed, createElement: h, mount, document } = setup();
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

test('computed switches dependencies and ignores plain objects with value', async () => {
  const { signal, computed, createElement: h, mount, document } = setup();
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
  assert.throws(() => effect(() => { calls++; value.value; throw new Error('boom'); }), /boom/);
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
    return () => `Count: ${count.value}`;
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
  const stop = mount(component(() => h('ul', {}, () => visible.value &&
    items.value.map((item, index) => h('li', index === 0 ? { ref: itemRef } : {}, item))
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
    children: () => visible.value
      ? jsx(Editor, {})
      : jsx('p', { children: 'Editor is hidden' })
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

test('Preserve hides a branch without replacing its DOM or disposing its scope', async () => {
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
  const wrapper = target.childNodes[0];
  const firstInput = input.element;

  assert.equal(wrapper.style.display, 'none');
  assert.equal(firstInput?.name, 'input');
  assert.equal(instances, 1);
  assert.deepEqual(calls, ['count 0']);

  count.value = 1;
  await nextFlush();
  assert.equal(firstInput.value, '1');
  assert.deepEqual(calls, ['count 0', 'count 1']);

  visible.value = true;
  await nextFlush();
  assert.equal(wrapper.style.display, 'contents');
  assert.equal(input.element, firstInput);
  assert.equal(instances, 1);
  assert.deepEqual(calls, ['count 0', 'count 1']);

  visible.value = false;
  await nextFlush();
  assert.equal(wrapper.style.display, 'none');
  assert.equal(input.element, firstInput);
  assert.deepEqual(calls, ['count 0', 'count 1']);

  stop();
  assert.equal(input.element, null);
  assert.deepEqual(calls, ['count 0', 'count 1', 'unmount']);
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
    return h('span', {}, () => value.value);
  }

  const stop = mount(h('div', {}, () => visible.value && component(Child)), document.createElement('root'));
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
  const stop = mount(h('div', {}, () => visible.value && h('button', { onClick() {} }, 'Click')), target);
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
  const stop = mount(h('p', {}, () => `Count: ${count.value}`), target);
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
  const stop = mount(h('div', { id: 'fixed', title: () => value.value }), target);
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
    h('li', { key: item.id, ref: rowRef }, () => label.value)
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
    { items, fallback: () => h('li', { ref: fallbackRef }, 'Empty') },
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
    fallback: () => h('li', {}, 'Empty'),
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
  const stop = mount(h('div', {}, () => visible.value ? component(KeyListener) : null), target);
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
