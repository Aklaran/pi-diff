import type { FileDiff, DiffLine } from './diff-engine';

export type HighlightFn = (code: string, filePath: string) => string;

interface RenderedLine {
  leftContent: string;
  leftRawContent: string;
  rightContent: string;
  rightRawContent: string;
}

export class SideBySideDiffView {
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

    // Calculate panel widths: total width minus 1 for separator, divided by 2
    const panelWidth = Math.floor((width - 1) / 2);

    return visibleLines.map(line => {
      const left = this.truncateToWidth(line.leftContent, panelWidth);
      const right = this.truncateToWidth(line.rightContent, panelWidth);
      
      // Pad both panels to exact width
      const leftPadded = this.padToWidth(left, line.leftRawContent, panelWidth);
      const rightPadded = this.padToWidth(right, line.rightRawContent, panelWidth);
      
      return `${leftPadded}│${rightPadded}`;
    });
  }

  private buildRenderedLines(): void {
    this.renderedLines = [];

    if (this.diff.hunks.length === 0) {
      return;
    }

    // Calculate max line numbers for alignment
    const maxOldLineNumber = this.getMaxOldLineNumber();
    const maxNewLineNumber = this.getMaxNewLineNumber();
    const oldLineNumberWidth = maxOldLineNumber.toString().length;
    const newLineNumberWidth = maxNewLineNumber.toString().length;

    let previousOldLineNumber: number | undefined;
    let previousNewLineNumber: number | undefined;

    for (let i = 0; i < this.diff.hunks.length; i++) {
      const hunk = this.diff.hunks[i];

      // Check if we need a separator (gap in line numbers)
      const currentOldLineNumber = hunk.oldLineNumber;
      const currentNewLineNumber = hunk.newLineNumber;

      if (previousOldLineNumber !== undefined && currentOldLineNumber !== undefined) {
        if (currentOldLineNumber > previousOldLineNumber + 1) {
          this.renderedLines.push(this.createSeparatorLine());
        }
      } else if (previousNewLineNumber !== undefined && currentNewLineNumber !== undefined) {
        if (currentNewLineNumber > previousNewLineNumber + 1) {
          this.renderedLines.push(this.createSeparatorLine());
        }
      }

      this.renderedLines.push(
        this.renderHunk(hunk, oldLineNumberWidth, newLineNumberWidth)
      );

      // Update previous line numbers for gap detection
      if (currentOldLineNumber !== undefined) {
        previousOldLineNumber = currentOldLineNumber;
      }
      if (currentNewLineNumber !== undefined) {
        previousNewLineNumber = currentNewLineNumber;
      }
    }
  }

  private getMaxOldLineNumber(): number {
    let max = 0;
    for (const hunk of this.diff.hunks) {
      if (hunk.oldLineNumber !== undefined) {
        max = Math.max(max, hunk.oldLineNumber);
      }
    }
    return max;
  }

  private getMaxNewLineNumber(): number {
    let max = 0;
    for (const hunk of this.diff.hunks) {
      if (hunk.newLineNumber !== undefined) {
        max = Math.max(max, hunk.newLineNumber);
      }
    }
    return max;
  }

  private renderHunk(
    hunk: DiffLine,
    oldLineNumberWidth: number,
    newLineNumberWidth: number
  ): RenderedLine {
    switch (hunk.type) {
      case 'context':
        return this.renderContextLine(hunk, oldLineNumberWidth, newLineNumberWidth);
      case 'removed':
        return this.renderRemovedLine(hunk, oldLineNumberWidth, newLineNumberWidth);
      case 'added':
        return this.renderAddedLine(hunk, oldLineNumberWidth, newLineNumberWidth);
    }
  }

  private renderContextLine(
    hunk: DiffLine,
    oldLineNumberWidth: number,
    newLineNumberWidth: number
  ): RenderedLine {
    const oldLineNum = hunk.oldLineNumber ?? 0;
    const newLineNum = hunk.newLineNumber ?? 0;
    const oldLineNumStr = oldLineNum.toString().padStart(oldLineNumberWidth, ' ');
    const newLineNumStr = newLineNum.toString().padStart(newLineNumberWidth, ' ');

    // Call highlightFn separately for each panel
    let leftContentText = hunk.content;
    let rightContentText = hunk.content;
    if (this.highlightFn) {
      leftContentText = this.highlightFn(hunk.content, this.diff.filePath);
      rightContentText = this.highlightFn(hunk.content, this.diff.filePath);
    }

    const color = '\x1b[2m'; // Dim
    const reset = '\x1b[0m';

    const leftContent = `${color}${oldLineNumStr} ${leftContentText}${reset}`;
    const leftRawContent = `${oldLineNumStr} ${hunk.content}`;

    const rightContent = `${color}${newLineNumStr} ${rightContentText}${reset}`;
    const rightRawContent = `${newLineNumStr} ${hunk.content}`;

    return {
      leftContent,
      leftRawContent,
      rightContent,
      rightRawContent,
    };
  }

  private renderRemovedLine(
    hunk: DiffLine,
    oldLineNumberWidth: number,
    newLineNumberWidth: number
  ): RenderedLine {
    const oldLineNum = hunk.oldLineNumber ?? 0;
    const oldLineNumStr = oldLineNum.toString().padStart(oldLineNumberWidth, ' ');

    const color = '\x1b[31m'; // Red
    const reset = '\x1b[0m';

    const leftContent = `${color}${oldLineNumStr} ${hunk.content}${reset}`;
    const leftRawContent = `${oldLineNumStr} ${hunk.content}`;

    // Right side is blank
    const newLineNumStr = ''.padStart(newLineNumberWidth, ' ');
    const rightContent = `${newLineNumStr} `;
    const rightRawContent = `${newLineNumStr} `;

    return {
      leftContent,
      leftRawContent,
      rightContent,
      rightRawContent,
    };
  }

  private renderAddedLine(
    hunk: DiffLine,
    oldLineNumberWidth: number,
    newLineNumberWidth: number
  ): RenderedLine {
    const newLineNum = hunk.newLineNumber ?? 0;
    const newLineNumStr = newLineNum.toString().padStart(newLineNumberWidth, ' ');

    const color = '\x1b[32m'; // Green
    const reset = '\x1b[0m';

    const rightContent = `${color}${newLineNumStr} ${hunk.content}${reset}`;
    const rightRawContent = `${newLineNumStr} ${hunk.content}`;

    // Left side is blank
    const oldLineNumStr = ''.padStart(oldLineNumberWidth, ' ');
    const leftContent = `${oldLineNumStr} `;
    const leftRawContent = `${oldLineNumStr} `;

    return {
      leftContent,
      leftRawContent,
      rightContent,
      rightRawContent,
    };
  }

  private createSeparatorLine(): RenderedLine {
    const color = '\x1b[2m'; // Dim
    const reset = '\x1b[0m';
    const content = `${color}···${reset}`;
    const rawContent = '···';

    return {
      leftContent: content,
      leftRawContent: rawContent,
      rightContent: content,
      rightRawContent: rawContent,
    };
  }

  private truncateToWidth(line: string, width: number): string {
    // Simple ANSI-aware truncation
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
          result += escapeSequence;
          inEscape = false;
          escapeSequence = '';
        }
        continue;
      }

      if (visibleLength >= width) {
        break;
      }

      result += char;
      visibleLength++;
    }

    if (result.includes('\x1b[') && !result.endsWith('\x1b[0m')) {
      result += '\x1b[0m';
    }

    return result;
  }

  private padToWidth(content: string, rawContent: string, width: number): string {
    // Calculate visible length (without ANSI codes)
    let visibleLength = 0;
    let inEscape = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];

      if (char === '\x1b') {
        inEscape = true;
        continue;
      }

      if (inEscape) {
        if (char === 'm') {
          inEscape = false;
        }
        continue;
      }

      visibleLength++;
    }

    const padding = width - visibleLength;
    if (padding <= 0) {
      return content;
    }

    // Add padding before the reset code if present
    if (content.endsWith('\x1b[0m')) {
      return content.slice(0, -4) + ' '.repeat(padding) + '\x1b[0m';
    }

    return content + ' '.repeat(padding);
  }
}
