# Diff Review 🔍

A Pi extension for reviewing file diffs in a modal overlay. Built with TDD (140 tests).

## Features

- **Unified diffs** across multiple edits to the same file
- **Inline and side-by-side** view modes (auto-fallback on narrow terminals)
- **Syntax highlighting** via Pi's `highlightCode()`
- **Keyboard-driven** navigation, dismissal, clipboard copy
- **Status indicator** showing pending file count

## Installation

Symlink into your Pi extensions directory:

```bash
ln -sfn ~/repos/diff-review ~/.pi/agent/extensions/diff-review
```

Then `/reload` in Pi.

## Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+Shift+R` | Toggle review modal |
| `↑/↓` or `j/k` | Navigate files |
| `Tab` | Toggle inline/side-by-side |
| `Ctrl+U/Ctrl+D` | Scroll diff half-page |
| `d` | Dismiss file (resets baseline) |
| `y` | Copy file path to clipboard |
| `Escape` | Close modal |
