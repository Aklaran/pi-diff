/** Re-export core types for convenience */
export type { DiffLine, FileDiff } from './diff-engine';
export type { FileSnapshot } from './diff-state';
export type { ModalFileEntry } from './modal';
export type { HighlightFn } from './inline-view';

/** Mode the diff review modal is currently in */
export type ModalMode = 'diff' | 'filePicker' | 'visual';

/** Direction for cursor movement */
export type CursorDirection = 'up' | 'down';
