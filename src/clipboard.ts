import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Copy text to clipboard. Returns true on success, false on failure.
 * Tries xclip first, then xsel, then pbcopy (macOS).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  const commands = [
    { cmd: 'xclip', args: '-selection clipboard' },
    { cmd: 'xsel', args: '--clipboard --input' },
    { cmd: 'pbcopy', args: '' },
  ];

  for (const { cmd, args } of commands) {
    try {
      const fullCommand = args ? `echo ${JSON.stringify(text)} | ${cmd} ${args}` : `echo ${JSON.stringify(text)} | ${cmd}`;
      await execAsync(fullCommand, { timeout: 5000 });
      return true;
    } catch (error) {
      // Try next command
      continue;
    }
  }

  return false;
}
