import * as vscode from "vscode";
import { ConversationStore } from "../core/conversation-store";

export async function handleSwitchConversation(
  store: ConversationStore,
  conversationId: string,
  title?: string
): Promise<boolean> {
  const displayTitle = title ? `"${title}"` : `conversation ${conversationId.slice(0, 8)}...`;
  const confirm = await vscode.window.showInformationMessage(
    `Switch active conversation in Antigravity to ${displayTitle}?`,
    { modal: true },
    "Switch Conversation"
  );

  if (confirm !== "Switch Conversation") {
    return false;
  }

  try {
    await store.switchConversation(conversationId);
    vscode.window.showInformationMessage(`Switched active conversation in Antigravity to ${displayTitle}.`);
    return true;
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to switch active conversation: ${err.message || err}`);
    return false;
  }
}

export async function handleRenameConversation(
  store: ConversationStore,
  conversationId: string,
  currentTitle?: string
): Promise<boolean> {
  const newTitle = await vscode.window.showInputBox({
    title: "Rename Antigravity Conversation",
    prompt: "Enter a new title for this conversation",
    value: currentTitle || "",
    placeHolder: "e.g. My Feature Discussion",
    validateInput: (val) => {
      if (!val || !val.trim()) {
        return "Conversation title cannot be empty";
      }
      return null;
    }
  });

  if (!newTitle || !newTitle.trim() || newTitle.trim() === currentTitle) {
    return false;
  }

  const confirm = await vscode.window.showInformationMessage(
    `Rename conversation to "${newTitle.trim()}"?`,
    { modal: true },
    "Rename Conversation"
  );

  if (confirm !== "Rename Conversation") {
    return false;
  }

  try {
    await store.renameConversation(conversationId, newTitle.trim());
    vscode.window.showInformationMessage(`Conversation renamed to "${newTitle.trim()}".`);
    return true;
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to rename conversation: ${err.message || err}`);
    return false;
  }
}

export async function handleDeleteConversation(
  store: ConversationStore,
  conversationId: string,
  title?: string
): Promise<boolean> {
  const displayTitle = title ? `"${title}"` : `conversation ${conversationId.slice(0, 8)}...`;
  const confirm = await vscode.window.showWarningMessage(
    `Are you sure you want to delete ${displayTitle}? This will remove its database and files permanently.`,
    { modal: true },
    "Delete Conversation"
  );

  if (confirm !== "Delete Conversation") {
    return false;
  }

  try {
    await store.deleteConversation(conversationId);
    vscode.window.showInformationMessage(`Conversation ${displayTitle} was successfully deleted.`);
    return true;
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to delete conversation: ${err.message || err}`);
    return false;
  }
}

export async function handleCreateProject(store: ConversationStore): Promise<string | null> {
  const name = await vscode.window.showInputBox({
    title: "Create New Project Folder",
    prompt: "Enter name for the new project",
    placeHolder: "e.g. my-awesome-project",
    validateInput: (val) => {
      if (!val || !val.trim()) {
        return "Project name cannot be empty";
      }
      return null;
    }
  });

  if (!name || !name.trim()) {
    return null;
  }

  const confirm = await vscode.window.showInformationMessage(
    `Create new project folder "${name.trim()}"?`,
    { modal: true },
    "Create Project"
  );

  if (confirm !== "Create Project") {
    return null;
  }

  try {
    const id = await store.createProject(name.trim());
    vscode.window.showInformationMessage(`Project folder "${name.trim()}" created successfully.`);
    return id;
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to create project folder: ${err.message || err}`);
    return null;
  }
}

export async function handleRenameProject(
  store: ConversationStore,
  projectId: string,
  currentName: string
): Promise<boolean> {
  const newName = await vscode.window.showInputBox({
    title: `Rename Project "${currentName}"`,
    prompt: "Enter new name for this project folder",
    value: currentName,
    validateInput: (val) => {
      if (!val || !val.trim()) {
        return "Project name cannot be empty";
      }
      return null;
    }
  });

  if (!newName || !newName.trim() || newName.trim() === currentName) {
    return false;
  }

  const confirm = await vscode.window.showInformationMessage(
    `Rename project "${currentName}" to "${newName.trim()}"?`,
    { modal: true },
    "Rename Project"
  );

  if (confirm !== "Rename Project") {
    return false;
  }

  try {
    await store.renameProject(projectId, newName.trim());
    vscode.window.showInformationMessage(`Project renamed to "${newName.trim()}".`);
    return true;
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to rename project: ${err.message || err}`);
    return false;
  }
}

export async function handleDeleteProject(
  store: ConversationStore,
  projectId: string,
  projectName: string,
  convoCount: number
): Promise<boolean> {
  if (convoCount > 0) {
    const warning = await vscode.window.showWarningMessage(
      `Project "${projectName}" contains ${convoCount} conversation(s). Please move or delete its conversations before deleting the project folder.`,
      "Understood"
    );
    return false;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Are you sure you want to delete empty project folder "${projectName}"?`,
    { modal: true },
    "Delete Project"
  );

  if (confirm !== "Delete Project") {
    return false;
  }

  try {
    await store.deleteProject(projectId);
    vscode.window.showInformationMessage(`Project "${projectName}" deleted successfully.`);
    return true;
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to delete project: ${err.message || err}`);
    return false;
  }
}


