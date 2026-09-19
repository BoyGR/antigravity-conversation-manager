import * as vscode from "vscode";
import * as path from "path";
import { ConversationStore } from "../core/conversation-store";
import { ConversationImporter } from "../core/conversation-importer";

export async function handleImportConversation(
  store: ConversationStore,
  importer: ConversationImporter
) {
  try {
    // 1. Pick bundle file
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        "Antigravity Bundle": ["acm", "agconvo", "zip"]
      },
      openLabel: "Select .acm / .zip Bundle"
    });

    if (!uris || uris.length === 0) return;
    const bundlePath = uris[0].fsPath;

    // 2. Select target project
    const projects = await store.listProjectsAndConversations();
    const projectItems = projects.map((p) => ({
      label: `$(folder) ${p.name}`,
      description: p.workspaceUri ? decodeURIComponent(p.workspaceUri) : p.id,
      projectId: p.id,
      workspaceUris: p.workspaceUri ? [p.workspaceUri] : []
    }));

    const pickedProject = await vscode.window.showQuickPick(projectItems, {
      placeHolder: "Select target project to import conversation into..."
    });

    if (!pickedProject) return;

    const bundleName = path.basename(bundlePath);
    const targetProjName = pickedProject.label.replace(/^\$\([^\)]+\)\s*/, "");
    const confirm = await vscode.window.showInformationMessage(
      `Import bundle "${bundleName}" into project "${targetProjName}"?`,
      { modal: true },
      "Import Conversation"
    );

    if (confirm !== "Import Conversation") return;

    // 3. Perform import
    let importedTitle = "";
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Importing conversation bundle into ${pickedProject.label}...`,
        cancellable: false
      },
      async () => {
        const res = await importer.importBundle({
          bundlePath,
          targetProjectId: pickedProject.projectId,
          targetWorkspaceUris: pickedProject.workspaceUris,
          forceNewId: true // ensure unique ID to prevent conflicts
        });

        if (!res.success) {
          throw new Error(res.error || "Import failed");
        }
        importedTitle = res.title;
      }
    );

    const reloadAction = "Reload Window (Ctrl+R in Antigravity)";
    const choice = await vscode.window.showInformationMessage(
      `Successfully imported "${importedTitle}" into ${pickedProject.label}!`,
      reloadAction
    );

    if (choice === reloadAction) {
      vscode.commands.executeCommand("workbench.action.reloadWindow");
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(`Import failed: ${err.message || err}`);
  }
}

