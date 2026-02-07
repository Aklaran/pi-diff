import type { FileDiff, DiffLine } from './diff-engine';
import { InlineDiffView, type HighlightFn } from './inline-view';

export class DiffViewController {
  private inlineView: InlineDiffView;

  constructor(diff: FileDiff, highlightFn?: HighlightFn) {
    this.inlineView = new InlineDiffView(diff, highlightFn);
  }

  setDiff(diff: FileDiff): void {
    this.inlineView.setDiff(diff);
  }

  // Scroll methods
  scrollUp(lines?: number): void {
    this.inlineView.scrollUp(lines);
  }

  scrollDown(lines?: number): void {
    this.inlineView.scrollDown(lines);
  }

  scrollToTop(): void {
    this.inlineView.scrollToTop();
  }

  scrollToBottom(): void {
    this.inlineView.scrollToBottom();
  }

  // Render methods
  render(width: number, visibleHeight: number): string[] {
    return this.inlineView.render(width, visibleHeight);
  }

  get totalLines(): number {
    return this.inlineView.totalLines;
  }

  get scrollOffset(): number {
    return this.inlineView.scrollOffset;
  }

  // Cursor methods
  get cursorLine(): number {
    return this.inlineView.cursorLine;
  }

  moveCursor(delta: number): void {
    this.inlineView.moveCursor(delta);
  }

  setCursor(line: number): void {
    this.inlineView.setCursor(line);
  }

  getCursorDiffLine(): DiffLine | undefined {
    return this.inlineView.getCursorDiffLine();
  }

  isSeparatorLine(index: number): boolean {
    return this.inlineView.isSeparatorLine(index);
  }

  // Visual mode methods
  get isVisualMode(): boolean {
    return this.inlineView.isVisualMode;
  }

  enterVisualMode(): void {
    this.inlineView.enterVisualMode();
  }

  exitVisualMode(): void {
    this.inlineView.exitVisualMode();
  }

  getVisualRange(): [number, number] {
    return this.inlineView.getVisualRange();
  }

  getSelectedRawLines(): string[] {
    return this.inlineView.getSelectedRawLines();
  }

  getSelectedDiffLines(): DiffLine[] {
    return this.inlineView.getSelectedDiffLines();
  }
}
