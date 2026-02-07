import { describe, it, expect, beforeEach } from 'vitest';
import { InlineDiffView } from '../src/inline-view';
import type { FileDiff, DiffLine } from '../src/diff-engine';

describe('InlineDiffView', () => {
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

  describe('Basic rendering', () => {
    it('renders added lines with + prefix and green color', () => {
      const view = new InlineDiffView(simpleDiff);
      const lines = view.render(80, 10);
      
      // Find the added line
      const addedLine = lines.find(line => line.includes('line 2 new'));
      expect(addedLine).toBeDefined();
      expect(addedLine).toContain('+');
      expect(addedLine).toContain('\x1b[32m'); // Green
      expect(addedLine).toContain('\x1b[0m'); // Reset
    });

    it('renders removed lines with - prefix and red color', () => {
      const view = new InlineDiffView(simpleDiff);
      const lines = view.render(80, 10);
      
      const removedLine = lines.find(line => line.includes('line 2 old'));
      expect(removedLine).toBeDefined();
      expect(removedLine).toContain('-');
      expect(removedLine).toContain('\x1b[31m'); // Red
      expect(removedLine).toContain('\x1b[0m'); // Reset
    });

    it('renders context lines with space prefix and dim color', () => {
      const view = new InlineDiffView(simpleDiff);
      const lines = view.render(80, 10);
      
      const contextLine = lines.find(line => line.includes('line 1'));
      expect(contextLine).toBeDefined();
      expect(contextLine).toContain('\x1b[2m'); // Dim
      expect(contextLine).toMatch(/1\s+\s\s+line 1/); // Has line number and space prefix
    });

    it('line numbers are right-aligned', () => {
      const diff: FileDiff = {
        filePath: 'test.ts',
        isNewFile: false,
        additions: 0,
        deletions: 0,
        hunks: [
          { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
          { type: 'context', content: 'line 10', oldLineNumber: 10, newLineNumber: 10 },
          { type: 'context', content: 'line 100', oldLineNumber: 100, newLineNumber: 100 },
        ],
      };
      
      const view = new InlineDiffView(diff);
      const lines = view.render(80, 10);
      
      // Filter out separator lines
      const contentLines = lines.filter(line => !line.includes('···'));
      
      // All line numbers should align at the same column
      // Line 1 should have more leading spaces than line 100
      expect(contentLines[0]).toMatch(/\s+1\s/);
      expect(contentLines[1]).toMatch(/\s+10\s/);
      expect(contentLines[2]).toMatch(/100\s/);
      
      // Extract the position where the content starts (should be same for all)
      // Strip ANSI codes first
      const strippedLines = contentLines.map(line => line.replace(/\x1b\[\d+m/g, ''));
      const contentStarts = strippedLines.map(line => line.indexOf('line'));
      
      expect(contentStarts[0]).toBeGreaterThan(0);
      expect(contentStarts[1]).toBe(contentStarts[0]);
      expect(contentStarts[2]).toBe(contentStarts[0]);
    });

    it('renders empty diff as empty array', () => {
      const emptyDiff: FileDiff = {
        filePath: 'empty.ts',
        isNewFile: false,
        additions: 0,
        deletions: 0,
        hunks: [],
      };
      
      const view = new InlineDiffView(emptyDiff);
      const lines = view.render(80, 10);
      
      expect(lines).toEqual([]);
    });
  });

  describe('Hunk separators', () => {
    it('renders separator between non-contiguous hunks', () => {
      const diff: FileDiff = {
        filePath: 'test.ts',
        isNewFile: false,
        additions: 0,
        deletions: 0,
        hunks: [
          { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
          { type: 'context', content: 'line 2', oldLineNumber: 2, newLineNumber: 2 },
          // Gap here - next line jumps from 2 to 10
          { type: 'context', content: 'line 10', oldLineNumber: 10, newLineNumber: 10 },
          { type: 'context', content: 'line 11', oldLineNumber: 11, newLineNumber: 11 },
        ],
      };
      
      const view = new InlineDiffView(diff);
      const lines = view.render(80, 10);
      
      // Should have 5 lines: 2 context, separator, 2 context
      expect(lines).toHaveLength(5);
      expect(lines[2]).toContain('···');
      expect(lines[2]).toContain('\x1b[2m'); // Dim
    });

    it('does not render separator for contiguous lines', () => {
      const view = new InlineDiffView(simpleDiff);
      const lines = view.render(80, 10);
      
      // No gaps in our simple diff, so no separators
      const separators = lines.filter(line => line.includes('···'));
      expect(separators).toHaveLength(0);
    });
  });

  describe('Scrolling', () => {
    let largeDiff: FileDiff;

    beforeEach(() => {
      const hunks: DiffLine[] = [];
      for (let i = 1; i <= 50; i++) {
        hunks.push({
          type: 'context',
          content: `line ${i}`,
          oldLineNumber: i,
          newLineNumber: i,
        });
      }
      
      largeDiff = {
        filePath: 'large.ts',
        isNewFile: false,
        additions: 0,
        deletions: 0,
        hunks,
      };
    });

    it('scrollDown moves the visible window', () => {
      const view = new InlineDiffView(largeDiff);
      const initialLines = view.render(80, 10);
      
      expect(view.scrollOffset).toBe(0);
      expect(initialLines[0]).toContain('line 1');
      
      view.scrollDown(5);
      const scrolledLines = view.render(80, 10);
      
      expect(view.scrollOffset).toBe(5);
      expect(scrolledLines[0]).toContain('line 6');
    });

    it('scrollUp moves the visible window', () => {
      const view = new InlineDiffView(largeDiff);
      
      view.scrollDown(10);
      expect(view.scrollOffset).toBe(10);
      
      view.scrollUp(5);
      expect(view.scrollOffset).toBe(5);
      
      const lines = view.render(80, 10);
      expect(lines[0]).toContain('line 6');
    });

    it('scrollDown defaults to 1 line', () => {
      const view = new InlineDiffView(largeDiff);
      
      view.scrollDown();
      expect(view.scrollOffset).toBe(1);
    });

    it('scrollUp defaults to 1 line', () => {
      const view = new InlineDiffView(largeDiff);
      
      view.scrollDown(5);
      view.scrollUp();
      expect(view.scrollOffset).toBe(4);
    });

    it('scroll clamps at top bound', () => {
      const view = new InlineDiffView(largeDiff);
      
      view.scrollUp(10); // Try to scroll past the top
      expect(view.scrollOffset).toBe(0);
      
      const lines = view.render(80, 10);
      expect(lines[0]).toContain('line 1');
    });

    it('scroll clamps at bottom bound', () => {
      const view = new InlineDiffView(largeDiff);
      
      view.scrollDown(1000); // Try to scroll way past the bottom
      
      // render() should clamp the offset so we can still see visibleHeight lines
      const visibleHeight = 10;
      const lines = view.render(80, visibleHeight);
      
      // After rendering, scrollOffset should be clamped
      const maxOffset = Math.max(0, view.totalLines - visibleHeight);
      expect(view.scrollOffset).toBe(maxOffset);
      
      expect(lines).toHaveLength(visibleHeight);
      expect(lines[lines.length - 1]).toContain('line 50');
    });

    it('scrollToTop resets to start', () => {
      const view = new InlineDiffView(largeDiff);
      
      view.scrollDown(20);
      expect(view.scrollOffset).toBeGreaterThan(0);
      
      view.scrollToTop();
      expect(view.scrollOffset).toBe(0);
      
      const lines = view.render(80, 10);
      expect(lines[0]).toContain('line 1');
    });

    it('scrollToBottom goes to end', () => {
      const view = new InlineDiffView(largeDiff);
      
      view.scrollToBottom();
      
      const visibleHeight = 10;
      const lines = view.render(80, visibleHeight);
      
      // After rendering, scrollOffset should be clamped to show the last lines
      const maxOffset = Math.max(0, view.totalLines - visibleHeight);
      expect(view.scrollOffset).toBe(maxOffset);
      
      expect(lines[lines.length - 1]).toContain('line 50');
    });
  });

  describe('Render properties', () => {
    it('totalLines reflects actual rendered line count', () => {
      const view = new InlineDiffView(simpleDiff);
      
      // 5 hunks, no separators = 5 lines
      expect(view.totalLines).toBe(5);
    });

    it('totalLines includes separators', () => {
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
      
      const view = new InlineDiffView(diff);
      
      // 2 hunks + 1 separator = 3 lines
      expect(view.totalLines).toBe(3);
    });

    it('render respects visibleHeight', () => {
      const diff: FileDiff = {
        filePath: 'test.ts',
        isNewFile: false,
        additions: 0,
        deletions: 0,
        hunks: Array.from({ length: 20 }, (_, i) => ({
          type: 'context' as const,
          content: `line ${i + 1}`,
          oldLineNumber: i + 1,
          newLineNumber: i + 1,
        })),
      };
      
      const view = new InlineDiffView(diff);
      
      expect(view.render(80, 5)).toHaveLength(5);
      expect(view.render(80, 10)).toHaveLength(10);
      expect(view.render(80, 100)).toHaveLength(20); // Can't show more than total
    });

    it('setDiff updates the rendered content', () => {
      const view = new InlineDiffView(simpleDiff);
      const initialLines = view.render(80, 10);
      
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
      
      view.setDiff(newDiff);
      const newLines = view.render(80, 10);
      
      expect(newLines.some(line => line.includes('new content'))).toBe(true);
      expect(newLines.some(line => line.includes('line 1'))).toBe(false);
      expect(view.totalLines).toBe(1);
    });

    it('setDiff resets scroll offset', () => {
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
      
      const view = new InlineDiffView(largeDiff);
      view.scrollDown(20);
      expect(view.scrollOffset).toBe(20);
      
      view.setDiff(simpleDiff);
      expect(view.scrollOffset).toBe(0);
    });
  });

  describe('Width truncation', () => {
    it('truncates long lines to fit width', () => {
      const diff: FileDiff = {
        filePath: 'test.ts',
        isNewFile: false,
        additions: 1,
        deletions: 0,
        hunks: [
          {
            type: 'added',
            content: 'a'.repeat(200), // Very long line
            oldLineNumber: undefined,
            newLineNumber: 1,
          },
        ],
      };
      
      const view = new InlineDiffView(diff);
      const lines = view.render(50, 10);
      
      expect(lines).toHaveLength(1);
      // Strip ANSI codes to count visible characters
      const visible = lines[0].replace(/\x1b\[\d+m/g, '');
      expect(visible.length).toBeLessThanOrEqual(50);
    });

    it('handles narrow widths gracefully', () => {
      const view = new InlineDiffView(simpleDiff);
      const lines = view.render(20, 10);
      
      expect(lines.length).toBeGreaterThan(0);
      lines.forEach(line => {
        const visible = line.replace(/\x1b\[\d+m/g, '');
        expect(visible.length).toBeLessThanOrEqual(20);
      });
    });
  });

  describe('Syntax highlighting', () => {
    it('calls highlightFn for context lines when provided', () => {
      const calls: Array<{ code: string; filePath: string }> = [];
      const highlightFn = (code: string, filePath: string) => {
        calls.push({ code, filePath });
        return `HIGHLIGHTED:${code}`;
      };
      
      const diff: FileDiff = {
        filePath: 'test.ts',
        isNewFile: false,
        additions: 0,
        deletions: 0,
        hunks: [
          { type: 'context', content: 'const x = 1;', oldLineNumber: 1, newLineNumber: 1 },
          { type: 'added', content: 'const y = 2;', oldLineNumber: undefined, newLineNumber: 2 },
          { type: 'context', content: 'const z = 3;', oldLineNumber: 2, newLineNumber: 3 },
        ],
      };
      
      const view = new InlineDiffView(diff, highlightFn);
      const lines = view.render(80, 10);
      
      // Should be called for 2 context lines, not the added line
      expect(calls).toHaveLength(2);
      expect(calls[0]).toEqual({ code: 'const x = 1;', filePath: 'test.ts' });
      expect(calls[1]).toEqual({ code: 'const z = 3;', filePath: 'test.ts' });
      
      // Context lines should include the highlighted content
      expect(lines[0]).toContain('HIGHLIGHTED:const x = 1;');
      expect(lines[2]).toContain('HIGHLIGHTED:const z = 3;');
    });

    it('does not call highlightFn for added/removed lines', () => {
      const calls: string[] = [];
      const highlightFn = (code: string) => {
        calls.push(code);
        return `HIGHLIGHTED:${code}`;
      };
      
      const diff: FileDiff = {
        filePath: 'test.ts',
        isNewFile: false,
        additions: 1,
        deletions: 1,
        hunks: [
          { type: 'removed', content: 'old line', oldLineNumber: 1, newLineNumber: undefined },
          { type: 'added', content: 'new line', oldLineNumber: undefined, newLineNumber: 1 },
        ],
      };
      
      const view = new InlineDiffView(diff, highlightFn);
      view.render(80, 10);
      
      // Should not be called for added/removed lines
      expect(calls).toHaveLength(0);
    });

    it('works without highlightFn', () => {
      const view = new InlineDiffView(simpleDiff); // No highlightFn
      const lines = view.render(80, 10);
      
      expect(lines.length).toBeGreaterThan(0);
      expect(lines[0]).toContain('line 1'); // Regular rendering works
    });
  });
});
