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
              const height = tui.height;
              const fileList = modal.getFileList();

              // Title bar
              lines.push(
                theme.fg("accent", theme.bold(" Diff Review ")) +
                  theme.fg("muted", `(${fileList.length} files)`)
              );
              lines.push(theme.fg("border", "─".repeat(Math.min(width, 80))));

              if (fileList.length === 0) {
                lines.push(theme.fg("muted", " No files to review"));
                lines.push("");
                lines.push(theme.fg("dim", " Press Escape or Ctrl+R to close"));
                return lines;
              }

              // File list
              for (let i = 0; i < fileList.length; i++) {
                const file = fileList[i];
                const selected = i === modal.selectedIndex;
                const prefix = selected ? "▸ " : "  ";
                const name = selected
                  ? theme.fg("accent", file.path)
                  : theme.fg("text", file.path);
                const stats = theme.fg("muted", ` +${file.additions}/-${file.deletions}`);
                const tag = file.isNewFile ? theme.fg("success", " [new]") : "";
                lines.push(truncateToWidth(`${prefix}${name}${stats}${tag}`, width));
              }

              lines.push(theme.fg("border", "─".repeat(Math.min(width, 80))));

              // View mode
              if (viewController) {
                const mode = viewController.viewMode === "inline" ? "Inline" : "Side-by-side";
                lines.push(theme.fg("dim", ` ${mode} view`));
              }

              // Diff content
              if (viewController) {
                // In overlay mode tui.height is undefined, so use a generous max
                const availableHeight = Math.max(5, (height ?? 50) - lines.length - 2);
                const diffLines = viewController.render(width, availableHeight);
                lines.push(...diffLines);

                if (viewController.totalLines > availableHeight) {
                  const pct = Math.round(
                    ((viewController.scrollOffset + availableHeight) /
                      viewController.totalLines) * 100
                  );
                  lines.push(theme.fg("dim", ` ── ${Math.min(pct, 100)}% ──`));
                }
              }

              // Help
              lines.push("");
              lines.push(
                theme.fg("dim", " ↑↓ navigate  Tab toggle view  d dismiss  y copy path  Esc close")
              );

              return lines.map((l) => truncateToWidth(l, width));
            },

            handleInput(data: string) {
              if (matchesKey(data, Key.escape)) {
                done();
                return;
              }

              // File navigation
              if (matchesKey(data, Key.up) || data === "k") {
                modal.selectPrevious();
                buildViewController();
                tui.requestRender();
                return;
              }
              if (matchesKey(data, Key.down) || data === "j") {
                modal.selectNext();
                buildViewController();
                tui.requestRender();
                return;
              }

              // Scroll diff (Ctrl+U / Ctrl+D for half-page)
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

              // Toggle view mode
              if (matchesKey(data, Key.tab)) {
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
