const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

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
  const context = { window: {}, document, Node: MockNode, queueMicrotask };
  vm.runInNewContext(fs.readFileSync('treegger.js', 'utf8'), context);
  return { ...context.window.Treegger, document };
}

const nextFlush = () => new Promise(resolve => setImmediate(resolve));

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

test('keyed list preserves rows on append and reorder', async () => {
  const { signal, each, createElement: h, mount, document } = setup();
  const first = { id: 1, label: 'A' };
  const second = { id: 2, label: 'B' };
  const items = signal([first]);
  const target = document.createElement('root');
  let renderCalls = 0;
  const stop = mount(h('ul', {}, each(items, item => {
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
  stop();
});

test('nullable list shows fallback and clears its ref when items appear', async () => {
  const { signal, ref, each, createElement: h, mount, document } = setup();
  const items = signal(null);
  const fallbackRef = ref();
  const target = document.createElement('root');
  const stop = mount(h('ul', {}, each(
    items,
    item => h('li', { key: item.id }, item.label),
    { fallback: () => h('li', { ref: fallbackRef }, 'Empty') }
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
