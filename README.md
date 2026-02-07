# Diff Review 🔍

A [Pi](https://github.com/badlogic/pi-mono) extension for reviewing file diffs in a full-screen modal overlay. Tracks every file the agent touches and lets you review changes with vim-style navigation.

Uses [pi-diff-ui](https://github.com/Aklaran/pi-diff-ui) for core diff rendering.

## Features

- **Unified diffs** across multiple edits to the same file
- **Full-screen per file** layout with box-drawn borders
- **Cursor tracking** with auto-scroll and visual line selection (`V`)
- **Yank to editor** (`y`) — pastes selected code blocks directly into Pi chat
- **Status indicator** showing pending file count

## Installation

```bash
git clone git@github.com:Aklaran/pi-diff.git ~/repos/diff-review
ln -sfn ~/repos/diff-review ~/.pi/agent/extensions/diff-review
cd ~/repos/diff-review && pnpm install && pnpm build
```

Then `/reload` in Pi.

## Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+Shift+R` | Toggle review modal |
| `↑/↓` or `j/k` | Navigate files |
| `Ctrl+U/Ctrl+D` | Scroll diff half-page |
| `V` | Visual line selection |
| `y` | Yank selection to Pi editor + close |
| `d` | Dismiss file (resets baseline) |
| `Escape` | Close modal |

## Part of [Himal](https://github.com/Aklaran/himal) 🏔️

## License

MIT
