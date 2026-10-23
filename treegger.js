
/* =========================================
   TREEGGER — single-file reactive prototype
   ========================================= */

(() => {
  let activeEffect = null;
  let activeScope = null;

  const debug = { showRerenders: false };

  function flash(node) {
    if (!debug.showRerenders || !node) return;

    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!el || typeof el.animate !== "function") return;

    el.animate(
      [
        { backgroundColor: "rgba(255, 193, 7, 0.65)", boxShadow: "0 0 0 3px rgba(255, 193, 7, 0.9)" },
        { backgroundColor: "rgba(255, 193, 7, 0)", boxShadow: "0 0 0 3px rgba(255, 193, 7, 0)" }
      ],
      { duration: 600, easing: "ease-out" }
    );
  }

  const queue = new Set();
  let scheduled = false;

  // ---------- Scheduler ----------

  function schedule(job) {
    if (!job.active) return;

    queue.add(job);

    if (!scheduled) {
      scheduled = true;
      queueMicrotask(flush);
    }
  }

  function flush() {
    scheduled = false;

    const jobs = [...queue];
    queue.clear();

    for (const job of jobs) {
      if (job.active) job.run();
    }

    if (queue.size) {
      scheduled = true;
      queueMicrotask(flush);
    }
  }

  // ---------- Scopes ----------

  function scope(fn) {
    const parent = activeScope;

    const owner = {
      parent,
      children: new Set(),
      effects: new Set(),
      cleanups: new Set(),
      active: true,

      dispose() {
        if (!owner.active) return;
        owner.active = false;

        for (const child of [...owner.children]) {
          child.dispose();
        }

        for (const job of [...owner.effects]) {
          job.stop();
        }

        for (const cleanup of owner.cleanups) {
          cleanup();
        }

        owner.children.clear();
        owner.effects.clear();
        owner.cleanups.clear();
        parent?.children.delete(owner);
      }
    };

    parent?.children.add(owner);
    activeScope = owner;

    try {
      return { value: fn(), owner };
    } catch (error) {
      owner.dispose();
      throw error;
    } finally {
      activeScope = parent;
    }
  }

  function onUnmount(cleanup) {
    if (typeof cleanup !== "function") {
      throw new TypeError("onUnmount expects a function");
    }
    if (!activeScope || !activeScope.active) {
      throw new Error("onUnmount must be called inside a component or scope");
    }
    if (activeEffect) {
      throw new Error("Use an effect return value for cleanup on each rerun");
    }
    activeScope.cleanups.add(cleanup);
  }

  // ---------- Effects ----------

  function effect(fn, owner = activeScope, onRerender) {
    const job = {
      active: true,
      deps: new Set(),
      hasRun: false,
      cleanup: null,

      run() {
        if (!job.active) return;

        if (job.cleanup) {
          const cleanup = job.cleanup;
          job.cleanup = null;
          cleanup();
        }

        for (const dep of job.deps) {
          dep.delete(job);
        }

        job.deps.clear();

        const previousEffect = activeEffect;
        const previousScope = activeScope;

        activeEffect = job;
        activeScope = owner;

        try {
          const cleanup = fn();
          job.cleanup = typeof cleanup === "function" ? cleanup : null;
          if (job.hasRun) onRerender?.();
          job.hasRun = true;
        } finally {
          activeEffect = previousEffect;
          activeScope = previousScope;
        }
      },

      stop() {
        if (!job.active) return;

        job.active = false;
        queue.delete(job);

        for (const dep of job.deps) {
          dep.delete(job);
        }

        job.deps.clear();
        owner?.effects.delete(job);

        if (job.cleanup) {
          const cleanup = job.cleanup;
          job.cleanup = null;
          cleanup();
        }
      }
    };

    owner?.effects.add(job);
    job.run();

    return job;
  }

  // ---------- Signals ----------

  function signal(initial) {
    let value = initial;
    const subscribers = new Set();

    return {
      get value() {
        if (activeEffect) {
          subscribers.add(activeEffect);
          activeEffect.deps.add(subscribers);
        }

        return value;
      },

      set value(next) {
        if (Object.is(value, next)) return;

        value = next;

        for (const job of [...subscribers]) {
          schedule(job);
        }
      }
    };
  }

  // ---------- Element factories ----------

  const FACTORY = Symbol("treegger.factory");
  const EACH = Symbol("treegger.each");
  const KEY = Symbol("treegger.key");

  function each(source, render, { fallback = null } = {}) {
    if (typeof render !== "function") {
      throw new TypeError("each(source, render) expects a render function");
    }
    return { [EACH]: true, source, render, fallback };
  }

  function ref() {
    const reference = { element: null };
    Object.defineProperty(reference, "refCallback", {
      value(element, previous) {
        if (!previous || reference.element === previous) {
          reference.element = element;
        }
      }
    });
    return reference;
  }

  function factory(fn) {
    fn[FACTORY] = true;
    return fn;
  }

  function isFactory(value) {
    return typeof value === "function" && value[FACTORY];
  }

  function isSignal(value) {
    return value &&
      typeof value === "object" &&
      "value" in value;
  }

  function resolve(value) {
    if (isSignal(value)) return value.value;
    if (typeof value === "function") return value();
    return value;
  }

  function untrack(fn) {
    const previous = activeEffect;
    activeEffect = null;
    try {
      return fn();
    } finally {
      activeEffect = previous;
    }
  }

  // ---------- DOM helpers ----------

  function setProp(el, key, value) {
    if (key === "className") {
      el.className = value ?? "";
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
      el[key] = value ?? (key === "checked" ? false : "");
      return;
    }

    if (value == null || value === false) {
      el.removeAttribute(key);
    } else if (value === true) {
      el.setAttribute(key, "");
    } else {
      el.setAttribute(key, String(value));
    }
  }

  function appendChild(parent, child, owner) {
    if (child && child[EACH]) {
      appendList(parent, child, owner);
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

    if (typeof child === "function" || isSignal(child)) {
      const marker = document.createComment("treegger");
      parent.append(marker);
      let textNode = null;
      owner?.cleanups.add(() => textNode?.remove());

      effect(() => {
        const rendered = scope(() => {
          const value = resolve(child);
          if (value == null || typeof value === "boolean" ||
              typeof value === "string" || typeof value === "number" ||
              typeof value === "bigint") {
            return { text: value == null || typeof value === "boolean" ? "" : String(value) };
          }
          const fragment = document.createDocumentFragment();
          untrack(() => appendChild(fragment, value, activeScope));
          return { fragment, nodes: [...fragment.childNodes] };
        });

        if ("text" in rendered.value) {
          if (textNode) {
            textNode.data = rendered.value.text;
          } else {
            textNode = document.createTextNode(rendered.value.text);
            marker.parentNode.insertBefore(textNode, marker);
          }
          rendered.owner.dispose();
          return;
        }

        textNode?.remove();
        textNode = null;
        marker.parentNode.insertBefore(rendered.value.fragment, marker);

        return () => {
          rendered.owner.dispose();
          for (const node of rendered.value.nodes) node.remove();
        };
      }, owner, () => flash(marker.previousSibling || marker.parentElement));
      return;
    }

    if (child == null || typeof child === "boolean") {
      return;
    }

    parent.append(document.createTextNode(String(child)));
  }

  function appendList(parent, list, owner) {
    const marker = document.createComment("treegger-list");
    parent.append(marker);
    let records = new Map();
    let fallbackRecord = null;

    function disposeRecord(record) {
      record.owner.dispose();
      for (const node of record.nodes) node.remove();
    }

    owner?.cleanups.add(() => {
      for (const record of records.values()) disposeRecord(record);
      records.clear();
      if (fallbackRecord) disposeRecord(fallbackRecord);
      fallbackRecord = null;
    });

    effect(() => {
      const items = resolve(list.source) ?? [];
      if (!Array.isArray(items)) throw new TypeError("each source must resolve to an array");

      if (items.length === 0) {
        for (const record of records.values()) disposeRecord(record);
        records.clear();
        if (list.fallback != null && !fallbackRecord) {
          const rendered = scope(() => {
            const fragment = document.createDocumentFragment();
            untrack(() => appendChild(fragment, list.fallback, activeScope));
            return { fragment, nodes: [...fragment.childNodes] };
          });
          marker.parentNode.insertBefore(rendered.value.fragment, marker);
          fallbackRecord = { owner: rendered.owner, nodes: rendered.value.nodes };
        }
        return;
      }

      if (fallbackRecord) {
        disposeRecord(fallbackRecord);
        fallbackRecord = null;
      }

      const byItem = new Map([...records.values()].map(record => [record.item, record]));
      const next = new Map();
      const keys = [];

      try {
        for (const item of items) {
          let record = byItem.get(item);
          if (!record) {
            const rendered = scope(() => {
              const tree = untrack(() => list.render(item));
              if (!isFactory(tree) || tree[KEY] == null) {
                throw new Error("each items must return an element with a key prop");
              }
              const fragment = document.createDocumentFragment();
              untrack(() => appendChild(fragment, tree, activeScope));
              fragment.append(document.createComment("treegger-item"));
              return { key: tree[KEY], nodes: [...fragment.childNodes] };
            });
            record = {
              item,
              key: rendered.value.key,
              owner: rendered.owner,
              nodes: rendered.value.nodes
            };
          }

          if (next.has(record.key)) {
            if (!byItem.has(item)) disposeRecord(record);
            throw new Error("each keys must be unique");
          }
          next.set(record.key, record);
          keys.push(record.key);
        }
      } catch (error) {
        for (const record of next.values()) {
          if (records.get(record.key) !== record) disposeRecord(record);
        }
        throw error;
      }

      for (const [key, record] of records) {
        if (next.get(key) === record) continue;
        disposeRecord(record);
      }

      let before = marker;
      for (let index = keys.length - 1; index >= 0; index--) {
        const record = next.get(keys[index]);
        if (record.nodes.at(-1).nextSibling !== before) {
          const fragment = document.createDocumentFragment();
          for (const node of record.nodes) fragment.append(node);
          marker.parentNode.insertBefore(fragment, before);
        }
        before = record.nodes[0];
      }

      records = next;
    }, owner, () => flash(marker.parentElement));
  }

  // ---------- createElement ----------

  function createElement(tag, props = {}, ...children) {
    if (typeof tag === "function") {
      return component(tag, { ...props, children });
    }

    const owner = activeScope;

    // Возвращаем функцию, а не VDOM-объект.
    const tree = factory(() => {
      const instanceOwner = activeScope?.active ? activeScope : owner;
      const el = document.createElement(tag);

      // Один независимый эффект для props элемента.
      effect(() => {
        for (const [key, raw] of Object.entries(props)) {
          if (key.startsWith("on") || key === "ref" || key === "key") continue;
          setProp(el, key, resolve(raw));
        }
      }, instanceOwner, () => flash(el));

      if (props.ref != null) {
        const callback = typeof props.ref === "function"
          ? props.ref
          : props.ref.refCallback;
        if (typeof callback !== "function") {
          throw new TypeError("ref prop must be a callback or a Treegger ref");
        }
        callback(el);
        instanceOwner?.cleanups.add(() => callback(null, el));
      }

      // События не нужно переподписывать при обновлении.
      for (const [key, handler] of Object.entries(props)) {
        if (key.startsWith("on") && typeof handler === "function") {
          const event = key.slice(2).toLowerCase();
          el.addEventListener(event, handler);
          instanceOwner?.cleanups.add(() => el.removeEventListener(event, handler));
        }
      }

      for (const child of children) {
        appendChild(el, child, instanceOwner);
      }

      return el;
    });
    tree[KEY] = props.key;
    return tree;
  }

  // ---------- Template and JSX factories ----------

  function jsx(tag, props = {}, jsxKey) {
    const { children, key, ...attributes } = props ?? {};
    const content = children == null ? [] : Array.isArray(children) ? children : [children];
    const elementProps = { ...attributes, key: jsxKey ?? key };
    return typeof tag === "function"
      ? component(tag, { ...elementProps, children })
      : createElement(tag, elementProps, ...content);
  }

  const jsxs = jsx;
  const jsxDEV = jsx;

  function expandComponentTags(markup, values) {
    let result = "";
    for (let index = 0; index < markup.length;) {
      if (markup[index] !== "<" || !/[A-Za-z]/.test(markup[index + 1] ?? "")) {
        result += markup[index++];
        continue;
      }

      let end = index + 1;
      let quote = null;
      for (; end < markup.length; end++) {
        const char = markup[end];
        if (quote) {
          if (char === quote) quote = null;
        } else if (char === '"' || char === "'") {
          quote = char;
        } else if (char === ">") {
          break;
        }
      }

      const tag = markup.slice(index, end + 1);
      const name = /^<([A-Za-z][\w:-]*)/.exec(tag)?.[1];
      const componentSlot = /^treegger-slot-(\d+)-end$/.exec(name ?? "");
      if (name && /^[A-Z]/.test(name)) {
        throw new Error(`Use <\${${name}}> to pass a component to html`);
      }
      if (componentSlot && typeof values[Number(componentSlot[1])] !== "function") {
        throw new TypeError("html component tag must contain a function");
      }
      if (componentSlot && /\/\s*>$/.test(tag)) {
        result += tag.replace(/\/\s*>$/, ">") + `</${name}>`;
      } else {
        result += tag;
      }
      index = end + 1;
    }
    return result;
  }

  function html(strings, ...values) {
    const marker = index => `treegger-slot-${index}-end`;
    const slots = /treegger-slot-(\d+)-end/g;
    const template = document.createElement("template");
    const markup = strings.reduce(
      (result, part, index) => result + part + (index < values.length ? marker(index) : ""),
      ""
    );
    template.innerHTML = expandComponentTags(markup, values);

    function parts(source) {
      const result = [];
      let start = 0;
      for (const match of source.matchAll(slots)) {
        if (match.index > start) result.push(source.slice(start, match.index));
        result.push(values[Number(match[1])]);
        start = match.index + match[0].length;
      }
      if (start < source.length) result.push(source.slice(start));
      return result;
    }

    function convert(node) {
      if (node.nodeType === Node.TEXT_NODE) return parts(node.data);
      if (node.nodeType !== Node.ELEMENT_NODE) return [];

      const props = {};
      for (const attribute of node.attributes) {
        const pieces = parts(attribute.value);
        props[attribute.name] = pieces.length === 0
          ? ""
          : pieces.length === 1
          ? pieces[0]
          : () => pieces.map(piece => String(resolve(piece) ?? "")).join("");
      }

      const children = Array.from(node.childNodes).flatMap(convert);
      const componentSlot = /^treegger-slot-(\d+)-end$/.exec(node.localName);
      return componentSlot
        ? component(values[Number(componentSlot[1])], { ...props, children })
        : createElement(node.localName, props, ...children);
    }

    const roots = Array.from(template.content.childNodes)
      .filter(node => node.nodeType !== Node.TEXT_NODE || node.data.trim())
      .flatMap(convert);

    if (roots.length !== 1 || !isFactory(roots[0])) {
      throw new Error("html template must have one root element");
    }

    return roots[0];
  }

  // ---------- Components ----------

  function component(fn, props = {}) {
    const parent = activeScope;

    const tree = factory(() => {
      const previous = activeScope;
      activeScope = previous?.active ? previous : parent;

      try {
        const instance = scope(() => {
          // Функция компонента вызывается один раз.
          const { key, ...componentProps } = props;
          const tree = fn(componentProps);

          if (!isFactory(tree)) {
            throw new Error(
              "Component must return a Treegger element"
            );
          }

          return tree();
        });

        const node = instance.value;
        disposers.set(node, () => instance.owner.dispose());

        return node;
      } finally {
        activeScope = previous;
      }
    });
    tree[KEY] = props.key;
    return tree;
  }

  const disposers = new WeakMap();

  // ---------- Mount ----------

  function mount(tree, target) {
    const instance = scope(() => isFactory(tree) ? tree() : tree);
    const node = instance.value;

    target.append(node);

    return () => {
      instance.owner.dispose();
      disposers.get(node)?.();
      node.remove();
    };
  }

  // ---------- Public API ----------

  window.Treegger = {
    debug,
    ref,
    each,
    signal,
    effect,
    onUnmount,
    scope,
    createElement,
    html,
    jsx,
    jsxs,
    jsxDEV,
    component,
    mount
  };

})();
