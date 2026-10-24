  export type Cleanup = () => void;
  export interface Dependency extends Set<Job> {
    version: number;
    refresh?: () => void;
  }
  export interface Owner {
    parent: Owner | null;
    children: Set<Owner> | null;
    effects: Set<Job> | null;
    cleanups: Set<Cleanup> | null;
    active: boolean;
    debugUpdates: boolean;
    errorHandler?: (error: unknown) => boolean;
    dispose(): void;
  }
  export interface Job {
    active: boolean;
    owner?: Owner | null;
    deps: Map<Dependency, number>;
    notify?: () => void;
    run?: () => void;
    stop(): void;
  }
  let activeEffect: Job | null = null;
  let activeScope: Owner | null = null;

  function trackDependency(dependency: Dependency) {
    if (!activeEffect) return;
    dependency.add(activeEffect);
    activeEffect.deps.set(dependency, dependency.version);
  }

  function dependenciesChanged(job: Job) {
    for (const [dependency, version] of job.deps) {
      dependency.refresh?.();
      if (dependency.version !== version) return true;
    }
    return false;
  }

  function handleError(error: unknown, owner: Owner | null | undefined) {
    let currentError = error;
    for (let current = owner; current; current = current.parent) {
      if (!current.active || !current.errorHandler) continue;
      try {
        if (current.errorHandler(currentError)) return true;
      } catch (nextError) {
        currentError = nextError;
      }
    }
    if (currentError !== error) throw currentError;
    return false;
  }

  function flash(node: Node | null, owner: Owner | null) {
    if (!owner?.debugUpdates || !node) return;

    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node as Element;
    if (!el || typeof el.animate !== "function") return;

    el.animate(
      [
        { backgroundColor: "rgba(255, 193, 7, 0.65)", boxShadow: "0 0 0 3px rgba(255, 193, 7, 0.9)" },
        { backgroundColor: "rgba(255, 193, 7, 0)", boxShadow: "0 0 0 3px rgba(255, 193, 7, 0)" }
      ],
      { duration: 600, easing: "ease-out" }
    );
  }

  const queue = new Set<Job>();
  let scheduled = false;

  // ---------- Scheduler ----------

  function schedule(job: Job) {
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

    const errors = [];

    for (const job of jobs) {
      if (job.active) {
        try { job.run?.(); }
        catch (error) {
          try {
            if (!handleError(error, job.owner)) errors.push(error);
          } catch (boundaryError) {
            errors.push(boundaryError);
          }
        }
      }
    }

    if (queue.size && !scheduled) {
      scheduled = true;
      queueMicrotask(flush);
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, "Treegger effects failed");
  }

  // ---------- Scopes ----------

  function scope<T>(fn: () => T, register = true) {
    const parent = activeScope;

    const owner: Owner = {
      parent,
      children: null,
      effects: null,
      cleanups: null,
      active: true,
      debugUpdates: parent?.debugUpdates ?? false,

      dispose() {
        if (!owner.active) return;
        owner.active = false;

        const errors = [];
        if (owner.children) for (const child of [...owner.children]) {
          try { child.dispose(); } catch (error) { errors.push(error); }
        }
        if (owner.effects) for (const job of [...owner.effects]) {
          try { job.stop(); } catch (error) { errors.push(error); }
        }
        if (owner.cleanups) for (const cleanup of owner.cleanups) {
          try { cleanup(); } catch (error) { errors.push(error); }
        }

        owner.children?.clear();
        owner.effects?.clear();
        owner.cleanups?.clear();
        parent?.children?.delete(owner);
        if (errors.length === 1) throw errors[0];
        if (errors.length > 1) throw new AggregateError(errors, "Treegger cleanup failed");
      }
    };

    if (register && parent) (parent.children ??= new Set<Owner>()).add(owner);
    activeScope = owner;

    try {
      return { value: fn(), owner };
    } catch (error) {
      try { owner.dispose(); }
      catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "Treegger scope failed during cleanup");
      }
      throw error;
    } finally {
      activeScope = parent;
    }
  }

  function addCleanup(owner: Owner | null | undefined, cleanup: Cleanup) {
    if (owner) (owner.cleanups ??= new Set()).add(cleanup);
  }

  function onUnmount(cleanup: Cleanup) {
    if (typeof cleanup !== "function") {
      throw new TypeError("onUnmount expects a function");
    }
    if (!activeScope || !activeScope.active) {
      throw new Error("onUnmount must be called inside a component or scope");
    }
    if (activeEffect) {
      throw new Error("Use an effect return value for cleanup on each rerun");
    }
    addCleanup(activeScope, cleanup);
  }

  // ---------- Effects ----------

  function effect(fn: () => void | Cleanup, owner: Owner | null = activeScope, onRerender?: () => void) {
    const job: Job & { hasRun: boolean; cleanup: Cleanup | null } = {
      active: true,
      owner,
      deps: new Map<Dependency, number>(),
      hasRun: false,
      cleanup: null,

      run() {
        if (!job.active) return;

        if (job.hasRun) {
          try {
            // Resolve lazy computations before disposing an unchanged consumer's branch or cleanup.
            if (!dependenciesChanged(job)) return;
          } catch (error) {
            job.stop();
            throw error;
          }
        }

        for (const dep of job.deps.keys()) {
          dep.delete(job);
        }

        job.deps.clear();

        if (job.cleanup) {
          const cleanup = job.cleanup;
          job.cleanup = null;
          try { cleanup(); } catch (error) { job.stop(); throw error; }
        }

        const previousEffect = activeEffect;
        const previousScope = activeScope;

        activeEffect = job;
        activeScope = owner;

        try {
          const cleanup = fn();
          job.cleanup = typeof cleanup === "function" ? cleanup : null;
          if (job.hasRun) onRerender?.();
          job.hasRun = true;
        } catch (error) {
          job.stop();
          throw error;
        } finally {
          activeEffect = previousEffect;
          activeScope = previousScope;
        }
      },

      stop() {
        if (!job.active) return;

        job.active = false;
        queue.delete(job);

        for (const dep of job.deps.keys()) {
          dep.delete(job);
        }

        job.deps.clear();
        owner?.effects?.delete(job);

        if (job.cleanup) {
          const cleanup = job.cleanup;
          job.cleanup = null;
          cleanup();
        }
      }
    };

    if (owner) (owner.effects ??= new Set<Job>()).add(job);
    job.run?.();

    return job;
  }

  function untrack<T>(fn: () => T): T {
    const previous = activeEffect;
    activeEffect = null;
    try {
      return fn();
    } finally {
      activeEffect = previous;
    }
  }


  function setActiveEffect(value: Job | null) { activeEffect = value; }
  function setActiveScope(value: Owner | null) { activeScope = value; }

export { activeEffect, activeScope, setActiveEffect, setActiveScope, trackDependency, dependenciesChanged, handleError, flash, schedule, scope, addCleanup, onUnmount, effect, untrack };
