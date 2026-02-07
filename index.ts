import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { highlightCode, getLanguageFromPath } from "@mariozechner/pi-coding-agent";
import { matchesKey, Key, truncateToWidth } from "@mariozechner/pi-tui";
import { DiffState } from "./src/diff-state";
import { DiffReviewModal } from "./src/modal";
import { DiffViewController } from "./src/diff-view-controller";
import { getStatusText, getWidgetLines } from "./src/status";
import { copyToClipboard } from "./src/clipboard";
import * as fs from "node:fs";
import * as path from "node:path";

export default function (pi: ExtensionAPI) {
  const state = new DiffState();
  const modal = new DiffReviewModal(state);
  let modalOpen = false;
  let currentDoneCallback: ((value: void) => void) | null = null;

  // Pre-captured file content (before tool executes)
  const preCapture = new Map<string, string>();

  function readFileContent(filePath: string): string {
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch {
      return "";
    }
  }

  function resolvePath(filePath: string, cwd: string): string {
    return path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
  }

  function updateStatus(ctx: any) {
    if (!ctx?.hasUI) return;
    const statusText = getStatusText(state.pendingCount);
    ctx.ui.setStatus("diff-review", statusText);

    const changedFiles = state.getChangedFiles();
    if (changedFiles.length > 0) {
      const fileData = changedFiles.map((fp) => {
        const diff = state.getFileDiff(fp);
        return {
          path: fp,
          additions: diff?.additions ?? 0,
          deletions: diff?.deletions ?? 0,
        };
      });
      ctx.ui.setWidget("diff-review", getWidgetLines(fileData) ?? undefined);
    } else {
      ctx.ui.setWidget("diff-review", undefined);
    }
  }

  // --- Pre-capture original content BEFORE tool executes ---
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "write" && event.toolName !== "edit") return;

    const input = event.input as { path?: string };
    if (!input.path) return;

    const resolved = resolvePath(input.path, ctx.cwd);

    // Only capture if not already tracked (first modification)
    if (!state.isTracked(resolved) && !preCapture.has(resolved)) {
      preCapture.set(resolved, readFileContent(resolved));
    }
  });

  // --- Track changes AFTER tool executes ---
  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "write" && event.toolName !== "edit") return;

    const input = event.input as { path?: string; content?: string };
    if (!input.path) return;

    const resolved = resolvePath(input.path, ctx.cwd);

    // Get current content after modification
    const currentContent =
      event.toolName === "write"
        ? (input.content ?? "")
        : readFileContent(resolved);

    if (state.isTracked(resolved)) {
      state.updateFile(resolved, currentContent);
    } else {
      const original = preCapture.get(resolved) ?? "";
      state.trackFile(resolved, original, currentContent);
      preCapture.delete(resolved);
    }

    modal.refresh();
    updateStatus(ctx);
  });

  // --- Ctrl+R shortcut to toggle modal ---
  pi.registerShortcut("ctrl+shift+r", {
    description: "Toggle diff review modal",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;

      if (modalOpen && currentDoneCallback) {
        currentDoneCallback();
        return;
      }

      if (state.pendingCount === 0) {
        ctx.ui.notify("No file changes to review", "info");
        return;
      }

      modal.refresh();
      modalOpen = true;

      await ctx.ui.custom<void>(
        (tui, theme, _keybindings, done) => {
          currentDoneCallback = done;
          let viewController: DiffViewController | null = null;

          // Capture ctx for status updates from within the modal
          const extCtx = ctx;

          function buildViewController() {
            const diff = modal.getSelectedDiff();
            if (diff) {
              const highlightFn = (code: string, filePath: string) => {
                const lang = getLanguageFromPath(filePath);
                if (!lang) return code;
                try {
                  return highlightCode(code, lang, theme);
                } catch {
                  return code;
                }
              };
              viewController = new DiffViewController(diff, highlightFn);
            } else {
              viewController = null;
            }
          }

          buildViewController();

          return {
            render(width: number): string[] {
              const lines: string[] = [];
              const height = tui.height ?? 50;
              const fileList = modal.getFileList();

              if (fileList.length === 0) {
                lines.push(
                  theme.fg("accent", theme.bold(" Diff Review ")) +
                    theme.fg("muted", "(0 files)")
                );
                lines.push(theme.fg("border", "─".repeat(Math.min(width, 80))));
                lines.push(theme.fg("muted", " No files to review"));
                lines.push("");
                lines.push(theme.fg("dim", " Press Escape or Ctrl+R to close"));
                return lines;
              }

              // File picker mode
              if (modal.isFilePickerOpen) {
                lines.push(theme.fg("accent", theme.bold(" File Picker ")));
                lines.push(theme.fg("border", "─".repeat(Math.min(width, 80))));
                lines.push("");

                // Center the file list
                for (let i = 0; i < fileList.length; i++) {
                  const file = fileList[i];
                  const selected = i === modal.filePickerIndex;
                  const prefix = selected ? "▸ " : "  ";
                  const name = selected
                    ? theme.fg("accent", file.path)
                    : theme.fg("text", file.path);
                  const stats = theme.fg("muted", ` +${file.additions}/-${file.deletions}`);
                  const tag = file.isNewFile ? theme.fg("success", " [new]") : "";
                  lines.push(truncateToWidth(`${prefix}${name}${stats}${tag}`, width));
                }

                lines.push("");
                lines.push(theme.fg("dim", " ↑↓ navigate  Enter select  Esc cancel"));
                return lines.map((l) => truncateToWidth(l, width));
              }

              // Full-screen diff view
              const currentFile = fileList[modal.selectedIndex];
              const fileIndex = modal.selectedIndex + 1;
              const totalFiles = fileList.length;

              // Header bar: [N/M] filepath  +X/-Y         View mode
              const fileNumStr = `[${fileIndex}/${totalFiles}]`;
              const filePathStr = theme.fg("accent", currentFile.path);
              const statsStr = theme.fg("muted", ` +${currentFile.additions}/-${currentFile.deletions}`);
              const viewModeStr = viewController 
                ? (viewController.viewMode === "inline" ? "Inline view" : "Side-by-side view")
                : "";

              // Build header with view mode right-aligned
              const leftSide = `${fileNumStr} ${filePathStr}${statsStr}`;
              const leftSideStripped = `${fileNumStr} ${currentFile.path} +${currentFile.additions}/-${currentFile.deletions}`;
              const padding = Math.max(1, width - leftSideStripped.length - viewModeStr.length);
              const header = leftSide + " ".repeat(padding) + theme.fg("dim", viewModeStr);
              
              lines.push(truncateToWidth(header, width));
              lines.push(theme.fg("border", "─".repeat(Math.min(width, 80))));

              // Diff content
              if (viewController) {
                // Reserve space for header (2 lines), scroll indicator (1 line), and help (2 lines)
                const availableHeight = Math.max(5, height - 5);
                const diffLines = viewController.render(width, availableHeight);
                lines.push(...diffLines);

                // Scroll indicator
                if (viewController.totalLines > availableHeight) {
                  const pct = Math.round(
                    ((viewController.scrollOffset + availableHeight) /
                      viewController.totalLines) * 100
                  );
                  lines.push(theme.fg("dim", `── ${Math.min(pct, 100)}% ──`));
                }
              }

              // Help
              lines.push("");
              lines.push(
                theme.fg("dim", " n/p files  d dismiss  Tab file list  Ctrl+D/U scroll  v view  y copy  Esc close")
              );

              return lines.map((l) => truncateToWidth(l, width));
            },

            handleInput(data: string) {
              // File picker mode
              if (modal.isFilePickerOpen) {
                if (matchesKey(data, Key.escape)) {
                  modal.closeFilePicker();
                  tui.requestRender();
                  return;
                }

                if (matchesKey(data, Key.up) || data === "k") {
                  modal.filePickerPrevious();
                  tui.requestRender();
                  return;
                }

                if (matchesKey(data, Key.down) || data === "j") {
                  modal.filePickerNext();
                  tui.requestRender();
                  return;
                }

                if (matchesKey(data, Key.enter)) {
                  modal.confirmFilePickerSelection();
                  buildViewController();
                  tui.requestRender();
                  return;
                }

                return; // Ignore other keys in file picker mode
              }

              // Normal diff view mode
              if (matchesKey(data, Key.escape)) {
                done();
                return;
              }

              // File navigation (n/p)
              if (data === "n") {
                modal.selectNext();
                buildViewController();
                tui.requestRender();
                return;
              }
              if (data === "p") {
                modal.selectPrevious();
                buildViewController();
                tui.requestRender();
                return;
              }

              // Line-by-line scrolling (j/k and arrow keys)
              if (matchesKey(data, Key.up) || data === "k") {
                viewController?.scrollUp(1);
                tui.requestRender();
                return;
              }
              if (matchesKey(data, Key.down) || data === "j") {
                viewController?.scrollDown(1);
                tui.requestRender();
                return;
              }

              // Half-page scroll (Ctrl+U / Ctrl+D)
              if (matchesKey(data, Key.ctrl("u"))) {
                viewController?.scrollUp(10);
                tui.requestRender();
                return;
              }
              if (matchesKey(data, Key.ctrl("d"))) {
                viewController?.scrollDown(10);
                tui.requestRender();
                return;
              }

              // Open file picker (Tab)
              if (matchesKey(data, Key.tab)) {
                modal.openFilePicker();
                tui.requestRender();
                return;
              }

              // Toggle view mode (v)
              if (data === "v") {
                viewController?.toggleViewMode(tui.width);
                tui.requestRender();
                return;
              }

              // Dismiss file
              if (data === "d") {
                modal.dismissSelected();
                updateStatus(extCtx);
                buildViewController();
                tui.requestRender();
                if (modal.getFileList().length === 0) {
                  done();
                }
                return;
              }

              // Copy file path
              if (data === "y") {
                const filePath = modal.getSelectedPath();
                if (filePath) {
                  copyToClipboard(filePath);
                }
                return;
              }
            },

            invalidate() {},
          };
        },
        {
          overlay: true,
          overlayOptions: {
            anchor: "center",
            width: "90%",
            maxHeight: "90%",
            minWidth: 60,
            margin: 1,
          },
        }
      );

      modalOpen = false;
      currentDoneCallback = null;
    },
  });
}
