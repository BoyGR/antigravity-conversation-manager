import * as vscode from "vscode";

export class StatusBarManager implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      95
    );
    this.statusBarItem.command = "boygr.antigravityConversationManager.focusView";
    this.statusBarItem.text = "$(antigravity-convo-logo) Antigravity Conversation Manager";
    this.statusBarItem.tooltip = "Antigravity Conversation Manager - Click to open dashboard";
    this.statusBarItem.show();
  }

  public updateText(count?: number) {
    if (count !== undefined) {
      this.statusBarItem.text = `$(antigravity-convo-logo) Antigravity Conversation Manager (${count})`;
    } else {
      this.statusBarItem.text = "$(antigravity-convo-logo) Antigravity Conversation Manager";
    }
  }

  public dispose() {
    this.statusBarItem.dispose();
  }
}

