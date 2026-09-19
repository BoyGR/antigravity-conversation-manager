import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import { AntigravityPaths, resolveAntigravityPaths } from "./antigravity-paths";
import { SqliteBridge } from "./sqlite-bridge";

export interface ImportOptions {
  bundlePath: string;
  targetProjectId: string;
  targetWorkspaceUris?: string[];
  forceNewId?: boolean;
}

export interface ImportResult {
  success: boolean;
  conversationId: string;
  title: string;
  projectId: string;
  error?: string;
}

export class ConversationImporter {
  private paths: AntigravityPaths;

  constructor(paths?: AntigravityPaths) {
    this.paths = paths || resolveAntigravityPaths();
  }

  public async importBundle(options: ImportOptions): Promise<ImportResult> {
    try {
      if (!fs.existsSync(options.bundlePath)) {
        throw new Error(`Bundle file not found: ${options.bundlePath}`);
      }

      const tempExtractDir = path.join(this.paths.baseDir, "temp_import_" + Date.now());
      fs.mkdirSync(tempExtractDir, { recursive: true });

      try {
        // 1. Extract zip via Python
        await this.extractZip(options.bundlePath, tempExtractDir);

        const manifestPath = path.join(tempExtractDir, "manifest.json");
        if (!fs.existsSync(manifestPath)) {
          throw new Error("Invalid bundle: missing manifest.json");
        }

        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        let originalId: string = manifest.conversationId || "";
        const title: string = manifest.title || "Imported Conversation";
        const preview: string = manifest.preview || "";
        const stepCount: number = manifest.stepCount || 0;
        const lastModified: string = new Date().toISOString();

        // Check if ID exists in conversation_summaries
        let targetId = originalId;
        const existing = originalId ? await SqliteBridge.query(
          this.paths.conversationSummariesDb,
          "SELECT conversation_id FROM conversation_summaries WHERE conversation_id = ?",
          [originalId]
        ) : [];

        if (!targetId || existing.length > 0 || options.forceNewId) {
          targetId = randomUUID();
        }

        // 2. Install database file
        const sourceDb = path.join(tempExtractDir, "database.db");
        const destDb = path.join(this.paths.conversationsDir, `${targetId}.db`);

        if (fs.existsSync(sourceDb)) {
          fs.copyFileSync(sourceDb, destDb);

          // Update trajectory_metadata_blob with targetProjectId
          const blobRows = await SqliteBridge.query(
            destDb,
            "SELECT data FROM trajectory_metadata_blob WHERE id = 'main'"
          );

          if (blobRows && blobRows.length > 0 && blobRows[0].data) {
            let blobBuffer: Buffer;
            const rawBlob = blobRows[0].data;
            if (typeof rawBlob === "object" && rawBlob.__type === "bytes_base64") {
              blobBuffer = Buffer.from(rawBlob.data, "base64");
            } else if (Buffer.isBuffer(rawBlob)) {
              blobBuffer = rawBlob;
            } else {
              blobBuffer = Buffer.from(rawBlob);
            }

            const oldProjBuf = Buffer.from(manifest.projectId || "", "utf-8");
            const newProjBuf = Buffer.from(options.targetProjectId, "utf-8");

            if (oldProjBuf.length > 0 && blobBuffer.includes(oldProjBuf)) {
              const updated = this.replaceBuffer(blobBuffer, oldProjBuf, newProjBuf);
              await SqliteBridge.executeUpdate(
                destDb,
                "UPDATE trajectory_metadata_blob SET data = ? WHERE id = 'main'",
                [{ __type: "bytes_base64", data: updated.toString("base64") }]
              );
            }
          }
          await SqliteBridge.checkpointWal(destDb);
        }

        // 3. Install brain directory
        const sourceBrain = path.join(tempExtractDir, "brain");
        const destBrain = path.join(this.paths.brainDir, targetId);

        if (fs.existsSync(sourceBrain)) {
          this.copyDirRecursive(sourceBrain, destBrain);
        }

        // 4. Inject row into conversation_summaries.db
        const workspaceJson = JSON.stringify(options.targetWorkspaceUris || []);
        
        // Read summary row template if available
        const summaryJsonPath = path.join(tempExtractDir, "summary.json");
        let rawSummaryObj: any = null;
        if (fs.existsSync(summaryJsonPath)) {
          try {
            const summaryRow = JSON.parse(fs.readFileSync(summaryJsonPath, "utf-8"));
            if (summaryRow.raw_summary) {
              rawSummaryObj = summaryRow.raw_summary;
              if (rawSummaryObj && typeof rawSummaryObj === "object" && rawSummaryObj.__type === "bytes_base64") {
                let buf: any = Buffer.from(rawSummaryObj.data, "base64");
                const oldProjBuf = Buffer.from(manifest.projectId || "", "utf-8");
                const newProjBuf = Buffer.from(options.targetProjectId, "utf-8");
                if (oldProjBuf.length > 0 && buf.includes(oldProjBuf)) {
                  buf = this.replaceBuffer(buf, oldProjBuf, newProjBuf);
                  rawSummaryObj = { __type: "bytes_base64", data: buf.toString("base64") };
                }
              }
            }
          } catch {}
        }

        await SqliteBridge.executeUpdate(
          this.paths.conversationSummariesDb,
          `INSERT OR REPLACE INTO conversation_summaries (
            conversation_id, title, preview, step_count, last_modified_time, 
            workspace_uris, status, project_id, agent_name, raw_summary
          ) VALUES (?, ?, ?, ?, ?, ?, 'CASCADE_RUN_STATUS_IDLE', ?, '', ?)`,
          [targetId, title, preview, stepCount, lastModified, workspaceJson, options.targetProjectId, rawSummaryObj]
        );

        await SqliteBridge.checkpointWal(this.paths.conversationSummariesDb);

        return {
          success: true,
          conversationId: targetId,
          title,
          projectId: options.targetProjectId
        };
      } finally {
        // Clean up temp dir
        try {
          fs.rmSync(tempExtractDir, { recursive: true, force: true });
        } catch {}
      }
    } catch (err: any) {
      return {
        success: false,
        conversationId: "",
        title: "",
        projectId: options.targetProjectId,
        error: err.message || String(err)
      };
    }
  }

  private extractZip(zipPath: string, targetDir: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const pyCmd = await SqliteBridge.getPythonCommand();
      const pyScript = `
import zipfile, sys, json
payload = json.loads(sys.stdin.read())
with zipfile.ZipFile(payload["zipPath"], "r") as zf:
    zf.extractall(payload["targetDir"])
print("ok")
`;
      const proc = spawn(pyCmd, ["-c", pyScript], { shell: false });
      let err = "";
      proc.stderr.on("data", (d) => (err += d.toString()));
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(err || `Extraction failed with code ${code}`));
      });
      proc.stdin.write(JSON.stringify({ zipPath, targetDir }));
      proc.stdin.end();
    });
  }

  private replaceBuffer(source: Buffer, target: Buffer, replacement: Buffer): Buffer {
    const idx = source.indexOf(target);
    if (idx === -1) return source;
    return Buffer.concat([
      source.subarray(0, idx),
      replacement,
      this.replaceBuffer(source.subarray(idx + target.length), target, replacement)
    ]);
  }

  private copyDirRecursive(src: string, dest: string) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        this.copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
