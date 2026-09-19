import * as fs from "fs";
import * as path from "path";
import { AntigravityPaths, resolveAntigravityPaths } from "./antigravity-paths";
import { SqliteBridge } from "./sqlite-bridge";

export interface MigrationResult {
  success: boolean;
  conversationId: string;
  previousProjectId: string;
  newProjectId: string;
  error?: string;
  backupFile?: string;
}

export class ConversationMigrator {
  private paths: AntigravityPaths;

  constructor(paths?: AntigravityPaths) {
    this.paths = paths || resolveAntigravityPaths();
  }

  public async moveConversation(
    conversationId: string,
    targetProjectId: string,
    targetWorkspaceUris: string[] = [],
    autoBackup: boolean = true
  ): Promise<MigrationResult> {
    try {
      if (!this.paths.exists) {
        throw new Error(`Antigravity database not found at ${this.paths.conversationSummariesDb}`);
      }

      // 1. Fetch current conversation details
      const rows = await SqliteBridge.query(
        this.paths.conversationSummariesDb,
        "SELECT project_id, workspace_uris, raw_summary FROM conversation_summaries WHERE conversation_id = ?",
        [conversationId]
      );

      if (!rows || rows.length === 0) {
        throw new Error(`Conversation not found in database: ${conversationId}`);
      }

      const currentRow = rows[0];
      const oldProjectId: string = currentRow.project_id || "";

      if (oldProjectId === targetProjectId) {
        return {
          success: true,
          conversationId,
          previousProjectId: oldProjectId,
          newProjectId: targetProjectId
        };
      }

      // 2. Perform safety backup if requested
      let backupFile: string | undefined;
      if (autoBackup) {
        backupFile = await this.createBackup();
      }

      // 3. Update individual conversation database: conversations/<id>.db
      const convoDbPath = path.join(this.paths.conversationsDir, `${conversationId}.db`);
      if (fs.existsSync(convoDbPath)) {
        const blobRows = await SqliteBridge.query(
          convoDbPath,
          "SELECT data FROM trajectory_metadata_blob WHERE id = 'main'"
        );

        if (blobRows && blobRows.length > 0 && blobRows[0].data) {
          const rawBlob = blobRows[0].data;
          let blobBuffer: Buffer;

          if (typeof rawBlob === "object" && rawBlob.__type === "bytes_base64") {
            blobBuffer = Buffer.from(rawBlob.data, "base64");
          } else if (Buffer.isBuffer(rawBlob)) {
            blobBuffer = rawBlob;
          } else {
            blobBuffer = Buffer.from(rawBlob);
          }

          const oldProjBuf = Buffer.from(oldProjectId, "utf-8");
          const newProjBuf = Buffer.from(targetProjectId, "utf-8");

          if (blobBuffer.includes(oldProjBuf)) {
            const updatedBuffer = this.replaceBuffer(blobBuffer, oldProjBuf, newProjBuf);
            await SqliteBridge.executeUpdate(
              convoDbPath,
              "UPDATE trajectory_metadata_blob SET data = ? WHERE id = 'main'",
              [{ __type: "bytes_base64", data: updatedBuffer.toString("base64") }]
            );
            await SqliteBridge.checkpointWal(convoDbPath);
          }
        }
      }

      // 4. Update conversation_summaries.db
      let newRawSummaryObj: any = currentRow.raw_summary;
      if (currentRow.raw_summary && oldProjectId) {
        let rawSummaryBuffer: Buffer;
        if (typeof currentRow.raw_summary === "object" && currentRow.raw_summary.__type === "bytes_base64") {
          rawSummaryBuffer = Buffer.from(currentRow.raw_summary.data, "base64");
        } else if (Buffer.isBuffer(currentRow.raw_summary)) {
          rawSummaryBuffer = currentRow.raw_summary;
        } else {
          rawSummaryBuffer = Buffer.from(currentRow.raw_summary);
        }

        const oldProjBuf = Buffer.from(oldProjectId, "utf-8");
        const newProjBuf = Buffer.from(targetProjectId, "utf-8");

        if (rawSummaryBuffer.includes(oldProjBuf)) {
          const updatedRawSummary = this.replaceBuffer(rawSummaryBuffer, oldProjBuf, newProjBuf);
          newRawSummaryObj = { __type: "bytes_base64", data: updatedRawSummary.toString("base64") };
        }
      }

      const workspaceUrisJson = targetWorkspaceUris.length > 0
        ? JSON.stringify(targetWorkspaceUris)
        : currentRow.workspace_uris;

      await SqliteBridge.executeUpdate(
        this.paths.conversationSummariesDb,
        "UPDATE conversation_summaries SET project_id = ?, workspace_uris = ?, raw_summary = ? WHERE conversation_id = ?",
        [targetProjectId, workspaceUrisJson, newRawSummaryObj, conversationId]
      );

      // Checkpoint WAL
      await SqliteBridge.checkpointWal(this.paths.conversationSummariesDb);

      // 5. Update agyhub_summaries_proto.pb if present
      if (fs.existsSync(this.paths.protoCachePath) && oldProjectId) {
        try {
          const pbBuffer = fs.readFileSync(this.paths.protoCachePath);
          const oldProjBuf = Buffer.from(oldProjectId, "utf-8");
          const newProjBuf = Buffer.from(targetProjectId, "utf-8");

          if (pbBuffer.includes(oldProjBuf)) {
            const updatedPbBuffer = this.replaceBuffer(pbBuffer, oldProjBuf, newProjBuf);
            fs.writeFileSync(this.paths.protoCachePath, updatedPbBuffer);
          }
        } catch (pbErr) {
          console.warn("Could not update agyhub_summaries_proto.pb:", pbErr);
        }
      }

      return {
        success: true,
        conversationId,
        previousProjectId: oldProjectId,
        newProjectId: targetProjectId,
        backupFile
      };
    } catch (err: any) {
      return {
        success: false,
        conversationId,
        previousProjectId: "",
        newProjectId: targetProjectId,
        error: err.message || String(err)
      };
    }
  }

  private replaceBuffer(source: Buffer, target: Buffer, replacement: Buffer): Buffer {
    const idx = source.indexOf(target);
    if (idx === -1) {
      return source;
    }
    return Buffer.concat([
      source.subarray(0, idx),
      replacement,
      this.replaceBuffer(source.subarray(idx + target.length), target, replacement)
    ]);
  }

  private async createBackup(): Promise<string> {
    const backupsDir = path.join(this.paths.baseDir, "backups");
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDbPath = path.join(backupsDir, `conversation_summaries_${timestamp}.db`);

    if (fs.existsSync(this.paths.conversationSummariesDb)) {
      // First checkpoint WAL
      try {
        await SqliteBridge.checkpointWal(this.paths.conversationSummariesDb);
      } catch {}
      fs.copyFileSync(this.paths.conversationSummariesDb, backupDbPath);
    }

    return backupDbPath;
  }
}

