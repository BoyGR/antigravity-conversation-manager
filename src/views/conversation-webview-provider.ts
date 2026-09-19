import * as vscode from "vscode";
import * as path from "path";
import { ConversationStore, ProjectGroup } from "../core/conversation-store";
import { ConversationMigrator } from "../core/conversation-migrator";
import { ConversationExporter } from "../core/conversation-exporter";
import { ConversationImporter } from "../core/conversation-importer";
import { BackupService } from "../core/backup-service";
import { LabelManager } from "../core/label-manager";
import { handleMoveConversation } from "../commands/move-conversation";
import { handleExportConversation } from "../commands/export-conversation";
import { handleImportConversation } from "../commands/import-conversation";
import { handleBackupAll, handleRestoreBackup } from "../commands/backup-restore";
import {
  handleSwitchConversation,
  handleRenameConversation,
  handleDeleteConversation,
  handleCreateProject,
  handleRenameProject,
  handleDeleteProject
} from "../commands/conversation-actions";
import { StatusBarManager } from "../status-bar/status-bar-manager";

export class ConversationWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "boygr.antigravityConversationManager.mainView";
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _store: ConversationStore,
    private readonly _migrator: ConversationMigrator,
    private readonly _exporter: ConversationExporter,
    private readonly _importer: ConversationImporter,
    private readonly _backupService: BackupService,
    private readonly _statusBar?: StatusBarManager
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, "dist"),
        vscode.Uri.joinPath(this._extensionUri, "media")
      ]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.refresh();
      }
    });

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "ready": {
          await this.refresh();
          break;
        }
        case "refresh": {
          await this.refresh();
          break;
        }
        case "switch": {
          const ok = await handleSwitchConversation(this._store, data.conversationId, data.title);
          if (ok) await this.refresh();
          break;
        }
        case "move": {
          await handleMoveConversation(this._store, this._migrator, data.conversationId);
          await this.refresh();
          break;
        }
        case "exportBundle": {
          await handleExportConversation(this._store, this._exporter, data.conversationId, "bundle");
          break;
        }
        case "exportMarkdown": {
          await handleExportConversation(this._store, this._exporter, data.conversationId, "markdown");
          break;
        }
        case "import": {
          await handleImportConversation(this._store, this._importer);
          await this.refresh();
          break;
        }
        case "backup": {
          await handleBackupAll(this._backupService);
          break;
        }
        case "restore": {
          await handleRestoreBackup(this._backupService);
          await this.refresh();
          break;
        }
        case "rename": {
          const ok = await handleRenameConversation(this._store, data.conversationId, data.title);
          if (ok) await this.refresh();
          break;
        }
        case "delete": {
          const ok = await handleDeleteConversation(this._store, data.conversationId, data.title);
          if (ok) await this.refresh();
          break;
        }
        case "createProject": {
          const id = await handleCreateProject(this._store);
          if (id) await this.refresh();
          break;
        }
        case "renameProject": {
          const ok = await handleRenameProject(this._store, data.projectId, data.currentName);
          if (ok) await this.refresh();
          break;
        }
        case "deleteProject": {
          const ok = await handleDeleteProject(this._store, data.projectId, data.projectName, data.convoCount || 0);
          if (ok) await this.refresh();
          break;
        }
        case "executeSwitch": {
          try {
            await this._store.switchConversation(data.conversationId);
            vscode.window.setStatusBarMessage(`$(check) Switched active conversation to "${data.title || data.conversationId}"`, 4000);
            await this.refresh();
          } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to switch conversation: ${err.message || err}`);
          }
          break;
        }
        case "executeRename": {
          try {
            await this._store.renameConversation(data.conversationId, data.newTitle);
            vscode.window.setStatusBarMessage(`$(check) Conversation renamed to "${data.newTitle}"`, 4000);
            await this.refresh();
          } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to rename conversation: ${err.message || err}`);
          }
          break;
        }
        case "executeDelete": {
          try {
            await this._store.deleteConversation(data.conversationId);
            vscode.window.setStatusBarMessage(`$(trash) Deleted conversation "${data.title || data.conversationId}"`, 4000);
            await this.refresh();
          } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to delete conversation: ${err.message || err}`);
          }
          break;
        }
        case "executeMove": {
          try {
            await this._migrator.moveConversation(data.conversationId, data.targetProjectId);
            vscode.window.setStatusBarMessage(`$(file-directory) Conversation moved to target folder`, 4000);
            await this.refresh();
          } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to move conversation: ${err.message || err}`);
          }
          break;
        }
        case "executeCreateProject": {
          try {
            await this._store.createProject(data.name);
            vscode.window.setStatusBarMessage(`$(folder-active) Project folder "${data.name}" created`, 4000);
            await this.refresh();
          } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to create project: ${err.message || err}`);
          }
          break;
        }
        case "executeRenameProject": {
          try {
            await this._store.renameProject(data.projectId, data.newName);
            vscode.window.setStatusBarMessage(`$(check) Project renamed to "${data.newName}"`, 4000);
            await this.refresh();
          } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to rename project: ${err.message || err}`);
          }
          break;
        }
        case "executeDeleteProject": {
          try {
            await this._store.deleteProject(data.projectId);
            vscode.window.setStatusBarMessage(`$(trash) Project folder "${data.projectName}" deleted`, 4000);
            await this.refresh();
          } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to delete project: ${err.message || err}`);
          }
          break;
        }
        case "copyId": {
          if (data.conversationId) {
            await vscode.env.clipboard.writeText(data.conversationId);
            vscode.window.setStatusBarMessage("$(clippy) Conversation ID copied to clipboard", 3000);
          }
          break;
        }
        case "openExternal": {
          if (data.url) {
            vscode.env.openExternal(vscode.Uri.parse(data.url));
          }
          break;
        }
        case "reorderProjects": {
          if (Array.isArray(data.newOrder)) {
            await this._store.saveProjectsOrder(data.newOrder);
            vscode.window.setStatusBarMessage(
              "$(sync) Antigravity project order synced to VS Code & Antigravity IDE",
              4000
            );
          }
          break;
        }
        case "openSettings": {
          this.openSettings();
          break;
        }
        case "saveSettings": {
          try {
            const config = vscode.workspace.getConfiguration("boygr.antigravityConversationManager");
            const prefs = data.preferences || {};
            if (prefs.theme !== undefined) await config.update("defaultTheme", prefs.theme, vscode.ConfigurationTarget.Global);
            if (prefs.language !== undefined) await config.update("defaultLanguage", prefs.language, vscode.ConfigurationTarget.Global);
            if (prefs.defaultExportFormat !== undefined) await config.update("defaultExportFormat", prefs.defaultExportFormat, vscode.ConfigurationTarget.Global);
            if (prefs.showPreview !== undefined) await config.update("showConversationPreview", prefs.showPreview, vscode.ConfigurationTarget.Global);
            if (prefs.confirmActions !== undefined) await config.update("confirmOnActions", prefs.confirmActions, vscode.ConfigurationTarget.Global);
            if (prefs.autoBackupBeforeMove !== undefined) await config.update("autoBackupBeforeMove", prefs.autoBackupBeforeMove, vscode.ConfigurationTarget.Global);
            if (prefs.customAntigravityPath !== undefined) await config.update("customAntigravityPath", prefs.customAntigravityPath, vscode.ConfigurationTarget.Global);
            if (prefs.pythonPath !== undefined) await config.update("pythonPath", prefs.pythonPath, vscode.ConfigurationTarget.Global);

            vscode.window.setStatusBarMessage("$(check) Antigravity Conversation Manager settings saved", 4000);
            await this.refresh();
          } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to save settings: ${err.message || err}`);
          }
          break;
        }
        case "createLabel": {
          try {
            const labelMgr = LabelManager.getInstance(this._store.getPaths());
            labelMgr.createLabel(data.name, data.color, data.description);
            await this.refresh();
          } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to create label: ${err.message || err}`);
          }
          break;
        }
        case "updateLabel": {
          try {
            const labelMgr = LabelManager.getInstance(this._store.getPaths());
            labelMgr.updateLabel(data.id, data.name, data.color, data.description);
            await this.refresh();
          } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to update label: ${err.message || err}`);
          }
          break;
        }
        case "deleteLabel": {
          try {
            const labelMgr = LabelManager.getInstance(this._store.getPaths());
            labelMgr.deleteLabel(data.id);
            await this.refresh();
          } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to delete label: ${err.message || err}`);
          }
          break;
        }
        case "setProjectLabels": {
          try {
            const labelMgr = LabelManager.getInstance(this._store.getPaths());
            labelMgr.setProjectLabels(data.projectId, data.labelIds || []);
            await this.refresh();
          } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to set project labels: ${err.message || err}`);
          }
          break;
        }
        case "setConversationLabels": {
          try {
            const labelMgr = LabelManager.getInstance(this._store.getPaths());
            labelMgr.setConversationLabels(data.conversationId, data.labelIds || []);
            await this.refresh();
          } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to set conversation labels: ${err.message || err}`);
          }
          break;
        }
      }
    });

    this.refresh();
  }

  public async openSettings(): Promise<void> {
    if (!this._view) {
      await vscode.commands.executeCommand("boygr.antigravityConversationManager.mainView.focus");
    }
    if (!this._view) return;
    this._view.webview.postMessage({ type: "openSettings" });
  }

  public async refresh() {
    if (!this._view) return;

    try {
      const [projects, activeConversationId] = await Promise.all([
        this._store.listProjectsAndConversations(),
        this._store.getActiveConversationId()
      ]);

      let totalConversations = 0;
      for (const p of projects) {
        totalConversations += p.conversations.length;
      }

      if (this._statusBar) {
        this._statusBar.updateText(totalConversations);
      }

      const config = vscode.workspace.getConfiguration("boygr.antigravityConversationManager");
      const preferences = {
        theme: config.get<string>("defaultTheme", "vscode"),
        language: config.get<string>("defaultLanguage", "auto"),
        defaultExportFormat: config.get<string>("defaultExportFormat", "bundle"),
        showPreview: config.get<boolean>("showConversationPreview", true),
        confirmActions: config.get<boolean>("confirmOnActions", true),
        autoBackupBeforeMove: config.get<boolean>("autoBackupBeforeMove", true),
        customAntigravityPath: config.get<string>("customAntigravityPath", ""),
        pythonPath: config.get<string>("pythonPath", "")
      };

      const labelMgr = LabelManager.getInstance(this._store.getPaths());
      const allLabels = labelMgr.getLabels();

      const iconUri = this._view.webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, "media", "icon.png")
      ).toString();

      this._view.webview.postMessage({
        type: "stateUpdate",
        projects,
        totalProjects: projects.length,
        totalConversations,
        activeConversationId,
        allLabels,
        baseDir: this._store.getPaths().baseDir,
        preferences,
        version: "0.3.2",
        iconUri
      });
    } catch (err: any) {
      this._view.webview.postMessage({
        type: "error",
        message: err.message || String(err)
      });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "dist", "media", "conversation-manager.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "dist", "media", "conversation-manager.css")
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Antigravity Conversation Manager</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div class="app-container">
    <header class="app-header">
      <div class="header-toolbar-row">
        <div class="search-bar">
          <input type="text" id="search-input" placeholder="Search conversations..." />
        </div>
        <div class="header-actions">
          <button id="btn-new-project" class="icon-button" title="Create New Project Folder">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
            </svg>
          </button>
          <button id="btn-import" class="icon-button" title="Import Conversation Bundle (.acm)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
              <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="labels-filter-bar" id="labels-filter-bar"></div>

      <div class="stats-bar" id="stats-bar">
        <span>Loading conversations...</span>
      </div>
    </header>

    <main class="tree-container" id="tree-container">
      <!-- Project groups rendered here -->
    </main>

    <footer class="developer-footer">
      <div class="developer-footer-copy">
        <span class="footer-prefix">Developed by</span>
        <a href="https://boygr.com" id="developer-link" class="developer-link" title="https://boygr.com" data-external-url="https://boygr.com">Boy Gilang Ramadhan (BoyGR)</a>
      </div>
      <span class="footer-version">v0.3.2</span>
    </footer>
  </div>

  <div id="modal-container"></div>
  <div id="settings-modal-container"></div>
  <div id="label-modal-container"></div>
  <div id="label-picker-container"></div>

  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}

