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
  private _cursorLine = 0;
  private _lineToHunkIndex: number[] = [];
  private _visualMode: boolean = false;
  private _visualAnchor: number = 0;

  constructor(diff: FileDiff, highlightFn?: HighlightFn) {
    this.diff = diff;
    this.highlightFn = highlightFn;
    this.buildRenderedLines();
  }

  get cursorLine(): number {
    return this._cursorLine;
  }

  get isVisualMode(): boolean {
    return this._visualMode;
  }

  get visualAnchor(): number {
    return this._visualAnchor;
  }

  enterVisualMode(): void {
    this._visualMode = true;
    this._visualAnchor = this._cursorLine;
  }

  exitVisualMode(): void {
    this._visualMode = false;
  }

  getVisualRange(): [number, number] {
    const min = Math.min(this._visualAnchor, this._cursorLine);
    const max = Math.max(this._visualAnchor, this._cursorLine);
    return [min, max];
  }

  getSelectedRawLines(): string[] {
    const [min, max] = this.getVisualRange();
    const selectedLines: string[] = [];
    
    for (let i = min; i <= max; i++) {
      if (i >= 0 && i < this.renderedLines.length) {
        selectedLines.push(this.renderedLines[i].rawContent);
      }
    }
    
    return selectedLines;
  }

  getSelectedDiffLines(): DiffLine[] {
    const [min, max] = this.getVisualRange();
    const selectedDiffLines: DiffLine[] = [];
    
    for (let i = min; i <= max; i++) {
      if (i >= 0 && i < this._lineToHunkIndex.length) {
        const hunkIndex = this._lineToHunkIndex[i];
        if (hunkIndex !== -1 && hunkIndex !== undefined) {
          selectedDiffLines.push(this.diff.hunks[hunkIndex]);
        }
      }
    }
    
    return selectedDiffLines;
  }

  setDiff(diff: FileDiff): void {
    this.diff = diff;
    this._scrollOffset = 0;
    this._cursorLine = 0;
    this._visualMode = false;
    this.buildRenderedLines();
  }

  moveCursor(delta: number): void {
    const newCursor = this._cursorLine + delta;
    this.setCursor(newCursor);
  }

  setCursor(line: number): void {
    const maxLine = Math.max(0, this.renderedLines.length - 1);
    this._cursorLine = Math.max(0, Math.min(line, maxLine));
    // Auto-scroll happens in render() since we need visibleHeight
  }

  getCursorDiffLine(): DiffLine | undefined {
    if (this.renderedLines.length === 0) {
      return undefined;
    }
    
    const hunkIndex = this._lineToHunkIndex[this._cursorLine];
    if (hunkIndex === -1 || hunkIndex === undefined) {
      return undefined;
    }
    
    return this.diff.hunks[hunkIndex];
  }

  isSeparatorLine(index: number): boolean {
    if (index < 0 || index >= this._lineToHunkIndex.length) {
      return false;
    }
    return this._lineToHunkIndex[index] === -1;
  }

  scrollUp(lines: number = 1): void {
    this._scrollOffset = Math.max(0, this._scrollOffset - lines);
    this.moveCursor(-lines);
  }

  scrollDown(lines: number = 1): void {
    this._scrollOffset = Math.min(
      Math.max(0, this.renderedLines.length),
      this._scrollOffset + lines
    );
    this.moveCursor(lines);
  }

  scrollToTop(): void {
    this._scrollOffset = 0;
    this._cursorLine = 0;
  }

  scrollToBottom(): void {
    this._scrollOffset = Math.max(0, this.renderedLines.length);
    this._cursorLine = Math.max(0, this.renderedLines.length - 1);
  }

  get totalLines(): number {
    return this.renderedLines.length;
  }

  get scrollOffset(): number {
    return this._scrollOffset;
  }

  render(width: number, visibleHeight: number): string[] {
    // Auto-scroll to keep cursor visible
    if (this._cursorLine >= this._scrollOffset + visibleHeight) {
      this._scrollOffset = this._cursorLine - visibleHeight + 1;
    }
    if (this._cursorLine < this._scrollOffset) {
      this._scrollOffset = this._cursorLine;
    }
    
    // Clamp scroll offset to ensure we can fill visibleHeight if possible
    const maxOffset = Math.max(0, this.renderedLines.length - visibleHeight);
    const offset = Math.min(this._scrollOffset, maxOffset);
    this._scrollOffset = offset;

    const endIndex = Math.min(offset + visibleHeight, this.renderedLines.length);
    const visibleLines = this.renderedLines.slice(offset, endIndex);

    return visibleLines.map((line, index) => {
      const lineIndex = offset + index;
      let content = line.content;
      
      // Check if line is within visual range
      let inVisualRange = false;
      if (this._visualMode) {
        const [min, max] = this.getVisualRange();
        inVisualRange = lineIndex >= min && lineIndex <= max;
      }
      
      // Highlight cursor line or visual selection with subtle dark gray background
      if (inVisualRange || lineIndex === this._cursorLine) {
        // Use 256-color dark gray background (236 = #303030) — subtle, won't clash with syntax colors
        // Wrap entire line: set bg at start, reset bg before final reset
        content = content.replace(/\x1b\[0m$/, '\x1b[49m\x1b[0m');
        content = `\x1b[48;5;236m${content}`;
      }
      
      return this.truncateToWidth(content, width);
    });
  }

  private buildRenderedLines(): void {
    this.renderedLines = [];
    this._lineToHunkIndex = [];

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
          this._lineToHunkIndex.push(-1); // -1 indicates separator
        }
      }

      this.renderedLines.push(this.renderHunk(hunk, lineNumberWidth));
      this._lineToHunkIndex.push(i); // Map to hunk index

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
