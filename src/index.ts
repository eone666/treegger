import { effect as runEffect, onUnmount, scope as runScope } from "./core";
import { signal as createSignal, store as createStore, computed as createComputed } from "./signals";
import {
  ref as createRef, Each as each, createElement as element,
  Fragment, ErrorBoundary, Preserve as preserve, component as makeComponent, debug as wrapDebug, mount as mountTree
} from "./render";
import { html as template, jsx as createJsx, jsxs, jsxDEV } from "./template";
import type {
  Signal, Computed, WritableComputed, Store, EffectHandle, ScopeHandle,
  DomRef, Child, Tree, ListTree, DebugTree, DebugOptions, Component, ElementProps, Key, EachProps, PreserveProps
} from "./types";

export type * from "./types";
export { onUnmount, Fragment, ErrorBoundary, jsxs, jsxDEV };
export const Preserve = preserve as (props: PreserveProps) => Tree;

export const signal = createSignal as <T>(initial: T) => Signal<T>;
export function computed<T>(get: () => T): Computed<T>;
export function computed<T>(options: { get: () => T; set: (next: T) => void }): WritableComputed<T>;
export function computed<T>(options: (() => T) | { get: () => T; set: (next: T) => void }): Computed<T> | WritableComputed<T> {
  return typeof options === "function" ? createComputed(options) : createComputed(options);
}
export const store = createStore as <T extends object>(initial: T) => Store<T>;
export const effect = runEffect as (run: () => void | (() => void)) => EffectHandle;
export const scope = runScope as <T>(run: () => T) => { value: T; owner: ScopeHandle };
export const ref = createRef as <E extends Element = HTMLElement>() => DomRef<E>;
export const Each = each as <T>(props: EachProps<T>) => ListTree;
export function createElement<T>(tag: typeof Each, props: Omit<EachProps<T>, "children">, render: (item: T) => Tree | ListTree): ListTree;
export function createElement<K extends keyof HTMLElementTagNameMap>(tag: K, props?: ElementProps<HTMLElementTagNameMap[K]> | null, ...children: Child[]): Tree;
export function createElement<K extends keyof SVGElementTagNameMap>(tag: K, props?: ElementProps<SVGElementTagNameMap[K]> | null, ...children: Child[]): Tree;
export function createElement<P>(tag: Component<P>, props: P, ...children: Child[]): Tree;
export function createElement(tag: string, props?: ElementProps | null, ...children: Child[]): Tree;
export function createElement(tag: unknown, props?: object | null, ...children: unknown[]): Tree | ListTree {
  return element(tag as string, props as Record<string, unknown> | null, ...children) as Tree | ListTree;
}
export const component = makeComponent as <P>(fn: Component<P>, props: P) => Tree;
export const debug = wrapDebug as (tree: Tree | ListTree | Node, options?: DebugOptions) => DebugTree;
export const html = template as (strings: TemplateStringsArray, ...values: unknown[]) => Tree;
export const jsx = createJsx as (tag: string | Component<Record<string, unknown>>, props: Record<string, unknown> | null, key?: Key) => Tree | ListTree;
export const mount = mountTree as (tree: Tree | ListTree | Node | DebugTree, target: Node) => () => void;
