export const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
export const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
export let activeNamespace = HTML_NAMESPACE;

// HTML template parsing lowercases standalone SVG fragments. Restore SVG's case-sensitive names.
export const svgTagNames = new Map([
  "altGlyph", "altGlyphDef", "altGlyphItem", "animateColor", "animateMotion", "animateTransform", "clipPath",
  "feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix", "feDiffuseLighting",
  "feDisplacementMap", "feDistantLight", "feDropShadow", "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR",
  "feGaussianBlur", "feImage", "feMerge", "feMergeNode", "feMorphology", "feOffset", "fePointLight",
  "feSpecularLighting", "feSpotLight", "feTile", "feTurbulence", "foreignObject", "glyphRef", "linearGradient",
  "radialGradient", "textPath"
].map(name => [name.toLowerCase(), name]));

export const svgAttributeNames = new Map([
  "attributeName", "attributeType", "baseFrequency", "baseProfile", "calcMode", "clipPathUnits", "diffuseConstant",
  "edgeMode", "filterUnits", "glyphRef", "gradientTransform", "gradientUnits", "kernelMatrix", "kernelUnitLength",
  "keyPoints", "keySplines", "keyTimes", "lengthAdjust", "limitingConeAngle", "markerHeight", "markerUnits",
  "markerWidth", "maskContentUnits", "maskUnits", "numOctaves", "pathLength", "patternContentUnits",
  "patternTransform", "patternUnits", "pointsAtX", "pointsAtY", "pointsAtZ", "preserveAlpha", "preserveAspectRatio",
  "primitiveUnits", "refX", "refY", "repeatCount", "repeatDur", "requiredExtensions", "requiredFeatures",
  "specularConstant", "specularExponent", "spreadMethod", "startOffset", "stdDeviation", "stitchTiles",
  "surfaceScale", "systemLanguage", "tableValues", "targetX", "targetY", "textLength", "viewBox", "viewTarget",
  "xChannelSelector", "yChannelSelector", "zoomAndPan"
].map(name => [name.toLowerCase(), name]));

export function withNamespace<T>(namespace: string, run: () => T): T {
  const previous = activeNamespace;
  activeNamespace = namespace;
  try { return run(); }
  finally { activeNamespace = previous; }
}

export function childNamespace(parent: Node): string {
  if (parent.nodeType !== Node.ELEMENT_NODE) return HTML_NAMESPACE;
  const element = parent as Element;
  return element.namespaceURI === SVG_NAMESPACE && element.localName !== "foreignObject"
    ? SVG_NAMESPACE : HTML_NAMESPACE;
}

export interface NodeRange {
  first: ChildNode;
  last: ChildNode;
}

export function moveRange(range: NodeRange, parent: Node & ParentNode, before: ChildNode | null) {
  if (range.first === before || (range.first.parentNode === parent && range.last.nextSibling === before)) return;
  let node: ChildNode | null = range.first;
  while (node) {
    const next: ChildNode | null = node.nextSibling;
    parent.insertBefore(node, before);
    if (node === range.last) break;
    node = next;
  }
}

export function removeRange(range: NodeRange) {
  let node: ChildNode | null = range.first;
  while (node) {
    const next: ChildNode | null = node.nextSibling;
    node.remove();
    if (node === range.last) break;
    node = next;
  }
}

export function nodeRange(node: Node): NodeRange {
  if (node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
    return { first: node as ChildNode, last: node as ChildNode };
  }
  const fragment = node as DocumentFragment;
  const first = document.createComment("treegger-range-start");
  const last = document.createComment("treegger-range-end");
  fragment.insertBefore(first, fragment.firstChild);
  fragment.append(last);
  return { first, last };
}
