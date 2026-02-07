/**
 * Returns a status string for the footer
 * @param pendingCount - Number of files with pending changes
 * @returns Status text like "📋 3 files changed" or undefined if no changes
 */
export function getStatusText(pendingCount: number): string | undefined {
  if (pendingCount === 0) {
    return undefined;
  }
  
  const fileWord = pendingCount === 1 ? 'file' : 'files';
  return `📋 ${pendingCount} ${fileWord} changed`;
}

/**
 * Returns widget lines showing changed file summary
 * @param changedFiles - Array of changed files with their stats
 * @returns Array of lines with header and file details, or undefined if empty
 */
export function getWidgetLines(
  changedFiles: { path: string; additions: number; deletions: number }[]
): string[] | undefined {
  if (changedFiles.length === 0) {
    return undefined;
  }
  
  const totalCount = changedFiles.length;
  const fileWord = totalCount === 1 ? 'file' : 'files';
  const header = `📋 ${totalCount} ${fileWord} changed`;
  
  const lines: string[] = [header];
  
  // Show up to 5 files
  const displayFiles = changedFiles.slice(0, 5);
  
  for (const file of displayFiles) {
    const stats = `+${file.additions}/-${file.deletions}`;
    lines.push(`  ${file.path}  ${stats}`);
  }
  
  // If there are more than 5 files, show "+N more"
  if (totalCount > 5) {
    const remaining = totalCount - 5;
    lines.push(`  +${remaining} more`);
  }
  
  return lines;
}
