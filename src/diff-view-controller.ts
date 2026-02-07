import type { FileDiff } from './diff-engine';
import { InlineDiffView, type HighlightFn } from './inline-view';
import { SideBySideDiffView } from './side-by-side-view';

export type ViewMode = 'inline' | 'side-by-side';

export class DiffViewController {
  private inlineView: InlineDiffView;
  private sideBySideView: SideBySideDiffView;
  private _viewMode: ViewMode = 'inline';

  constructor(diff: FileDiff, highlightFn?: HighlightFn) {
    this.inlineView = new InlineDiffView(diff, highlightFn);
    this.sideBySideView = new SideBySideDiffView(diff, highlightFn);
  }

  setDiff(diff: FileDiff): void {
    this.inlineView.setDiff(diff);
    this.sideBySideView.setDiff(diff);
  }

  toggleViewMode(terminalWidth: number): boolean {
    if (this._viewMode === 'inline') {
      // Try to switch to side-by-side
      if (this.canUseSideBySide(terminalWidth)) {
        this._viewMode = 'side-by-side';
        this.resetScroll();
        return true;
      }
      return false;
    } else {
      // Switch back to inline
      this._viewMode = 'inline';
      this.resetScroll();
      return true;
    }
  }

  get viewMode(): ViewMode {
    return this._viewMode;
  }

  setViewMode(mode: ViewMode): void {
    if (this._viewMode !== mode) {
      this._viewMode = mode;
      this.resetScroll();
    }
  }

  canUseSideBySide(terminalWidth: number): boolean {
    return terminalWidth >= 120;
  }

  scrollUp(lines?: number): void {
    this.getActiveView().scrollUp(lines);
  }

  scrollDown(lines?: number): void {
    this.getActiveView().scrollDown(lines);
  }

  scrollToTop(): void {
    this.getActiveView().scrollToTop();
  }

  scrollToBottom(): void {
    this.getActiveView().scrollToBottom();
  }

  render(width: number, visibleHeight: number): string[] {
    return this.getActiveView().render(width, visibleHeight);
  }

  get totalLines(): number {
    return this.getActiveView().totalLines;
  }

  get scrollOffset(): number {
    return this.getActiveView().scrollOffset;
  }

  private getActiveView(): InlineDiffView | SideBySideDiffView {
    return this._viewMode === 'inline' ? this.inlineView : this.sideBySideView;
  }

  private resetScroll(): void {
    this.inlineView.scrollToTop();
    this.sideBySideView.scrollToTop();
  }
}
