
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
    } finally {
      activeScope = parent;
    }
  }

  // ---------- Effects ----------

  function effect(fn, owner = activeScope, onRerender) {
    const job = {
      active: true,
      deps: new Set(),
      hasRun: false,

      run() {
        if (!job.active) return;

        for (const dep of job.deps) {
          dep.delete(job);
        }

        job.deps.clear();

        const previousEffect = activeEffect;
        const previousScope = activeScope;

        activeEffect = job;
        activeScope = owner;

        try {
          fn();
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
      const text = document.createTextNode("");

      effect(() => {
        text.data = String(resolve(child) ?? "");
      }, owner, () => flash(text));

      parent.append(text);
      return;
    }

    if (child == null || typeof child === "boolean") {
      return;
    }

    parent.append(document.createTextNode(String(child)));
  }

  // ---------- createElement ----------

  function createElement(tag, props = {}, ...children) {
    if (typeof tag === "function") {
      return component(tag, { ...props, children });
    }

    const owner = activeScope;

    // Возвращаем функцию, а не VDOM-объект.
    return factory(() => {
      const instanceOwner = owner?.active ? owner : activeScope;
      const el = document.createElement(tag);

      // Один независимый эффект для props элемента.
      effect(() => {
        for (const [key, raw] of Object.entries(props)) {
          if (key.startsWith("on") || key === "ref") continue;
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
          el.addEventListener(
            key.slice(2).toLowerCase(),
            handler
          );
        }
      }

      for (const child of children) {
        appendChild(el, child, instanceOwner);
      }

      return el;
    });
  }

  // ---------- Template and JSX factories ----------

  function jsx(tag, props = {}) {
    const { children, key, ...attributes } = props ?? {};
    const content = children == null ? [] : Array.isArray(children) ? children : [children];
    return typeof tag === "function"
      ? component(tag, { ...attributes, children })
      : createElement(tag, attributes, ...content);
  }

  const jsxs = jsx;
  const jsxDEV = jsx;

  function html(strings, ...values) {
    const marker = index => `treegger-slot-${index}-end`;
    const slots = /treegger-slot-(\d+)-end/g;
    const template = document.createElement("template");
    template.innerHTML = strings.reduce(
      (result, part, index) => result + part + (index < values.length ? marker(index) : ""),
      ""
    );

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

      return createElement(
        node.localName,
        props,
        ...Array.from(node.childNodes).flatMap(convert)
      );
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

    return factory(() => {
      const previous = activeScope;
      activeScope = parent?.active ? parent : previous;

      try {
        const instance = scope(() => {
          // Функция компонента вызывается один раз.
          const tree = fn(props);

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
    signal,
    effect,
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
