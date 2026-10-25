import { activeScope, setActiveScope, handleError, flash, scope, addCleanup, effect, untrack, type Owner } from "./core";
import { DOM_REF, isSignal, resolve } from "./signals";
import { appendList } from "./list";
import type { Key, ErrorBoundaryProps } from "./types";
import { activeNamespace, SVG_NAMESPACE, svgTagNames, svgAttributeNames, withNamespace, childNamespace, removeRange } from "./dom";

  // ---------- Element factories ----------

  const FACTORY = Symbol("treegger.factory");
  const EACH: unique symbol = Symbol("treegger.each");
  const KEY = Symbol("treegger.key");
  const FRAGMENT = Symbol("treegger.fragment");
  const DEBUG = Symbol("treegger.debug");
  type Factory = (() => Node) & { [FACTORY]: boolean; [KEY]?: Key; [FRAGMENT]?: boolean };
  type RenderParent = Node & ParentNode;

  function fragment(...children: unknown[]) {
    const owner = activeScope;
    const tree = factory(() => {
      const container = document.createDocumentFragment();
      const currentOwner = activeScope?.active ? activeScope : owner;
      container.append(document.createComment("treegger-fragment-start"));
      for (const child of children) appendChild(container, child, currentOwner);
      container.append(document.createComment("treegger-fragment-end"));
      return container;
    });
    tree[FRAGMENT] = true;
    return tree;
  }

  function Fragment({ children = [] }: { children?: unknown } = {}) {
    return fragment(...(Array.isArray(children) ? children : [children]));
  }

  function errorBoundary(children: unknown, fallback?: ErrorBoundaryProps["fallback"]) {
    const tree = factory(() => {
      const namespace = activeNamespace;
      const instance = scope(() => {
        const boundaryOwner = activeScope;
        const root = document.createDocumentFragment();
        const start = document.createComment("treegger-boundary-start");
        const end = document.createComment("treegger-boundary-end");
        root.append(start, end);
        let branch: { owner: Owner; value: { nodes: ChildNode[] } } | null = null;
        let failed = false;

        function clearBranch() {
          if (!branch) return;
          const previous = branch;
          branch = null;
          try { previous.owner.dispose(); }
          finally { for (const node of previous.value.nodes) node.remove(); }
        }
        addCleanup(boundaryOwner, clearBranch);

        function render(value: unknown, evaluate = false) {
          const previousScope = activeScope;
          setActiveScope(boundaryOwner);
          let rendered;
          try {
            rendered = withNamespace(namespace, () => scope(() => {
              const content = document.createDocumentFragment();
              appendChild(content, evaluate && typeof value === "function" ? value() : value, activeScope);
              return { fragment: content, nodes: [...content.childNodes] };
            }));
          } finally {
            setActiveScope(previousScope);
          }
          branch = rendered;
          end.parentNode!.insertBefore(rendered.value.fragment, end);
        }

        function reset() {
          if (!failed) return;
          clearBranch();
          failed = false;
          try { render(children); } catch (error) { showFallback(error); }
        }

        function showFallback(error: unknown) {
          if (failed) return false;
          failed = true;
          clearBranch();
          const content = fallback == null
            ? createElement("pre", { role: "alert" }, String(error instanceof Error ? error.message : error))
            : typeof fallback === "function" && !isFactory(fallback)
              ? () => fallback(error, reset)
              : fallback;
          render(content, typeof fallback === "function" && !isFactory(fallback));
          return true;
        }

        boundaryOwner!.errorHandler = showFallback;
        try { render(children); } catch (error) { showFallback(error); }
        return root;
      });
      return instance.value;
    });
    tree[FRAGMENT] = true;
    return tree;
  }

  function ErrorBoundary({ children = [], fallback }: ErrorBoundaryProps = {}) {
    return errorBoundary(children, fallback);
  }

  function Preserve({ when = true, children = [] }: { when?: unknown; children?: unknown } = {}) {
    const tree = factory(() => scope(() => {
      const container = document.createDocumentFragment();
      const parked = document.createDocumentFragment();
      const first = document.createComment("treegger-preserve-start");
      const last = document.createComment("treegger-preserve-end");
      container.append(first);
      untrack(() => {
        for (const child of Array.isArray(children) ? children : [children]) {
          appendChild(container, child, activeScope);
        }
      });
      container.append(last);
      let attached = true;
      effect(() => {
        const show = Boolean(resolve(when));
        if (show === attached) return;
        if (show) {
          last.parentNode!.insertBefore(parked, last);
        } else {
          let node = first.nextSibling;
          while (node && node !== last) {
            const next = node.nextSibling;
            parked.append(node);
            node = next;
          }
        }
        attached = show;
      });
      addCleanup(activeScope, () => {
        removeRange({ first, last });
        while (parked.firstChild) parked.firstChild.remove();
      });
      return container;
    }).value);
    tree[FRAGMENT] = true;
    return tree;
  }

  function Each({ items, children, fallback = null }: { items?: unknown; children?: unknown; fallback?: unknown } = {}) {
    const render: unknown = Array.isArray(children)
      ? (children as unknown[]).find(child => typeof child === "function")
      : children;
    if (typeof render !== "function") {
      throw new TypeError("<Each> expects a render function as its child");
    }
    return { [EACH]: true, source: items, render: render as (item: unknown) => unknown, fallback };
  }

  function ref<E extends Element = HTMLElement>() {
    const reference: { [DOM_REF]: boolean; element: E | null; refCallback?: (element: E | null, previous?: E) => void } = { [DOM_REF]: true, element: null };
    Object.defineProperty(reference, "refCallback", {
      value(element: E | null, previous?: E) {
        if (!previous || reference.element === previous) {
          reference.element = element;
        }
      }
    });
    return reference;
  }

  function factory(fn: () => Node): Factory {
    return Object.assign(fn, { [FACTORY]: true });
  }

  function isFactory(value: unknown): value is Factory {
    return typeof value === "function" && FACTORY in value && value[FACTORY] === true;
  }

  function primitiveText(value: unknown): string | null {
    if (value == null || typeof value === "boolean" ||
        typeof value === "string" || typeof value === "number" ||
        typeof value === "bigint") {
      return value == null || typeof value === "boolean" ? "" : String(value);
    }
    return null;
  }

  // ---------- DOM helpers ----------

  const booleanAttributes = new Set([
    "allowfullscreen", "async", "autofocus", "autoplay", "checked", "controls", "default", "defer",
    "disabled", "disablepictureinpicture", "disableremoteplayback", "formnovalidate", "hidden", "inert",
    "ismap", "itemscope", "loop", "multiple", "muted", "nomodule", "novalidate", "open",
    "playsinline", "readonly", "required", "reversed", "selected", "shadowrootclonable",
    "shadowrootdelegatesfocus", "shadowrootserializable"
  ]);

  const svgAliases = new Map([
    "strokeWidth", "strokeLinecap", "strokeLinejoin", "strokeDasharray", "strokeDashoffset", "strokeMiterlimit",
    "fillRule", "clipRule", "fillOpacity", "strokeOpacity", "clipPath", "markerStart", "markerMid", "markerEnd",
    "fontSize", "fontFamily", "textAnchor", "dominantBaseline", "stopColor", "stopOpacity", "vectorEffect"
  ].map(name => [name.toLowerCase(), name.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)]));

  function setProp(el: HTMLElement | SVGElement, key: string, value: unknown) {
    if (typeof value === "function") throw new TypeError("Function DOM prop values are unsupported; use a signal or computed value");
    if (key === "className" || key === "classname") {
      if (el.namespaceURI === SVG_NAMESPACE) el.setAttribute("class", String(value ?? ""));
      else (el as HTMLElement).className = String(value ?? "");
      return;
    }

    if (key === "style") {
      if (typeof value === "string") {
        el.style.cssText = value;
      } else {
        el.style.cssText = "";

        if (value && typeof value === "object") {
          Object.assign(el.style, value);
        }
      }
      return;
    }

    if (key === "value" || key === "checked") {
      if (key === "checked") (el as HTMLInputElement).checked = Boolean(value);
      else (el as HTMLInputElement).value = String(value ?? "");
      return;
    }

    if (el.namespaceURI === SVG_NAMESPACE) {
      key = svgAttributeNames.get(key.toLowerCase()) ?? svgAliases.get(key.toLowerCase()) ?? key;
    }
    const attributeNamespace = key.startsWith("xlink:") ? "http://www.w3.org/1999/xlink"
      : key.startsWith("xml:") ? "http://www.w3.org/XML/1998/namespace" : null;
    if (attributeNamespace) {
      if (value == null || value === false) el.removeAttributeNS(attributeNamespace, key.split(":")[1]);
      else el.setAttributeNS(attributeNamespace, key, String(value));
    } else if (value == null || (value === false && el.namespaceURI !== SVG_NAMESPACE && booleanAttributes.has(key.toLowerCase()))) {
      el.removeAttribute(key);
    } else if (value === true && el.namespaceURI !== SVG_NAMESPACE && booleanAttributes.has(key.toLowerCase())) {
      el.setAttribute(key, "");
    } else {
      el.setAttribute(key, String(value));
    }
  }

  function appendChild(parent: RenderParent, child: unknown, owner: Owner | null) {
    if (child && typeof child === "object" && EACH in child && child[EACH] &&
        "source" in child && "render" in child && typeof child.render === "function" && "fallback" in child) {
      appendList(parent, { source: child.source, render: child.render as (item: unknown) => unknown, fallback: child.fallback }, owner);
      return;
    }

    if (Array.isArray(child)) {
      for (const item of child) {
        appendChild(parent, item, owner);
      }
      return;
    }

    if (isFactory(child)) {
      parent.append(child());
      return;
    }

    if (child instanceof Node) {
      parent.append(child);
      return;
    }

    if (typeof child === "function") {
      throw new TypeError("Function children are unsupported; wrap reactive expressions in derive()");
    }

    if (isSignal(child)) {
      const namespace = activeNamespace;
      const marker = document.createComment("treegger");
      parent.append(marker);
      let textNode: Text | null = null;
      addCleanup(owner, () => textNode?.remove());
      const setText = (text: string) => {
        if (textNode) {
          if (textNode.data !== text) textNode.data = text;
        } else {
          textNode = document.createTextNode(text);
          marker.parentNode!.insertBefore(textNode, marker);
        }
      };

      effect(() => withNamespace(namespace, () => {
        const value = child.value;
        const simple = primitiveText(value);
        if (simple !== null) {
          setText(simple);
          return;
        }
        const rendered = scope(() => {
          const fragment = document.createDocumentFragment();
          untrack(() => appendChild(fragment, value, activeScope));
          return { fragment, nodes: [...fragment.childNodes] };
        });

        textNode?.remove();
        textNode = null;
        marker.parentNode!.insertBefore(rendered.value.fragment, marker);

        return () => {
          rendered.owner.dispose();
          for (const node of rendered.value.nodes) node.remove();
        };
      }), owner, () => flash(marker.previousSibling || marker.parentElement, owner));
      return;
    }

    if (child == null || typeof child === "boolean") {
      return;
    }

    parent.append(document.createTextNode(String(child)));
  }

  // ---------- createElement ----------

  type EventCallback = (event: Event) => unknown;
  function isEventCallback(value: unknown): value is EventCallback {
    return typeof value === "function";
  }

  function bindProp(el: HTMLElement | SVGElement, key: string, value: unknown, owner: Owner | null) {
    if (isSignal(value)) {
      effect(() => setProp(el, key, value.value), owner, () => flash(el, owner));
    } else setProp(el, key, value);
  }

  function createElement(tag: string | ((props: Record<string, unknown>) => unknown), props: Record<string, unknown> | null = {}, ...children: unknown[]) {
    props ??= {};
    if (tag === Fragment) return fragment(...children);
    if (tag === ErrorBoundary) return errorBoundary(children, props.fallback as ErrorBoundaryProps["fallback"]);
    if (tag === Preserve) return Preserve({ when: props.when, children });
    if (tag === Each) return Each({ ...props, children });
    if (typeof tag === "function") {
      return component(tag, { ...props, children });
    }

    const owner = activeScope;

    // Возвращаем функцию, а не VDOM-объект.
    const tree = factory(() => {
      const instanceOwner = activeScope?.active ? activeScope : owner;
      const namespace = tag === "svg" ? SVG_NAMESPACE : activeNamespace;
      const el = namespace === SVG_NAMESPACE
        ? document.createElementNS(SVG_NAMESPACE, svgTagNames.get(tag.toLowerCase()) ?? tag)
        : document.createElement(tag);
      const events: [string, EventCallback | { value: unknown }][] = [];
      for (const [key, value] of Object.entries(props)) {
        if (key === "ref" || key === "key") continue;
        // A select cannot resolve its value until its options have been mounted.
        if (key === "value" && el.localName === "select") continue;
        if (key.startsWith("on")) {
          if (value == null) continue;
          if (!isEventCallback(value) && !isSignal(value)) {
            throw new TypeError(`${key} must be an event callback, signal, computed, or nullish value`);
          }
          events.push([key.slice(2).toLowerCase(), value]);
        } else {
          bindProp(el, key, value, instanceOwner);
        }
      }

      if (props.ref != null) {
        const callback = typeof props.ref === "function"
          ? props.ref
          : typeof props.ref === "object" && props.ref !== null && "refCallback" in props.ref ? props.ref.refCallback : undefined;
        if (typeof callback !== "function") {
          throw new TypeError("ref prop must be a callback or a Treegger ref");
        }
        callback(el);
        addCleanup(instanceOwner, () => callback(null, el));
      }

      // События не нужно переподписывать при обновлении.
      for (const [event, source] of events) {
        const listener = (browserEvent: Event) => {
          try {
            const result = untrack(() => {
              const handler = isSignal(source) ? source.value : source;
              if (handler == null) return;
              if (!isEventCallback(handler)) {
                throw new TypeError(`${event} handler must resolve to a callback or nullish value`);
              }
              return handler(browserEvent);
            });
            if (result instanceof Promise) {
              result.catch((error: unknown) => {
                if (!handleError(error, instanceOwner)) queueMicrotask(() => { throw error; });
              });
            }
          } catch (error) {
            if (!handleError(error, instanceOwner)) throw error;
          }
        };
        el.addEventListener(event, listener);
        addCleanup(instanceOwner, () => el.removeEventListener(event, listener));
      }

      withNamespace(childNamespace(el), () => {
        for (const child of children) appendChild(el, child, instanceOwner);
      });

      if (el.localName === "select" && Object.hasOwn(props, "value")) {
        bindProp(el, "value", props.value, instanceOwner);
      }

      return el;
    });
    if (typeof props.key === "string" || typeof props.key === "number" || typeof props.key === "symbol") tree[KEY] = props.key;
    return tree;
  }

  // ---------- Components ----------

  function component(fn: (props: Record<string, unknown>) => unknown, props: Record<string, unknown> = {}) {
    const parent = activeScope;

    const tree = factory(() => {
      const previous = activeScope;
      setActiveScope(previous?.active ? previous : parent);

      try {
        const instance = scope(() => {
          // Функция компонента вызывается один раз.
          const { key: _key, ...componentProps } = props;
          const result = fn(componentProps);
          if (isFactory(result)) return result();

          const fragment = document.createDocumentFragment();
          appendChild(fragment, result, activeScope);
          return fragment;
        });

        const node = instance.value;
        disposers.set(node, () => instance.owner.dispose());

        return node;
      } finally {
        setActiveScope(previous);
      }
    });
    if (typeof props.key === "string" || typeof props.key === "number" || typeof props.key === "symbol") tree[KEY] = props.key;
    return tree;
  }

  const disposers = new WeakMap<Node, () => void>();

  // ---------- Mount ----------

  function debug<T extends Factory | Node | object>(tree: T, options: { showUpdates?: boolean } = {}) {
    return { [DEBUG]: true as const, tree, showUpdates: options.showUpdates ?? true };
  }

  function mount(tree: Factory | Node | object, target: RenderParent) {
    const debugged = DEBUG in tree && tree[DEBUG] === true && "tree" in tree;
    const content = debugged ? tree.tree : tree;
    const instance = withNamespace(childNamespace(target), () => scope(() => {
      if (debugged) activeScope!.debugUpdates = "showUpdates" in tree && tree.showUpdates === true;
      return isFactory(content) ? content() : content instanceof Node ? content : fragment(content)();
    }));
    const node = instance.value;
    const nodes = node.nodeType === 11 ? [...node.childNodes] : [node as ChildNode];

    try { target.append(node); }
    catch (error) {
      try { instance.owner.dispose(); }
      catch (cleanupError) { throw new AggregateError([error, cleanupError], "Treegger mount failed during cleanup"); }
      throw error;
    }

    return () => {
      try {
        instance.owner.dispose();
      } finally {
        try { disposers.get(node)?.(); }
        finally { for (const child of nodes) child.remove(); }
      }
    };
  }


export { FACTORY, EACH, KEY, FRAGMENT, fragment, errorBoundary, Fragment, ErrorBoundary, Preserve, Each, ref, factory, isFactory, appendChild, createElement, component, debug, mount };
export type { Factory };
