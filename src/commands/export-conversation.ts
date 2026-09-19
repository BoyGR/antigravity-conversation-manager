import * as vscode from "vscode";
import * as path from "path";
import { ConversationStore } from "../core/conversation-store";
import { ConversationExporter } from "../core/conversation-exporter";

export async function handleExportConversation(
  store: ConversationStore,
  exporter: ConversationExporter,
  targetConversationId?: string,
  forceFormat?: "bundle" | "markdown"
) {
  try {
    const projects = await store.listProjectsAndConversations();
    if (projects.length === 0) {
      vscode.window.showWarningMessage("No Antigravity conversations found.");
      return;
    }

    let selectedConvoId = targetConversationId;
    let selectedConvoTitle = "conversation";

    if (!selectedConvoId) {
      const convoItems: (vscode.QuickPickItem & { convoId: string; title: string })[] = [];
      for (const p of projects) {
        for (const c of p.conversations) {
          convoItems.push({
            label: `$(comment-discussion) ${c.title}`,
            description: `Project: ${p.name}`,
            detail: `Steps: ${c.stepCount} • Size: ${(c.dbSizeBytes / 1024).toFixed(1)} KB`,
            convoId: c.id,
            title: c.title
          });
        }
      }

      const picked = await vscode.window.showQuickPick(convoItems, {
        placeHolder: "Select conversation to export...",
        matchOnDescription: true
      });

      if (!picked) return;
      selectedConvoId = picked.convoId;
      selectedConvoTitle = picked.title;
    } else {
      // Look up title
      for (const p of projects) {
        const found = p.conversations.find((c) => c.id === selectedConvoId);
        if (found) {
          selectedConvoTitle = found.title;
          break;
        }
      }
    }

    // 2. Select format
    let format = forceFormat;
    if (!format) {
      const formatPick = await vscode.window.showQuickPick(
        [
          {
            label: "$(archive) Portable Bundle (.acm)",
            description: "Complete package (Database + Brain + Manifest) for sharing and importing",
            format: "bundle" as const
          },
          {
            label: "$(markdown) Document (.md)",
            description: "Readable Markdown document with user messages, thoughts, and replies",
            format: "markdown" as const
          }
        ],
        { placeHolder: "Choose export format..." }
      );

      if (!formatPick) return;
      format = formatPick.format;
    }

    // Sanitize filename
    const safeTitle = selectedConvoTitle.replace(/[\\/:*?"<>|]/g, "_").trim() || "conversation";
    const defaultExt = format === "bundle" ? ".acm" : ".md";
    const defaultFileName = `${safeTitle}${defaultExt}`;

    // 3. Prompt save path
    const saveUri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultFileName),
      filters: format === "bundle" ? { "Antigravity Bundle": ["acm", "zip", "agconvo"] } : { "Markdown": ["md"] }
    });

    if (!saveUri) return;

    // 4. Perform export
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Exporting conversation (${format})...`,
        cancellable: false
      },
      async () => {
        await exporter.exportConversation({
          conversationId: selectedConvoId!,
          outputPath: saveUri.fsPath,
          format: format!
        });
      }
    );

    const openAction = "Open File / Folder";
    const choice = await vscode.window.showInformationMessage(
      `Successfully exported conversation to ${path.basename(saveUri.fsPath)}!`,
      openAction
    );

    if (choice === openAction) {
      vscode.env.openExternal(vscode.Uri.file(path.dirname(saveUri.fsPath)));
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(`Export failed: ${err.message || err}`);
  }
}

