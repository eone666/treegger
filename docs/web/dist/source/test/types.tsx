import {
  Each, ErrorBoundary, Preserve, computed, createElement, debug, effect, Fragment, html, mount,
  onUnmount, ref, scope, signal, store, type Component, type Store, type TreeggerElement, type TreeggerNode
} from 'treegger';

type MyComponent = () => TreeggerElement;
const HtmlComponent: MyComponent = () => html`<p>Hello</p>`;
const JsxComponent: MyComponent = () => <p>Hello</p>;
const TypedComponent: Component<{ label: string }> = ({ label }) => <p>{label}</p>;
const EmptyComponent: Component = () => null;
const TextComponent: Component = () => 'Hello';
const NumberComponent: Component = () => 42;
const ReactiveComponent: Component = () => () => `Count: ${count.value}`;
const primitiveView = <><EmptyComponent /><TextComponent /><NumberComponent /><ReactiveComponent /></>;
const content: TreeggerNode = [HtmlComponent(), JsxComponent(), 'text', signal(1)];
void TypedComponent;
void primitiveView;
void content;

const count = signal(1);
count.value = 2;
const doubled = computed(() => count.value * 2);
const writable = computed({ get: () => count.value * 2, set: next => { count.value = next / 2; } });
writable.value = 10;
// @ts-expect-error read-only computed
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
doubled.value = 5;

const state = store({ count, doubled, writable, nested: { name: 'Ada' }, list: [signal(1)] });
const number: number = state.count;
state.count = 3;
const derived: number = state.doubled;
// @ts-expect-error read-only computed store field
state.doubled = 3;
state.writable = 8;
state.nested.name = 'Grace';
state.list[0].value = 4;
// @ts-expect-error signal array item remains wrapped
const wrong: number = state.list[0];
const typedStore: Store<{ title: string }> = store({ title: 'Hi' });
typedStore.title = 'Bye';

const input = ref<HTMLInputElement>();
input.element?.focus();
const tree = <>
  <input ref={input} onInput={event => { const inputEvent: InputEvent = event; void inputEvent; }} />
  <button onClick={event => { const mouse: MouseEvent = event; void mouse; }}>{doubled}</button>
  <Each items={signal([{ id: 1, label: 'One' }])} fallback={() => <p>Empty</p>}>
    {item => <p key={item.id}>{item.label}</p>}
  </Each>
  <ErrorBoundary fallback={(error, reset) => <button onClick={reset}>{String(error)}</button>}>
    <p>Safe</p>
  </ErrorBoundary>
  <Preserve when={signal(true)}><input /></Preserve>
</>;
const target = document.createElement('div');
const unmount = mount(tree, target);
unmount();
const native = createElement('button', { onClick: event => { const mouse: MouseEvent = event; void mouse; } }, 'Click');
mount(native, target);
mount(html`<p>${count}</p>`, target);
const panel = scope(() => { onUnmount(() => {}); return 1; });
const scopedNumber: number = panel.value;
panel.owner.dispose();
mount(debug(tree), target);
mount(debug(tree, { showUpdates: false }), target);
const job = effect(() => { return () => {}; });
job.stop();
void Fragment;
void number;
void derived;
void wrong;
void scopedNumber;
