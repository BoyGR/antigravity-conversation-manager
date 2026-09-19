import * as fs from "fs";
import * as path from "path";
import { AntigravityPaths, resolveAntigravityPaths } from "./antigravity-paths";
import { SqliteBridge } from "./sqlite-bridge";

export interface BackupItem {
  filename: string;
  fullPath: string;
  sizeBytes: number;
  createdAt: Date;
  conversationCount?: number;
}

export class BackupService {
  private paths: AntigravityPaths;
  private backupsDir: string;

  constructor(paths?: AntigravityPaths) {
    this.paths = paths || resolveAntigravityPaths();
    this.backupsDir = path.join(this.paths.baseDir, "backups");
  }

  public async createBackup(customTargetPath?: string): Promise<string> {
    if (!this.paths.exists) {
      throw new Error(`Database not found: ${this.paths.conversationSummariesDb}`);
    }

    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true });
    }

    await SqliteBridge.checkpointWal(this.paths.conversationSummariesDb);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDbName = `conversation_summaries_${timestamp}.db`;
    const destDbPath = path.join(this.backupsDir, backupDbName);

    fs.copyFileSync(this.paths.conversationSummariesDb, destDbPath);

    // Also backup proto cache if present
    if (fs.existsSync(this.paths.protoCachePath)) {
      const destProtoPath = path.join(this.backupsDir, `agyhub_summaries_${timestamp}.pb`);
      fs.copyFileSync(this.paths.protoCachePath, destProtoPath);
    }

    if (customTargetPath) {
      const targetDir = path.dirname(customTargetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.copyFileSync(this.paths.conversationSummariesDb, customTargetPath);
      return customTargetPath;
    }

    return destDbPath;
  }

  public async listBackups(): Promise<BackupItem[]> {
    if (!fs.existsSync(this.backupsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.backupsDir);
    const backups: BackupItem[] = [];

    for (const file of files) {
      if (file.startsWith("conversation_summaries_") && file.endsWith(".db")) {
        const fullPath = path.join(this.backupsDir, file);
        try {
          const stat = fs.statSync(fullPath);
          backups.push({
            filename: file,
            fullPath,
            sizeBytes: stat.size,
            createdAt: stat.mtime
          });
        } catch {}
      }
    }

    backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return backups;
  }

  public async restoreBackup(backupPath: string): Promise<boolean> {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file does not exist: ${backupPath}`);
    }

    // Safety: create pre-restore backup
    await this.createBackup();

    // Copy backup over active DB
    fs.copyFileSync(backupPath, this.paths.conversationSummariesDb);
    await SqliteBridge.checkpointWal(this.paths.conversationSummariesDb);

    // Try to restore associated proto cache if exists
    const protoBackup = backupPath.replace("conversation_summaries_", "agyhub_summaries_").replace(".db", ".pb");
    if (fs.existsSync(protoBackup)) {
      fs.copyFileSync(protoBackup, this.paths.protoCachePath);
    }

    return true;
  }
}

