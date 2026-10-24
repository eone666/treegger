import { activeScope, scope, effect, flash, addCleanup, untrack } from "./core";
import { resolve } from "./signals";
import { appendChild, isFactory, KEY, FRAGMENT } from "./render";
import type { Owner } from "./core";
import type { Key } from "./types";
import { activeNamespace, withNamespace, nodeRange, moveRange, removeRange, type NodeRange } from "./dom";

interface ListRecord extends NodeRange {
  item: unknown;
  key: Key;
  owner: Owner;
}
interface FallbackRecord extends NodeRange { owner: Owner }
interface ListDescriptor {
  source: unknown;
  render: (item: unknown) => unknown;
  fallback: unknown;
}

  function appendList(parent: Node & ParentNode, list: ListDescriptor, owner: Owner | null) {
    const namespace = activeNamespace;
    const marker = document.createComment("treegger-list");
    parent.append(marker);
    let records = new Map<Key, ListRecord>();
    let recordsByItem = new Map<unknown, ListRecord>();
    let orderedRecords: ListRecord[] = [];
    let fallbackRecord: FallbackRecord | null = null;

    function createRecord(item: unknown): ListRecord {
      const rendered = withNamespace(namespace, () => scope(() => untrack(() => {
        const tree = list.render(item);
        if (!isFactory(tree) || tree[KEY] == null || tree[FRAGMENT]) {
          throw new Error("each items must return an element with a key prop");
        }
        return { key: tree[KEY]!, range: nodeRange(tree()) };
      }), false));
      return {
        item,
        key: rendered.value.key,
        owner: rendered.owner,
        ...rendered.value.range
      };
    }

    function disposeRecord(record: ListRecord | FallbackRecord, removeNode = true) {
      try { record.owner.dispose(); }
      finally { if (removeNode) removeRange(record); }
    }

    function clearRecords() {
      if (records.size === 0) return;
      const first = orderedRecords[0].first;
      const parentNode = marker.parentNode;
      const canReplaceChildren = typeof parentNode?.replaceChildren === "function" &&
        first === parentNode.firstChild && marker === parentNode.lastChild;
      for (const record of records.values()) disposeRecord(record, false);
      if (canReplaceChildren && first === parentNode.firstChild && marker === parentNode.lastChild) {
        parentNode.replaceChildren(marker);
      } else {
        for (const record of records.values()) {
          removeRange(record);
        }
      }
      records.clear();
      recordsByItem.clear();
      orderedRecords = [];
    }

    addCleanup(owner, () => {
      clearRecords();
      if (fallbackRecord) disposeRecord(fallbackRecord);
      fallbackRecord = null;
    });

    effect(() => {
      const items = resolve(list.source) ?? [];
      if (!Array.isArray(items)) throw new TypeError("each source must resolve to an array");

      if (items.length === 0) {
        clearRecords();
        if (list.fallback != null && !fallbackRecord) {
          const rendered = withNamespace(namespace, () => scope(() => {
            const fragment = document.createDocumentFragment();
            untrack(() => appendChild(fragment, list.fallback, activeScope));
            return { fragment, range: nodeRange(fragment) };
          }));
          marker.parentNode!.insertBefore(rendered.value.fragment, marker);
          fallbackRecord = { owner: rendered.owner, ...rendered.value.range };
        }
        return;
      }

      if (fallbackRecord) {
        disposeRecord(fallbackRecord);
        fallbackRecord = null;
      }

      // An unchanged prefix only needs the new tail inserted once.
      let prefixLength = 0;
      while (prefixLength < orderedRecords.length &&
             prefixLength < items.length &&
             orderedRecords[prefixLength].item === items[prefixLength]) {
        prefixLength++;
      }
      if (prefixLength === orderedRecords.length && items.length > prefixLength) {
        const appended = [];
        const newKeys = new Set();
        try {
          for (let index = prefixLength; index < items.length; index++) {
            const record = createRecord(items[index]);
            appended.push(record);
            if (records.has(record.key) || newKeys.has(record.key)) {
              throw new Error("each keys must be unique");
            }
            newKeys.add(record.key);
          }
          const fragment = document.createDocumentFragment();
          for (const record of appended) moveRange(record, fragment, null);
          marker.parentNode!.insertBefore(fragment, marker);
        } catch (error) {
          for (const record of appended) disposeRecord(record);
          throw error;
        }
        for (const record of appended) {
          records.set(record.key, record);
          recordsByItem.set(record.item, record);
          orderedRecords.push(record);
        }
        return;
      }

      let staged;
      let createdBeforeReconcile: ListRecord[] = [];
      if (items.length === orderedRecords.length) {
        if (prefixLength === items.length) return;
        const moved = [];
        for (let index = prefixLength; index < items.length && moved.length <= 2; index++) {
          if (orderedRecords[index].item !== items[index]) moved.push(index);
        }
        if (moved.length === 2) {
          const [firstIndex, secondIndex] = moved;
          const firstRecord = orderedRecords[firstIndex];
          const secondRecord = orderedRecords[secondIndex];
          if (firstRecord.item === items[secondIndex] && secondRecord.item === items[firstIndex]) {
            const afterSecond = secondRecord.last.nextSibling;
            const container = marker.parentNode!;
            moveRange(secondRecord, container, firstRecord.first);
            moveRange(firstRecord, container, afterSecond);
            orderedRecords[firstIndex] = secondRecord;
            orderedRecords[secondIndex] = firstRecord;
            return;
          }
        }
        const replacements = [];
        const stagedByItem = new Map();
        let samePositions = true;
        try {
          for (let index = prefixLength; index < items.length; index++) {
            const old = orderedRecords[index];
            const item = items[index];
            if (old.item === item) continue;
            if (recordsByItem.has(item) || stagedByItem.has(item)) {
              samePositions = false;
              break;
            }
            const record = createRecord(item);
            replacements.push({ index, old, record });
            stagedByItem.set(item, record);
            if (record.key !== old.key) {
              samePositions = false;
              break;
            }
          }
        } catch (error) {
          for (const { record } of replacements) disposeRecord(record);
          throw error;
        }
        if (samePositions) {
          const container = marker.parentNode!;
          for (const { index, old, record } of replacements) {
            const oldNode = old.first;
            const before = old.last.nextSibling;
            old.owner.dispose();
            moveRange(record, container, oldNode.parentNode === container
              ? oldNode : before?.parentNode === container ? before : marker);
            removeRange(old);
            records.set(record.key, record);
            recordsByItem.delete(old.item);
            recordsByItem.set(record.item, record);
            orderedRecords[index] = record;
          }
          return;
        }
        // Reuse rows already rendered while checking the positional path.
        staged = stagedByItem;
        createdBeforeReconcile = replacements.map(({ record }) => record);
      }

      const next = new Map();
      const nextByItem = new Map();
      const ordered = [];
      const created = createdBeforeReconcile ?? [];

      try {
        for (const item of items) {
          let record = recordsByItem.get(item) ?? staged?.get(item);
          if (!record) {
            record = createRecord(item);
            created.push(record);
          }

          if (next.has(record.key)) {
            throw new Error("each keys must be unique");
          }
          next.set(record.key, record);
          nextByItem.set(item, record);
          ordered.push(record);
        }
      } catch (error) {
        for (const record of created) disposeRecord(record);
        throw error;
      }

      for (const record of created) {
        if (nextByItem.get(record.item) !== record) disposeRecord(record);
      }

      for (const [key, record] of records) {
        if (next.get(key) === record) continue;
        disposeRecord(record);
      }

      // Keep the longest already ordered subsequence in place. Every other
      // surviving row moves at most once, even for large permutations.
      const oldPositions = new Map(orderedRecords.map((record, index) => [record, index]));
      const tails = [];
      // Allocate the index buffer without per-element callbacks in this hot path.
      // oxlint-disable-next-line unicorn/no-new-array
      const previous = new Array(ordered.length).fill(-1);
      for (let index = 0; index < ordered.length; index++) {
        const position = oldPositions.get(ordered[index]);
        if (position === undefined) continue;
        let low = 0;
        let high = tails.length;
        while (low < high) {
          const middle = (low + high) >> 1;
          if ((oldPositions.get(ordered[tails[middle]]) ?? -1) < position) low = middle + 1;
          else high = middle;
        }
        if (low > 0) previous[index] = tails[low - 1];
        tails[low] = index;
      }
      const stable = new Set();
      for (let index = tails.at(-1); index !== undefined && index !== -1; index = previous[index]) {
        stable.add(index);
      }

      let before = marker;
      for (let index = ordered.length - 1; index >= 0; index--) {
        const record = ordered[index];
        if (!stable.has(index) && record.last.nextSibling !== before) {
          moveRange(record, marker.parentNode!, before);
        }
        before = record.first;
      }

      records = next;
      recordsByItem = nextByItem;
      orderedRecords = ordered;
    }, owner, () => flash(marker.parentElement, owner));
  }


export { appendList };
