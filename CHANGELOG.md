# Changelog

All notable changes to the **Antigravity Conversation Manager** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.6] - 2026-09-22

### Fixed
- **Multi-Window Active Conversation Scoping**:
  - **Window-Scoped Session Detection**: Fixed an issue where opening multiple VS Code / Antigravity IDE windows side-by-side caused one window to incorrectly display the active conversation from another window. Active conversation resolution now prioritizes the window's exact `context.storageUri` (`workspaceStorage/<workspaceId>/state.vscdb`) and matches `workspace.json` folder URIs before falling back to global timestamps.
  - **Window-Scoped Switching**: Conversation switching now strictly targets the current window's workspace database first, ensuring that switching conversations in one project does not unexpectedly override or pollute active sessions in other open windows.

### Changed
- **Cleaner Switch Button UI**:
  - Removed the lightning icon (`⚡`) from the `[Switch]` button on conversation items in the sidebar list, resulting in a cleaner, more minimalist UI.
  - Updated the switch confirmation modal header icon to `⇄`.

---

## [0.3.5] - 2026-09-22

### Fixed
- **Remote Server (WSL2 / Remote SSH) Storage Roots & Conversation Switching (Issue #2)**:
  - **Remote Extension Host Storage Discovery**: Added dedicated discovery for remote server paths (`~/.antigravity-ide-server/data/User/`, `~/.vscode-server/data/User/`, `~/.cursor-server/data/User/`, `~/.windsurf-server/data/User/`) so `workspaceStorage` and `globalStorage` databases are correctly located in WSL2, SSH, and containerized environments.
  - **WSL Windows Host Storage Mount**: When running inside WSL2 on a Windows host, the extension now also scans `/mnt/c/Users/*/AppData/Roaming` to bridge desktop client session databases.
  - **Anti False-Positive Validation**: Fixed false-positive success notifications by verifying that at least one database was updated (`updatedWorkspaces > 0 || updatedGlobal > 0`) before reporting success, preventing silent switch failures.
  - **Reload Window Action**: Added a direct "Reload Window" notification button after switching conversations so users in remote architectures can immediately sync the in-memory chat panel with a single click.

---

## [0.3.4] - 2026-09-21

### Fixed
- **Linux, WSL2, and Standalone Antigravity IDE Compatibility (Issue #1)**:
  - **Direct Session Scanner Fallback**: When running inside Google Antigravity Standalone IDE (where centralized `conversation_summaries.db` is not produced), the dashboard now directly scans and loads individual `conversations/*.db` databases and extracts titles, previews, step counts, and workspace mapping without failing.
  - **Tilde (`~`) Path Expansion**: Settings paths such as `~/.gemini/antigravity` entered in `customAntigravityPath` or `pythonPath` are now properly expanded using `os.homedir()`.
  - **Linux / WSL Python Executable Resolution**: Prioritizes `python3`, `/usr/bin/python3`, and `/usr/local/bin/python3` on non-Windows environments to avoid `ENOENT` on Ubuntu/Debian where `python` is not available on PATH.
  - **Cross-Platform Storage Roots**: Expanded active session and project order discovery to inspect Linux XDG config (`~/.config`), macOS `~/Library/Application Support`, and Windows `%APPDATA%`.

---

## [0.3.3] - 2026-09-20

### Added
- **Extension Icon in Settings About Section**: The extension's logo (`icon.png`) now appears prominently in the About section of the Settings modal, matching the visual pattern of Antigravity Account Switcher.

### Changed
- **README Improvements**:
  - Broadened the intro tagline to mention all VS Code-compatible editors (VS Code, Antigravity IDE, Cursor, Windsurf, VSCodium).
  - Standardized the License section format to match `antigravity-account-switcher`, including Author, MIT License link, and Google LLC disclaimer.

### Chore
- Removed redundant duplicate `media/sidebar-icon.svg` asset (identical copy of `antigravity.svg`). The `media/` folder now contains exactly 5 essential production files.
- Fixed `build-font.js` root path resolution (`path.resolve(__dirname, '../..')`) for correct operation from the `.bgr/scripts/` directory.

---

## [0.3.2] - 2026-09-19

### Changed
- **Transparent Extension Icon Branding**:
  - Replaced the dark boxed rounded square background on the official extension icon (`icon.png`) with a clean, 100% transparent PNG background.
- **UI/UX Consistency with Antigravity Account Switcher**:
  - **Developer Footer**: Matched the footer layout 1:1, including dynamic localized prefix (`Developed by` / `Dikembangkan oleh`), developer display name `Boy Gilang Ramadhan (BoyGR)`, external link metadata, and aligned font sizing.
  - **Reset Configuration Option**: Added `Reset to Default` button in the Settings modal footer, restoring preferences to standard factory values.
  - **Settings Modal Polish**: Updated About section with dynamic versioning and external website link.

---

## [0.3.1] - 2026-09-19

### Fixed
- **Action Buttons & Metadata Text Overlap**:
  - Removed absolute floating positioning on `.conversation-actions` that caused action icon buttons (such as the new label button) to overlap metadata text (`steps • KB • time`) on narrow sidebars.
  - Implemented standard flexbox sibling truncation (`text-overflow: ellipsis`) so metadata smoothly yields space to action buttons without any visual collisions or text overlap.
  - Added full title tooltips to metadata so users can always see full step counts, database sizes, and timestamps on hover.

---

## [0.3.0] - 2026-09-19

### Added
- **Multi-Level Label & Tagging System**:
  - **Custom Label Management**: Create, edit, recolor, and delete custom labels with an 8-color preset palette.
  - **Project Folder Labeling**: Assign categorical labels to project folders (e.g., *Work*, *Personal*, *Tools*).
  - **Conversation Labeling**: Attach granular labels to individual conversations (e.g., *Feature*, *Bug*, *Research*).
  - **Interactive Filter Bar**: Quick-filter conversations across all projects with interactive label chips and conversation count badges.
  - **Zero Database Contamination**: Labels are persisted centrally in `~/.gemini/antigravity/acm_labels.json`, guaranteeing 100% safety against upstream Antigravity SQLite schema updates.
  - **Portable Bundle Label Preservation**: Conversation labels are automatically preserved in `.acm` bundle manifests during export and restored upon import.

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

