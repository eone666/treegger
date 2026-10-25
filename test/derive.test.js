import { test } from 'vitest';
import assert from 'node:assert/strict';
import { computed, derive, effect, scope, signal } from '../src/index.ts';
import { nextFlush } from './helpers.js';

test('computed is the backward-compatible alias of derive', () => {
  assert.equal(computed, derive);
});

test('derive stays lazy and caches values with equality disabled', async () => {
  const source = signal(0);
  let calculations = 0;
  const parity = derive(() => { calculations++; return source.value % 2; }, { equals: false });
  source.value = 2;
  await nextFlush();
  assert.equal(calculations, 0);
  assert.equal(parity.value, 0);
  assert.equal(parity.value, 0);
  assert.equal(calculations, 1);
  const seen = [];
  const watcher = effect(() => { seen.push(parity.value); });
  source.value = 4;
  source.value = 6;
  assert.equal(parity.value, 0);
  assert.equal(parity.value, 0);
  await nextFlush();
  assert.equal(calculations, 2);
  assert.deepEqual(seen, [0, 0]);
  watcher.stop(); parity.dispose();
});

test('derive uses Object.is by default, including NaN and signed zero', async () => {
  const source = signal(0);
  const value = derive(() => source.value < 2 ? NaN : source.value === 2 ? 0 : -0);
  const seen = [];
  const watcher = effect(() => { seen.push(value.value); });
  source.value = 1;
  await nextFlush();
  assert.equal(seen.length, 1);
  source.value = 2;
  await nextFlush();
  source.value = 3;
  await nextFlush();
  assert.ok(Number.isNaN(seen[0]));
  assert.ok(Object.is(seen[1], 0));
  assert.ok(Object.is(seen[2], -0));
  watcher.stop(); value.dispose();
});

test('custom equality retains the cached result and compares against the last accepted value', async () => {
  const original = { id: 1, name: 'Ada' };
  const equivalent = { id: 1, name: 'Grace' };
  const changed = { id: 2, name: 'Lin' };
  const source = signal(original);
  const comparisons = [];
  const selected = derive(() => source.value, { equals(previous, next) {
    comparisons.push([previous, next]);
    return previous.id === next.id;
  } });
  const seen = [];
  const watcher = effect(() => { seen.push(selected.value); });
  source.value = equivalent;
  await nextFlush();
  assert.equal(selected.value, original);
  assert.deepEqual(seen, [original]);
  source.value = changed;
  await nextFlush();
  assert.deepEqual(comparisons, [[original, equivalent], [original, changed]]);
  assert.equal(selected.value, changed);
  assert.deepEqual(seen, [original, changed]);
  watcher.stop(); selected.dispose();
});

test('custom equality does not register comparator reads as dependencies', async () => {
  const source = signal(1);
  const unrelated = signal(0);
  let runs = 0, comparisons = 0;
  const value = derive(() => { runs++; return source.value; }, { equals(previous, next) {
    comparisons++; void unrelated.value;
    return previous === next;
  } });
  const watcher = effect(() => { void value.value; });
  source.value = 2;
  await nextFlush();
  unrelated.value++;
  await nextFlush();
  assert.equal(runs, 2);
  assert.equal(comparisons, 1);
  watcher.stop(); value.dispose();
});

test('derive updates conditional dependencies and chained consumers with custom equality', async () => {
  const chooseFirst = signal(true), first = signal(1), second = signal(1);
  const selected = derive(() => ({ value: chooseFirst.value ? first.value : second.value }), {
    equals: (previous, next) => previous.value === next.value
  });
  let calculations = 0;
  const doubled = derive(() => { calculations++; return selected.value.value * 2; });
  const seen = [];
  const watcher = effect(() => { seen.push(doubled.value); });
  chooseFirst.value = false;
  await nextFlush();
  first.value = 10;
  await nextFlush();
  assert.deepEqual(seen, [2]);
  assert.equal(calculations, 1);
  second.value = 3;
  await nextFlush();
  assert.deepEqual(seen, [2, 6]);
  watcher.stop(); doubled.dispose(); selected.dispose();
});

test('equality-disabled derivations still skip evaluation when upstream results are unchanged', async () => {
  const source = signal(1);
  const positive = derive(() => source.value > 0);
  let calculations = 0;
  const value = derive(() => { calculations++; return positive.value; }, { equals: false });
  const watcher = effect(() => { void value.value; });
  source.value = 2;
  await nextFlush();
  assert.equal(calculations, 1);
  source.value = -1;
  await nextFlush();
  assert.equal(calculations, 2);
  watcher.stop(); value.dispose(); positive.dispose();
});

test('derive options validate equality and failed comparisons retry without caching a result', () => {
  assert.throws(() => derive(() => 1, { equals: true }), /equals/);
  const source = signal(1);
  let fail = true;
  const value = derive(() => source.value, { equals(previous, next) {
    if (fail) throw new Error('comparison failed');
    return previous === next;
  } });
  assert.equal(value.value, 1);
  source.value = 2;
  assert.throws(() => value.value, /comparison failed/);
  assert.throws(() => value.value, /comparison failed/);
  fail = false;
  assert.equal(value.value, 2);
  value.dispose();
});

test('writable derivations retain setters and owned derivations stop with their scope', async () => {
  const source = signal(1);
  const seen = [];
  const instance = scope(() => {
    const doubled = derive({ get: () => source.value * 2, set: next => { source.value = next / 2; } }, { equals: false });
    effect(() => { seen.push(doubled.value); });
    return doubled;
  });
  instance.value.value = 10;
  await nextFlush();
  assert.equal(source.value, 5);
  assert.deepEqual(seen, [2, 10]);
  instance.owner.dispose();
  source.value = 6;
  await nextFlush();
  assert.deepEqual(seen, [2, 10]);
});
