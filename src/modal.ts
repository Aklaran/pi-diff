import { DiffState } from './diff-state';
import { FileDiff } from './diff-engine';

export interface ModalFileEntry {
  path: string;
  additions: number;
  deletions: number;
  isNewFile: boolean;
}

export class DiffReviewModal {
  private _selectedIndex: number = 0;
  private _fileList: ModalFileEntry[] = [];

  constructor(private diffState: DiffState) {
    this.refresh();
  }

  /**
   * Get the list of files with changes for display
   */
  getFileList(): ModalFileEntry[] {
    return this._fileList;
  }

  /**
   * Get currently selected index
   */
  get selectedIndex(): number {
    return this._selectedIndex;
  }

  /**
   * Get currently selected file path
   */
  get selectedFile(): string | undefined {
    if (this._fileList.length === 0) {
      return undefined;
    }
    return this._fileList[this._selectedIndex]?.path;
  }

  /**
   * Select next file (wraps around)
   */
  selectNext(): void {
    if (this._fileList.length === 0) {
      return;
    }
    this._selectedIndex = (this._selectedIndex + 1) % this._fileList.length;
  }

  /**
   * Select previous file (wraps around)
   */
  selectPrevious(): void {
    if (this._fileList.length === 0) {
      return;
    }
    this._selectedIndex = this._selectedIndex === 0 
      ? this._fileList.length - 1 
      : this._selectedIndex - 1;
  }

  /**
   * Select file at specific index (clamped to valid range)
   */
  selectIndex(index: number): void {
    if (this._fileList.length === 0) {
      this._selectedIndex = 0;
      return;
    }
    this._selectedIndex = Math.max(0, Math.min(index, this._fileList.length - 1));
  }

  /**
   * Get diff for currently selected file
   */
  getSelectedDiff(): FileDiff | undefined {
    const selectedPath = this.selectedFile;
    if (!selectedPath) {
      return undefined;
    }
    return this.diffState.getFileDiff(selectedPath);
  }

  /**
   * Dismiss the currently selected file
   * Returns false if nothing selected
   */
  dismissSelected(): boolean {
    const selectedPath = this.selectedFile;
    if (!selectedPath) {
      return false;
    }

    this.diffState.dismissFile(selectedPath);
    this.refresh();

    // If we dismissed the last file and there are still files,
    // clamp the index to the new last file
    if (this._selectedIndex >= this._fileList.length && this._fileList.length > 0) {
      this._selectedIndex = this._fileList.length - 1;
    }

    return true;
  }

  /**
   * Get the path of the currently selected file
   */
  getSelectedPath(): string | undefined {
    return this.selectedFile;
  }

  /**
   * Refresh file list from DiffState (call after state changes)
   */
  refresh(): void {
    const changedFiles = this.diffState.getChangedFiles();
    this._fileList = changedFiles.map(path => {
      const diff = this.diffState.getFileDiff(path);
      return {
        path,
        additions: diff?.additions ?? 0,
        deletions: diff?.deletions ?? 0,
        isNewFile: diff?.isNewFile ?? false,
      };
    });

    // Clamp selection index to valid range
    if (this._fileList.length === 0) {
      this._selectedIndex = 0;
    } else if (this._selectedIndex >= this._fileList.length) {
      this._selectedIndex = this._fileList.length - 1;
    }
  }
}
