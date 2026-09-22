import * as fs from "fs";
import * as path from "path";
import { AntigravityPaths, resolveAntigravityPaths } from "./antigravity-paths";
import { SqliteBridge } from "./sqlite-bridge";
import { LabelItem, LabelManager } from "./label-manager";
import * as vscode from "vscode";

export interface ConversationItem {
  id: string;
  title: string;
  preview: string;
  stepCount: number;
  lastModifiedTime: string;
  workspaceUris: string[];
  status: string;
  projectId: string;
  projectName: string;
  agentName: string;
  hasBrain: boolean;
  dbSizeBytes: number;
  labels: LabelItem[];
}

export interface ProjectGroup {
  id: string;
  name: string;
  workspaceUri?: string;
  conversations: ConversationItem[];
  labels: LabelItem[];
}

export class ConversationStore {
  private paths: AntigravityPaths;

  constructor(paths?: AntigravityPaths) {
    this.paths = paths || resolveAntigravityPaths();
  }

  public getPaths(): AntigravityPaths {
    return this.paths;
  }

  public async listProjectsAndConversations(): Promise<ProjectGroup[]> {
    if (!this.paths.exists) {
      return [];
    }

    // 1. Load authoritative project definitions from ~/.gemini/config/projects/*.json
    const knownProjects = this.loadKnownProjects();
    const labelMgr = LabelManager.getInstance(this.paths);

    let rows: any[] = [];
    let querySuccess = false;

    // 2. Query conversations from conversation_summaries.db if available
    if (this.paths.hasSummariesDb && fs.existsSync(this.paths.conversationSummariesDb)) {
      try {
        const sql = `
          SELECT 
            conversation_id,
            title,
            preview,
            step_count,
            last_modified_time,
            workspace_uris,
            status,
            project_id,
            agent_name
          FROM conversation_summaries
          ORDER BY last_modified_time DESC
        `;
        rows = await SqliteBridge.query(this.paths.conversationSummariesDb, sql);
        querySuccess = true;
      } catch (err) {
        console.warn("Could not query conversation_summaries.db, falling back to direct conversation scan:", err);
      }
    }

    // 3. If central summaries DB is absent, failed, or empty, scan individual conversations/<id>.db
    if (!querySuccess || rows.length === 0) {
      if (this.paths.hasConversationDbs || fs.existsSync(this.paths.conversationsDir)) {
        const scannedProjects = await this.scanIndividualConversationDbs(knownProjects, labelMgr);
        if (scannedProjects.length > 0) {
          return this.sortProjects(scannedProjects);
        }
      }
      if (!querySuccess) {
        return [];
      }
    }

    const projectMap = new Map<string, ProjectGroup>();

    // Pre-populate with all known projects so empty projects appear too
    for (const [pId, pInfo] of knownProjects.entries()) {
      if (pId === "outside-of-project") continue;
      projectMap.set(pId, {
        id: pId,
        name: pInfo.name,
        workspaceUri: pInfo.folderUri,
        conversations: [],
        labels: labelMgr.getProjectLabels(pId)
      });
    }

    const customTitles = this.loadCustomTitles();

    for (const r of rows) {
      const id = r.conversation_id as string;
      const title = customTitles[id] || (r.title as string) || (r.preview as string) || "Untitled Conversation";
      const preview = (r.preview as string) || "";
      const stepCount = (r.step_count as number) || 0;
      const lastModifiedTime = (r.last_modified_time as string) || "";
      const projectId = (r.project_id as string) || "default";
      const status = (r.status as string) || "";
      const agentName = (r.agent_name as string) || "";

      let workspaceUris: string[] = [];
      try {
        if (typeof r.workspace_uris === "string" && r.workspace_uris.trim()) {
          workspaceUris = JSON.parse(r.workspace_uris);
        }
      } catch {}

      // Check physical files
      const convoDbPath = path.join(this.paths.conversationsDir, `${id}.db`);
      let dbSizeBytes = 0;
      if (fs.existsSync(convoDbPath)) {
        try {
          dbSizeBytes = fs.statSync(convoDbPath).size;
        } catch {}
      }

      const brainDirPath = path.join(this.paths.brainDir, id);
      const hasBrain = fs.existsSync(brainDirPath);

      // Determine authoritative project name
      let projectName = "Unknown Project";
      if (knownProjects.has(projectId)) {
        projectName = knownProjects.get(projectId)!.name;
      } else if (projectId === "default-cli-project") {
        projectName = "CLI Project";
      } else if (workspaceUris.length > 0) {
        try {
          const decoded = decodeURIComponent(workspaceUris[0].replace(/^file:\/\/\/?/, ""));
          projectName = path.basename(decoded) || "Project";
        } catch {}
      }

      const item: ConversationItem = {
        id,
        title,
        preview,
        stepCount,
        lastModifiedTime,
        workspaceUris,
        status,
        projectId,
        projectName,
        agentName,
        hasBrain,
        dbSizeBytes,
        labels: labelMgr.getConversationLabels(id)
      };

      if (!projectMap.has(projectId)) {
        projectMap.set(projectId, {
          id: projectId,
          name: projectName,
          workspaceUri: workspaceUris[0] || "",
          conversations: [],
          labels: labelMgr.getProjectLabels(projectId)
        });
      }

      projectMap.get(projectId)!.conversations.push(item);
    }

    return this.sortProjects(Array.from(projectMap.values()));
  }

  private async sortProjects(projectList: ProjectGroup[]): Promise<ProjectGroup[]> {
    const knownProjectOrder: string[] = await this.loadProjectsOrder();

    if (knownProjectOrder.length > 0) {
      projectList.sort((a, b) => {
        const indexA = knownProjectOrder.indexOf(a.id);
        const indexB = knownProjectOrder.indexOf(b.id);
        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.name.localeCompare(b.name);
      });
    }

    return projectList;
  }

  private getCustomTitlesPath(): string {
    return path.join(this.paths.baseDir, "acm_custom_titles.json");
  }

  private loadCustomTitles(): Record<string, string> {
    try {
      const p = this.getCustomTitlesPath();
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, "utf-8"));
      }
    } catch {}
    return {};
  }

  private saveCustomTitle(conversationId: string, title: string): void {
    try {
      const p = this.getCustomTitlesPath();
      const existing = this.loadCustomTitles();
      existing[conversationId] = title;
      fs.writeFileSync(p, JSON.stringify(existing, null, 2), "utf-8");
    } catch {}
  }

  /**
   * Scans individual conversation databases (<uuid>.db) directly.
   * Used in Antigravity Standalone IDE or environments where conversation_summaries.db is not maintained.
   */
  private async scanIndividualConversationDbs(
    knownProjects: Map<string, { id: string; name: string; folderUri?: string }>,
    labelMgr: LabelManager
  ): Promise<ProjectGroup[]> {
    if (!fs.existsSync(this.paths.conversationsDir)) {
      return [];
    }

    let files: string[] = [];
    try {
      files = fs.readdirSync(this.paths.conversationsDir).filter((f) => f.endsWith(".db"));
    } catch {
      return [];
    }

    if (files.length === 0) {
      return [];
    }

    const projectMap = new Map<string, ProjectGroup>();
    for (const [pId, pInfo] of knownProjects.entries()) {
      if (pId === "outside-of-project") continue;
      projectMap.set(pId, {
        id: pId,
        name: pInfo.name,
        workspaceUri: pInfo.folderUri,
        conversations: [],
        labels: labelMgr.getProjectLabels(pId)
      });
    }

    const customTitles = this.loadCustomTitles();

    for (const file of files) {
      const id = path.basename(file, ".db");
      const dbPath = path.join(this.paths.conversationsDir, file);
      let dbSizeBytes = 0;
      let lastModifiedTime = new Date().toISOString();

      try {
        const st = fs.statSync(dbPath);
        dbSizeBytes = st.size;
        lastModifiedTime = st.mtime.toISOString();
      } catch {}

      const brainDirPath = path.join(this.paths.brainDir, id);
      const hasBrain = fs.existsSync(brainDirPath);

      // 1. Title and preview extraction
      let title = customTitles[id] || "";
      let preview = "";

      // Try reading brain transcript.jsonl first (most accurate for user query)
      if (hasBrain) {
        const transcriptPath = path.join(brainDirPath, ".system_generated", "logs", "transcript.jsonl");
        if (fs.existsSync(transcriptPath)) {
          try {
            const fd = fs.openSync(transcriptPath, "r");
            const buf = Buffer.alloc(8192);
            const bytesRead = fs.readSync(fd, buf, 0, 8192, 0);
            fs.closeSync(fd);
            const text = buf.toString("utf-8", 0, bytesRead);
            const lines = text.split("\n");
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const step = JSON.parse(line);
                if (step.type === "USER_INPUT" && step.content) {
                  let raw = String(step.content).trim();
                  const reqMatch = raw.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/i);
                  if (reqMatch) {
                    raw = reqMatch[1].trim();
                  }
                  raw = raw.replace(/\r?\n/g, " ").replace(/\s+/g, " ");
                  if (!title) {
                    title = raw.length > 60 ? raw.slice(0, 57) + "..." : raw;
                  }
                  preview = raw.length > 120 ? raw.slice(0, 117) + "..." : raw;
                  if (step.created_at) {
                    lastModifiedTime = step.created_at;
                  }
                  break;
                }
              } catch {}
            }
          } catch {}
        }
      }

      // 2. Query stepCount from steps table
      let stepCount = 0;
      try {
        const countRows = await SqliteBridge.query<{ cnt: number }>(dbPath, "SELECT COUNT(*) as cnt FROM steps;");
        if (countRows && countRows.length > 0) {
          stepCount = countRows[0].cnt || 0;
        }
      } catch {}

      if (!title) {
        title = `Conversation ${id.slice(0, 8)}`;
      }

      // 3. Extract workspace URI and project from trajectory_metadata_blob
      const workspaceUris: string[] = [];
      let projectId = "default";
      let projectName = "Antigravity Project";

      try {
        const blobRows = await SqliteBridge.query(
          dbPath,
          "SELECT data FROM trajectory_metadata_blob WHERE id = 'main';"
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

          const blobStr = blobBuffer.toString("utf-8");
          const uriMatches = blobStr.match(/file:\/\/\/[^\x00-\x1f\s"'<>]+/g);
          if (uriMatches && uriMatches.length > 0) {
            const cleanUri = uriMatches[0].replace(/[\x00-\x1f].*$/, "");
            workspaceUris.push(cleanUri);
          }

          for (const [kId, pInfo] of knownProjects.entries()) {
            if (blobStr.includes(kId)) {
              projectId = kId;
              projectName = pInfo.name;
              break;
            }
          }
        }
      } catch {}

      if (projectId === "default" && workspaceUris.length > 0) {
        const cleanUri = workspaceUris[0].toLowerCase();
        for (const [kId, pInfo] of knownProjects.entries()) {
          if (pInfo.folderUri && cleanUri.includes(pInfo.folderUri.toLowerCase())) {
            projectId = kId;
            projectName = pInfo.name;
            break;
          }
        }
        if (projectId === "default") {
          try {
            const decoded = decodeURIComponent(workspaceUris[0].replace(/^file:\/\/\/?/, ""));
            const base = path.basename(decoded);
            if (base) {
              projectName = base;
              projectId = `folder-${base.toLowerCase().replace(/[^a-z0-9_-]/g, "-")}`;
            }
          } catch {}
        }
      }

      const item: ConversationItem = {
        id,
        title,
        preview,
        stepCount,
        lastModifiedTime,
        workspaceUris,
        status: "COMPLETED",
        projectId,
        projectName,
        agentName: "Antigravity Agent",
        hasBrain,
        dbSizeBytes,
        labels: labelMgr.getConversationLabels(id)
      };

      if (!projectMap.has(projectId)) {
        projectMap.set(projectId, {
          id: projectId,
          name: projectName,
          workspaceUri: workspaceUris[0] || "",
          conversations: [],
          labels: labelMgr.getProjectLabels(projectId)
        });
      }

      projectMap.get(projectId)!.conversations.push(item);
    }

    return Array.from(projectMap.values());
  }

  private loadKnownProjects(): Map<string, { id: string; name: string; folderUri?: string }> {
    const map = new Map<string, { id: string; name: string; folderUri?: string }>();
    if (!fs.existsSync(this.paths.configProjectsDir)) {
      return map;
    }

    try {
      const files = fs.readdirSync(this.paths.configProjectsDir);
      for (const f of files) {
        if (f.endsWith(".json")) {
          try {
            const p = path.join(this.paths.configProjectsDir, f);
            const content = JSON.parse(fs.readFileSync(p, "utf-8"));
            if (content.id && content.name) {
              let folderUri: string | undefined;
              const res = content.projectResources?.resources;
              if (Array.isArray(res) && res.length > 0 && res[0].gitFolder?.folderUri) {
                folderUri = res[0].gitFolder.folderUri;
              }
              map.set(content.id, {
                id: content.id,
                name: content.name,
                folderUri
              });
            }
          } catch {}
        }
      }
    } catch {}

    return map;
  }

  private async loadProjectsOrder(): Promise<string[]> {
    // 1. Try VS Code / IDE state.vscdb first (active session storage in VS Code)
    for (const vscdbPath of this.paths.vscdbPaths) {
      try {
        const rows = await SqliteBridge.query<{ value: string }>(
          vscdbPath,
          "SELECT value FROM ItemTable WHERE key = 'google.google-antigravity'"
        );
        if (rows && rows.length > 0) {
          const val = JSON.parse(rows[0].value);
          const storage = val["antigravity-storage"];
          const storageObj = typeof storage === "string" ? JSON.parse(storage) : storage;
          if (storageObj && storageObj.projectsOrder) {
            const parsed = JSON.parse(storageObj.projectsOrder);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed;
            }
          }
        }
      } catch {}
    }

    // 2. Fallback to Antigravity Standalone app_storage.json
    try {
      if (fs.existsSync(this.paths.appStorageJson)) {
        const raw = fs.readFileSync(this.paths.appStorageJson, "utf-8");
        const json = JSON.parse(raw);
        if (json.projectsOrder) {
          const parsed = JSON.parse(json.projectsOrder);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch {}

    return [];
  }

  public async saveProjectsOrder(newOrder: string[]): Promise<boolean> {
    let savedAny = false;

    // 1. Save to Antigravity Standalone app_storage.json
    try {
      if (fs.existsSync(this.paths.appStorageJson)) {
        const raw = fs.readFileSync(this.paths.appStorageJson, "utf-8");
        const json = JSON.parse(raw);
        json.projectsOrder = JSON.stringify(newOrder);
        fs.writeFileSync(this.paths.appStorageJson, JSON.stringify(json, null, 2), "utf-8");
        savedAny = true;
      }
    } catch (e) {
      console.error("Failed to save projectsOrder to app_storage.json:", e);
    }

    // 2. Save to VS Code / IDE state.vscdb
    for (const vscdbPath of this.paths.vscdbPaths) {
      try {
        const rows = await SqliteBridge.query<{ value: string }>(
          vscdbPath,
          "SELECT value FROM ItemTable WHERE key = 'google.google-antigravity'"
        );
        if (rows && rows.length > 0) {
          const val = JSON.parse(rows[0].value);
          let storage = val["antigravity-storage"];
          const isStr = typeof storage === "string";
          const storageObj = isStr ? JSON.parse(storage) : (storage || {});
          storageObj.projectsOrder = JSON.stringify(newOrder);
          val["antigravity-storage"] = isStr ? JSON.stringify(storageObj) : storageObj;

          await SqliteBridge.executeUpdate(
            vscdbPath,
            "UPDATE ItemTable SET value = ? WHERE key = 'google.google-antigravity'",
            [JSON.stringify(val)]
          );
          savedAny = true;
        }
      } catch (e) {
        console.error(`Failed to save projectsOrder to ${vscdbPath}:`, e);
      }
    }

    // 3. Request Antigravity webview to refresh if command exists
    try {
      await vscode.commands.executeCommand("antigravity.reconnect");
    } catch {}

    return savedAny;
  }

  public async renameConversation(conversationId: string, newTitle: string): Promise<boolean> {
    const trimmed = newTitle.trim();
    if (!trimmed) {
      throw new Error("Conversation title cannot be empty");
    }

    try {
      if (this.paths.hasSummariesDb && fs.existsSync(this.paths.conversationSummariesDb)) {
        try {
          const sql = "UPDATE conversation_summaries SET title = ? WHERE conversation_id = ?;";
          await SqliteBridge.executeUpdate(this.paths.conversationSummariesDb, sql, [trimmed, conversationId]);
          await SqliteBridge.checkpointWal(this.paths.conversationSummariesDb);
        } catch (dbErr) {
          console.warn("Could not update title in conversation_summaries.db:", dbErr);
        }
      }

      // Always save to custom titles mapping for standalone IDE support and UI consistency
      this.saveCustomTitle(conversationId, trimmed);

      await this.triggerAntigravityRefresh();

      return true;
    } catch (e: any) {
      console.error("Failed to rename conversation:", e);
      throw new Error(`Failed to rename conversation: ${e.message || e}`);
    }
  }

  private async triggerAntigravityRefresh(): Promise<void> {
    try {
      await vscode.commands.executeCommand("antigravity.reconnect");
    } catch {}
    try {
      await vscode.commands.executeCommand("antigravity.triggerUpdate");
    } catch {}
  }

  public async deleteConversation(conversationId: string): Promise<boolean> {
    try {
      // 1. Delete from conversation_summaries.db if it exists
      if (this.paths.hasSummariesDb && fs.existsSync(this.paths.conversationSummariesDb)) {
        try {
          const sql = "DELETE FROM conversation_summaries WHERE conversation_id = ?;";
          await SqliteBridge.executeUpdate(this.paths.conversationSummariesDb, sql, [conversationId]);
          await SqliteBridge.checkpointWal(this.paths.conversationSummariesDb);
        } catch (dbErr) {
          console.warn("Could not delete from conversation_summaries.db:", dbErr);
        }
      }

      // Delete custom title mapping if exists
      try {
        const p = this.getCustomTitlesPath();
        const titles = this.loadCustomTitles();
        if (titles[conversationId]) {
          delete titles[conversationId];
          fs.writeFileSync(p, JSON.stringify(titles, null, 2), "utf-8");
        }
      } catch {}

      // 2. Delete conversations/<id>.db*
      const convoFiles = [
        path.join(this.paths.conversationsDir, `${conversationId}.db`),
        path.join(this.paths.conversationsDir, `${conversationId}.db-wal`),
        path.join(this.paths.conversationsDir, `${conversationId}.db-shm`)
      ];
      for (const f of convoFiles) {
        if (fs.existsSync(f)) {
          try {
            fs.unlinkSync(f);
          } catch {}
        }
      }

      // 3. Delete brain/<id>
      const brainDir = path.join(this.paths.brainDir, conversationId);
      if (fs.existsSync(brainDir)) {
        try {
          fs.rmSync(brainDir, { recursive: true, force: true });
        } catch {}
      }

      // 4. Delete annotations/<id>
      const annotationsDir = path.join(this.paths.annotationsDir, conversationId);
      if (fs.existsSync(annotationsDir)) {
        try {
          fs.rmSync(annotationsDir, { recursive: true, force: true });
        } catch {}
      }

      await this.triggerAntigravityRefresh();

      return true;
    } catch (e: any) {
      console.error("Failed to delete conversation:", e);
      throw new Error(`Failed to delete conversation: ${e.message || e}`);
    }
  }

  public async getActiveConversationId(): Promise<string | null> {
    const pyScript = `
import os, glob, sqlite3, json, sys

try:
    roots = []
    if os.environ.get('APPDATA'):
        roots.append(os.environ['APPDATA'])
    home = os.path.expanduser('~')
    roots.append(os.environ.get('XDG_CONFIG_HOME', os.path.join(home, '.config')))
    roots.append(os.path.join(home, 'Library', 'Application Support'))
    roots.append(os.path.join(home, 'AppData', 'Roaming'))

    # If running inside WSL, also inspect Windows host AppData mounted under /mnt/c
    if os.path.exists('/mnt/c/Users'):
        try:
            for u in os.listdir('/mnt/c/Users'):
                win_appdata = os.path.join('/mnt/c/Users', u, 'AppData', 'Roaming')
                if os.path.isdir(win_appdata):
                    roots.append(win_appdata)
        except Exception:
            pass

    editors = ['Antigravity', 'Antigravity IDE', 'Code', 'Code - Insiders', 'Cursor', 'Windsurf', 'VSCodium']

    # Remote Extension Host server roots (WSL, Remote SSH, Containers)
    server_roots = [
        os.path.join(home, '.antigravity-ide-server', 'data', 'User'),
        os.path.join(home, '.vscode-server', 'data', 'User'),
        os.path.join(home, '.vscode-server-insiders', 'data', 'User'),
        os.path.join(home, '.cursor-server', 'data', 'User'),
        os.path.join(home, '.windsurf-server', 'data', 'User'),
    ]

    ws_patterns = []
    for root in roots:
        if os.path.isdir(root):
            for ed in editors:
                ws_patterns.append(os.path.join(root, ed, 'User', 'workspaceStorage', '*', 'state.vscdb'))

    for s_root in server_roots:
        if os.path.isdir(s_root):
            ws_patterns.append(os.path.join(s_root, 'workspaceStorage', '*', 'state.vscdb'))

    candidates = []
    for pat in ws_patterns:
        for db_path in glob.glob(pat):
            try:
                candidates.append((os.path.getmtime(db_path), db_path))
            except Exception:
                pass

    candidates.sort(key=lambda x: x[0], reverse=True)
    active_id = None
    for mtime, db_path in candidates:
        try:
            conn = sqlite3.connect(db_path, timeout=2.0)
            c = conn.cursor()
            c.execute("SELECT value FROM ItemTable WHERE key = 'google.google-antigravity'")
            row = c.fetchone()
            conn.close()
            if row:
                val = json.loads(row[0])
                cid = val.get('lastConversationId')
                if cid:
                    active_id = cid
                    break
        except Exception:
            pass

    print(json.dumps({'success': True, 'activeConversationId': active_id}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
`;
    try {
      const res = await SqliteBridge.runScript<{ success: boolean; activeConversationId?: string }>(pyScript);
      return res.activeConversationId || null;
    } catch {
      return null;
    }
  }

  public async switchConversation(conversationId: string): Promise<{ success: boolean; updatedWorkspaces: number; updatedGlobal: number }> {
    const pyScript = `
import os, glob, sqlite3, json, sys

try:
    payload = json.loads(sys.stdin.read())
    target_id = payload["conversationId"]
    roots = []
    if os.environ.get('APPDATA'):
        roots.append(os.environ['APPDATA'])
    home = os.path.expanduser('~')
    roots.append(os.environ.get('XDG_CONFIG_HOME', os.path.join(home, '.config')))
    roots.append(os.path.join(home, 'Library', 'Application Support'))
    roots.append(os.path.join(home, 'AppData', 'Roaming'))

    # If running inside WSL, also inspect Windows host AppData mounted under /mnt/c
    if os.path.exists('/mnt/c/Users'):
        try:
            for u in os.listdir('/mnt/c/Users'):
                win_appdata = os.path.join('/mnt/c/Users', u, 'AppData', 'Roaming')
                if os.path.isdir(win_appdata):
                    roots.append(win_appdata)
        except Exception:
            pass

    editors = ['Antigravity', 'Antigravity IDE', 'Code', 'Code - Insiders', 'Cursor', 'Windsurf', 'VSCodium']

    # Remote Extension Host server roots (WSL, Remote SSH, Containers)
    server_roots = [
        os.path.join(home, '.antigravity-ide-server', 'data', 'User'),
        os.path.join(home, '.vscode-server', 'data', 'User'),
        os.path.join(home, '.vscode-server-insiders', 'data', 'User'),
        os.path.join(home, '.cursor-server', 'data', 'User'),
        os.path.join(home, '.windsurf-server', 'data', 'User'),
    ]

    ws_patterns = []
    for root in roots:
        if os.path.isdir(root):
            for ed in editors:
                ws_patterns.append(os.path.join(root, ed, "User", "workspaceStorage", "*", "state.vscdb"))

    for s_root in server_roots:
        if os.path.isdir(s_root):
            ws_patterns.append(os.path.join(s_root, "workspaceStorage", "*", "state.vscdb"))
    
    updated_ws = 0
    # 1. Update workspaceStorage
    for pat in ws_patterns:
        for db_path in glob.glob(pat):
            try:
                conn = sqlite3.connect(db_path, timeout=5.0)
                c = conn.cursor()
                c.execute("SELECT value FROM ItemTable WHERE key = 'google.google-antigravity'")
                row = c.fetchone()
                if row:
                    try:
                        val = json.loads(row[0])
                        val["lastConversationId"] = target_id
                        c.execute("UPDATE ItemTable SET value = ? WHERE key = 'google.google-antigravity'", (json.dumps(val),))
                        c.execute("INSERT OR REPLACE INTO ItemTable (key, value) VALUES ('antigravity.pendingConversationId', ?)", (target_id,))
                        conn.commit()
                        updated_ws += 1
                    except Exception:
                        pass
                conn.close()
            except Exception:
                pass

    # 2. Update globalStorage
    gs_paths = []
    for root in roots:
        if os.path.isdir(root):
            for ed in editors:
                gs_paths.append(os.path.join(root, ed, "User", "globalStorage", "state.vscdb"))

    for s_root in server_roots:
        if os.path.isdir(s_root):
            gs_paths.append(os.path.join(s_root, "globalStorage", "state.vscdb"))

    updated_gs = 0
    for gs_path in gs_paths:
        if os.path.exists(gs_path):
            try:
                conn = sqlite3.connect(gs_path, timeout=5.0)
                c = conn.cursor()
                c.execute("INSERT OR REPLACE INTO ItemTable (key, value) VALUES ('antigravity.pendingConversationId', ?)", (target_id,))
                conn.commit()
                conn.close()
                updated_gs += 1
            except Exception:
                pass

    print(json.dumps({"success": True, "updatedWorkspaces": updated_ws, "updatedGlobal": updated_gs}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
`;

    try {
      const res = await SqliteBridge.runScript<{
        success: boolean;
        updatedWorkspaces?: number;
        updatedGlobal?: number;
        error?: string;
      }>(pyScript, { conversationId });

      if (!res.success) {
        throw new Error(res.error || "Failed to execute switch script");
      }

      const updatedWorkspaces = res.updatedWorkspaces || 0;
      const updatedGlobal = res.updatedGlobal || 0;

      if (updatedWorkspaces === 0 && updatedGlobal === 0) {
        throw new Error(
          "No active Antigravity session storage found (0 databases updated). " +
          "Please ensure Antigravity chat is open in this workspace."
        );
      }

      try {
        await vscode.commands.executeCommand("antigravity.reconnect");
      } catch {}

      try {
        await vscode.commands.executeCommand("antigravity.triggerUpdate");
      } catch {}

      try {
        await vscode.commands.executeCommand("antigravity.panel.focus");
      } catch {
        try {
          await vscode.commands.executeCommand("workbench.view.extension.antigravity-sidebar");
        } catch {}
      }

      return {
        success: true,
        updatedWorkspaces,
        updatedGlobal
      };
    } catch (e: any) {
      console.error("Failed to switch conversation:", e);
      throw new Error(`Failed to switch conversation: ${e.message || e}`);
    }
  }

  public async createProject(projectName: string): Promise<string> {
    const trimmed = projectName.trim();
    if (!trimmed) {
      throw new Error("Project name cannot be empty");
    }

    const { randomUUID } = await import("crypto");
    const newProjectId = randomUUID();

    if (!fs.existsSync(this.paths.configProjectsDir)) {
      fs.mkdirSync(this.paths.configProjectsDir, { recursive: true });
    }

    const filePath = path.join(this.paths.configProjectsDir, `${newProjectId}.json`);
    const projectData = {
      id: newProjectId,
      name: trimmed,
      projectResources: {
        resources: []
      }
    };

    fs.writeFileSync(filePath, JSON.stringify(projectData, null, 2), "utf-8");

    // Add to project orders
    const currentOrder = await this.loadProjectsOrder();
    if (!currentOrder.includes(newProjectId)) {
      currentOrder.push(newProjectId);
      await this.saveProjectsOrder(currentOrder);
    }

    await this.triggerAntigravityRefresh();

    return newProjectId;
  }

  public async renameProject(projectId: string, newName: string): Promise<boolean> {
    const trimmed = newName.trim();
    if (!trimmed) {
      throw new Error("Project name cannot be empty");
    }

    const filePath = path.join(this.paths.configProjectsDir, `${projectId}.json`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Project configuration file not found for ID: ${projectId}`);
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      data.name = trimmed;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");

      await this.triggerAntigravityRefresh();

      return true;
    } catch (e: any) {
      throw new Error(`Failed to rename project: ${e.message || e}`);
    }
  }

  public async deleteProject(projectId: string): Promise<boolean> {
    const filePath = path.join(this.paths.configProjectsDir, `${projectId}.json`);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e: any) {
        throw new Error(`Failed to delete project file: ${e.message || e}`);
      }
    }

    // Remove from projectsOrder
    const currentOrder = await this.loadProjectsOrder();
    const updated = currentOrder.filter((id) => id !== projectId);
    await this.saveProjectsOrder(updated);

    await this.triggerAntigravityRefresh();

    return true;
  }
}
