export { jsx, jsxs, Fragment } from "./index";
import type { ElementProps, Key, TreeggerElement, TreeggerNode } from "./types";

export namespace JSX {
  export type Element = TreeggerElement;
  export type ElementType = keyof IntrinsicElements | ((props: never) => TreeggerNode);
  export interface IntrinsicAttributes { key?: Key }
  export interface ElementChildrenAttribute { children: unknown }
  export type IntrinsicElements = {
    [K in keyof HTMLElementTagNameMap]: ElementProps<HTMLElementTagNameMap[K]>;
  } & {
    [K in keyof SVGElementTagNameMap]: ElementProps<SVGElementTagNameMap[K]>;
  };
}
