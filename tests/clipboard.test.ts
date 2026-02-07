import { describe, it, expect } from 'vitest';
import { copyToClipboard } from '../src/clipboard';

describe('clipboard', () => {
  it('returns a boolean', async () => {
    const result = await copyToClipboard('test');
    expect(typeof result).toBe('boolean');
  });

  it('can be called without throwing', async () => {
    await expect(copyToClipboard('test')).resolves.toBeDefined();
  });

  it('handles empty string without throwing', async () => {
    await expect(copyToClipboard('')).resolves.toBeDefined();
  });
});
