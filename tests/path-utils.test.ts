import { describe, it, expect } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import { expandPath, resolvePath } from '../src/path-utils';

describe('path-utils', () => {
  describe('expandPath', () => {
    it('should expand ~ to home directory', () => {
      const result = expandPath('~');
      expect(result).toBe(os.homedir());
    });

    it('should expand ~/... to home directory path', () => {
      const result = expandPath('~/.openclaw/workspace/memory/file.md');
      expect(result).toBe(path.join(os.homedir(), '.openclaw/workspace/memory/file.md'));
    });

    it('should not modify paths that do not start with ~', () => {
      const result = expandPath('/absolute/path/file.txt');
      expect(result).toBe('/absolute/path/file.txt');
    });

    it('should not modify relative paths', () => {
      const result = expandPath('relative/path/file.txt');
      expect(result).toBe('relative/path/file.txt');
    });

    it('should not expand ~ in the middle of a path', () => {
      const result = expandPath('some/~/path');
      expect(result).toBe('some/~/path');
    });
  });

  describe('resolvePath', () => {
    it('should resolve absolute paths without modification', () => {
      const result = resolvePath('/absolute/path/file.txt', '/some/cwd');
      expect(result).toBe('/absolute/path/file.txt');
    });

    it('should resolve relative paths against cwd', () => {
      const result = resolvePath('relative/file.txt', '/some/cwd');
      expect(result).toBe('/some/cwd/relative/file.txt');
    });

    it('should expand and resolve ~ to home directory', () => {
      const result = resolvePath('~', '/some/cwd');
      expect(result).toBe(os.homedir());
    });

    it('should expand and resolve ~/... paths to home directory paths', () => {
      const result = resolvePath('~/.openclaw/workspace/memory/file.md', '/some/cwd');
      const expected = path.join(os.homedir(), '.openclaw/workspace/memory/file.md');
      expect(result).toBe(expected);
    });

    it('should not incorrectly resolve ~ paths as relative to cwd', () => {
      // This is the main bug we're fixing
      const result = resolvePath('~/.openclaw/test', '/some/cwd');
      
      // Should NOT produce /some/cwd/~/.openclaw/test
      expect(result).not.toBe('/some/cwd/~/.openclaw/test');
      
      // Should produce ${HOME}/.openclaw/test
      expect(result).toBe(path.join(os.homedir(), '.openclaw/test'));
    });
  });
});
