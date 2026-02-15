import { computeSegmentBounds } from './segmentBounds';

type Bounds = { startSeconds: number; endSeconds: number };

function assertBoundsEqual(actual: Bounds, expected: Bounds, label: string) {
  if (actual.startSeconds !== expected.startSeconds || actual.endSeconds !== expected.endSeconds) {
    throw new Error(
      `${label} expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`
    );
  }
}

function test(label: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${label}`);
  } catch (err) {
    console.error(`fail - ${label}`);
    throw err;
  }
}

test('computeSegmentBounds uses buffers and duration', () => {
  const result = computeSegmentBounds(60, 25, 120, 5, 10);
  assertBoundsEqual(result, { startSeconds: 55, endSeconds: 100 }, 'example');
});

test('computeSegmentBounds clamps start to zero', () => {
  const result = computeSegmentBounds(2, 1, 120, 5, 10);
  assertBoundsEqual(result, { startSeconds: 0, endSeconds: 13 }, 'start clamp');
});

test('computeSegmentBounds clamps end to media duration', () => {
  const result = computeSegmentBounds(95, 10, 100, 5, 10);
  assertBoundsEqual(result, { startSeconds: 90, endSeconds: 100 }, 'end clamp');
});

test('computeSegmentBounds enforces minimum length when possible', () => {
  const result = computeSegmentBounds(10, 1, 200, 5, 10);
  assertBoundsEqual(result, { startSeconds: 5, endSeconds: 21 }, 'min length');
});
