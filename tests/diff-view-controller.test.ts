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
    it('renders with inline view', () => {
      const controller = new DiffViewController(simpleDiff);
      const lines = controller.render(80, 10);
      
      expect(lines.length).toBeGreaterThan(0);
      // Inline view doesn't have separator
      expect(lines.every(line => !line.includes('│'))).toBe(true);
    });
  });

  describe('Cursor delegation', () => {
    it('cursorLine delegates to inline view', () => {
      const controller = new DiffViewController(simpleDiff);
      expect(controller.cursorLine).toBe(0);
    });

    it('moveCursor delegates to inline view', () => {
      const controller = new DiffViewController(simpleDiff);
      controller.moveCursor(2);
      expect(controller.cursorLine).toBe(2);
    });

    it('setCursor delegates to inline view', () => {
      const controller = new DiffViewController(simpleDiff);
      controller.setCursor(3);
      expect(controller.cursorLine).toBe(3);
    });

    it('getCursorDiffLine delegates to inline view', () => {
      const controller = new DiffViewController(simpleDiff);
      controller.setCursor(0);
      const diffLine = controller.getCursorDiffLine();
      expect(diffLine).toBeDefined();
      expect(diffLine?.content).toBe('line 1');
    });

    it('isSeparatorLine delegates to inline view', () => {
      const diff: FileDiff = {
        filePath: 'test.ts',
        isNewFile: false,
        additions: 0,
        deletions: 0,
        hunks: [
          { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
          { type: 'context', content: 'line 10', oldLineNumber: 10, newLineNumber: 10 },
        ],
      };
      
      const controller = new DiffViewController(diff);
      expect(controller.isSeparatorLine(0)).toBe(false);
      expect(controller.isSeparatorLine(1)).toBe(true);
      expect(controller.isSeparatorLine(2)).toBe(false);
    });
  });

  describe('Visual mode delegation', () => {
    it('isVisualMode delegates to inline view', () => {
      const controller = new DiffViewController(simpleDiff);
      expect(controller.isVisualMode).toBe(false);
    });

    it('enterVisualMode delegates to inline view', () => {
      const controller = new DiffViewController(simpleDiff);
      controller.setCursor(2);
      controller.enterVisualMode();
      
      expect(controller.isVisualMode).toBe(true);
    });

    it('exitVisualMode delegates to inline view', () => {
      const controller = new DiffViewController(simpleDiff);
      controller.enterVisualMode();
      expect(controller.isVisualMode).toBe(true);
      
      controller.exitVisualMode();
      expect(controller.isVisualMode).toBe(false);
    });

    it('getVisualRange delegates to inline view', () => {
      const controller = new DiffViewController(simpleDiff);
      controller.setCursor(1);
      controller.enterVisualMode();
      controller.moveCursor(2);
      
      const range = controller.getVisualRange();
      expect(range).toEqual([1, 3]);
    });

    it('getSelectedRawLines delegates to inline view', () => {
      const controller = new DiffViewController(simpleDiff);
      controller.setCursor(0);
      controller.enterVisualMode();
      controller.moveCursor(1);
      
      const rawLines = controller.getSelectedRawLines();
      expect(rawLines).toHaveLength(2);
      expect(rawLines[0]).toContain('line 1');
      expect(rawLines[1]).toContain('line 2 old');
    });

    it('getSelectedDiffLines delegates to inline view', () => {
      const controller = new DiffViewController(simpleDiff);
      controller.setCursor(0);
      controller.enterVisualMode();
      controller.moveCursor(2);
      
      const diffLines = controller.getSelectedDiffLines();
      expect(diffLines).toHaveLength(3);
      expect(diffLines[0].content).toBe('line 1');
      expect(diffLines[1].content).toBe('line 2 old');
      expect(diffLines[2].content).toBe('line 2 new');
    });
  });

  describe('Scroll delegation', () => {
    it('scrollDown delegates to inline view', () => {
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
      
      controller.scrollDown(5);
      expect(controller.scrollOffset).toBe(5);
      
      const lines = controller.render(80, 10);
      expect(lines[0]).toContain('line 6');
    });

    it('scrollUp delegates to inline view', () => {
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

    it('scrollToTop delegates to inline view', () => {
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

    it('scrollToBottom delegates to inline view', () => {
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
    it('delegates to inline view', () => {
      const controller = new DiffViewController(simpleDiff);
      const lines = controller.render(80, 10);
      
      expect(lines.length).toBeGreaterThan(0);
      // Inline view has + prefix for added lines
      const hasPlus = lines.some(line => line.includes('+ '));
      expect(hasPlus).toBe(true);
      
      // No separator
      expect(lines.every(line => !line.includes('│'))).toBe(true);
    });

    it('totalLines delegates to inline view', () => {
      const controller = new DiffViewController(simpleDiff);
      
      const totalLines = controller.totalLines;
      expect(totalLines).toBe(5);
    });
  });

  describe('setDiff', () => {
    it('updates inline view', () => {
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
      
      const newLines = controller.render(80, 10);
      expect(newLines.some(line => line.includes('new content'))).toBe(true);
      expect(newLines.some(line => line.includes('line 1'))).toBe(false);
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
    it('passes highlightFn to inline view', () => {
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
      
      // highlightFn should have been called during construction for inline view
      expect(calls.length).toBeGreaterThan(0);
      
      // Test inline mode rendering
      const inlineLines = controller.render(80, 10);
      expect(inlineLines[0]).toContain('HIGHLIGHTED:const x = 1;');
    });
  });
});
