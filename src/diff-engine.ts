import * as Diff from 'diff';

export interface DiffLine {
  type: 'added' | 'removed' | 'context';
  content: string;  // the line text (without +/- prefix)
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface FileDiff {
  filePath: string;
  isNewFile: boolean;
  hunks: DiffLine[];
  additions: number;
  deletions: number;
}

export function computeDiff(filePath: string, original: string, current: string): FileDiff {
  // Check if this is a new file (empty original, non-empty current)
  const isNewFile = original === '' && current !== '';
  
  // Handle edge case: both empty
  if (original === '' && current === '') {
    return {
      filePath,
      isNewFile: false,
      hunks: [],
      additions: 0,
      deletions: 0,
    };
  }
  
  // Compute unified diff with context
  const patches = Diff.structuredPatch(
    filePath,
    filePath,
    original,
    current,
    undefined,
    undefined,
    { context: 3 }
  );
  
  const hunks: DiffLine[] = [];
  let additions = 0;
  let deletions = 0;
  
  // Process each hunk
  for (const hunk of patches.hunks) {
    let oldLineNum = hunk.oldStart;
    let newLineNum = hunk.newStart;
    
    for (const line of hunk.lines) {
      const firstChar = line[0];
      const content = line.substring(1);
      
      if (firstChar === '+') {
        hunks.push({
          type: 'added',
          content,
          newLineNumber: newLineNum,
        });
        additions++;
        newLineNum++;
      } else if (firstChar === '-') {
        hunks.push({
          type: 'removed',
          content,
          oldLineNumber: oldLineNum,
        });
        deletions++;
        oldLineNum++;
      } else {
        // Context line (starts with space)
        hunks.push({
          type: 'context',
          content,
          oldLineNumber: oldLineNum,
          newLineNumber: newLineNum,
        });
        oldLineNum++;
        newLineNum++;
      }
    }
  }
  
  return {
    filePath,
    isNewFile,
    hunks,
    additions,
    deletions,
  };
}
