import * as vscode from "vscode";
import { resolveAntigravityPaths } from "./core/antigravity-paths";
import { ConversationStore } from "./core/conversation-store";
import { ConversationMigrator } from "./core/conversation-migrator";
import { ConversationExporter } from "./core/conversation-exporter";
import { ConversationImporter } from "./core/conversation-importer";
import { BackupService } from "./core/backup-service";
import { ConversationWebviewProvider } from "./views/conversation-webview-provider";
import { StatusBarManager } from "./status-bar/status-bar-manager";
import {
  handleSwitchConversation,
  handleRenameConversation,
  handleDeleteConversation,
  handleCreateProject,
  handleRenameProject,
  handleDeleteProject
} from "./commands/conversation-actions";
import { handleMoveConversation } from "./commands/move-conversation";
import { handleExportConversation } from "./commands/export-conversation";
import { handleImportConversation } from "./commands/import-conversation";
import { handleBackupAll, handleRestoreBackup } from "./commands/backup-restore";

export function activate(context: vscode.ExtensionContext) {
  const paths = resolveAntigravityPaths();
  const store = new ConversationStore(paths);
  const migrator = new ConversationMigrator(paths);
  const exporter = new ConversationExporter(paths);
  const importer = new ConversationImporter(paths);
  const backupService = new BackupService(paths);

  // 1. Register Status Bar
  const statusBar = new StatusBarManager();
  context.subscriptions.push(statusBar);

  // 2. Register Webview View
  const webviewProvider = new ConversationWebviewProvider(
    context.extensionUri,
    store,
    migrator,
    exporter,
    importer,
    backupService,
    statusBar
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ConversationWebviewProvider.viewType,
      webviewProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    )
  );

  // 3. Real-time Live Watcher (auto-refresh on DB changes without reload)
  try {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.file(paths.baseDir), "conversation_summaries.db")
    );
    let debounceTimer: NodeJS.Timeout | null = null;
    const triggerRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        webviewProvider.refresh();
      }, 800);
    };

    watcher.onDidChange(triggerRefresh);
    watcher.onDidCreate(triggerRefresh);
    watcher.onDidDelete(triggerRefresh);
    context.subscriptions.push(watcher);
  } catch (watcherErr) {
    console.warn("Could not attach file watcher:", watcherErr);
  }

  // 4. Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "boygr.antigravityConversationManager.focusView",
      () => {
        vscode.commands.executeCommand("boygr.antigravityConversationManager.mainView.focus");
      }
    ),
    vscode.commands.registerCommand(
      "boygr.antigravityConversationManager.refresh",
      async () => {
        await webviewProvider.refresh();
      }
    ),
    vscode.commands.registerCommand(
      "boygr.antigravityConversationManager.switchConversation",
      async (convoId?: string) => {
        if (!convoId) {
          const projects = await store.listProjectsAndConversations();
          const items: (vscode.QuickPickItem & { convoId: string; title: string })[] = [];
          for (const p of projects) {
            for (const c of p.conversations) {
              items.push({
                label: `$(comment-discussion) ${c.title}`,
                description: `Project: ${p.name}`,
                detail: c.preview ? c.preview.slice(0, 100) : undefined,
                convoId: c.id,
                title: c.title
              });
            }
          }
          const picked = await vscode.window.showQuickPick(items, {
            placeHolder: "Select a conversation to switch active window to..."
          });
          if (!picked) return;
          const ok = await handleSwitchConversation(store, picked.convoId, picked.title);
          if (ok) await webviewProvider.refresh();
        } else {
          const ok = await handleSwitchConversation(store, convoId);
          if (ok) await webviewProvider.refresh();
        }
      }
    ),
    vscode.commands.registerCommand(
      "boygr.antigravityConversationManager.renameConversation",
      async (convoId?: string) => {
        if (!convoId) {
          const projects = await store.listProjectsAndConversations();
          const items: (vscode.QuickPickItem & { convoId: string; title: string })[] = [];
          for (const p of projects) {
            for (const c of p.conversations) {
              items.push({
                label: `$(comment-discussion) ${c.title}`,
                description: `Project: ${p.name}`,
                convoId: c.id,
                title: c.title
              });
            }
          }
          const picked = await vscode.window.showQuickPick(items, {
            placeHolder: "Select a conversation to rename..."
          });
          if (!picked) return;
          const ok = await handleRenameConversation(store, picked.convoId, picked.title);
          if (ok) await webviewProvider.refresh();
        } else {
          const ok = await handleRenameConversation(store, convoId);
          if (ok) await webviewProvider.refresh();
        }
      }
    ),
    vscode.commands.registerCommand(
      "boygr.antigravityConversationManager.deleteConversation",
      async (convoId?: string) => {
        if (!convoId) {
          const projects = await store.listProjectsAndConversations();
          const items: (vscode.QuickPickItem & { convoId: string; title: string })[] = [];
          for (const p of projects) {
            for (const c of p.conversations) {
              items.push({
                label: `$(comment-discussion) ${c.title}`,
                description: `Project: ${p.name}`,
                convoId: c.id,
                title: c.title
              });
            }
          }
          const picked = await vscode.window.showQuickPick(items, {
            placeHolder: "Select a conversation to delete..."
          });
          if (!picked) return;
          const ok = await handleDeleteConversation(store, picked.convoId, picked.title);
          if (ok) await webviewProvider.refresh();
        } else {
          const ok = await handleDeleteConversation(store, convoId);
          if (ok) await webviewProvider.refresh();
        }
      }
    ),
    vscode.commands.registerCommand(
      "boygr.antigravityConversationManager.createProject",
      async () => {
        const id = await handleCreateProject(store);
        if (id) await webviewProvider.refresh();
      }
    ),
    vscode.commands.registerCommand(
      "boygr.antigravityConversationManager.renameProject",
      async () => {
        const projects = await store.listProjectsAndConversations();
        const items = projects.map((p) => ({
          label: `$(folder) ${p.name}`,
          description: p.workspaceUri ? decodeURIComponent(p.workspaceUri) : p.id,
          id: p.id,
          name: p.name
        }));
        const picked = await vscode.window.showQuickPick(items, {
          placeHolder: "Select a project folder to rename..."
        });
        if (!picked) return;
        const ok = await handleRenameProject(store, picked.id, picked.name);
        if (ok) await webviewProvider.refresh();
      }
    ),
    vscode.commands.registerCommand(
      "boygr.antigravityConversationManager.deleteProject",
      async () => {
        const projects = await store.listProjectsAndConversations();
        const items = projects.map((p) => ({
          label: `$(folder) ${p.name}`,
          description: `${p.conversations.length} conversation(s)`,
          id: p.id,
          name: p.name,
          convoCount: p.conversations.length
        }));
        const picked = await vscode.window.showQuickPick(items, {
          placeHolder: "Select an empty project folder to delete..."
        });
        if (!picked) return;
        const ok = await handleDeleteProject(store, picked.id, picked.name, picked.convoCount);
        if (ok) await webviewProvider.refresh();
      }
    ),
    vscode.commands.registerCommand(
      "boygr.antigravityConversationManager.moveConversation",
      async (convoId?: string) => {
        await handleMoveConversation(store, migrator, convoId);
        await webviewProvider.refresh();
      }
    ),
    vscode.commands.registerCommand(
      "boygr.antigravityConversationManager.exportConversation",
      async (convoId?: string) => {
        await handleExportConversation(store, exporter, convoId, "bundle");
      }
    ),
    vscode.commands.registerCommand(
      "boygr.antigravityConversationManager.exportMarkdown",
      async (convoId?: string) => {
        await handleExportConversation(store, exporter, convoId, "markdown");
      }
    ),
    vscode.commands.registerCommand(
      "boygr.antigravityConversationManager.importConversation",
      async () => {
        await handleImportConversation(store, importer);
        await webviewProvider.refresh();
      }
    ),
    vscode.commands.registerCommand(
      "boygr.antigravityConversationManager.backupAll",
      async () => {
        await handleBackupAll(backupService);
      }
    ),
    vscode.commands.registerCommand(
      "boygr.antigravityConversationManager.restoreBackup",
      async () => {
        await handleRestoreBackup(backupService);
        await webviewProvider.refresh();
      }
    ),
    vscode.commands.registerCommand(
      "boygr.antigravityConversationManager.openSettings",
      async () => {
        await webviewProvider.openSettings();
      }
    )
  );
}

export function deactivate() {}

