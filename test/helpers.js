import assert from 'node:assert/strict';
import * as Treegger from '../src/index.ts';

// A small DOM double for isolated bookkeeping checks; dom.test.js covers standard DOM behavior.
class MockNode {
  static TEXT_NODE = 3;
  static ELEMENT_NODE = 1;
  static DOCUMENT_FRAGMENT_NODE = 11;

  constructor(type, name = '', data = '') {
    this.nodeType = type;
    this.name = name;
    this.localName = name;
    this.namespaceURI = type === 1 ? 'http://www.w3.org/1999/xhtml' : null;
    this.data = data;
    this.childNodes = [];
    this.parentNode = null;
    this.style = {};
    this.listeners = new Map();
    this.attributes = new Map();
  }

  get parentElement() {
    return this.parentNode?.nodeType === 1 ? this.parentNode : null;
  }

  get firstChild() { return this.childNodes[0] ?? null; }
  get lastChild() { return this.childNodes.at(-1) ?? null; }

  get previousSibling() {
    return this.parentNode?.childNodes[this.parentNode.childNodes.indexOf(this) - 1] ?? null;
  }

  get nextSibling() {
    return this.parentNode?.childNodes[this.parentNode.childNodes.indexOf(this) + 1] ?? null;
  }

  append(...nodes) {
    for (const node of nodes) this.insertBefore(node, null);
  }

  insertBefore(node, before) {
    if (node.nodeType === 11) {
      for (const child of [...node.childNodes]) this.insertBefore(child, before);
      return;
    }
    node.remove();
    const index = before ? this.childNodes.indexOf(before) : this.childNodes.length;
    assert.notEqual(index, -1);
    this.childNodes.splice(index, 0, node);
    node.parentNode = this;
  }

  remove() {
    if (!this.parentNode) return;
    const siblings = this.parentNode.childNodes;
    siblings.splice(siblings.indexOf(this), 1);
    this.parentNode = null;
  }

  addEventListener(event, handler) {
    this.listeners.set(event, handler);
  }

  removeEventListener(event, handler) {
    if (this.listeners.get(event) === handler) this.listeners.delete(event);
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
}

export function setup() {
  const document = {
    createElement: tag => new MockNode(1, tag),
    createElementNS: (namespace, tag) => Object.assign(new MockNode(1, tag), { namespaceURI: namespace }),
    createTextNode: data => new MockNode(3, '', data),
    createComment: data => new MockNode(8, '', data),
    createDocumentFragment: () => new MockNode(11)
  };
  globalThis.document = document;
  globalThis.Node = MockNode;
  return { ...Treegger, document };
}

export const nextFlush = () => new Promise(resolve => setImmediate(resolve));

export function textContent(node) {
  return node.nodeType === 3 ? node.data : Array.from(node.childNodes, textContent).join('');
}

const mounts = new Set();

export function mountInDocument(tree) {
  const target = document.body.appendChild(document.createElement('div'));
  let dispose;
  try { dispose = Treegger.mount(tree, target); }
  catch (error) { target.remove(); throw error; }
  const unmount = () => {
    if (!mounts.delete(unmount)) return;
    try { dispose(); }
    finally { target.remove(); }
  };
  mounts.add(unmount);
  return { target, unmount };
}

export function cleanupDocument() {
  try { for (const unmount of [...mounts]) unmount(); }
  finally { document.body.replaceChildren(); }
}

export function queryTexts(parent, selector) {
  return Array.from(parent.querySelectorAll(selector), element => element.textContent);
}
