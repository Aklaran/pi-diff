import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { highlightCode, getLanguageFromPath } from "@mariozechner/pi-coding-agent";
import { matchesKey, Key, truncateToWidth } from "@mariozechner/pi-tui";
import { DiffState, DiffReviewModal, createOverlayHandler } from "pi-diff-ui";
import { getStatusText, getWidgetLines } from "./src/status";
import { resolvePath } from "./src/path-utils";

import * as fs from "node:fs";

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
          const highlightProvider = (code: string, filePath: string) => {
            const lang = getLanguageFromPath(filePath);
            if (!lang) return code;
            try {
              return highlightCode(code, lang, theme);
            } catch {
              return code;
            }
          };
          const keyUtils = { matchesKey, Key, truncateToWidth };
          return createOverlayHandler(modal, tui, theme, keyUtils, highlightProvider, done, {
            onDismiss: () => updateStatus(ctx),
            onPasteToEditor: (text) => ctx.ui.pasteToEditor(text),
          });
        },
        {
          overlay: true,
          overlayOptions: { anchor: "center", width: "90%", minWidth: 60, margin: 1 },
        }
      );

      modalOpen = false;
      currentDoneCallback = null;
    },
  });
}
