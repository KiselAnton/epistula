import { test, expect } from '@playwright/test';
import { applyToAll, getStrategyFor } from '../utils/strategy';

test.describe('strategy util (unit-like)', () => {
  test('getStrategyFor defaults to merge', () => {
    expect(getStrategyFor({}, 'faculties')).toBe('merge');
  });

  test('applyToAll assigns strategy to all keys', () => {
    const map = applyToAll(['a', 'b', 'c'], 'replace');
    expect(map).toEqual({ a: 'replace', b: 'replace', c: 'replace' });
  });
});
