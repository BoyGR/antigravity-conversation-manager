# Changelog

All notable changes to the **Antigravity Conversation Manager** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] - 2026-09-19

### Added & Restored
- **Full Conversation Export & Import**:
  - **Portable Bundle Export (`.acm`)**: Export conversations into self-contained portable bundles containing conversation databases, trajectory metadata, brain logs, artifacts, and summary states.
  - **Human-Readable Markdown Export (`.md`)**: Export conversations formatted as structured Markdown documents with prompts, thought chains, model responses, and tool executions.
  - **One-Click Conversation Bundle Import**: Import conversation bundles directly into any target project folder or workspace.
- **Database Backup & Rollback**:
  - **Full SQLite Snapshot Backup**: Create point-in-time snapshot backups of Antigravity's conversation database (`conversation_summaries.db`) and individual conversation databases before major operations.
  - **Interactive Database Restore**: Rollback or restore databases from previous snapshot archives with automatic WAL checkpointing.
- **Unified Design System & In-Webview Custom Dialogs**:
  - Integrated the exact Antigravity design system tokens (`--ag-*`) matching `antigravity-account-switcher` for seamless Dark and Light theme integration.
  - Custom in-webview modal dialogs for switching, renaming, moving, and deleting conversations with zero window popups or distracting browser alerts.
  - Slim custom scrollbars with `color-mix` styling and smooth animations.
- **Status Bar & Activity Bar Brand Consistency**:
  - Contributed custom `antigravity-logo` icon font (`media/antigravity.woff`) matching official Antigravity styling in the status bar.
  - Consistent SVG branding across Activity Bar, status bar, and webview headers.

---

## [0.1.0] - 2026-09-19

### Initial Release
- **Core Conversation Management**:
  - List and browse conversations grouped by workspace projects.
  - Fast instant search filtering across conversation titles and preview text.
  - Active conversation detection with visual status badge.
  - Switch active conversation directly from the sidebar.
  - In-place conversation renaming with instant database synchronization.
  - Move conversations between project workspaces.
  - Project folder creation, renaming, deletion, and custom reordering.
  - Developer footer with author information and direct link.

