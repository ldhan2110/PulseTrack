import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, maskToken } from './encryption.util';

describe('encryption.util', () => {
  const key = 'a'.repeat(64); // 32 bytes hex-encoded

  describe('encrypt / decrypt', () => {
    it('round-trips a plaintext string', () => {
      const plaintext = 'ghp_abc123secretToken';
      const encrypted = encrypt(plaintext, key);
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toContain(':'); // iv:authTag:ciphertext
      const decrypted = decrypt(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertext each time (random IV)', () => {
      const plaintext = 'sk-ant-secret';
      const a = encrypt(plaintext, key);
      const b = encrypt(plaintext, key);
      expect(a).not.toBe(b);
    });
  });

  describe('maskToken', () => {
    it('masks a token showing only last 4 chars', () => {
      expect(maskToken('ghp_abc123secretToken')).toBe('****...oken');
    });

    it('returns **** for short tokens', () => {
      expect(maskToken('abc')).toBe('****');
    });

    it('returns empty string for null/undefined', () => {
      expect(maskToken(null as unknown as string)).toBe('');
      expect(maskToken(undefined as unknown as string)).toBe('');
    });
  });
});
