# Contributing

## Development

```bash
cd ~/repos/diff-review
npm install
npm test          # run tests once
npm run test:watch # watch mode
```

## Architecture

The extension is split into focused modules:

- **diff-engine** — computes unified diffs using the `diff` npm package
- **diff-state** — manages file snapshots and baselines
- **inline-view** — renders colored inline diffs with syntax highlighting
- **side-by-side-view** — renders split-panel diffs
- **diff-view-controller** — switches between view modes
- **modal** — manages file list navigation and selection
- **status** — generates status line and widget text
- **clipboard** — cross-platform clipboard access

## Testing

TDD is the rule. Write failing tests first, then implement.

```bash
npx vitest run          # all tests
npx vitest run --watch  # watch mode
```

## Task Tracking

This project uses [Beads](https://github.com/steveyegge/beads) for issue tracking:

```bash
bd ready    # what's unblocked?
bd list     # all issues
bd graph --all  # dependency graph
```
