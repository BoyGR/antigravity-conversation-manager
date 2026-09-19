import * as vscode from "vscode";
import * as path from "path";
import { BackupService } from "../core/backup-service";

export async function handleBackupAll(backupService: BackupService) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const defaultFilename = `antigravity_conversations_backup_${timestamp}.db`;

    const saveUri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultFilename),
      filters: {
        "SQLite Database Backup": ["db", "acm.bak"],
        "All Files": ["*"]
      },
      title: "Save Antigravity Conversation Database Backup"
    });

    if (!saveUri) return;

    const backupPath = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Creating Antigravity conversation database backup...",
        cancellable: false
      },
      async () => {
        return await backupService.createBackup(saveUri.fsPath);
      }
    );

    const openAction = "Open Containing Folder";
    const choice = await vscode.window.showInformationMessage(
      `Backup created successfully: ${path.basename(backupPath)}`,
      openAction
    );

    if (choice === openAction) {
      vscode.env.openExternal(vscode.Uri.file(path.dirname(backupPath)));
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(`Backup failed: ${err.message || err}`);
  }
}

export async function handleRestoreBackup(backupService: BackupService) {
  try {
    const backups = await backupService.listBackups();

    const items: (vscode.QuickPickItem & { fullPath?: string; isBrowse?: boolean })[] = [
      {
        label: "$(file-directory) Select Backup File from Explorer...",
        description: "Browse your files for any .db or .acm.bak backup",
        isBrowse: true
      }
    ];

    for (const b of backups) {
      items.push({
        label: `$(database) ${b.filename}`,
        description: `${(b.sizeBytes / 1024).toFixed(1)} KB`,
        detail: `Created: ${b.createdAt.toLocaleString()}`,
        fullPath: b.fullPath
      });
    }

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: "Select a backup snapshot or choose from Explorer to restore..."
    });

    if (!picked) return;

    let targetBackupPath = picked.fullPath;

    if (picked.isBrowse) {
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
          "Database Backup": ["db", "acm.bak", "bak"],
          "All Files": ["*"]
        },
        openLabel: "Restore Selected Backup"
      });

      if (!uris || uris.length === 0) return;
      targetBackupPath = uris[0].fsPath;
    }

    if (!targetBackupPath) return;

    const confirm = await vscode.window.showWarningMessage(
      `Are you sure you want to restore "${path.basename(targetBackupPath)}"? This will overwrite your active conversation database. A safety snapshot will be created first.`,
      { modal: true },
      "Restore Backup"
    );

    if (confirm !== "Restore Backup") return;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Restoring conversation database...",
        cancellable: false
      },
      async () => {
        await backupService.restoreBackup(targetBackupPath!);
      }
    );

    const reloadAction = "Reload Window (Ctrl+R in Antigravity)";
    const choice = await vscode.window.showInformationMessage(
      `Successfully restored database from ${path.basename(targetBackupPath)}!`,
      reloadAction
    );

    if (choice === reloadAction) {
      vscode.commands.executeCommand("workbench.action.reloadWindow");
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(`Restore failed: ${err.message || err}`);
  }
}

