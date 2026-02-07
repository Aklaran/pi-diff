import { describe, it, expect, beforeEach } from 'vitest';
import { DiffViewController } from '../src/diff-view-controller';
import type { FileDiff } from '../src/diff-engine';

describe('DiffViewController', () => {
  let simpleDiff: FileDiff;

  beforeEach(() => {
    simpleDiff = {
      filePath: 'test.ts',
      isNewFile: false,
      additions: 2,
      deletions: 1,
      hunks: [
        { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
        { type: 'removed', content: 'line 2 old', oldLineNumber: 2, newLineNumber: undefined },
        { type: 'added', content: 'line 2 new', oldLineNumber: undefined, newLineNumber: 2 },
        { type: 'added', content: 'line 3 new', oldLineNumber: undefined, newLineNumber: 3 },
        { type: 'context', content: 'line 4', oldLineNumber: 3, newLineNumber: 4 },
      ],
    };
  });

  describe('Initial state', () => {
    it('defaults to inline mode', () => {
      const controller = new DiffViewController(simpleDiff);
      expect(controller.viewMode).toBe('inline');
    });

    it('renders with inline view by default', () => {
      const controller = new DiffViewController(simpleDiff);
      const lines = controller.render(80, 10);
      
      expect(lines.length).toBeGreaterThan(0);
      // Inline view doesn't have separator
      expect(lines.every(line => !line.includes('│'))).toBe(true);
    });
  });

  describe('canUseSideBySide', () => {
    it('returns true when width >= 120', () => {
      const controller = new DiffViewController(simpleDiff);
      
      expect(controller.canUseSideBySide(120)).toBe(true);
      expect(controller.canUseSideBySide(140)).toBe(true);
      expect(controller.canUseSideBySide(200)).toBe(true);
    });

    it('returns false when width < 120', () => {
      const controller = new DiffViewController(simpleDiff);
      
      expect(controller.canUseSideBySide(119)).toBe(false);
      expect(controller.canUseSideBySide(100)).toBe(false);
      expect(controller.canUseSideBySide(80)).toBe(false);
    });
  });

  describe('toggleViewMode', () => {
    it('switches to side-by-side when width >= 120', () => {
      const controller = new DiffViewController(simpleDiff);
      expect(controller.viewMode).toBe('inline');
      
      const result = controller.toggleViewMode(120);
      
      expect(result).toBe(true);
      expect(controller.viewMode).toBe('side-by-side');
    });

    it('returns false and stays in inline when width < 120', () => {
      const controller = new DiffViewController(simpleDiff);
      expect(controller.viewMode).toBe('inline');
      
      const result = controller.toggleViewMode(100);
      
      expect(result).toBe(false);
      expect(controller.viewMode).toBe('inline');
    });

    it('toggles back to inline from side-by-side', () => {
      const controller = new DiffViewController(simpleDiff);
      
      controller.toggleViewMode(120);
      expect(controller.viewMode).toBe('side-by-side');
      
      const result = controller.toggleViewMode(120);
      
      expect(result).toBe(true);
      expect(controller.viewMode).toBe('inline');
    });

    it('resets scroll position when switching views', () => {
      const largeDiff: FileDiff = {
        filePath: 'large.ts',
        isNewFile: false,
        additions: 0,
        deletions: 0,
        hunks: Array.from({ length: 50 }, (_, i) => ({
          type: 'context' as const,
          content: `line ${i + 1}`,
          oldLineNumber: i + 1,
          newLineNumber: i + 1,
        })),
      };
      
      const controller = new DiffViewController(largeDiff);
      
      // Scroll down in inline mode
      controller.scrollDown(20);
      expect(controller.scrollOffset).toBe(20);
      
      // Toggle to side-by-side - scroll should reset
      controller.toggleViewMode(120);
      expect(controller.scrollOffset).toBe(0);
      
      // Scroll down in side-by-side mode
      controller.scrollDown(15);
      expect(controller.scrollOffset).toBe(15);
      
      // Toggle back to inline - scroll should reset again
      controller.toggleViewMode(120);
      expect(controller.scrollOffset).toBe(0);
    });
  });

  describe('setViewMode', () => {
    it('forces a specific mode', () => {
      const controller = new DiffViewController(simpleDiff);
      expect(controller.viewMode).toBe('inline');
      
      controller.setViewMode('side-by-side');
      expect(controller.viewMode).toBe('side-by-side');
      
      controller.setViewMode('inline');
      expect(controller.viewMode).toBe('inline');
    });

    it('resets scroll position when changing modes', () => {
      const largeDiff: FileDiff = {
        filePath: 'large.ts',
        isNewFile: false,
        additions: 0,
        deletions: 0,
        hunks: Array.from({ length: 50 }, (_, i) => ({
          type: 'context' as const,
          content: `line ${i + 1}`,
          oldLineNumber: i + 1,
          newLineNumber: i + 1,
        })),
      };
      
      const controller = new DiffViewController(largeDiff);
      
      controller.scrollDown(20);
      expect(controller.scrollOffset).toBe(20);
      
      controller.setViewMode('side-by-side');
      expect(controller.scrollOffset).toBe(0);
    });
  });

  describe('Scroll delegation', () => {
    it('scrollDown delegates to active view', () => {
      const largeDiff: FileDiff = {
        filePath: 'large.ts',
        isNewFile: false,
        additions: 0,
        deletions: 0,
        hunks: Array.from({ length: 50 }, (_, i) => ({
          type: 'context' as const,
          content: `line ${i + 1}`,
          oldLineNumber: i + 1,
          newLineNumber: i + 1,
        })),
      };
      
      const controller = new DiffViewController(largeDiff);
      
      // Test in inline mode
      controller.scrollDown(5);
      expect(controller.scrollOffset).toBe(5);
      
      const lines = controller.render(80, 10);
      expect(lines[0]).toContain('line 6');
      
      // Switch to side-by-side
      controller.setViewMode('side-by-side');
      
      // Scroll should work in side-by-side too
      controller.scrollDown(3);
      expect(controller.scrollOffset).toBe(3);
      
      const lines2 = controller.render(120, 10);
      expect(lines2[0]).toContain('line 4');
    });

    it('scrollUp delegates to active view', () => {
      const largeDiff: FileDiff = {
        filePath: 'large.ts',
        isNewFile: false,
        additions: 0,
        deletions: 0,
        hunks: Array.from({ length: 50 }, (_, i) => ({
          type: 'context' as const,
          content: `line ${i + 1}`,
          oldLineNumber: i + 1,
          newLineNumber: i + 1,
        })),
      };
      
      const controller = new DiffViewController(largeDiff);
      
      controller.scrollDown(10);
      controller.scrollUp(5);
      expect(controller.scrollOffset).toBe(5);
    });

    it('scrollToTop delegates to active view', () => {
      const largeDiff: FileDiff = {
        filePath: 'large.ts',
        isNewFile: false,
        additions: 0,
        deletions: 0,
        hunks: Array.from({ length: 50 }, (_, i) => ({
          type: 'context' as const,
          content: `line ${i + 1}`,
          oldLineNumber: i + 1,
          newLineNumber: i + 1,
        })),
      };
      
      const controller = new DiffViewController(largeDiff);
      
      controller.scrollDown(20);
      controller.scrollToTop();
      expect(controller.scrollOffset).toBe(0);
    });

    it('scrollToBottom delegates to active view', () => {
      const largeDiff: FileDiff = {
        filePath: 'large.ts',
        isNewFile: false,
        additions: 0,
        deletions: 0,
        hunks: Array.from({ length: 50 }, (_, i) => ({
          type: 'context' as const,
          content: `line ${i + 1}`,
          oldLineNumber: i + 1,
          newLineNumber: i + 1,
        })),
      };
      
      const controller = new DiffViewController(largeDiff);
      
      controller.scrollToBottom();
      const visibleHeight = 10;
      const lines = controller.render(80, visibleHeight);
      
      expect(lines[lines.length - 1]).toContain('line 50');
    });
  });

  describe('Render delegation', () => {
    it('delegates to inline view when in inline mode', () => {
      const controller = new DiffViewController(simpleDiff);
      const lines = controller.render(80, 10);
      
      expect(lines.length).toBeGreaterThan(0);
      // Inline view has + prefix for added lines
      const hasPlus = lines.some(line => line.includes('+ '));
      expect(hasPlus).toBe(true);
      
      // No separator
      expect(lines.every(line => !line.includes('│'))).toBe(true);
    });

    it('delegates to side-by-side view when in side-by-side mode', () => {
      const controller = new DiffViewController(simpleDiff);
      controller.setViewMode('side-by-side');
      
      const lines = controller.render(120, 10);
      
      expect(lines.length).toBeGreaterThan(0);
      // Side-by-side has separator
      const hasSeparator = lines.some(line => line.includes('│'));
      expect(hasSeparator).toBe(true);
    });

    it('totalLines delegates to active view', () => {
      const controller = new DiffViewController(simpleDiff);
      
      const inlineTotalLines = controller.totalLines;
      expect(inlineTotalLines).toBe(5);
      
      controller.setViewMode('side-by-side');
      const sideBySideTotalLines = controller.totalLines;
      expect(sideBySideTotalLines).toBe(5);
    });
  });

  describe('setDiff', () => {
    it('updates both views', () => {
      const controller = new DiffViewController(simpleDiff);
      
      const initialLines = controller.render(80, 10);
      expect(initialLines.some(line => line.includes('line 1'))).toBe(true);
      
      const newDiff: FileDiff = {
        filePath: 'other.ts',
        isNewFile: false,
        additions: 1,
        deletions: 0,
        hunks: [
          { type: 'added', content: 'new content', oldLineNumber: undefined, newLineNumber: 1 },
        ],
      };
      
      controller.setDiff(newDiff);
      
      // Check inline mode
      controller.setViewMode('inline');
      const inlineLines = controller.render(80, 10);
      expect(inlineLines.some(line => line.includes('new content'))).toBe(true);
      expect(inlineLines.some(line => line.includes('line 1'))).toBe(false);
      
      // Check side-by-side mode
      controller.setViewMode('side-by-side');
      const sideLines = controller.render(120, 10);
      expect(sideLines.some(line => line.includes('new content'))).toBe(true);
      expect(sideLines.some(line => line.includes('line 1'))).toBe(false);
    });

    it('resets scroll offset', () => {
      const largeDiff: FileDiff = {
        filePath: 'large.ts',
        isNewFile: false,
        additions: 0,
        deletions: 0,
        hunks: Array.from({ length: 50 }, (_, i) => ({
          type: 'context' as const,
          content: `line ${i + 1}`,
          oldLineNumber: i + 1,
          newLineNumber: i + 1,
        })),
      };
      
      const controller = new DiffViewController(largeDiff);
      controller.scrollDown(20);
      expect(controller.scrollOffset).toBe(20);
      
      controller.setDiff(simpleDiff);
      expect(controller.scrollOffset).toBe(0);
    });
  });

  describe('Syntax highlighting', () => {
    it('passes highlightFn to both views', () => {
      const calls: string[] = [];
      const highlightFn = (code: string) => {
        calls.push(code);
        return `HIGHLIGHTED:${code}`;
      };
      
      const diff: FileDiff = {
        filePath: 'test.ts',
        isNewFile: false,
        additions: 0,
        deletions: 0,
        hunks: [
          { type: 'context', content: 'const x = 1;', oldLineNumber: 1, newLineNumber: 1 },
        ],
      };
      
      const controller = new DiffViewController(diff, highlightFn);
      
      // highlightFn should have been called during construction for both views
      // inline view: once for the context line
      // side-by-side view: twice for the context line (left and right panels)
      expect(calls.length).toBe(3);
      
      // Test inline mode rendering
      const inlineLines = controller.render(80, 10);
      expect(inlineLines[0]).toContain('HIGHLIGHTED:const x = 1;');
      
      // Test side-by-side mode rendering
      controller.setViewMode('side-by-side');
      const sideLines = controller.render(120, 10);
      expect(sideLines[0]).toContain('HIGHLIGHTED:const x = 1;');
    });
  });
});
