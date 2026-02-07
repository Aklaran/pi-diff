import type { FileDiff, DiffLine } from './diff-engine';

export type HighlightFn = (code: string, filePath: string) => string;

interface RenderedLine {
  content: string; // Full ANSI-colored line
  rawContent: string; // Without ANSI codes (for length calculations)
}

export class InlineDiffView {
  private diff: FileDiff;
  private highlightFn?: HighlightFn;
  private renderedLines: RenderedLine[] = [];
  private _scrollOffset = 0;

  constructor(diff: FileDiff, highlightFn?: HighlightFn) {
    this.diff = diff;
    this.highlightFn = highlightFn;
    this.buildRenderedLines();
  }

  setDiff(diff: FileDiff): void {
    this.diff = diff;
    this._scrollOffset = 0;
    this.buildRenderedLines();
  }

  scrollUp(lines: number = 1): void {
    this._scrollOffset = Math.max(0, this._scrollOffset - lines);
  }

  scrollDown(lines: number = 1): void {
    this._scrollOffset = Math.min(
      Math.max(0, this.renderedLines.length),
      this._scrollOffset + lines
    );
  }

  scrollToTop(): void {
    this._scrollOffset = 0;
  }

  scrollToBottom(): void {
    this._scrollOffset = Math.max(0, this.renderedLines.length);
  }

  get totalLines(): number {
    return this.renderedLines.length;
  }

  get scrollOffset(): number {
    return this._scrollOffset;
  }

  render(width: number, visibleHeight: number): string[] {
    // Clamp scroll offset to ensure we can fill visibleHeight if possible
    const maxOffset = Math.max(0, this.renderedLines.length - visibleHeight);
    const offset = Math.min(this._scrollOffset, maxOffset);
    this._scrollOffset = offset;

    const endIndex = Math.min(offset + visibleHeight, this.renderedLines.length);
    const visibleLines = this.renderedLines.slice(offset, endIndex);

    return visibleLines.map(line => this.truncateToWidth(line.content, width));
  }

  private buildRenderedLines(): void {
    this.renderedLines = [];

    if (this.diff.hunks.length === 0) {
      return;
    }

    // Calculate max line number for alignment
    const maxLineNumber = this.getMaxLineNumber();
    const lineNumberWidth = maxLineNumber.toString().length;

    let previousLineNumber: number | undefined;

    for (let i = 0; i < this.diff.hunks.length; i++) {
      const hunk = this.diff.hunks[i];
      const currentLineNumber = hunk.newLineNumber ?? hunk.oldLineNumber;

      // Check if we need a separator (gap in line numbers)
      if (previousLineNumber !== undefined && currentLineNumber !== undefined) {
        // There's a gap if the current line is not consecutive
        if (currentLineNumber > previousLineNumber + 1) {
          this.renderedLines.push(this.createSeparatorLine());
        }
      }

      this.renderedLines.push(this.renderHunk(hunk, lineNumberWidth));

      // Update previous line number for gap detection
      if (currentLineNumber !== undefined) {
        previousLineNumber = currentLineNumber;
      }
    }
  }

  private getMaxLineNumber(): number {
    let max = 0;
    for (const hunk of this.diff.hunks) {
      const lineNum = hunk.newLineNumber ?? hunk.oldLineNumber ?? 0;
      max = Math.max(max, lineNum);
    }
    return max;
  }

  private renderHunk(hunk: DiffLine, lineNumberWidth: number): RenderedLine {
    const lineNumber = hunk.newLineNumber ?? hunk.oldLineNumber ?? 0;
    const lineNumStr = lineNumber.toString().padStart(lineNumberWidth, ' ');

    let prefix: string;
    let color: string;
    let content = hunk.content;

    switch (hunk.type) {
      case 'added':
        prefix = '+';
        color = '\x1b[32m'; // Green
        break;
      case 'removed':
        prefix = '-';
        color = '\x1b[31m'; // Red
        break;
      case 'context':
        prefix = ' ';
        color = '\x1b[2m'; // Dim
        // Apply syntax highlighting only to context lines
        if (this.highlightFn) {
          content = this.highlightFn(hunk.content, this.diff.filePath);
        }
        break;
    }

    // Format: [dim line number] [color][prefix] [content][reset]
    const fullContent = `${color}${lineNumStr} ${prefix} ${content}\x1b[0m`;
    const rawContent = `${lineNumStr} ${prefix} ${hunk.content}`;

    return {
      content: fullContent,
      rawContent,
    };
  }

  private createSeparatorLine(): RenderedLine {
    const content = '\x1b[2m···\x1b[0m';
    const rawContent = '···';
    return { content, rawContent };
  }

  private truncateToWidth(line: string, width: number): string {
    // Simple ANSI-aware truncation
    // Count visible characters while preserving ANSI codes
    let visibleLength = 0;
    let result = '';
    let inEscape = false;
    let escapeSequence = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '\x1b') {
        inEscape = true;
        escapeSequence = char;
        continue;
      }

      if (inEscape) {
        escapeSequence += char;
        if (char === 'm') {
          // End of escape sequence
          result += escapeSequence;
          inEscape = false;
          escapeSequence = '';
        }
        continue;
      }

      // Regular character
      if (visibleLength >= width) {
        break;
      }

      result += char;
      visibleLength++;
    }

    // Make sure we close any open escape sequences
    if (result.includes('\x1b[') && !result.endsWith('\x1b[0m')) {
      result += '\x1b[0m';
    }

    return result;
  }
}
