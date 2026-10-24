import { Fragment, ErrorBoundary, Preserve, Each, fragment, errorBoundary, component, createElement, isFactory } from "./render";
import { resolve, computed } from "./signals";
import type { Key, ErrorBoundaryProps, HtmlTemplate, HtmlComponentRegistry } from "./types";

  // ---------- Template and JSX factories ----------

  function jsx(tag: string | ((props: Record<string, unknown>) => unknown), props: Record<string, unknown> | null = {}, jsxKey?: Key): ReturnType<typeof createElement> | ReturnType<typeof Each> {
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
  interface CachedTemplate {
    template: HTMLTemplateElement;
    attributeCases: Map<string, Map<string, { name: string; bare: boolean }>>;
    componentNames: Map<string, string>;
  }
  const templateCache = new WeakMap<TemplateStringsArray, CachedTemplate>();
  const builtinComponents = { Fragment, ErrorBoundary, Preserve, Each };

  function expandComponentTags(markup: string, attributeCases: CachedTemplate["attributeCases"], componentNames: Map<string, string>) {
    const componentTags = new Map<string, string>();
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
      if (markup[index] !== "<" || !/[A-Za-z]/.test(markup[index + (markup[index + 1] === "/" ? 2 : 1)] ?? "")) {
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

      let tag = markup.slice(index, end + 1);
      const tagMatch = /^<(\/?)([A-Za-z][\w:-]*)/.exec(tag);
      const closing = tagMatch?.[1] === "/";
      const sourceName = tagMatch?.[2];
      let name = sourceName;
      if (sourceName && /^[A-Z]/.test(sourceName)) {
        name = componentTags.get(sourceName);
        if (!name) {
          name = `treegger-component-${componentTags.size}`;
          while (markup.includes(name)) name += "-";
          componentTags.set(sourceName, name);
          componentNames.set(name, sourceName);
        }
        tag = tag.replace(sourceName, name);
      }
      const componentSlot = /^treegger-slot-(\d+)-end$/.exec(name ?? "");
      if (name && !closing) {
        const names = new Map<string, { name: string; bare: boolean }>();
        const attributes = /\s+([^\s=/>]+)(\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g;
        for (const match of tag.slice(name.length + 1).matchAll(attributes)) {
          names.set(match[1].toLowerCase(), { name: match[1], bare: match[2] === undefined });
        }
        if ([...names.values()].some(attribute => /[A-Z]/.test(attribute.name) || attribute.bare)) {
          // Keep the parser's native attributes and carry their source spelling as private metadata.
          let marker = `data-treegger-props-${attributeCases.size}`;
          while (markup.includes(marker)) marker += "-";
          attributeCases.set(marker, names);
          tag = tag.replace(/\/?>$/, ending => ` ${marker}=""${ending}`);
        }
      }
      if (!closing && (componentSlot || (name && componentNames.has(name))) && /\/\s*>$/.test(tag)) {
        result += tag.replace(/\/\s*>$/, ">") + `</${name}>`;
      } else {
        result += tag;
      }
      index = end + 1;
    }
    return result;
  }

  function renderTemplate(strings: TemplateStringsArray, values: unknown[], registry: HtmlComponentRegistry) {
    const marker = (index: number) => `treegger-slot-${index}-end`;
    const slots = /treegger-slot-(\d+)-end/g;
    let cached = templateCache.get(strings);
    if (!cached) {
      const template = document.createElement("template");
      const attributeCases: CachedTemplate["attributeCases"] = new Map();
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
      const componentNames = new Map<string, string>();
      const expanded = expandComponentTags(markup, attributeCases, componentNames);
      const rootTag = /^\s*<([a-z][\w:-]*)/i.exec(expanded)?.[1]?.toLowerCase();
      if (rootTag === "tr") {
        template.innerHTML = `<table><tbody>${expanded}</tbody></table>`;
        const row = template.content.querySelector("tr");
        if (row) template.content.replaceChildren(row);
      } else {
        template.innerHTML = expanded;
      }
      cached = { template, attributeCases, componentNames };
      templateCache.set(strings, cached);
    }
    const { template, attributeCases, componentNames } = cached;

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
      const attributes = Array.from((node as Element).attributes);
      const names = attributes.map(attribute => attributeCases.get(attribute.name)).find(Boolean);
      for (const attribute of attributes) {
        if (attributeCases.has(attribute.name)) continue;
        const original = names?.get(attribute.name.toLowerCase());
        const name = original?.name ?? attribute.name;
        const pieces = parts(attribute.value);
        props[name] = original?.bare ? true : pieces.length === 0
          ? ""
          : pieces.length === 1
          ? pieces[0]
          : computed(() => pieces.map(piece => String(resolve(piece) ?? "")).join(""));
      }

      const children: unknown[] = Array.from(node.childNodes).flatMap(convert);
      const element = node as Element;
      const componentSlot = /^treegger-slot-(\d+)-end$/.exec(element.localName);
      if (componentSlot && typeof values[Number(componentSlot[1])] !== "function") {
        throw new TypeError("html component tag must contain a function");
      }
      const registeredName = componentNames.get(element.localName);
      let tag: unknown = element.localName;
      if (registeredName) {
        tag = Object.hasOwn(registry, registeredName) ? registry[registeredName]
          : Object.hasOwn(builtinComponents, registeredName) ? builtinComponents[registeredName as keyof typeof builtinComponents] : undefined;
        if (typeof tag !== "function") {
          throw new Error(`Unknown html component "${registeredName}"; register it with html.with({ ${registeredName} }) or use <\${${registeredName}}>`);
        }
      } else if (componentSlot) tag = values[Number(componentSlot[1])];
      else if (element.localName === "fragment" || element.localName === "treegger-fragment") tag = Fragment;
      else if (element.localName === "errorboundary") tag = ErrorBoundary;
      else if (element.localName === "preserve") tag = Preserve;
      else if (element.localName === "each") tag = Each;

      return createElement(tag as string | ((props: Record<string, unknown>) => unknown), props, ...children);
    }

    const roots = Array.from(template.content.childNodes)
      .filter(node => node.nodeType !== Node.TEXT_NODE || node.textContent?.trim())
      .flatMap(convert);

    return roots.length === 1 && isFactory(roots[0]) ? roots[0] : fragment(...roots);
  }


  function createHtml(registry: HtmlComponentRegistry = {}): HtmlTemplate {
    return Object.assign(
      (strings: TemplateStringsArray, ...values: unknown[]) => renderTemplate(strings, values, registry),
      {
        with(components: HtmlComponentRegistry): HtmlTemplate {
          for (const [name, value] of Object.entries(components)) {
            if (!/^[A-Z]\w*$/.test(name) || typeof value !== "function") {
              throw new TypeError("html.with expects component functions with capitalized identifier names");
            }
          }
          return createHtml({ ...registry, ...components });
        }
      }
    );
  }

  const html = createHtml();


export { html, jsx, jsxs, jsxDEV };
