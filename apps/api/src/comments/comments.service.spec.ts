import { describe, it, expect } from 'vitest';

describe('CommentsService', () => {
  describe('create()', () => {
    it('should create a top-level comment', async () => {
      expect(true).toBe(true); // placeholder — Plan 02 fills this in
    });
  });

  describe('findAll()', () => {
    it('should return top-level comments with nested replies', async () => {
      expect(true).toBe(true); // placeholder
    });
  });

  describe('delete()', () => {
    it('should allow author to delete own comment', async () => {
      expect(true).toBe(true); // placeholder
    });

    it('should allow PM to delete any comment', async () => {
      expect(true).toBe(true); // placeholder
    });

    it('should reject delete from non-author non-PM', async () => {
      expect(true).toBe(true); // placeholder
    });
  });
});
