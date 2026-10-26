import test from "node:test";
import assert from "node:assert/strict";
import { closingSectorLayout } from "../lib/ceremonies/closing-layout.ts";

test("closing A–D have three 10×10 blocks and one ten-row, five-chair block", () => {
  for (const code of ["A", "B", "C", "D"]) {
    const seats = closingSectorLayout(code, 350)!;
    assert.equal(seats.length, 350);
    for (let block = 1; block <= 4; block++) {
      const chairs = seats.filter(s => s.block === block);
      assert.equal(chairs.length, block === 4 ? 50 : 100);
      assert.equal(new Set(chairs.map(s => s.column)).size, block === 4 ? 5 : 10);
      assert.equal(new Set(chairs.map(s => s.row)).size, 10);
    }
    assert.equal(new Set(seats.map(s => `${s.x},${s.y}`)).size, 350);
  }
});
test("closing E preserves the front 350 and adds three rear 4×10 blocks", () => {
  const seats = closingSectorLayout("E", 470)!;
  assert.deepEqual(seats.slice(0, 350), closingSectorLayout("A", 350));
  const fourth = seats.filter(s => s.block === 4);
  assert.equal(fourth.length, 50);
  assert.equal(new Set(fourth.map(s => s.row)).size, 10);
  assert.equal(new Set(fourth.map(s => s.column)).size, 5);
  for (let block = 5; block <= 7; block++) {
    const chairs = seats.filter(s => s.block === block);
    assert.equal(chairs.length, 40);
    assert.equal(new Set(chairs.map(s => s.row)).size, 4);
    assert.equal(new Set(chairs.map(s => s.column)).size, 10);
    assert.ok(chairs.every(s => s.y >= 112));
  }
  assert.equal(new Set(seats.map(s => `${s.x},${s.y}`)).size, 470);
});
test("exterior has twelve 10×10 blocks in four rows of three", () => {
  const seats = closingSectorLayout("ESTERNO", 1200)!;
  const origins = seats.filter(s => s.row === 1 && s.column === 1);
  assert.equal(origins.length, 12);
  assert.equal(new Set(origins.map(s => s.x)).size, 3);
  assert.equal(new Set(origins.map(s => s.y)).size, 4);
  for (let block = 1; block <= 12; block++) assert.equal(seats.filter(s => s.block === block).length, 100);
  assert.equal(new Set(seats.map(s => `${s.x},${s.y}`)).size, 1200);
});
test("unknown sectors or changed capacities do not invent physical blocks", () => {
  assert.equal(closingSectorLayout("A", 351), null);
  assert.equal(closingSectorLayout("E", 350), null);
  assert.equal(closingSectorLayout("ESTERNO", 1100), null);
  assert.equal(closingSectorLayout("PRATO", 1000), null);
});
