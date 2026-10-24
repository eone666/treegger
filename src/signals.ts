import { activeEffect, activeScope, schedule, setActiveEffect, type Job, type Dependency } from "./core";
import { writableComputedBrand } from "./types";
import type { Computed, WritableComputed } from "./types";

  // ---------- Signals ----------

  const SIGNAL = Symbol("treegger.signal");
  const COMPUTED = Symbol("treegger.computed");
  const DOM_REF = Symbol("treegger.dom-ref");

  function warnReadonlyComputed() {
    console.warn("Cannot assign to a read-only computed value");
  }

  function signal<T>(initial: T) {
    let value = initial;
    const subscribers: Dependency = new Set();

    return {
      [SIGNAL]: true,
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
          if (job.notify) job.notify();
          else schedule(job);
        }
      }
    };
  }

  function store<T extends object>(initial: T) {
    const arrayIndex = (target: unknown, key: PropertyKey) => Array.isArray(target) && typeof key === "string" &&
      /^(0|[1-9]\d*)$/.test(key) && Number(key) < 2 ** 32 - 1;
    const isObject = (value: unknown): value is Record<PropertyKey, unknown> => value !== null && typeof value === "object" &&
      (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
    if (!isObject(initial)) throw new TypeError("store expects a plain object or array");

    const proxies = new WeakMap<object, Record<PropertyKey, unknown>>();
    const targets = new WeakMap<object, object>();
    const unwrap = (value: object) => targets.get(value) ?? value;

    function wrap(target: Record<PropertyKey, unknown>): Record<PropertyKey, unknown> {
      if (isSignal(target) || target?.[DOM_REF]) return target;
      if (!isObject(target)) return target;
      const existing = proxies.get(target);
      if (existing) return existing;

      const properties = new Map<PropertyKey, ReturnType<typeof signal<unknown>>>();
      const membership = new Map<PropertyKey, ReturnType<typeof signal<boolean>>>();
      const keys = signal(0);
      const property = (key: PropertyKey) => {
        if (!properties.has(key)) properties.set(key, signal(Reflect.get(target, key)));
        return properties.get(key)!;
      };
      const notify = (key: PropertyKey) => {
        if (properties.has(key)) properties.get(key)!.value = Reflect.get(target, key);
        if (membership.has(key)) membership.get(key)!.value = Reflect.has(target, key);
      };

      const proxy = new Proxy(target, {
        get(object, key, receiver) {
          if (!Object.hasOwn(object, key) && Reflect.has(object, key)) {
            return Reflect.get(object, key, receiver);
          }
          const value = property(key).value;
          return isSignal(value) && !arrayIndex(object, key) ? value.value : isObject(value) ? wrap(value) : value;
        },
        set(object, key, value) {
          const previous = Object.hasOwn(object, key) ? Reflect.get(object, key) : undefined;
          if (isSignal(previous) && !isSignal(value) && !arrayIndex(object, key)) {
            previous.value = value;
            return true;
          }
          const hadKey = Object.hasOwn(object, key);
          const oldLength = Array.isArray(object) ? object.length : 0;
          const success = Reflect.set(object, key, value && typeof value === "object" ? unwrap(value) : value);
          if (!success) return false;

          notify(key);
          if (!hadKey || (Array.isArray(object) && object.length !== oldLength)) keys.value++;
          if (Array.isArray(object) && object.length !== oldLength) {
            notify("length");
            if (object.length < oldLength) {
              for (const index of properties.keys()) {
                if (typeof index === "string" && Number.isInteger(Number(index)) && Number(index) >= object.length) notify(index);
              }
              for (const index of membership.keys()) {
                if (typeof index === "string" && Number.isInteger(Number(index)) && Number(index) >= object.length) notify(index);
              }
            }
          }
          return true;
        },
        deleteProperty(object, key) {
          const hadKey = Object.hasOwn(object, key);
          const success = Reflect.deleteProperty(object, key);
          if (success && hadKey) {
            notify(key);
            keys.value++;
          }
          return success;
        },
        has(object, key) {
          if (!membership.has(key)) membership.set(key, signal(Reflect.has(object, key)));
          return membership.get(key)!.value;
        },
        ownKeys(object) {
          keys.value;
          return Reflect.ownKeys(object);
        }
      });

      proxies.set(target, proxy);
      targets.set(proxy, target);
      return proxy;
    }

    return wrap(initial);
  }

  function computed<T>(calculate: () => T): Computed<T>;
  function computed<T>(calculate: { get: () => T; set: (next: T) => void }): WritableComputed<T>;
  function computed<T>(calculate: (() => T) | { get: () => T; set?: (next: T) => void }): Computed<T> | WritableComputed<T> {
    const getter = typeof calculate === "function" ? calculate : calculate?.get;
    const setter = typeof calculate === "function" ? null : calculate?.set;
    if (typeof getter !== "function" || (setter != null && typeof setter !== "function")) {
      throw new TypeError("computed expects a function or an object with get and optional set functions");
    }
    let value!: T;
    let dirty = true;
    let calculating = false;
    const subscribers: Dependency = new Set();
    const owner = activeScope;
    const job: Job = {
      active: true,
      deps: new Set<Dependency>(),
      notify() {
        if (dirty || !job.active) return;
        dirty = true;
        for (const subscriber of [...subscribers]) {
          if (subscriber.notify) subscriber.notify();
          else schedule(subscriber);
        }
      },
      stop() {
        if (!job.active) return;
        job.active = false;
        for (const dep of job.deps) dep.delete(job);
        job.deps.clear();
        owner?.effects?.delete(job);
        subscribers.clear();
      }
    };
    if (owner) (owner.effects ??= new Set()).add(job);

    const result = {
      [SIGNAL]: true,
      [COMPUTED]: true,
      get value() {
        if (calculating) throw new Error("computed cannot depend on itself");
        if (activeEffect && activeEffect !== job) {
          subscribers.add(activeEffect);
          activeEffect.deps.add(subscribers);
        }
        if (dirty) {
          for (const dep of job.deps) dep.delete(job);
          job.deps.clear();
          const previousEffect = activeEffect;
          setActiveEffect(job);
          calculating = true;
          try {
            value = getter();
            dirty = false;
          } finally {
            calculating = false;
            setActiveEffect(previousEffect);
          }
        }
        return value;
      },
      set value(next) {
        if (setter) setter(next);
        else warnReadonlyComputed();
      },
      dispose: () => job.stop()
    };
    return setter ? Object.assign(result, { [writableComputedBrand]: true as const }) : result;
  }

  function isSignal(value: unknown): value is { value: unknown } {
    return value != null && typeof value === "object" && SIGNAL in value && value[SIGNAL] === true;
  }

  function resolve(value: unknown): unknown {
    if (isSignal(value)) return value.value;
    if (typeof value === "function") return value();
    return value;
  }


export { SIGNAL, DOM_REF, signal, store, computed, isSignal, resolve };
