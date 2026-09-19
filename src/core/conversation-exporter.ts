import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { AntigravityPaths, resolveAntigravityPaths } from "./antigravity-paths";
import { SqliteBridge } from "./sqlite-bridge";

import { LabelManager } from "./label-manager";

export interface ExportOptions {
  conversationId: string;
  outputPath: string;
  format: "bundle" | "markdown";
}

export class ConversationExporter {
  private paths: AntigravityPaths;

  constructor(paths?: AntigravityPaths) {
    this.paths = paths || resolveAntigravityPaths();
  }

  public async exportConversation(options: ExportOptions): Promise<string> {
    if (options.format === "markdown") {
      return this.exportToMarkdown(options.conversationId, options.outputPath);
    } else {
      return this.exportToBundle(options.conversationId, options.outputPath);
    }
  }

  private async exportToBundle(conversationId: string, outputPath: string): Promise<string> {
    const convoDbPath = path.join(this.paths.conversationsDir, `${conversationId}.db`);
    const brainDirPath = path.join(this.paths.brainDir, conversationId);
    const labels = LabelManager.getInstance(this.paths).getConversationLabels(conversationId);

    // Fetch summary row
    const rows = await SqliteBridge.query(
      this.paths.conversationSummariesDb,
      "SELECT * FROM conversation_summaries WHERE conversation_id = ?",
      [conversationId]
    );

    if (!rows || rows.length === 0) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const summaryRow = rows[0];
    const pyCmd = await SqliteBridge.getPythonCommand();

    const pyScript = `
import zipfile, os, sys, json

payload = json.loads(sys.stdin.read())
convo_id = payload["convoId"]
convo_db = payload["convoDb"]
brain_dir = payload["brainDir"]
output_zip = payload["outputZip"]
summary_row = payload["summaryRow"]
labels = payload.get("labels", [])

manifest = {
    "version": 1,
    "conversationId": convo_id,
    "title": summary_row.get("title", ""),
    "preview": summary_row.get("preview", ""),
    "stepCount": summary_row.get("step_count", 0),
    "lastModifiedTime": summary_row.get("last_modified_time", ""),
    "projectId": summary_row.get("project_id", ""),
    "workspaceUris": summary_row.get("workspace_uris", "[]"),
    "labels": labels,
    "exportedAt": str(os.path.getmtime(convo_db)) if os.path.exists(convo_db) else ""
}

os.makedirs(os.path.dirname(os.path.abspath(output_zip)), exist_ok=True)

with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zf:
    zf.writestr("manifest.json", json.dumps(manifest, indent=2))
    zf.writestr("summary.json", json.dumps(summary_row, indent=2))
    
    if os.path.exists(convo_db):
        zf.write(convo_db, arcname="database.db")
        
    if os.path.exists(brain_dir):
        for root, _, files in os.walk(brain_dir):
            for f in files:
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, brain_dir)
                zf.write(full_path, arcname=os.path.join("brain", rel_path))

print(json.dumps({"success": True, "outputPath": output_zip}))
`;

    return new Promise((resolve, reject) => {
      const proc = spawn(pyCmd, ["-c", pyScript], { shell: false });
      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (d) => (stdout += d.toString()));
      proc.stderr.on("data", (d) => (stderr += d.toString()));

      proc.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(stderr || `Export process exited with code ${code}`));
          return;
        }
        try {
          const res = JSON.parse(stdout.trim());
          if (res.success) {
            resolve(res.outputPath);
          } else {
            reject(new Error(res.error || "Export failed"));
          }
        } catch {
          resolve(outputPath);
        }
      });

      proc.stdin.write(
        JSON.stringify({
          convoId: conversationId,
          convoDb: convoDbPath,
          brainDir: brainDirPath,
          outputZip: outputPath,
          summaryRow,
          labels
        })
      );
      proc.stdin.end();
    });
  }

  private async exportToMarkdown(conversationId: string, outputPath: string): Promise<string> {
    const brainDir = path.join(this.paths.brainDir, conversationId);
    let transcriptFile = path.join(brainDir, ".system_generated", "logs", "transcript.jsonl");

    if (!fs.existsSync(transcriptFile)) {
      transcriptFile = path.join(brainDir, ".system_generated", "logs", "transcript_full.jsonl");
    }

    // Fetch conversation title
    const rows = await SqliteBridge.query(
      this.paths.conversationSummariesDb,
      "SELECT title, preview, last_modified_time FROM conversation_summaries WHERE conversation_id = ?",
      [conversationId]
    );

    const title = rows[0]?.title || rows[0]?.preview || "Antigravity Conversation";
    const date = rows[0]?.last_modified_time || new Date().toISOString();

    let mdContent = `# ${title}\n\n`;
    mdContent += `* **Conversation ID**: \`${conversationId}\`\n`;
    mdContent += `* **Date**: ${date}\n`;
    mdContent += `* **Exported by**: Antigravity Conversation Manager\n\n---\n\n`;

    if (fs.existsSync(transcriptFile)) {
      const lines = fs.readFileSync(transcriptFile, "utf-8").split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const step = JSON.parse(line);
          const type = step.type || "";
          const content = step.content || "";

          if (type === "USER_INPUT") {
            mdContent += `## 👤 User\n\n${content}\n\n---\n\n`;
          } else if (type === "PLANNER_RESPONSE") {
            mdContent += `## 🤖 Antigravity Assistant\n\n`;
            if (step.thinking) {
              mdContent += `<details><summary>Thought Process</summary>\n\n${step.thinking}\n\n</details>\n\n`;
            }
            if (content) {
              mdContent += `${content}\n\n`;
            }
            if (step.tool_calls && Array.isArray(step.tool_calls) && step.tool_calls.length > 0) {
              mdContent += `**Tool Calls:**\n\n`;
              for (const tc of step.tool_calls) {
                mdContent += `* \`${tc.toolSummary || tc.toolAction || "Tool"}\`: \`${tc.name || ""}\`\n`;
              }
              mdContent += `\n`;
            }
            mdContent += `---\n\n`;
          }
        } catch {}
      }
    } else {
      mdContent += `*(Transcript logs not found for this conversation)*\n`;
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, mdContent, "utf-8");
    return outputPath;
  }
}

