import { describe, it, expect, beforeEach } from 'vitest';
import { DiffReviewModal } from '../src/modal';
import { DiffState } from '../src/diff-state';

describe('DiffReviewModal', () => {
  let diffState: DiffState;
  let modal: DiffReviewModal;

  beforeEach(() => {
    diffState = new DiffState();
    modal = new DiffReviewModal(diffState);
  });

  describe('getFileList', () => {
    it('returns entries for changed files', () => {
      diffState.trackFile('file1.ts', 'original', 'modified');
      diffState.trackFile('file2.ts', '', 'new content');
      modal.refresh();

      const files = modal.getFileList();
      expect(files).toHaveLength(2);
      expect(files[0].path).toBe('file1.ts');
      expect(files[1].path).toBe('file2.ts');
    });

    it('returns empty array when no changes', () => {
      const files = modal.getFileList();
      expect(files).toEqual([]);
    });

    it('file list entries have correct additions/deletions counts', () => {
      diffState.trackFile('file1.ts', 'line1\nline2', 'line1\nline2\nline3');
      modal.refresh();

      const files = modal.getFileList();
      expect(files).toHaveLength(1);
      expect(files[0].additions).toBeGreaterThan(0);
      expect(files[0].deletions).toBeGreaterThanOrEqual(0);
    });

    it('file list entries have isNewFile flag', () => {
      diffState.trackFile('new.ts', '', 'content');
      modal.refresh();

      const files = modal.getFileList();
      expect(files).toHaveLength(1);
      expect(files[0].isNewFile).toBe(true);
    });
  });

  describe('selection', () => {
    it('selectedIndex starts at 0', () => {
      expect(modal.selectedIndex).toBe(0);
    });

    it('selectNext advances selection', () => {
      diffState.trackFile('file1.ts', 'a', 'b');
      diffState.trackFile('file2.ts', 'a', 'b');
      modal.refresh();

      expect(modal.selectedIndex).toBe(0);
      modal.selectNext();
      expect(modal.selectedIndex).toBe(1);
    });

    it('selectPrevious decreases selection', () => {
      diffState.trackFile('file1.ts', 'a', 'b');
      diffState.trackFile('file2.ts', 'a', 'b');
      modal.refresh();

      modal.selectNext();
      expect(modal.selectedIndex).toBe(1);
      modal.selectPrevious();
      expect(modal.selectedIndex).toBe(0);
    });

    it('selectNext wraps around at end', () => {
      diffState.trackFile('file1.ts', 'a', 'b');
      diffState.trackFile('file2.ts', 'a', 'b');
      modal.refresh();

      modal.selectNext(); // index 1
      modal.selectNext(); // wraps to 0
      expect(modal.selectedIndex).toBe(0);
    });

    it('selectPrevious wraps around at start', () => {
      diffState.trackFile('file1.ts', 'a', 'b');
      diffState.trackFile('file2.ts', 'a', 'b');
      modal.refresh();

      expect(modal.selectedIndex).toBe(0);
      modal.selectPrevious(); // wraps to 1
      expect(modal.selectedIndex).toBe(1);
    });

    it('selectIndex sets index with bounds clamping', () => {
      diffState.trackFile('file1.ts', 'a', 'b');
      diffState.trackFile('file2.ts', 'a', 'b');
      modal.refresh();

      modal.selectIndex(1);
      expect(modal.selectedIndex).toBe(1);

      modal.selectIndex(10); // clamps to max
      expect(modal.selectedIndex).toBe(1);

      modal.selectIndex(-5); // clamps to 0
      expect(modal.selectedIndex).toBe(0);
    });
  });

  describe('getSelectedDiff', () => {
    it('returns diff for current selection', () => {
      diffState.trackFile('file1.ts', 'original', 'modified');
      modal.refresh();

      const diff = modal.getSelectedDiff();
      expect(diff).toBeDefined();
      expect(diff?.filePath).toBe('file1.ts');
    });

    it('returns undefined when no files', () => {
      const diff = modal.getSelectedDiff();
      expect(diff).toBeUndefined();
    });

    it('returns correct diff after navigation', () => {
      diffState.trackFile('file1.ts', 'a', 'b');
      diffState.trackFile('file2.ts', 'c', 'd');
      modal.refresh();

      modal.selectNext();
      const diff = modal.getSelectedDiff();
      expect(diff?.filePath).toBe('file2.ts');
    });
  });

  describe('dismissSelected', () => {
    it('removes file and refreshes', () => {
      diffState.trackFile('file1.ts', 'a', 'b');
      diffState.trackFile('file2.ts', 'c', 'd');
      modal.refresh();

      expect(modal.getFileList()).toHaveLength(2);
      const result = modal.dismissSelected();
      expect(result).toBe(true);
      expect(modal.getFileList()).toHaveLength(1);
    });

    it('clamps index when last file dismissed', () => {
      diffState.trackFile('file1.ts', 'a', 'b');
      diffState.trackFile('file2.ts', 'c', 'd');
      modal.refresh();

      modal.selectIndex(1); // select last file
      expect(modal.selectedIndex).toBe(1);

      modal.dismissSelected();
      expect(modal.selectedIndex).toBe(0); // clamped to new last
    });

    it('returns false when no files', () => {
      const result = modal.dismissSelected();
      expect(result).toBe(false);
    });

    it('handles dismissing all files', () => {
      diffState.trackFile('file1.ts', 'a', 'b');
      modal.refresh();

      const result = modal.dismissSelected();
      expect(result).toBe(true);
      expect(modal.getFileList()).toHaveLength(0);
      expect(modal.selectedIndex).toBe(0);
    });
  });

  describe('getSelectedPath', () => {
    it('returns current file path', () => {
      diffState.trackFile('file1.ts', 'a', 'b');
      modal.refresh();

      const path = modal.getSelectedPath();
      expect(path).toBe('file1.ts');
    });

    it('returns undefined when no files', () => {
      const path = modal.getSelectedPath();
      expect(path).toBeUndefined();
    });

    it('returns correct path after navigation', () => {
      diffState.trackFile('file1.ts', 'a', 'b');
      diffState.trackFile('file2.ts', 'c', 'd');
      modal.refresh();

      modal.selectNext();
      const path = modal.getSelectedPath();
      expect(path).toBe('file2.ts');
    });
  });

  describe('selectedFile', () => {
    it('returns path of currently selected file', () => {
      diffState.trackFile('file1.ts', 'a', 'b');
      modal.refresh();

      expect(modal.selectedFile).toBe('file1.ts');
    });

    it('returns undefined when no files', () => {
      expect(modal.selectedFile).toBeUndefined();
    });
  });

  describe('refresh', () => {
    it('updates file list from state', () => {
      diffState.trackFile('file1.ts', 'a', 'b');
      modal.refresh();
      expect(modal.getFileList()).toHaveLength(1);

      diffState.trackFile('file2.ts', 'c', 'd');
      modal.refresh();
      expect(modal.getFileList()).toHaveLength(2);
    });

    it('clamps selection when current file no longer in list', () => {
      diffState.trackFile('file1.ts', 'a', 'b');
      diffState.trackFile('file2.ts', 'c', 'd');
      modal.refresh();

      modal.selectIndex(1);
      expect(modal.selectedIndex).toBe(1);

      diffState.dismissFile('file2.ts');
      modal.refresh();
      expect(modal.selectedIndex).toBe(0);
    });
  });
});
