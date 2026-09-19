import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as vscode from "vscode";

export interface SqliteQueryResult<T = any> {
  success: boolean;
  rows?: T[];
  changes?: number;
  error?: string;
}

export class SqliteBridge {
  private static pythonCommand: string | null = null;

  public static async getPythonCommand(): Promise<string> {
    if (this.pythonCommand) {
      return this.pythonCommand;
    }

    // 1. Check user configuration
    try {
      const config = vscode.workspace.getConfiguration("boygr.antigravityConversationManager");
      const configuredPath = config.get<string>("pythonPath")?.trim();
      if (configuredPath && fs.existsSync(configuredPath)) {
        const works = await this.testCommand(configuredPath);
        if (works) {
          this.pythonCommand = configuredPath;
          return configuredPath;
        }
      }
    } catch {}

    // 2. Build candidate list
    const candidates: string[] = ["python", "python3", "py"];

    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    const programFiles = process.env.ProgramFiles || "C:\\Program Files";

    // Known common Windows python paths
    const pythonDirs = [
      path.join(localAppData, "Programs", "Python", "Python312", "python.exe"),
      path.join(localAppData, "Programs", "Python", "Python313", "python.exe"),
      path.join(localAppData, "Programs", "Python", "Python311", "python.exe"),
      path.join(localAppData, "Programs", "Python", "Python310", "python.exe"),
      path.join(localAppData, "Programs", "Python", "Launcher", "py.exe"),
      path.join(programFiles, "Python312", "python.exe"),
      path.join(programFiles, "Python311", "python.exe")
    ];

    for (const p of pythonDirs) {
      if (fs.existsSync(p)) {
        candidates.push(p);
      }
    }

    // 3. Test candidates
    for (const cmd of candidates) {
      const available = await this.testCommand(cmd);
      if (available) {
        this.pythonCommand = cmd;
        return cmd;
      }
    }

    throw new Error(
      "Python (python, python3, or py) with sqlite3 support is required. Please install Python or set the pythonPath setting in VS Code."
    );
  }

  private static testCommand(cmd: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const proc = spawn(cmd, ["-c", "import sqlite3; print('ok')"], { shell: false });
        let out = "";
        proc.stdout.on("data", (d) => (out += d.toString()));
        proc.on("close", (code) => {
          resolve(code === 0 && out.trim() === "ok");
        });
        proc.on("error", () => resolve(false));
      } catch {
        resolve(false);
      }
    });
  }

  public static async query<T = any>(dbPath: string, sql: string, params: any[] = []): Promise<T[]> {
    const res = await this.execute(dbPath, "query", sql, params);
    if (!res.success) {
      throw new Error(res.error || "SQLite query failed");
    }
    return res.rows || [];
  }

  public static async executeUpdate(dbPath: string, sql: string, params: any[] = []): Promise<number> {
    const res = await this.execute(dbPath, "update", sql, params);
    if (!res.success) {
      throw new Error(res.error || "SQLite update failed");
    }
    return res.changes || 0;
  }

  public static async checkpointWal(dbPath: string): Promise<void> {
    await this.query(dbPath, "PRAGMA wal_checkpoint(TRUNCATE);");
  }

  public static async runScript<T = any>(script: string, payload: any = {}): Promise<T> {
    const pyCmd = await this.getPythonCommand();
    return new Promise((resolve, reject) => {
      const proc = spawn(pyCmd, ["-c", script], { shell: false });
      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk) => (stdout += chunk.toString()));
      proc.stderr.on("data", (chunk) => (stderr += chunk.toString()));

      proc.on("close", (code) => {
        if (code !== 0 && !stdout.trim()) {
          reject(new Error(stderr || `Process exited with code ${code}`));
          return;
        }

        try {
          const parsed = JSON.parse(stdout.trim());
          resolve(parsed);
        } catch (e: any) {
          reject(new Error(`Invalid JSON output from Python script: ${stdout || stderr}`));
        }
      });

      proc.on("error", (err) => {
        reject(err);
      });

      proc.stdin.write(JSON.stringify(payload));
      proc.stdin.end();
    });
  }

  private static async execute(
    dbPath: string,
    action: "query" | "update",
    sql: string,
    params: any[]
  ): Promise<SqliteQueryResult> {
    if (!fs.existsSync(dbPath)) {
      return { success: false, error: `Database file does not exist: ${dbPath}` };
    }

    const pyCmd = await this.getPythonCommand();

    const pyScript = `
import sqlite3, json, sys, base64

try:
    payload = json.loads(sys.stdin.read())
    db_path = payload["dbPath"]
    action = payload["action"]
    sql = payload["sql"]
    raw_params = payload.get("params", [])

    processed_params = []
    for p in raw_params:
        if isinstance(p, dict) and p.get("__type") == "bytes_base64":
            processed_params.append(base64.b64decode(p["data"]))
        else:
            processed_params.append(p)

    conn = sqlite3.connect(db_path, timeout=10.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    if action == "query":
        cursor.execute(sql, processed_params)
        raw_rows = cursor.fetchall()
        result_rows = []
        for r in raw_rows:
            d = {}
            for k in r.keys():
                val = r[k]
                if isinstance(val, (bytes, bytearray)):
                    d[k] = {"__type": "bytes_base64", "data": base64.b64encode(val).decode("ascii")}
                else:
                    d[k] = val
            result_rows.append(d)
        print(json.dumps({"success": True, "rows": result_rows}))
    elif action == "update":
        cursor.execute(sql, processed_params)
        conn.commit()
        changes = cursor.rowcount
        conn.close()
        print(json.dumps({"success": True, "changes": changes}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
`;

    return new Promise((resolve) => {
      const proc = spawn(pyCmd, ["-c", pyScript], { shell: false });
      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk) => (stdout += chunk.toString()));
      proc.stderr.on("data", (chunk) => (stderr += chunk.toString()));

      proc.on("close", (code) => {
        if (code !== 0 && !stdout.trim()) {
          resolve({ success: false, error: stderr || `Process exited with code ${code}` });
          return;
        }

        try {
          const parsed = JSON.parse(stdout.trim());
          resolve(parsed);
        } catch (e: any) {
          resolve({ success: false, error: `Invalid JSON output: ${stdout || stderr} (${e.message})` });
        }
      });

      proc.on("error", (err) => {
        resolve({ success: false, error: err.message });
      });

      const inputPayload = JSON.stringify({
        dbPath,
        action,
        sql,
        params
      });

      proc.stdin.write(inputPayload);
      proc.stdin.end();
    });
  }
}
