import { Fragment, ErrorBoundary, Preserve, Each, EACH, fragment, errorBoundary, component, createElement, isFactory } from "./render";
import { resolve } from "./signals";
import type { Key, ErrorBoundaryProps } from "./types";

  // ---------- Template and JSX factories ----------

  function jsx(tag: string | ((props: Record<string, unknown>) => unknown), props: Record<string, unknown> | null = {}, jsxKey?: Key) {
    const { children, key, ...attributes } = props ?? {};
    const content = children == null ? [] : Array.isArray(children) ? children : [children];
    const elementProps = { ...attributes, key: jsxKey ?? key };
    return tag === Fragment
      ? fragment(...content)
      : tag === ErrorBoundary
      ? errorBoundary(content, attributes.fallback as ErrorBoundaryProps["fallback"])
      : tag === Preserve
      ? Preserve({ when: attributes.when, children: content })
      : tag === Each
      ? Each({ ...attributes, children })
      : typeof tag === "function"
      ? component(tag, { ...elementProps, children })
      : createElement(tag, elementProps, ...content);
  }

  const jsxs = jsx;
  const jsxDEV = jsx;
  const templateCache = new WeakMap<TemplateStringsArray, HTMLTemplateElement>();

  function expandComponentTags(markup: string) {
    let result = "";
    for (let index = 0; index < markup.length;) {
      if (markup.startsWith("<>", index)) {
        result += "<treegger-fragment>";
        index += 2;
        continue;
      }
      if (markup.startsWith("</>", index)) {
        result += "</treegger-fragment>";
        index += 3;
        continue;
      }
      if (markup[index] !== "<" || !/[A-Za-z]/.test(markup[index + 1] ?? "")) {
        result += markup[index++];
        continue;
      }

      let end = index + 1;
      let quote: string | null = null;
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
      if (name && name !== "Fragment" && name !== "ErrorBoundary" && name !== "Preserve" && name !== "Each" && /^[A-Z]/.test(name)) {
        throw new Error(`Use <\${${name}}> to pass a component to html`);
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

  function html(strings: TemplateStringsArray, ...values: unknown[]) {
    const marker = (index: number) => `treegger-slot-${index}-end`;
    const slots = /treegger-slot-(\d+)-end/g;
    let template = templateCache.get(strings);
    if (!template) {
      template = document.createElement("template");
      let inTag = false;
      let quote: string | null = null;
      const markup = strings.reduce((result, part, index) => {
        for (const char of part) {
          if (quote) {
            if (char === quote) quote = null;
          } else if (inTag && (char === '"' || char === "'")) {
            quote = char;
          } else if (char === "<") {
            inTag = true;
          } else if (char === ">") {
            inTag = false;
          }
        }
        return result + part + (index < values.length
          ? inTag ? marker(index) : `<!--${marker(index)}-->`
          : "");
      }, "");
      const expanded = expandComponentTags(markup);
      const rootTag = /^\s*<([a-z][\w:-]*)/i.exec(expanded)?.[1]?.toLowerCase();
      if (rootTag === "tr") {
        template.innerHTML = `<table><tbody>${expanded}</tbody></table>`;
        const row = template.content.querySelector("tr");
        if (row) template.content.replaceChildren(row);
      } else {
        template.innerHTML = expanded;
      }
      templateCache.set(strings, template);
    }

    function parts(source: string) {
      const result: unknown[] = [];
      let start = 0;
      for (const match of source.matchAll(slots)) {
        if (match.index > start) result.push(source.slice(start, match.index));
        result.push(values[Number(match[1])]);
        start = match.index + match[0].length;
      }
      if (start < source.length) result.push(source.slice(start));
      return result;
    }

    function convert(node: Node): unknown | unknown[] {
      if (node.nodeType === Node.TEXT_NODE) return parts(node.textContent ?? "");
      if (node.nodeType === Node.COMMENT_NODE) {
        const slot = /^treegger-slot-(\d+)-end$/.exec(node.textContent ?? "");
        return slot ? [values[Number(slot[1])]] : [];
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return [];

      const props: Record<string, unknown> = {};
      for (const attribute of (node as Element).attributes) {
        const pieces = parts(attribute.value);
        props[attribute.name] = pieces.length === 0
          ? ""
          : pieces.length === 1
          ? pieces[0]
          : () => pieces.map(piece => String(resolve(piece) ?? "")).join("");
      }

      const children: unknown[] = Array.from(node.childNodes).flatMap(convert);
      const element = node as Element;
      const componentSlot = /^treegger-slot-(\d+)-end$/.exec(element.localName);
      if (componentSlot && typeof values[Number(componentSlot[1])] !== "function") {
        throw new TypeError("html component tag must contain a function");
      }
      return element.localName === "fragment" || element.localName === "treegger-fragment"
        ? fragment(...children)
        : element.localName === "errorboundary" || (componentSlot && values[Number(componentSlot[1])] === ErrorBoundary)
        ? errorBoundary(children, props.fallback as ErrorBoundaryProps["fallback"])
        : element.localName === "preserve" || (componentSlot && values[Number(componentSlot[1])] === Preserve)
        ? Preserve({ when: props.when, children })
        : element.localName === "each" || (componentSlot && values[Number(componentSlot[1])] === Each)
        ? Each({ ...props, children })
        : componentSlot
        ? component(values[Number(componentSlot[1])] as (props: Record<string, unknown>) => unknown, { ...props, children })
        : createElement(element.localName, props, ...children);
    }

    const roots = Array.from(template.content.childNodes)
      .filter(node => node.nodeType !== Node.TEXT_NODE || node.textContent?.trim())
      .flatMap(convert);

    return roots.length === 1 && isFactory(roots[0]) ? roots[0] : fragment(...roots);
  }


export { html, jsx, jsxs, jsxDEV };
