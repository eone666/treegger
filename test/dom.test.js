// @vitest-environment jsdom

import { afterEach, test, vi } from 'vitest';
import assert from 'node:assert/strict';
import { computed, effect, Each, ErrorBoundary, Fragment, html, jsx, onUnmount, Preserve, ref, signal } from '../src/index.ts';
import { cleanupDocument, mountInDocument, nextFlush, queryTexts } from './helpers.js';

afterEach(cleanupDocument);

test('HTML and JSX pass the same camelCase component props, callbacks, and boolean flags', () => {
  const currentValue = signal(1);
  const calls = [];
  const received = [];
  const onSave = value => calls.push(value);
  function Widget(props) {
    received.push(props);
    return jsx('button', {
      className: props.buttonClass,
      onClick: () => props.onSave(props.initialCount),
      children: props.displayLabel
    });
  }
  const htmlTree = html`<${Widget} initialCount=${3} onSave=${onSave} currentValue=${currentValue}
    buttonClass="action" displayLabel="A label with spaces" isActive />`;
  const jsxTree = jsx(Widget, {
    initialCount: 3, onSave, currentValue, buttonClass: 'action', displayLabel: 'A label with spaces', isActive: true
  });
  for (const tree of [htmlTree, jsxTree]) {
    const { target } = mountInDocument(tree);
    assert.equal(target.querySelector('button').className, 'action');
    assert.equal(target.querySelector('button').textContent, 'A label with spaces');
    target.querySelector('button').click();
  }
  assert.deepEqual(calls, [3, 3]);
  for (const props of received) {
    assert.equal(props.initialCount, 3);
    assert.equal(props.onSave, onSave);
    assert.equal(props.currentValue, currentValue);
    assert.equal(props.isActive, true);
    assert.equal(Object.keys(props).some(name => name.startsWith('data-treegger-props-')), false);
  }
});

test('HTML and JSX share DOM prop casing, boolean attributes, and reactive values', async () => {
  const value = signal('first');
  const calls = [];
  const onInput = event => calls.push(event.target.value);
  const trees = [
    html`<input className="field" value=${value} onInput=${onInput} tabIndex=${0} checked readOnly title="A onSave='literal' value">`,
    jsx('input', { className: 'field', value, onInput, tabIndex: 0, checked: true, readOnly: true, title: "A onSave='literal' value" })
  ];
  const inputs = trees.map(tree => mountInDocument(tree).target.querySelector('input'));
  for (const input of inputs) {
    assert.equal(input.className, 'field');
    assert.equal(input.value, 'first');
    assert.equal(input.checked, true);
    assert.equal(input.readOnly, true);
    assert.equal(input.tabIndex, 0);
    assert.equal(input.title, "A onSave='literal' value");
    assert.equal(input.getAttributeNames().some(name => name.startsWith('data-treegger-props-')), false);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  assert.deepEqual(calls, ['first', 'first']);
  value.value = 'updated';
  await nextFlush();
  for (const input of inputs) assert.equal(input.value, 'updated');
});

test('keyed component fragments reorder and disappear through standard DOM operations', async () => {
  const a = { id: 'a' }, b = { id: 'b' }, c = { id: 'c' };
  const items = signal([a, b, c]);
  const expanded = signal(true);
  const removed = [];
  function Row({ item }) {
    onUnmount(() => removed.push(item.id));
    return jsx(Fragment, { children: [
      jsx('li', { children: item.id }),
      computed(() => expanded.value ? html`<li>${item.id} details</li>` : null)
    ] });
  }
  const { target } = mountInDocument(jsx('ul', { children: [
    jsx('li', { children: 'before' }),
    jsx(Each, { items, children: item => jsx(Row, { key: item.id, item }) }),
    jsx('li', { children: 'after' })
  ] }));
  const firstA = target.querySelectorAll('li')[1];
  items.value = [c, b, a];
  await nextFlush();
  assert.deepEqual(queryTexts(target, 'li'), ['before', 'c', 'c details', 'b', 'b details', 'a', 'a details', 'after']);
  expanded.value = false;
  await nextFlush();
  expanded.value = true;
  await nextFlush();
  items.value = [b, a];
  await nextFlush();
  assert.deepEqual(queryTexts(target, 'li'), ['before', 'b', 'b details', 'a', 'a details', 'after']);
  assert.equal(target.querySelectorAll('li')[3], firstA);
  assert.deepEqual(removed, ['c']);
  items.value = [];
  await nextFlush();
  assert.deepEqual(queryTexts(target, 'li'), ['before', 'after']);
  assert.equal(target.querySelector('ul').childNodes.length, 3);
  assert.deepEqual(removed.sort(), ['a', 'b', 'c']);
});

test('Each clears fragment rows without leaving nodes when replaceChildren is available', async () => {
  const items = signal([1, 2]);
  function Row({ item }) { return html`<><li>${item}</li><li>${item} details</li></>`; }
  const { target } = mountInDocument(jsx('ul', { children: jsx(Each, {
    items, children: item => jsx(Row, { key: item, item })
  }) }));
  items.value = [];
  await nextFlush();
  assert.equal(target.querySelectorAll('li').length, 0);
  assert.equal(target.querySelector('ul').childNodes.length, 1);
  assert.equal(target.querySelector('ul').firstChild.nodeType, Node.COMMENT_NODE);
});

test('Preserve detaches actual input nodes, retains values, and cleans up event listeners on disposal', async () => {
  const visible = signal(true);
  const count = signal(0);
  const input = ref();
  let mounts = 0;
  let disposals = 0;
  function Draft() {
    mounts++;
    onUnmount(() => { disposals++; });
    return html`<><textarea ref=${input}></textarea><button onclick=${() => count.value++}>${count}</button></>`;
  }
  const { target, unmount } = mountInDocument(html`<Preserve when=${visible}><${Draft} /></Preserve>`);
  const textarea = input.element;
  const button = target.querySelector('button');
  textarea.value = 'draft';
  textarea.focus();
  assert.equal(document.activeElement, textarea);
  visible.value = false;
  await nextFlush();
  assert.equal(textarea.isConnected, false);
  assert.equal(button.isConnected, false);
  assert.equal(target.querySelector('textarea'), null);
  assert.equal(input.element, textarea);
  assert.equal(disposals, 0);
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await nextFlush();
  assert.equal(button.textContent, '1');
  visible.value = true;
  await nextFlush();
  assert.equal(target.querySelector('textarea'), textarea);
  assert.equal(textarea.isConnected, true);
  assert.equal(textarea.value, 'draft');
  assert.equal(mounts, 1);
  assert.equal(target.children.length, 2);
  visible.value = false;
  await nextFlush();
  unmount();
  assert.equal(input.element, null);
  assert.equal(disposals, 1);
  button.dispatchEvent(new MouseEvent('click'));
  assert.equal(count.value, 1);
});

test('Preserve keeps table rows as direct children and restores updated detached content', async () => {
  const visible = signal(false);
  const label = signal('first');
  const { target } = mountInDocument(jsx('table', { children: jsx('tbody', { children: jsx(Preserve, {
    when: visible,
    children: jsx('tr', { children: jsx('td', { children: label }) })
  }) }) }));
  assert.equal(target.querySelector('tr'), null);
  label.value = 'updated';
  await nextFlush();
  visible.value = true;
  await nextFlush();
  assert.equal(target.querySelector('tbody > tr > td').textContent, 'updated');
  assert.equal(target.querySelector('tbody').children.length, 1);
});

test('SVG elements and case-sensitive names survive HTML templates and reactive updates', async () => {
  const visible = signal(false);
  const width = signal(2);
  const content = computed(() => visible.value
    ? html`<linearGradient id="gradient" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="green"></stop></linearGradient>`
    : null);
  const { target } = mountInDocument(html`<svg viewBox="0 0 20 20">
    <defs>${content}</defs>
    <circle cx="10" cy="10" r="8" strokeWidth=${width} className="dot"></circle>
    <foreignObject><div>HTML</div></foreignObject>
  </svg>`);
  const svg = target.querySelector('svg');
  const circle = target.querySelector('circle');
  assert.ok(svg instanceof SVGSVGElement);
  assert.ok(circle instanceof SVGElement);
  assert.equal(svg.getAttribute('viewBox'), '0 0 20 20');
  assert.equal(circle.getAttribute('stroke-width'), '2');
  assert.equal(circle.getAttribute('class'), 'dot');
  assert.equal(target.querySelector('foreignObject > div').namespaceURI, 'http://www.w3.org/1999/xhtml');
  visible.value = true;
  width.value = 3;
  await nextFlush();
  const gradient = target.querySelector('linearGradient');
  assert.ok(gradient instanceof SVGElement);
  assert.equal(gradient.namespaceURI, 'http://www.w3.org/2000/svg');
  assert.equal(gradient.getAttribute('gradientUnits'), 'userSpaceOnUse');
  assert.equal(circle.getAttribute('stroke-width'), '3');
});

test('SVG context reaches component rows, Preserve, and ErrorBoundary fallback', async () => {
  const items = signal([1]);
  const visible = signal(true);
  const fail = signal(false);
  function Dot({ value }) { return jsx('circle', { r: value }); }
  const { target } = mountInDocument(jsx('svg', { children: [
    jsx(Each, { items, children: item => jsx(Dot, { key: item, value: item }) }),
    jsx(Preserve, { when: visible, children: jsx('path', { d: 'M0 0L1 1' }) }),
    jsx(ErrorBoundary, { fallback: jsx('text', { children: 'error' }), children: computed(() => {
      if (fail.value) throw new Error('failed');
      return jsx('g', {});
    }) })
  ] }));
  const path = target.querySelector('path');
  visible.value = false;
  items.value = [1, 2];
  fail.value = true;
  await nextFlush();
  assert.equal(path.isConnected, false);
  assert.equal(target.querySelectorAll('circle').length, 2);
  assert.equal(target.querySelector('text').namespaceURI, 'http://www.w3.org/2000/svg');
  visible.value = true;
  await nextFlush();
  assert.equal(target.querySelector('path'), path);
  assert.equal(target.querySelector('svg > div'), null);
  for (const element of target.querySelectorAll('svg > *')) assert.ok(element instanceof SVGElement);
});

test('SVG namespaced attributes and JSX className use standard attribute semantics', async () => {
  const link = signal('#first');
  const { target } = mountInDocument(jsx('svg', { children: jsx('use', { 'xlink:href': link, className: 'icon' }) }));
  const use = target.querySelector('use');
  assert.equal(use.getAttributeNS('http://www.w3.org/1999/xlink', 'href'), '#first');
  assert.equal(use.getAttribute('class'), 'icon');
  link.value = '#second';
  await nextFlush();
  assert.equal(use.getAttributeNS('http://www.w3.org/1999/xlink', 'href'), '#second');
});

test('ordinary callbacks read current state during actual browser events', async () => {
  const editing = signal(false);
  const calls = [];
  const { target } = mountInDocument(jsx('button', { onClick: event => {
    assert.ok(event instanceof MouseEvent);
    calls.push(editing.value ? 'save' : 'edit');
  }, children: 'action' }));
  const button = target.querySelector('button');
  button.click();
  editing.value = true;
  await nextFlush();
  assert.deepEqual(calls, ['edit']);
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  assert.deepEqual(calls, ['edit', 'save']);
});

test('ARIA, data, and enumerated attributes serialize boolean values instead of disappearing', async () => {
  const active = signal(false);
  for (const tree of [
    html`<button aria-expanded=${active} data-active=${active} draggable=${active} disabled=${active}>toggle</button>`,
    jsx('button', { 'aria-expanded': active, 'data-active': active, draggable: active, disabled: active })
  ]) {
    const { target } = mountInDocument(tree);
    const button = target.querySelector('button');
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    assert.equal(button.getAttribute('data-active'), 'false');
    assert.equal(button.getAttribute('draggable'), 'false');
    assert.equal(button.disabled, false);
  }
  active.value = true;
  await nextFlush();
  for (const button of document.querySelectorAll('button')) {
    assert.equal(button.getAttribute('aria-expanded'), 'true');
    assert.equal(button.getAttribute('data-active'), 'true');
    assert.equal(button.draggable, true);
    assert.equal(button.disabled, true);
  }
});

test('select value is applied after its option children exist in HTML and JSX', async () => {
  const selected = signal('second');
  const trees = [
    html`<select value=${selected}><option value="first">First</option><option value="second">Second</option></select>`,
    jsx('select', { value: selected, children: [jsx('option', { value: 'first', children: 'First' }), jsx('option', { value: 'second', children: 'Second' })] })
  ];
  const selects = trees.map(tree => mountInDocument(tree).target.querySelector('select'));
  for (const select of selects) assert.equal(select.value, 'second');
  selected.value = 'first';
  await nextFlush();
  for (const select of selects) assert.equal(select.value, 'first');
});

test('html.with keeps registries isolated when the same template call site is cached', () => {
  const first = html.with({ Card: () => html`<p>first</p>` });
  const second = html.with({ Card: () => html`<p>second</p>` });
  const template = tag => tag`<Card /><span>after</span>`;
  for (const [tag, expected] of [[first, 'first'], [second, 'second'], [first, 'first']]) {
    const { target } = mountInDocument(template(tag));
    assert.deepEqual(queryTexts(target, 'p, span'), [expected, 'after']);
  }
  assert.throws(() => template(html), /Unknown html component "Card"/);
  assert.equal(mountInDocument(template(second)).target.querySelector('p').textContent, 'second');
});

test('html.with merges registries immutably and preserves component name casing', () => {
  const definitions = { Card: () => html`<p>original</p>` };
  const base = html.with(definitions);
  definitions.Card = () => html`<p>mutated</p>`;
  const extended = base.with({ Card: () => html`<p>override</p>`, CARD: () => html`<p>uppercase</p>` });
  assert.equal(mountInDocument(base`<Card />`).target.textContent, 'original');
  assert.equal(mountInDocument(extended`<Card /><CARD />`).target.textContent, 'overrideuppercase');
  assert.throws(() => base`<CARD />`, /Unknown html component "CARD"/);
  assert.throws(() => html.with({ card: () => null }), /capitalized/);
  assert.throws(() => html.with({ Card: 42 }), /component functions/);
});

test('registered components keep reactive props, callback props, children, refs, and disposal', async () => {
  const count = signal(0);
  const input = ref();
  let received;
  let disposed = 0;
  let saved = 0;
  const onSave = () => saved++;
  function Card(props) {
    received = props;
    onUnmount(() => disposed++);
    return html`<section><input ref=${input} /><button onClick=${props.onSave}>${props.count}</button>${props.children}</section>`;
  }
  const view = html.with({ Card });
  const { target, unmount } = mountInDocument(view`<Card count=${count} onSave=${onSave} isActive><strong>child</strong></Card>`);
  assert.equal(received.onSave, onSave);
  assert.equal(received.isActive, true);
  assert.equal(target.querySelector('strong').textContent, 'child');
  target.querySelector('button').click();
  assert.equal(saved, 1);
  count.value = 2;
  await nextFlush();
  assert.equal(target.querySelector('button').textContent, '2');
  assert.equal(input.element, target.querySelector('input'));
  unmount();
  assert.equal(input.element, null);
  assert.equal(disposed, 1);
});

test('html.with combines named and interpolated components with built-in controls', async () => {
  const items = signal([1, 2]);
  const visible = signal(true);
  function Row({ item }) { return html`<li>${item}</li>`; }
  const Other = () => html`<span>interpolated</span>`;
  const view = html.with({ Row });
  const { target } = mountInDocument(view`<Fragment><Preserve when=${visible}><ul><Each items=${items}>${item => view`<Row key=${item} item=${item} />`}</Each></ul></Preserve><${Other} /><ErrorBoundary fallback=${html`<b>failed</b>`}>${computed(() => { throw new Error('failure'); })}</ErrorBoundary></Fragment>`);
  assert.deepEqual(queryTexts(target, 'li'), ['1', '2']);
  assert.equal(target.querySelector('span').textContent, 'interpolated');
  assert.equal(target.querySelector('b').textContent, 'failed');
  items.value = [2, 1];
  await nextFlush();
  assert.deepEqual(queryTexts(target, 'li'), ['2', '1']);
  visible.value = false;
  await nextFlush();
  assert.equal(target.querySelector('ul'), null);
  visible.value = true;
  await nextFlush();
  assert.deepEqual(queryTexts(target, 'li'), ['2', '1']);
});

test('components opt into explicit reactive props while initial values and callbacks stay ordinary', async () => {
  const label = signal('first');
  const initial = signal(3);
  let calls = 0;
  let mounts = 0;
  function Panel({ label, initial, onSave }) {
    mounts++;
    const count = signal(initial);
    return jsx('button', { onClick: onSave, children: computed(() => `${label.value}: ${count.value}`) });
  }
  const view = html.with({ Panel });
  const onSave = () => { calls++; };
  const trees = [
    jsx(Panel, { label, initial: initial.value, onSave }),
    html`<${Panel} label=${label} initial=${initial.value} onSave=${onSave} />`,
    view`<Panel label=${computed(() => label.value)} initial=${initial.value} onSave=${onSave} />`
  ];
  const buttons = trees.map(tree => mountInDocument(tree).target.querySelector('button'));
  assert.equal(calls, 0);
  for (const button of buttons) assert.equal(button.textContent, 'first: 3');
  label.value = 'second';
  initial.value = 10;
  await nextFlush();
  for (const button of buttons) {
    assert.equal(button.textContent, 'second: 3');
    button.click();
  }
  assert.equal(mounts, 3);
  assert.equal(calls, 3);
});

test('plain function children, DOM props, list sources and Preserve conditions are rejected without invocation', () => {
  let calls = 0;
  const getter = () => { calls++; return 'unexpected'; };
  const cases = [
    jsx('p', { children: getter }),
    jsx('p', { children: [getter] }),
    jsx('p', { children: computed(() => getter) }),
    jsx('input', { title: getter }),
    jsx('select', { value: getter }),
    jsx('p', { title: computed(() => getter) }),
    jsx(Preserve, { when: getter, children: jsx('span', {}) }),
    jsx(Each, { items: getter, children: item => jsx('p', { key: item }) }),
    html`<p>${getter}</p>`,
    html`<input title=${getter} />`
  ];
  for (const tree of cases) assert.throws(() => mountInDocument(tree), /function|computed/i);
  assert.equal(calls, 0);
});

test('computed DOM props, store expressions and mixed template attributes update explicitly', async () => {
  const count = signal(1);
  const title = computed(() => `Count: ${count.value}`);
  const { target } = mountInDocument(html`<p title="Current ${count}" class=${computed(() => count.value > 1 ? 'high' : 'low')}>${title}</p>`);
  const paragraph = target.querySelector('p');
  assert.equal(paragraph.title, 'Current 1');
  assert.equal(paragraph.className, 'low');
  count.value = 2;
  await nextFlush();
  assert.equal(paragraph.title, 'Current 2');
  assert.equal(paragraph.className, 'high');
  assert.equal(paragraph.textContent, 'Count: 2');
});

test('HTML and JSX resolve computed handlers lazily at dispatch without resubscribing', async () => {
  for (const syntax of ['html', 'jsx']) {
    const editing = signal(false);
    const calls = [];
    let selections = 0;
    const edit = event => { calls.push(['edit', event.currentTarget]); };
    const save = event => { calls.push(['save', event.currentTarget]); };
    const handler = computed(() => { selections++; return editing.value ? save : edit; });
    const { target, unmount } = mountInDocument(syntax === 'html'
      ? html`<button onClick=${handler}>action</button>`
      : jsx('button', { onClick: handler, children: 'action' }));
    const button = target.querySelector('button');
    const add = vi.spyOn(button, 'addEventListener');
    const remove = vi.spyOn(button, 'removeEventListener');
    assert.equal(selections, 0);
    button.click();
    assert.deepEqual(calls, [['edit', button]]);
    editing.value = true;
    button.click(); // The new handler is available before any queued update flush.
    await nextFlush();
    assert.deepEqual(calls, [['edit', button], ['save', button]]);
    assert.equal(selections, 2);
    assert.equal(add.mock.calls.length, 0);
    assert.equal(remove.mock.calls.length, 0);
    unmount();
    assert.equal(remove.mock.calls.length, 1);
    button.click();
    assert.equal(calls.length, 2);
    add.mockRestore(); remove.mockRestore(); handler.dispose();
  }
});

test('signal handlers can start disabled, switch callbacks, and become nullish again', () => {
  const handler = signal(null);
  const { target, unmount } = mountInDocument(html`<button onClick=${handler}>action</button>`);
  const button = target.querySelector('button');
  let first = 0, second = 0;
  button.click();
  handler.value = () => { first++; };
  button.click();
  handler.value = () => { second++; };
  button.click();
  handler.value = undefined;
  button.click();
  handler.value = null;
  button.click();
  assert.deepEqual([first, second], [1, 1]);
  unmount();
});

test('event dispatch does not subscribe an enclosing effect to handler sources or callback reads', async () => {
  const selection = signal(false);
  const value = signal(1);
  const trigger = signal(0);
  const calls = [];
  const handler = computed(() => selection.value ? () => { calls.push(-value.value); } : () => { calls.push(value.value); });
  const { target } = mountInDocument(jsx('button', { onClick: handler }));
  let runs = 0;
  const watcher = effect(() => { void trigger.value; runs++; target.querySelector('button').click(); });
  selection.value = true;
  value.value = 2;
  await nextFlush();
  assert.equal(runs, 1);
  assert.deepEqual(calls, [1]);
  trigger.value++;
  await nextFlush();
  assert.equal(runs, 2);
  assert.deepEqual(calls, [1, -2]);
  watcher.stop(); handler.dispose();
});

test('ErrorBoundary handles callback selection errors, invalid resolved handlers and sync or async failures', async () => {
  const sources = [
    computed(() => { throw new Error('selection failed'); }),
    signal('invalid handler'),
    signal(() => { throw new Error('callback failed'); }),
    computed(() => async () => { throw new Error('async callback failed'); })
  ];
  for (const source of sources) {
    const { target, unmount } = mountInDocument(jsx(ErrorBoundary, {
      fallback: error => jsx('p', { children: error.message }),
      children: jsx('button', { onClick: source })
    }));
    target.querySelector('button').click();
    await nextFlush();
    assert.match(target.querySelector('p').textContent, /failed|must resolve to a callback/);
    assert.equal(target.querySelector('button'), null);
    unmount();
    if ('dispose' in source) source.dispose();
  }
});
