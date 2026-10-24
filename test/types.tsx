import {
  Each, ErrorBoundary, Preserve, computed, createElement, debug, effect, Fragment, html, mount,
  onUnmount, ref, scope, signal, store, type Reactive, type Component, type Store, type TreeggerElement, type TreeggerNode
} from 'treegger';

type MyComponent = () => TreeggerElement;
const HtmlComponent: MyComponent = () => html`<p>Hello</p>`;
const JsxComponent: MyComponent = () => <p>Hello</p>;
const TypedComponent: Component<{ label: string }> = ({ label }) => <p>{label}</p>;
const EmptyComponent: Component = () => null;
const TextComponent: Component = () => 'Hello';
const NumberComponent: Component = () => 42;
const ReactiveComponent: Component = () => computed(() => `Count: ${count.value}`);
const primitiveView = <><EmptyComponent /><TextComponent /><NumberComponent /><ReactiveComponent /></>;
const content: TreeggerNode = [HtmlComponent(), JsxComponent(), 'text', signal(1)];
void TypedComponent;
void primitiveView;
void content;

const count = signal(1);
count.value = 2;
const doubled = computed(() => count.value * 2);
const visible = computed(() => count.value > 0);
const jsxBranch = computed(() => visible.value ? <TypedComponent label="Positive" /> : null);
const htmlBranch = computed(() => visible.value ? html`<p>Positive</p>` : null);
const computedView = <section>{jsxBranch}{htmlBranch}</section>;
const ComputedComponent: Component = () => jsxBranch;
void computedView;
void ComputedComponent;
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

class StoreExample {
  label() { return 'class instance'; }
}
const opaqueState = store({
  date: new Date(), map: new Map<string, number>(), set: new Set<string>(), pattern: /tree/g,
  callback: (value: number) => value * 2, instance: new StoreExample(),
  promise: Promise.resolve(1), bytes: new Uint8Array([1]), nested: { dates: [new Date()] }
});
const timestamp: number = opaqueState.date.getTime();
const mapped: number | undefined = opaqueState.map.get('key');
const has: boolean = opaqueState.set.has('key');
const matched: boolean = opaqueState.pattern.test('treegger');
const called: number = opaqueState.callback(2);
const classLabel: string = opaqueState.instance.label();
const promise: Promise<number> = opaqueState.promise;
const bytes: Uint8Array = opaqueState.bytes;
const nestedDate: Date = opaqueState.nested.dates[0];
void [timestamp, mapped, has, matched, called, classLabel, promise, bytes, nestedDate];

const svgView = <svg viewBox="0 0 10 10" width={10} height={10}>
  <circle cx={5} cy={5} r={4} fill="green" strokeWidth={2} />
  <foreignObject><div>HTML</div></foreignObject>
</svg>;
void svgView;

const expressionHandler = <button onClick={() => count.value++}>Increment</button>;
const booleanHandler = <button onClick={() => window.dispatchEvent(new Event('resize'))}>Resize</button>;
const asynchronousHandler = <button onClick={async () => { await Promise.resolve(); }}>Async</button>;
const reactiveHandler = <button onClick={computed(() => () => {})}>Computed callback</button>;
void [expressionHandler, booleanHandler, asynchronousHandler, reactiveHandler];

const input = ref<HTMLInputElement>();
input.element?.focus();
const tree = <>
  <input ref={input} onInput={event => { const inputEvent: InputEvent = event; void inputEvent; }} />
  <button onClick={event => { const mouse: MouseEvent = event; void mouse; }}>{doubled}</button>
  <Each items={signal([{ id: 1, label: 'One' }])} fallback={computed(() => <p>Empty</p>)}>
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

const registeredHtml = html.with({ TypedComponent, Each, EmptyComponent });
const extendedHtml = registeredHtml.with({ JsxComponent });
const registeredTree: TreeggerElement = extendedHtml`<TypedComponent label="Hi" /><JsxComponent />`;
void registeredTree;
// @ts-expect-error registry entries must be component functions
html.with({ Invalid: 42 });

function ReactiveLabel({ count, initial = 0, onSave }: { count: Reactive<number>; initial?: number; onSave: () => void }) {
  const doubled = computed(() => count.value * 2 + initial);
  return <button onClick={onSave}>{doubled}</button>;
}
const explicitReactive = <><ReactiveLabel count={count} onSave={() => {}} /><ReactiveLabel count={doubled} initial={1} onSave={() => {}} /></>;
// @ts-expect-error Reactive only accepts signals and computed values
const plainReactive: Reactive<number> = 1;
// @ts-expect-error getters must be explicitly wrapped in computed
const getterReactive: Reactive<number> = () => 1;
// @ts-expect-error plain functions are not reactive DOM props
const functionProp = <div title={() => 'title'} />;
// @ts-expect-error plain functions are not renderable children
const functionChild = <div>{() => 'text'}</div>;
// @ts-expect-error list sources cannot be getter functions
const functionItems = <Each items={() => [1]}>{item => <p key={item}>{item}</p>}</Each>;
// @ts-expect-error Preserve conditions cannot be getter functions
const functionWhen = <Preserve when={() => true}><span /></Preserve>;
// @ts-expect-error component Reactive props require explicit wrappers
const functionComponentProp = <ReactiveLabel count={() => 1} onSave={() => {}} />;
void [explicitReactive, plainReactive, getterReactive, functionProp, functionChild, functionItems, functionWhen, functionComponentProp];

const reactiveMouseHandler = signal<((event: MouseEvent) => void) | null>(null);
reactiveMouseHandler.value = event => { const x: number = event.clientX; void x; };
const computedMouseHandler = computed(() => count.value > 0 ? (event: MouseEvent) => { void event.clientX; } : undefined);
const reactiveEventProps = <><button onClick={reactiveMouseHandler} /><button onclick={computedMouseHandler} /><button onClick={null} /></>;
// @ts-expect-error reactive event values must contain callbacks or nullish values
const invalidReactiveEvent = <button onClick={signal(42)} />;
// @ts-expect-error keyboard callbacks cannot handle mouse events
const invalidEventKind = <button onClick={signal((event: KeyboardEvent) => { void event.key; })} />;
void [reactiveEventProps, invalidReactiveEvent, invalidEventKind];
