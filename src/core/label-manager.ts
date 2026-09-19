import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { AntigravityPaths, resolveAntigravityPaths } from "./antigravity-paths";

export interface LabelItem {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface LabelsDatabase {
  version: number;
  labels: LabelItem[];
  projectLabels: Record<string, string[]>;
  conversationLabels: Record<string, string[]>;
}

export class LabelManager {
  private static instance: LabelManager | null = null;
  private filePath: string;
  private data: LabelsDatabase;

  public static getInstance(paths?: AntigravityPaths): LabelManager {
    if (!LabelManager.instance) {
      LabelManager.instance = new LabelManager(paths);
    }
    return LabelManager.instance;
  }

  constructor(paths?: AntigravityPaths) {
    const resolvedPaths = paths || resolveAntigravityPaths();
    this.filePath = path.join(resolvedPaths.baseDir, "acm_labels.json");
    this.data = this.load();
  }

  private getDefaultData(): LabelsDatabase {
    return {
      version: 1,
      labels: [
        { id: "lbl-work", name: "Work", color: "#3b82f6" },
        { id: "lbl-personal", name: "Personal", color: "#10b981" },
        { id: "lbl-feature", name: "Feature", color: "#8b5cf6" },
        { id: "lbl-bug", name: "Bug", color: "#ef4444" },
        { id: "lbl-research", name: "Research", color: "#f59e0b" }
      ],
      projectLabels: {},
      conversationLabels: {}
    };
  }

  private load(): LabelsDatabase {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        const parsed = JSON.parse(raw);
        return {
          version: parsed.version || 1,
          labels: Array.isArray(parsed.labels) ? parsed.labels : [],
          projectLabels: parsed.projectLabels || {},
          conversationLabels: parsed.conversationLabels || {}
        };
      }
    } catch (err) {
      console.error("Failed to read acm_labels.json, using defaults:", err);
    }

    const defaultData = this.getDefaultData();
    this.saveData(defaultData);
    return defaultData;
  }

  private saveData(data: LabelsDatabase): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to save acm_labels.json:", err);
    }
  }

  public getLabels(): LabelItem[] {
    return [...this.data.labels];
  }

  public createLabel(name: string, color: string, description?: string): LabelItem {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("Label name cannot be empty");
    }

    const existing = this.data.labels.find(
      (l) => l.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      return existing;
    }

    const newLabel: LabelItem = {
      id: `lbl-${randomUUID().slice(0, 8)}`,
      name: trimmed,
      color: color || "#3b82f6",
      description: description?.trim()
    };

    this.data.labels.push(newLabel);
    this.saveData(this.data);
    return newLabel;
  }

  public updateLabel(id: string, name: string, color: string, description?: string): boolean {
    const label = this.data.labels.find((l) => l.id === id);
    if (!label) return false;

    if (name && name.trim()) {
      label.name = name.trim();
    }
    if (color) {
      label.color = color;
    }
    if (description !== undefined) {
      label.description = description.trim();
    }

    this.saveData(this.data);
    return true;
  }

  public deleteLabel(id: string): boolean {
    const initialLen = this.data.labels.length;
    this.data.labels = this.data.labels.filter((l) => l.id !== id);

    if (this.data.labels.length !== initialLen) {
      // Clean from projectLabels
      for (const pId in this.data.projectLabels) {
        this.data.projectLabels[pId] = this.data.projectLabels[pId].filter(
          (lblId) => lblId !== id
        );
      }

      // Clean from conversationLabels
      for (const cId in this.data.conversationLabels) {
        this.data.conversationLabels[cId] = this.data.conversationLabels[cId].filter(
          (lblId) => lblId !== id
        );
      }

      this.saveData(this.data);
      return true;
    }
    return false;
  }

  public getProjectLabels(projectId: string): LabelItem[] {
    const labelIds = this.data.projectLabels[projectId] || [];
    const labelMap = new Map(this.data.labels.map((l) => [l.id, l]));
    return labelIds.map((id) => labelMap.get(id)).filter(Boolean) as LabelItem[];
  }

  public setProjectLabels(projectId: string, labelIds: string[]): void {
    const validIds = labelIds.filter((id) =>
      this.data.labels.some((l) => l.id === id)
    );
    this.data.projectLabels[projectId] = Array.from(new Set(validIds));
    this.saveData(this.data);
  }

  public getConversationLabels(conversationId: string): LabelItem[] {
    const labelIds = this.data.conversationLabels[conversationId] || [];
    const labelMap = new Map(this.data.labels.map((l) => [l.id, l]));
    return labelIds.map((id) => labelMap.get(id)).filter(Boolean) as LabelItem[];
  }

  public setConversationLabels(conversationId: string, labelIds: string[]): void {
    const validIds = labelIds.filter((id) =>
      this.data.labels.some((l) => l.id === id)
    );
    this.data.conversationLabels[conversationId] = Array.from(new Set(validIds));
    this.saveData(this.data);
  }

  public getAllData(): LabelsDatabase {
    return JSON.parse(JSON.stringify(this.data));
  }
}

