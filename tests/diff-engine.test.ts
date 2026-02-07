import { describe, it, expect } from 'vitest';
import { computeDiff, DiffLine, FileDiff } from '../src/diff-engine';

describe('diff-engine', () => {
  describe('computeDiff', () => {
    it('should handle simple addition of lines', () => {
      const original = 'line 1\nline 2\nline 3\n';
      const current = 'line 1\nline 2\nline 2.5\nline 3\n';
      
      const result = computeDiff('test.txt', original, current);
      
      expect(result.filePath).toBe('test.txt');
      expect(result.isNewFile).toBe(false);
      expect(result.additions).toBe(1);
      expect(result.deletions).toBe(0);
      
      // Should include the added line
      const addedLines = result.hunks.filter(h => h.type === 'added');
      expect(addedLines).toHaveLength(1);
      expect(addedLines[0].content).toBe('line 2.5');
    });

    it('should handle simple deletion of lines', () => {
      const original = 'line 1\nline 2\nline 3\nline 4\n';
      const current = 'line 1\nline 2\nline 4\n';
      
      const result = computeDiff('test.txt', original, current);
      
      expect(result.filePath).toBe('test.txt');
      expect(result.isNewFile).toBe(false);
      expect(result.additions).toBe(0);
      expect(result.deletions).toBe(1);
      
      // Should include the removed line
      const removedLines = result.hunks.filter(h => h.type === 'removed');
      expect(removedLines).toHaveLength(1);
      expect(removedLines[0].content).toBe('line 3');
    });

    it('should handle modification (remove + add)', () => {
      const original = 'line 1\nline 2\nline 3\n';
      const current = 'line 1\nline 2 modified\nline 3\n';
      
      const result = computeDiff('test.txt', original, current);
      
      expect(result.additions).toBe(1);
      expect(result.deletions).toBe(1);
      
      const removedLines = result.hunks.filter(h => h.type === 'removed');
      const addedLines = result.hunks.filter(h => h.type === 'added');
      
      expect(removedLines).toHaveLength(1);
      expect(removedLines[0].content).toBe('line 2');
      expect(addedLines).toHaveLength(1);
      expect(addedLines[0].content).toBe('line 2 modified');
    });

    it('should detect new file when original is empty', () => {
      const original = '';
      const current = 'new line 1\nnew line 2\n';
      
      const result = computeDiff('newfile.txt', original, current);
      
      expect(result.isNewFile).toBe(true);
      expect(result.additions).toBe(2);
      expect(result.deletions).toBe(0);
      
      const addedLines = result.hunks.filter(h => h.type === 'added');
      expect(addedLines).toHaveLength(2);
    });

    it('should handle no changes (identical content)', () => {
      const original = 'line 1\nline 2\nline 3\n';
      const current = 'line 1\nline 2\nline 3\n';
      
      const result = computeDiff('test.txt', original, current);
      
      expect(result.isNewFile).toBe(false);
      expect(result.additions).toBe(0);
      expect(result.deletions).toBe(0);
      expect(result.hunks).toHaveLength(0);
    });

    it('should handle all content removed', () => {
      const original = 'line 1\nline 2\nline 3\n';
      const current = '';
      
      const result = computeDiff('test.txt', original, current);
      
      expect(result.isNewFile).toBe(false);
      expect(result.additions).toBe(0);
      expect(result.deletions).toBe(3);
      
      const removedLines = result.hunks.filter(h => h.type === 'removed');
      expect(removedLines).toHaveLength(3);
    });

    it('should assign correct line numbers', () => {
      const original = 'line 1\nline 2\nline 3\n';
      const current = 'line 1\nline 2 modified\nline 3\n';
      
      const result = computeDiff('test.txt', original, current);
      
      // Find the removed line (line 2 original)
      const removedLine = result.hunks.find(h => h.type === 'removed' && h.content === 'line 2');
      expect(removedLine?.oldLineNumber).toBe(2);
      
      // Find the added line (line 2 modified)
      const addedLine = result.hunks.find(h => h.type === 'added' && h.content === 'line 2 modified');
      expect(addedLine?.newLineNumber).toBe(2);
    });

    it('should include context lines around changes', () => {
      const original = 'line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\n';
      const current = 'line 1\nline 2\nline 3\nline 4 modified\nline 5\nline 6\nline 7\n';
      
      const result = computeDiff('test.txt', original, current);
      
      // Should have context lines around the change
      const contextLines = result.hunks.filter(h => h.type === 'context');
      expect(contextLines.length).toBeGreaterThan(0);
      
      // Context should include surrounding lines
      const contextContents = contextLines.map(h => h.content);
      expect(contextContents).toContain('line 3');
      expect(contextContents).toContain('line 5');
    });

    it('should handle trailing newlines correctly', () => {
      const original = 'line 1\nline 2';
      const current = 'line 1\nline 2\n';
      
      const result = computeDiff('test.txt', original, current);
      
      // Should detect the difference in trailing newline
      expect(result.additions + result.deletions).toBeGreaterThan(0);
    });

    it('should handle empty original and empty current', () => {
      const original = '';
      const current = '';
      
      const result = computeDiff('test.txt', original, current);
      
      expect(result.isNewFile).toBe(false);
      expect(result.additions).toBe(0);
      expect(result.deletions).toBe(0);
      expect(result.hunks).toHaveLength(0);
    });
  });
});
