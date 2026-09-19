import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as vscode from "vscode";

export interface AntigravityPaths {
  baseDir: string;
  configProjectsDir: string;
  conversationSummariesDb: string;
  conversationsDir: string;
  brainDir: string;
  protoCachePath: string;
  annotationsDir: string;
  appStorageJson: string;
  vscdbPaths: string[];
  exists: boolean;
}

export function resolveAntigravityPaths(): AntigravityPaths {
  const home = os.homedir();
  
  // 1. Check workspace config
  const config = vscode.workspace.getConfiguration("boygr.antigravityConversationManager");
  const customPath = config.get<string>("customAntigravityPath")?.trim();

  let baseDir = path.join(home, ".gemini", "antigravity");
  if (customPath && fs.existsSync(customPath)) {
    baseDir = customPath;
  }

  const configProjectsDir = path.join(home, ".gemini", "config", "projects");
  const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
  const appStorageJson = path.join(appData, "Antigravity", "app_storage.json");

  // Global storage paths for VS Code / Cursor / Insiders
  const vscdbCandidates = [
    path.join(appData, "Code", "User", "globalStorage", "state.vscdb"),
    path.join(appData, "Code - Insiders", "User", "globalStorage", "state.vscdb"),
    path.join(appData, "Antigravity", "User", "globalStorage", "state.vscdb"),
    path.join(appData, "Cursor", "User", "globalStorage", "state.vscdb")
  ];
  const vscdbPaths = vscdbCandidates.filter((p) => fs.existsSync(p));

  const conversationSummariesDb = path.join(baseDir, "conversation_summaries.db");
  const conversationsDir = path.join(baseDir, "conversations");
  const brainDir = path.join(baseDir, "brain");
  const protoCachePath = path.join(baseDir, "agyhub_summaries_proto.pb");
  const annotationsDir = path.join(baseDir, "annotations");

  const exists = fs.existsSync(conversationSummariesDb);

  return {
    baseDir,
    configProjectsDir,
    conversationSummariesDb,
    conversationsDir,
    brainDir,
    protoCachePath,
    annotationsDir,
    appStorageJson,
    vscdbPaths,
    exists
  };
}

export function getConversationDbPath(paths: AntigravityPaths, conversationId: string): string {
  return path.join(paths.conversationsDir, `${conversationId}.db`);
}

export function getBrainDirPath(paths: AntigravityPaths, conversationId: string): string {
  return path.join(paths.brainDir, conversationId);
}
