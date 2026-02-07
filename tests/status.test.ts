import { describe, it, expect } from 'vitest';
import { getStatusText, getWidgetLines } from '../src/status';

describe('getStatusText', () => {
  it('returns undefined for 0 files', () => {
    expect(getStatusText(0)).toBeUndefined();
  });

  it('returns singular for 1 file', () => {
    expect(getStatusText(1)).toBe('📋 1 file changed');
  });

  it('returns plural for multiple files', () => {
    expect(getStatusText(3)).toBe('📋 3 files changed');
    expect(getStatusText(10)).toBe('📋 10 files changed');
  });
});

describe('getWidgetLines', () => {
  it('returns undefined for empty array', () => {
    expect(getWidgetLines([])).toBeUndefined();
  });

  it('shows header + file lines with correct format', () => {
    const result = getWidgetLines([
      { path: 'src/foo.ts', additions: 5, deletions: 2 },
      { path: 'src/bar.ts', additions: 12, deletions: 0 },
    ]);
    
    expect(result).toEqual([
      '📋 2 files changed',
      '  src/foo.ts  +5/-2',
      '  src/bar.ts  +12/-0',
    ]);
  });

  it('shows singular file count in header', () => {
    const result = getWidgetLines([
      { path: 'src/single.ts', additions: 3, deletions: 1 },
    ]);
    
    expect(result).toEqual([
      '📋 1 file changed',
      '  src/single.ts  +3/-1',
    ]);
  });

  it('truncates at 5 files with "+N more" message', () => {
    const files = [
      { path: 'file1.ts', additions: 1, deletions: 0 },
      { path: 'file2.ts', additions: 2, deletions: 1 },
      { path: 'file3.ts', additions: 3, deletions: 2 },
      { path: 'file4.ts', additions: 4, deletions: 3 },
      { path: 'file5.ts', additions: 5, deletions: 4 },
      { path: 'file6.ts', additions: 6, deletions: 5 },
      { path: 'file7.ts', additions: 7, deletions: 6 },
    ];
    
    const result = getWidgetLines(files);
    
    expect(result).toEqual([
      '📋 7 files changed',
      '  file1.ts  +1/-0',
      '  file2.ts  +2/-1',
      '  file3.ts  +3/-2',
      '  file4.ts  +4/-3',
      '  file5.ts  +5/-4',
      '  +2 more',
    ]);
  });

  it('shows correct +N/-N format with various numbers', () => {
    const result = getWidgetLines([
      { path: 'zero-deletions.ts', additions: 10, deletions: 0 },
      { path: 'zero-additions.ts', additions: 0, deletions: 5 },
      { path: 'both.ts', additions: 100, deletions: 50 },
    ]);
    
    expect(result).toEqual([
      '📋 3 files changed',
      '  zero-deletions.ts  +10/-0',
      '  zero-additions.ts  +0/-5',
      '  both.ts  +100/-50',
    ]);
  });
});
