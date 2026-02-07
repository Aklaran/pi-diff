import { describe, it, expect, beforeEach } from 'vitest';
import { DiffState } from '../src/diff-state';

describe('diff-state', () => {
  let state: DiffState;

  beforeEach(() => {
    state = new DiffState();
  });

  describe('trackFile', () => {
    it('should store file snapshot', () => {
      state.trackFile('test.txt', 'original', 'current');
      
      expect(state.isTracked('test.txt')).toBe(true);
    });

    it('should return file in getChangedFiles when content differs', () => {
      state.trackFile('test.txt', 'original', 'current');
      
      const changed = state.getChangedFiles();
      expect(changed).toContain('test.txt');
    });

    it('should not return file in getChangedFiles when content is identical', () => {
      state.trackFile('test.txt', 'same', 'same');
      
      const changed = state.getChangedFiles();
      expect(changed).not.toContain('test.txt');
    });

    it('should behave like updateFile when tracking same file twice', () => {
      state.trackFile('test.txt', 'original', 'v1');
      state.trackFile('test.txt', 'should not replace original', 'v2');
      
      const diff = state.getFileDiff('test.txt');
      expect(diff).toBeDefined();
      
      // Should still diff against 'original', not 'should not replace original'
      // This means the original baseline was preserved
      const hasOriginalContext = diff!.hunks.some(h => 
        h.type === 'removed' && h.content === 'original'
      );
      expect(hasOriginalContext).toBe(true);
    });
  });

  describe('isTracked', () => {
    it('should return false for untracked file', () => {
      expect(state.isTracked('unknown.txt')).toBe(false);
    });

    it('should return true after tracking', () => {
      state.trackFile('test.txt', 'original', 'current');
      expect(state.isTracked('test.txt')).toBe(true);
    });
  });

  describe('getFileDiff', () => {
    it('should return undefined for untracked file', () => {
      const diff = state.getFileDiff('unknown.txt');
      expect(diff).toBeUndefined();
    });

    it('should return diff for tracked file', () => {
      state.trackFile('test.txt', 'line 1\n', 'line 1\nline 2\n');
      
      const diff = state.getFileDiff('test.txt');
      expect(diff).toBeDefined();
      expect(diff!.filePath).toBe('test.txt');
      expect(diff!.additions).toBe(1);
    });

    it('should return diff with no changes for identical content', () => {
      state.trackFile('test.txt', 'same', 'same');
      
      const diff = state.getFileDiff('test.txt');
      expect(diff).toBeDefined();
      expect(diff!.additions).toBe(0);
      expect(diff!.deletions).toBe(0);
      expect(diff!.hunks).toHaveLength(0);
    });
  });

  describe('getChangedFiles', () => {
    it('should return empty array when no files tracked', () => {
      const changed = state.getChangedFiles();
      expect(changed).toHaveLength(0);
    });

    it('should return only files with actual changes', () => {
      state.trackFile('changed.txt', 'original', 'modified');
      state.trackFile('unchanged.txt', 'same', 'same');
      
      const changed = state.getChangedFiles();
      expect(changed).toHaveLength(1);
      expect(changed).toContain('changed.txt');
      expect(changed).not.toContain('unchanged.txt');
    });

    it('should return multiple changed files', () => {
      state.trackFile('file1.txt', 'a', 'b');
      state.trackFile('file2.txt', 'x', 'y');
      
      const changed = state.getChangedFiles();
      expect(changed).toHaveLength(2);
      expect(changed).toContain('file1.txt');
      expect(changed).toContain('file2.txt');
    });
  });

  describe('updateFile', () => {
    it('should keep original baseline and update current', () => {
      state.trackFile('test.txt', 'original\n', 'v1\n');
      state.updateFile('test.txt', 'v2\n');
      
      const diff = state.getFileDiff('test.txt');
      expect(diff).toBeDefined();
      
      // Should show changes from original to v2, not v1 to v2
      const removedLines = diff!.hunks.filter(h => h.type === 'removed');
      expect(removedLines.some(l => l.content === 'original')).toBe(true);
      
      const addedLines = diff!.hunks.filter(h => h.type === 'added');
      expect(addedLines.some(l => l.content === 'v2')).toBe(true);
    });

    it('should accumulate multiple updates', () => {
      state.trackFile('test.txt', 'line 1\n', 'line 1\nline 2\n');
      state.updateFile('test.txt', 'line 1\nline 2\nline 3\n');
      state.updateFile('test.txt', 'line 1\nline 2\nline 3\nline 4\n');
      
      const diff = state.getFileDiff('test.txt');
      expect(diff).toBeDefined();
      
      // Should show diff from original (1 line) to final (4 lines)
      expect(diff!.additions).toBe(3);
      expect(diff!.deletions).toBe(0);
    });

    it('should handle update on untracked file gracefully', () => {
      // This is an edge case - updateFile on non-tracked file
      // It should either track it or do nothing
      // For robustness, let's expect it to do nothing
      state.updateFile('unknown.txt', 'content');
      expect(state.isTracked('unknown.txt')).toBe(false);
    });
  });

  describe('dismissFile', () => {
    it('should reset baseline to current content', () => {
      state.trackFile('test.txt', 'original\n', 'modified\n');
      expect(state.getChangedFiles()).toContain('test.txt');
      
      state.dismissFile('test.txt');
      
      // After dismiss, should have no changes
      expect(state.getChangedFiles()).not.toContain('test.txt');
      
      const diff = state.getFileDiff('test.txt');
      expect(diff).toBeDefined();
      expect(diff!.additions).toBe(0);
      expect(diff!.deletions).toBe(0);
    });

    it('should keep file tracked after dismiss', () => {
      state.trackFile('test.txt', 'original', 'modified');
      state.dismissFile('test.txt');
      
      expect(state.isTracked('test.txt')).toBe(true);
    });

    it('should diff against dismissed state after new edit', () => {
      state.trackFile('test.txt', 'v0\n', 'v1\n');
      state.dismissFile('test.txt');
      state.updateFile('test.txt', 'v2\n');
      
      const diff = state.getFileDiff('test.txt');
      expect(diff).toBeDefined();
      
      // Should diff v1 (dismissed baseline) against v2
      const removedLines = diff!.hunks.filter(h => h.type === 'removed');
      expect(removedLines.some(l => l.content === 'v1')).toBe(true);
      
      const addedLines = diff!.hunks.filter(h => h.type === 'added');
      expect(addedLines.some(l => l.content === 'v2')).toBe(true);
    });

    it('should handle dismiss on untracked file gracefully', () => {
      // Should not throw
      expect(() => state.dismissFile('unknown.txt')).not.toThrow();
    });
  });

  describe('pendingCount', () => {
    it('should be 0 initially', () => {
      expect(state.pendingCount).toBe(0);
    });

    it('should count files with changes', () => {
      state.trackFile('file1.txt', 'a', 'b');
      state.trackFile('file2.txt', 'x', 'y');
      
      expect(state.pendingCount).toBe(2);
    });

    it('should not count files without changes', () => {
      state.trackFile('changed.txt', 'a', 'b');
      state.trackFile('unchanged.txt', 'same', 'same');
      
      expect(state.pendingCount).toBe(1);
    });

    it('should update after dismiss', () => {
      state.trackFile('file1.txt', 'a', 'b');
      state.trackFile('file2.txt', 'x', 'y');
      expect(state.pendingCount).toBe(2);
      
      state.dismissFile('file1.txt');
      expect(state.pendingCount).toBe(1);
    });

    it('should update after updateFile creates changes', () => {
      state.trackFile('test.txt', 'same', 'same');
      expect(state.pendingCount).toBe(0);
      
      state.updateFile('test.txt', 'different');
      expect(state.pendingCount).toBe(1);
    });
  });

  describe('complex scenarios', () => {
    it('should handle multiple files with various operations', () => {
      // Track several files
      state.trackFile('file1.txt', 'a', 'b');
      state.trackFile('file2.txt', 'x', 'x'); // no change
      state.trackFile('file3.txt', 'p', 'q');
      
      expect(state.pendingCount).toBe(2);
      
      // Update one
      state.updateFile('file1.txt', 'c');
      expect(state.pendingCount).toBe(2);
      
      // Dismiss one
      state.dismissFile('file3.txt');
      expect(state.pendingCount).toBe(1);
      
      // Update the dismissed file
      state.updateFile('file3.txt', 'r');
      expect(state.pendingCount).toBe(2);
      
      const changed = state.getChangedFiles();
      expect(changed).toContain('file1.txt');
      expect(changed).not.toContain('file2.txt');
      expect(changed).toContain('file3.txt');
    });
  });
});
