import * as vscode from "vscode";
import { ConversationStore } from "../core/conversation-store";
import { ConversationMigrator } from "../core/conversation-migrator";

export async function handleMoveConversation(
  store: ConversationStore,
  migrator: ConversationMigrator,
  targetConversationId?: string
) {
  try {
    const projects = await store.listProjectsAndConversations();
    if (projects.length === 0) {
      vscode.window.showWarningMessage("No Antigravity conversations found.");
      return;
    }

    let selectedConvoId = targetConversationId;
    let selectedConvoTitle = "";

    // 1. Select conversation if not provided
    if (!selectedConvoId) {
      const convoItems: (vscode.QuickPickItem & { convoId: string; currentProjectId: string })[] = [];
      for (const p of projects) {
        for (const c of p.conversations) {
          convoItems.push({
            label: `$(comment-discussion) ${c.title}`,
            description: `Project: ${p.name}`,
            detail: c.preview ? c.preview.slice(0, 100) : undefined,
            convoId: c.id,
            currentProjectId: p.id
          });
        }
      }

      const pickedConvo = await vscode.window.showQuickPick(convoItems, {
        placeHolder: "Select a conversation to move...",
        matchOnDescription: true,
        matchOnDetail: true
      });

      if (!pickedConvo) return;
      selectedConvoId = pickedConvo.convoId;
      selectedConvoTitle = pickedConvo.label.replace("$(comment-discussion) ", "");
    }

    // 2. Select target project
    const projectItems: (vscode.QuickPickItem & { projectId: string; workspaceUris: string[] })[] = projects.map((p) => ({
      label: `$(folder) ${p.name}`,
      description: p.workspaceUri ? decodeURIComponent(p.workspaceUri) : p.id,
      projectId: p.id,
      workspaceUris: p.workspaceUri ? [p.workspaceUri] : []
    }));

    const pickedProject = await vscode.window.showQuickPick(projectItems, {
      placeHolder: "Select target project folder to move into..."
    });

    if (!pickedProject) return;

    const displayTitle = selectedConvoTitle ? `"${selectedConvoTitle}"` : `conversation ${selectedConvoId!.slice(0, 8)}...`;
    const targetLabel = pickedProject.label.replace(/^\$\([^\)]+\)\s*/, "");
    const confirm = await vscode.window.showInformationMessage(
      `Move ${displayTitle} to project "${targetLabel}"?`,
      { modal: true },
      "Move Conversation"
    );

    if (confirm !== "Move Conversation") return;

    // 3. Move
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Moving conversation to ${pickedProject.label}...`,
        cancellable: false
      },
      async () => {
        const config = vscode.workspace.getConfiguration("boygr.antigravityConversationManager");
        const autoBackup = config.get<boolean>("autoBackupBeforeMove") ?? true;

        const res = await migrator.moveConversation(
          selectedConvoId!,
          pickedProject.projectId,
          pickedProject.workspaceUris,
          autoBackup
        );

        if (!res.success) {
          throw new Error(res.error || "Migration failed");
        }
      }
    );

    const reloadAction = "Reload Window (Ctrl+R in Antigravity)";
    const choice = await vscode.window.showInformationMessage(
      `Successfully moved "${selectedConvoTitle || selectedConvoId}" to ${pickedProject.label}!`,
      reloadAction
    );

    if (choice === reloadAction) {
      vscode.commands.executeCommand("workbench.action.reloadWindow");
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to move conversation: ${err.message || err}`);
  }
}

