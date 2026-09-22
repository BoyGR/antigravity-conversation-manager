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
  hasSummariesDb: boolean;
  hasConversationDbs: boolean;
}

/**
 * Expands leading ~ or ~/ to the user's home directory.
 */
export function expandTilde(p: string): string {
  if (!p) return p;
  const trimmed = p.trim();
  if (trimmed === "~") {
    return os.homedir();
  }
  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) {
    return path.join(os.homedir(), trimmed.slice(2));
  }
  return trimmed;
}

export function resolveAntigravityPaths(): AntigravityPaths {
  const home = os.homedir();

  // 1. Check workspace configuration with tilde expansion
  const config = vscode.workspace.getConfiguration("boygr.antigravityConversationManager");
  const rawCustomPath = config.get<string>("customAntigravityPath")?.trim();
  const customPath = rawCustomPath ? expandTilde(rawCustomPath) : "";

  let baseDir = path.join(home, ".gemini", "antigravity");
  if (customPath && fs.existsSync(customPath)) {
    baseDir = customPath;
  } else {
    // Auto-detect Standalone Antigravity IDE directory if default ~/.gemini/antigravity does not exist or lacks conversations
    const standardDir = path.join(home, ".gemini", "antigravity");
    const ideDir = path.join(home, ".gemini", "antigravity-ide");

    if (!fs.existsSync(standardDir) && fs.existsSync(ideDir)) {
      baseDir = ideDir;
    } else if (fs.existsSync(standardDir) && fs.existsSync(ideDir)) {
      const standardConvos = path.join(standardDir, "conversations");
      const ideConvos = path.join(ideDir, "conversations");
      const standardHasConvos = fs.existsSync(standardConvos) && fs.readdirSync(standardConvos).some((f) => f.endsWith(".db"));
      const ideHasConvos = fs.existsSync(ideConvos) && fs.readdirSync(ideConvos).some((f) => f.endsWith(".db"));
      if (!standardHasConvos && ideHasConvos) {
        baseDir = ideDir;
      }
    }
  }

  // Authoritative project config directories
  let configProjectsDir = path.join(home, ".gemini", "config", "projects");
  if (!fs.existsSync(configProjectsDir)) {
    const altProjectsDir = path.join(baseDir, "config", "projects");
    if (fs.existsSync(altProjectsDir)) {
      configProjectsDir = altProjectsDir;
    } else {
      const ideProjectsDir = path.join(home, ".gemini", "antigravity-ide", "config", "projects");
      if (fs.existsSync(ideProjectsDir)) {
        configProjectsDir = ideProjectsDir;
      }
    }
  }

  // Resolve editor storage roots across Windows, Linux/WSL, and macOS
  const editorRoots: string[] = [];
  if (process.env.APPDATA) {
    editorRoots.push(process.env.APPDATA);
  }
  // Linux / WSL standard XDG config dir
  const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
  editorRoots.push(xdgConfig);
  // macOS Application Support
  editorRoots.push(path.join(home, "Library", "Application Support"));
  // Fallback for Windows without APPDATA env
  editorRoots.push(path.join(home, "AppData", "Roaming"));

  // In WSL2, also inspect Windows host AppData mounted under /mnt/c/Users/*/AppData/Roaming
  if (process.platform === "linux" && fs.existsSync("/mnt/c/Users")) {
    try {
      const winUsers = fs.readdirSync("/mnt/c/Users");
      for (const u of winUsers) {
        const winAppData = path.join("/mnt/c/Users", u, "AppData", "Roaming");
        if (fs.existsSync(winAppData)) {
          editorRoots.push(winAppData);
        }
      }
    } catch {}
  }

  const editorNames = [
    "Antigravity",
    "Antigravity IDE",
    "Code",
    "Code - Insiders",
    "Cursor",
    "Windsurf",
    "VSCodium"
  ];

  const vscdbCandidates: string[] = [];
  let appStorageJson = "";

  for (const root of editorRoots) {
    if (!fs.existsSync(root)) continue;
    for (const ed of editorNames) {
      const vscdb = path.join(root, ed, "User", "globalStorage", "state.vscdb");
      if (fs.existsSync(vscdb)) {
        vscdbCandidates.push(vscdb);
      }
    }
    if (!appStorageJson) {
      const candidateAppStorage = path.join(root, "Antigravity", "app_storage.json");
      if (fs.existsSync(candidateAppStorage)) {
        appStorageJson = candidateAppStorage;
      }
      const candidateIdeStorage = path.join(root, "Antigravity IDE", "app_storage.json");
      if (fs.existsSync(candidateIdeStorage)) {
        appStorageJson = candidateIdeStorage;
      }
    }
  }

  // Remote Extension Host Server storage paths (WSL, Remote SSH, Containers)
  const remoteServerDirs = [
    path.join(home, ".antigravity-ide-server", "data", "User"),
    path.join(home, ".vscode-server", "data", "User"),
    path.join(home, ".vscode-server-insiders", "data", "User"),
    path.join(home, ".cursor-server", "data", "User"),
    path.join(home, ".windsurf-server", "data", "User")
  ];

  for (const sDir of remoteServerDirs) {
    if (!fs.existsSync(sDir)) continue;
    const vscdb = path.join(sDir, "globalStorage", "state.vscdb");
    if (fs.existsSync(vscdb)) {
      vscdbCandidates.push(vscdb);
    }
  }

  if (!appStorageJson) {
    appStorageJson = path.join(editorRoots[0] || home, "Antigravity", "app_storage.json");
  }

  const conversationSummariesDb = path.join(baseDir, "conversation_summaries.db");
  const conversationsDir = path.join(baseDir, "conversations");
  const brainDir = path.join(baseDir, "brain");
  const protoCachePath = path.join(baseDir, "agyhub_summaries_proto.pb");
  const annotationsDir = path.join(baseDir, "annotations");

  const hasSummariesDb = fs.existsSync(conversationSummariesDb);
  let hasConversationDbs = false;
  if (fs.existsSync(conversationsDir)) {
    try {
      hasConversationDbs = fs.readdirSync(conversationsDir).some((f) => f.endsWith(".db"));
    } catch {}
  }

  // The extension environment exists if conversation_summaries.db exists OR if conversations directory has databases
  const exists = hasSummariesDb || hasConversationDbs || fs.existsSync(baseDir);

  return {
    baseDir,
    configProjectsDir,
    conversationSummariesDb,
    conversationsDir,
    brainDir,
    protoCachePath,
    annotationsDir,
    appStorageJson,
    vscdbPaths: vscdbCandidates,
    exists,
    hasSummariesDb,
    hasConversationDbs
  };
}

export function getConversationDbPath(paths: AntigravityPaths, conversationId: string): string {
  return path.join(paths.conversationsDir, `${conversationId}.db`);
}

export function getBrainDirPath(paths: AntigravityPaths, conversationId: string): string {
  return path.join(paths.brainDir, conversationId);
}
