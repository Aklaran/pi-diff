import * as os from "node:os";
import * as path from "node:path";

/**
 * Expands tilde (~) in file paths to the user's home directory.
 * 
 * @param filePath - The file path that may contain a tilde
 * @returns The path with tilde expanded, or the original path if no tilde at start
 * 
 * @example
 * expandPath("~") // returns "/home/user"
 * expandPath("~/Documents") // returns "/home/user/Documents"
 * expandPath("/absolute/path") // returns "/absolute/path"
 * expandPath("relative/path") // returns "relative/path"
 */
export function expandPath(filePath: string): string {
  if (filePath === '~') return os.homedir();
  if (filePath.startsWith('~/')) return path.join(os.homedir(), filePath.slice(2));
  return filePath;
}

/**
 * Resolves a file path, expanding tilde and resolving relative paths against cwd.
 * 
 * @param filePath - The file path to resolve (may be absolute, relative, or tilde-prefixed)
 * @param cwd - The current working directory to resolve relative paths against
 * @returns The fully resolved absolute path
 * 
 * @example
 * resolvePath("~/test.txt", "/some/dir") // returns "/home/user/test.txt"
 * resolvePath("file.txt", "/some/dir") // returns "/some/dir/file.txt"
 * resolvePath("/absolute.txt", "/some/dir") // returns "/absolute.txt"
 */
export function resolvePath(filePath: string, cwd: string): string {
  const expanded = expandPath(filePath);
  return path.isAbsolute(expanded) ? expanded : path.resolve(cwd, expanded);
}
