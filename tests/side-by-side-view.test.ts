import { describe, it, expect, beforeEach } from 'vitest';
import { SideBySideDiffView } from '../src/side-by-side-view';
import type { FileDiff, DiffLine } from '../src/diff-engine';

describe('SideBySideDiffView', () => {
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
    it('renders two panels with separator', () => {
      const view = new SideBySideDiffView(simpleDiff);
      const lines = view.render(120, 10);
      
      expect(lines.length).toBeGreaterThan(0);
      // Each line should have a separator
      lines.forEach(line => {
        expect(line).toContain('│');
      });
    });

    it('context lines appear on both sides', () => {
      const view = new SideBySideDiffView(simpleDiff);
      const lines = view.render(120, 10);
      
      // Find the first context line (line 1)
      const contextLine = lines.find(line => line.includes('line 1'));
      expect(contextLine).toBeDefined();
      
      // The line should appear on both sides of the separator
      const parts = contextLine!.split('│');
      expect(parts).toHaveLength(2);
      expect(parts[0]).toContain('line 1');
      expect(parts[1]).toContain('line 1');
    });

    it('removed lines appear only on left', () => {
      const view = new SideBySideDiffView(simpleDiff);
      const lines = view.render(120, 10);
      
      const removedLine = lines.find(line => line.includes('line 2 old'));
      expect(removedLine).toBeDefined();
      
      const parts = removedLine!.split('│');
      expect(parts).toHaveLength(2);
      
      // Left side should have the removed content
      expect(parts[0]).toContain('line 2 old');
      expect(parts[0]).toContain('\x1b[31m'); // Red
      
      // Right side should be mostly blank (just whitespace)
      const rightVisible = parts[1].replace(/\x1b\[\d+m/g, '').trim();
      expect(rightVisible).toBe('');
    });

    it('added lines appear only on right', () => {
      const view = new SideBySideDiffView(simpleDiff);
      const lines = view.render(120, 10);
      
      const addedLine = lines.find(line => line.includes('line 2 new'));
      expect(addedLine).toBeDefined();
      
      const parts = addedLine!.split('│');
      expect(parts).toHaveLength(2);
      
      // Right side should have the added content
      expect(parts[1]).toContain('line 2 new');
      expect(parts[1]).toContain('\x1b[32m'); // Green
      
      // Left side should be mostly blank (just whitespace)
      const leftVisible = parts[0].replace(/\x1b\[\d+m/g, '').trim();
      expect(leftVisible).toBe('');
    });

    it('line numbers shown on each panel', () => {
      const view = new SideBySideDiffView(simpleDiff);
      const lines = view.render(120, 10);
      
      // Find the context line (should have line numbers on both sides)
      const contextLine = lines.find(line => line.includes('line 1'));
      expect(contextLine).toBeDefined();
      
      const parts = contextLine!.split('│');
      
      // Left side should have old line number (1)
      expect(parts[0]).toMatch(/1\s/);
      
      // Right side should have new line number (1)
      expect(parts[1]).toMatch(/1\s/);
    });

    it('respects width - each panel is roughly width/2', () => {
      const view = new SideBySideDiffView(simpleDiff);
      const lines = view.render(120, 10);
      
      lines.forEach(line => {
        // Strip ANSI codes
        const visible = line.replace(/\x1b\[\d+m/g, '');
        // Total width should be approximately the requested width
        expect(visible.length).toBeLessThanOrEqual(120);
        
        // Each side should be roughly half (minus separator)
        const parts = visible.split('│');
        expect(parts).toHaveLength(2);
        
        // Each panel should be around 59 chars (120/2 - 1 for separator)
        const leftWidth = parts[0].length;
        const rightWidth = parts[1].length;
        
        // Allow some tolerance
        expect(leftWidth).toBeGreaterThan(50);
        expect(leftWidth).toBeLessThan(65);
        expect(rightWidth).toBeGreaterThan(50);
        expect(rightWidth).toBeLessThan(65);
      });
    });

    it('renders empty diff as empty array', () => {
      const emptyDiff: FileDiff = {
        filePath: 'empty.ts',
        isNewFile: false,
        additions: 0,
        deletions: 0,
        hunks: [],
      };
      
      const view = new SideBySideDiffView(emptyDiff);
      const lines = view.render(120, 10);
      
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
      
      const view = new SideBySideDiffView(diff);
      const lines = view.render(120, 10);
      
      // Should have 5 lines: 2 context, separator, 2 context
      expect(lines).toHaveLength(5);
      expect(lines[2]).toContain('···');
      
      // Separator should appear on both sides
      const parts = lines[2].split('│');
      expect(parts[0]).toContain('···');
      expect(parts[1]).toContain('···');
    });

    it('does not render separator for contiguous lines', () => {
      const view = new SideBySideDiffView(simpleDiff);
      const lines = view.render(120, 10);
      
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
      const view = new SideBySideDiffView(largeDiff);
      const initialLines = view.render(120, 10);
      
      expect(view.scrollOffset).toBe(0);
      expect(initialLines[0]).toContain('line 1');
      
      view.scrollDown(5);
      const scrolledLines = view.render(120, 10);
      
      expect(view.scrollOffset).toBe(5);
      expect(scrolledLines[0]).toContain('line 6');
    });

    it('scrollUp moves the visible window', () => {
      const view = new SideBySideDiffView(largeDiff);
      
      view.scrollDown(10);
      expect(view.scrollOffset).toBe(10);
      
      view.scrollUp(5);
      expect(view.scrollOffset).toBe(5);
      
      const lines = view.render(120, 10);
      expect(lines[0]).toContain('line 6');
    });

    it('scrollDown defaults to 1 line', () => {
      const view = new SideBySideDiffView(largeDiff);
      
      view.scrollDown();
      expect(view.scrollOffset).toBe(1);
    });

    it('scrollUp defaults to 1 line', () => {
      const view = new SideBySideDiffView(largeDiff);
      
      view.scrollDown(5);
      view.scrollUp();
      expect(view.scrollOffset).toBe(4);
    });

    it('scroll clamps at top bound', () => {
      const view = new SideBySideDiffView(largeDiff);
      
      view.scrollUp(10);
      expect(view.scrollOffset).toBe(0);
      
      const lines = view.render(120, 10);
      expect(lines[0]).toContain('line 1');
    });

    it('scroll clamps at bottom bound', () => {
      const view = new SideBySideDiffView(largeDiff);
      
      view.scrollDown(1000);
      
      const visibleHeight = 10;
      const lines = view.render(120, visibleHeight);
      
      const maxOffset = Math.max(0, view.totalLines - visibleHeight);
      expect(view.scrollOffset).toBe(maxOffset);
      
      expect(lines).toHaveLength(visibleHeight);
      expect(lines[lines.length - 1]).toContain('line 50');
    });

    it('scrollToTop resets to start', () => {
      const view = new SideBySideDiffView(largeDiff);
      
      view.scrollDown(20);
      expect(view.scrollOffset).toBeGreaterThan(0);
      
      view.scrollToTop();
      expect(view.scrollOffset).toBe(0);
      
      const lines = view.render(120, 10);
      expect(lines[0]).toContain('line 1');
    });

    it('scrollToBottom goes to end', () => {
      const view = new SideBySideDiffView(largeDiff);
      
      view.scrollToBottom();
      
      const visibleHeight = 10;
      const lines = view.render(120, visibleHeight);
      
      const maxOffset = Math.max(0, view.totalLines - visibleHeight);
      expect(view.scrollOffset).toBe(maxOffset);
      
      expect(lines[lines.length - 1]).toContain('line 50');
    });
  });

  describe('Render properties', () => {
    it('totalLines reflects actual rendered line count', () => {
      const view = new SideBySideDiffView(simpleDiff);
      
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
      
      const view = new SideBySideDiffView(diff);
      
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
      
      const view = new SideBySideDiffView(diff);
      
      expect(view.render(120, 5)).toHaveLength(5);
      expect(view.render(120, 10)).toHaveLength(10);
      expect(view.render(120, 100)).toHaveLength(20);
    });

    it('setDiff updates the rendered content', () => {
      const view = new SideBySideDiffView(simpleDiff);
      const initialLines = view.render(120, 10);
      
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
      const newLines = view.render(120, 10);
      
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
      
      const view = new SideBySideDiffView(largeDiff);
      view.scrollDown(20);
      expect(view.scrollOffset).toBe(20);
      
      view.setDiff(simpleDiff);
      expect(view.scrollOffset).toBe(0);
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
      
      const view = new SideBySideDiffView(diff, highlightFn);
      const lines = view.render(120, 10);
      
      // Should be called for 2 context lines, twice each (left and right panels)
      expect(calls).toHaveLength(4);
      expect(calls[0]).toEqual({ code: 'const x = 1;', filePath: 'test.ts' });
      expect(calls[1]).toEqual({ code: 'const x = 1;', filePath: 'test.ts' });
      expect(calls[2]).toEqual({ code: 'const z = 3;', filePath: 'test.ts' });
      expect(calls[3]).toEqual({ code: 'const z = 3;', filePath: 'test.ts' });
      
      // Context lines should include the highlighted content on both sides
      expect(lines[0]).toContain('HIGHLIGHTED:const x = 1;');
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
      
      const view = new SideBySideDiffView(diff, highlightFn);
      view.render(120, 10);
      
      expect(calls).toHaveLength(0);
    });

    it('works without highlightFn', () => {
      const view = new SideBySideDiffView(simpleDiff);
      const lines = view.render(120, 10);
      
      expect(lines.length).toBeGreaterThan(0);
      expect(lines[0]).toContain('line 1');
    });
  });
});
