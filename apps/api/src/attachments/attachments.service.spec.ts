import { describe, it, expect } from 'vitest';

describe('AttachmentsService', () => {
  describe('create()', () => {
    it('should create an attachment record', async () => {
      expect(true).toBe(true); // placeholder — Plan 02 fills this in
    });
  });

  describe('delete()', () => {
    it('should allow uploader to delete own attachment', async () => {
      expect(true).toBe(true); // placeholder
    });

    it('should allow PM to delete any attachment', async () => {
      expect(true).toBe(true); // placeholder
    });

    it('should reject delete from non-uploader non-PM', async () => {
      expect(true).toBe(true); // placeholder
    });
  });
});
