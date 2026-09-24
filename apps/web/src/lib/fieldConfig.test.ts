import { describe, it, expect } from 'vitest';
import { isFieldVisible } from './fieldConfig';

describe('isFieldVisible', () => {
  it('unset config => visible', () => {
    expect(isFieldVisible(undefined, 'sprint')).toBe(true);
    expect(isFieldVisible(null, 'sprint')).toBe(true);
  });

  it('missing key => visible', () => {
    expect(isFieldVisible({ storyPoints: false }, 'sprint')).toBe(true);
  });

  it('explicit false => hidden', () => {
    expect(isFieldVisible({ sprint: false }, 'sprint')).toBe(false);
  });

  it('explicit true => visible', () => {
    expect(isFieldVisible({ sprint: true }, 'sprint')).toBe(true);
  });
});
