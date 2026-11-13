const test = require('node:test');
const assert = require('node:assert/strict');
const { getCurrentStreak } = require('../.test-output/lib/streak.js');

test('streak counts consecutive activity days including today', () => {
  assert.equal(getCurrentStreak(
    ['2026-11-12', '2026-11-13', '2026-11-14'],
    new Date('2026-11-14T12:00:00.000Z')
  ), 3);
});

test('streak remains active when last activity was yesterday', () => {
  assert.equal(getCurrentStreak(
    ['2026-11-12', '2026-11-13'],
    new Date('2026-11-14T12:00:00.000Z')
  ), 2);
});

test('streak resets after a missed day', () => {
  assert.equal(getCurrentStreak(
    ['2026-11-10', '2026-11-12'],
    new Date('2026-11-14T12:00:00.000Z')
  ), 0);
});

test('streak starts at zero when there is no activity today or yesterday', () => {
  assert.equal(getCurrentStreak(
    ['2026-11-12'],
    new Date('2026-11-14T12:00:00.000Z')
  ), 0);
});
