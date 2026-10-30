import { pointFromSignatureDrag } from './signatureDrawing';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  beginStroke,
  clearSignature,
  compactSignature,
  countPoints,
  emptySignature,
  extendStroke,
  isValidSignature,
  normalizeSignature,
  pointFromTouchEvent,
  resizeSignatureCanvas,
  signaturePathData,
  undoLastStroke,
  type SignatureDrawing,
} from './signatureDrawing';

const ASPECT = 0.5;

function drawWave(drawing: SignatureDrawing, from = 0.1, to = 0.8, steps = 30): SignatureDrawing {
  let next = beginStroke(drawing, { x: from, y: 0.25 });
  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps;
    next = extendStroke(next, { x: from + (to - from) * t, y: 0.25 + Math.sin(t * 9) * 0.1 });
  }
  return next;
}

test('a single tap is not a signature', () => {
  const tapped = beginStroke(emptySignature(ASPECT), { x: 0.5, y: 0.25 });
  assert.equal(isValidSignature(tapped), false);
});

test('a tiny dot with many jittering points is not a signature', () => {
  let dot = beginStroke(emptySignature(ASPECT), { x: 0.5, y: 0.25 });
  for (let index = 0; index < 40; index += 1) dot = extendStroke(dot, { x: 0.5 + (index % 2) * 0.005, y: 0.25 });
  assert.equal(isValidSignature(dot), false);
});

test('a short straight scratch is not a signature', () => {
  let scratch = beginStroke(emptySignature(ASPECT), { x: 0.4, y: 0.25 });
  for (let index = 1; index <= 20; index += 1) scratch = extendStroke(scratch, { x: 0.4 + index * 0.004, y: 0.25 });
  assert.equal(isValidSignature(scratch), false);
});

test('a meaningful drawn stroke is a valid signature', () => {
  assert.equal(isValidSignature(drawWave(emptySignature(ASPECT))), true);
});

test('null and empty drawings are invalid', () => {
  assert.equal(isValidSignature(null), false);
  assert.equal(isValidSignature(undefined), false);
  assert.equal(isValidSignature(emptySignature(ASPECT)), false);
});

test('validation and path generation never throw for incomplete drawing data', () => {
  for (const value of [null, undefined, {}, { aspect: 0.5, strokes: null }, { aspect: 0.5, strokes: [[]] }, { aspect: 0.5, strokes: [[null]] }]) {
    assert.doesNotThrow(() => isValidSignature(value));
    assert.equal(isValidSignature(value), false);
    assert.doesNotThrow(() => signaturePathData(value, 200));
  }
});

test('touch coordinates are copied synchronously and incomplete events are ignored', () => {
  const event = { nativeEvent: { locationX: 50, locationY: 25 } };
  assert.deepEqual(pointFromTouchEvent(event, 100), { x: 0.5, y: 0.25 });
  assert.equal(pointFromTouchEvent(null, 100), null);
  assert.equal(pointFromTouchEvent({ nativeEvent: null }, 100), null);
  assert.equal(pointFromTouchEvent({ nativeEvent: { locationX: 50 } }, 100), null);
  assert.equal(pointFromTouchEvent({ nativeEvent: { locationX: 50, locationY: null } }, 100), null);
  assert.equal(pointFromTouchEvent(event, 0), null);
  assert.deepEqual(pointFromTouchEvent(event, { width: 100, height: 240 }), { x: 0.5, y: 0.25 });
  assert.equal(pointFromTouchEvent(event, { width: 100, height: 0 }), null);
});

test('rapid plain touch samples remain a valid signature without retaining event data', () => {
  let drawing = emptySignature(ASPECT);
  for (let index = 0; index < 40; index += 1) {
    const point = pointFromTouchEvent({ nativeEvent: { locationX: 20 + index * 3, locationY: 30 + (index % 5) * 8 } }, 200);
    drawing = index === 0 ? beginStroke(drawing, point) : extendStroke(drawing, point);
  }
  assert.equal(isValidSignature(drawing), true);
  assert.doesNotMatch(JSON.stringify(drawing), /nativeEvent|locationX|locationY/);
});

test('drawing never mutates the previous drawing', () => {
  const empty = emptySignature(ASPECT);
  const started = beginStroke(empty, { x: 0.2, y: 0.2 });
  const extended = extendStroke(started, { x: 0.3, y: 0.3 });
  assert.equal(empty.strokes.length, 0);
  assert.equal(countPoints(started), 1);
  assert.equal(countPoints(extended), 2);
});

test('clear removes all ink and undo removes only the last stroke', () => {
  const twoStrokes = drawWave(drawWave(emptySignature(ASPECT)), 0.2, 0.7);
  assert.equal(twoStrokes.strokes.length, 2);
  assert.equal(undoLastStroke(twoStrokes).strokes.length, 1);
  assert.equal(clearSignature(twoStrokes).strokes.length, 0);
  assert.equal(isValidSignature(clearSignature(twoStrokes)), false);
});

test('points are clamped to the canvas', () => {
  const clamped = extendStroke(beginStroke(emptySignature(ASPECT), { x: -2, y: 9 }), { x: 5, y: -1 });
  for (const point of clamped.strokes.flat()) {
    assert.ok(point.x >= 0 && point.x <= 1);
    assert.ok(point.y >= 0 && point.y <= ASPECT);
  }
});

test('path data draws the actual strokes and scales with width', () => {
  const drawing = drawWave(emptySignature(ASPECT));
  const small = signaturePathData(drawing, 100);
  const large = signaturePathData(drawing, 400);
  assert.match(small, /^M/);
  assert.notEqual(small, large);
  assert.equal(signaturePathData(emptySignature(ASPECT), 100), '');
  assert.equal(signaturePathData(beginStroke(emptySignature(ASPECT), { x: 0.2, y: 0.2 }), 100), '');
});

test('a measured canvas keeps points at their local touch position across its full height', () => {
  const canvas = { width: 200, height: 420 };
  const aspect = canvas.height / canvas.width;
  const start = pointFromTouchEvent({ nativeEvent: { locationX: 4, locationY: 412 } }, canvas);
  const end = pointFromTouchEvent({ nativeEvent: { locationX: 196, locationY: 8 } }, canvas);
  const drawing = extendStroke(beginStroke(resizeSignatureCanvas(emptySignature(), aspect), start), end);
  assert.deepEqual(drawing.strokes[0][0], { x: 0.02, y: 2.06 });
  assert.deepEqual(drawing.strokes[0][1], { x: 0.98, y: 0.04 });
});

test('normalizeSignature round-trips a valid drawing through JSON', () => {
  const drawing = drawWave(emptySignature(ASPECT));
  assert.deepEqual(normalizeSignature(JSON.parse(JSON.stringify(drawing))), drawing);
});

test('normalizeSignature rejects malformed or tiny stored data', () => {
  assert.equal(normalizeSignature(null), null);
  assert.equal(normalizeSignature('x'), null);
  assert.equal(normalizeSignature({ aspect: 'a', strokes: [] }), null);
  assert.equal(normalizeSignature({ aspect: 0.5, strokes: [[{ x: 'a', y: 0 }]] }), null);
  assert.equal(normalizeSignature({ aspect: 0.5, strokes: [[{ x: 0.5, y: 0.2 }]] }), null);
});

test('compactSignature bounds the point count and keeps stroke endpoints', () => {
  const drawing = drawWave(emptySignature(ASPECT), 0.1, 0.8, 400);
  const compact = compactSignature(drawing, 60);
  assert.ok(countPoints(compact) <= 130);
  const original = drawing.strokes[0];
  const thinned = compact.strokes[0];
  assert.equal(thinned[thinned.length - 1].x, Math.round(original[original.length - 1].x * 1000) / 1000);
});

test('signature movement uses gesture deltas rather than stale native target coordinates', () => {
  const canvas = { width: 200, height: 100 };
  assert.deepEqual(pointFromSignatureDrag({ x: 0.1, y: 0.2 }, 80, 20, canvas), { x: 0.5, y: 0.3 });
  assert.deepEqual(pointFromSignatureDrag({ x: 0.1, y: 0.2 }, -100, 1000, canvas), { x: 0, y: 0.5 });
  assert.equal(pointFromSignatureDrag(null, 10, 10, canvas), null);
  assert.equal(pointFromSignatureDrag({ x: 0.1, y: 0.2 }, NaN, 0, canvas), null);
});
