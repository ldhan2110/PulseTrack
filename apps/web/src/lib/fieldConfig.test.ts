import { describe, it, expect } from 'vitest';
import { isFieldVisible, FIELD_DEFS } from './fieldConfig';

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

describe('taskCategory field def', () => {
  it('is present, required, and default-visible', () => {
    const def = FIELD_DEFS.find((d) => d.key === 'taskCategory');
    expect(def).toBeDefined();
    expect(def!.label).toBe('Task type');
    expect(def!.required).toBe(true);
    expect(isFieldVisible(undefined, 'taskCategory')).toBe(true);
    expect(isFieldVisible({ taskCategory: false }, 'taskCategory')).toBe(false);
  });
});
