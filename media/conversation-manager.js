(function () {
  const vscode = acquireVsCodeApi();

  let state = {
    projects: [],
    allLabels: [],
    selectedLabelFilter: "all",
    filterQuery: "",
    activeConversationId: null,
    expandedProjectId: null,
    hasInitializedExpansion: false,
    lastProjectsJson: ""
  };

  let preferences = {
    theme: "vscode",
    language: "auto",
    defaultExportFormat: "bundle",
    showPreview: true,
    confirmActions: true,
    autoBackupBeforeMove: true,
    customAntigravityPath: "",
    pythonPath: ""
  };

  let ui = {
    settingsOpen: false,
    settingsDraft: null,
    labelModalOpen: false,
    labelPickerOpen: false,
    newLabelColor: "#3b82f6"
  };

  const LABEL_PRESET_COLORS = [
    "#3b82f6", // Blue
    "#10b981", // Emerald
    "#8b5cf6", // Purple
    "#ef4444", // Red
    "#f59e0b", // Amber
    "#06b6d4", // Cyan
    "#ec4899", // Pink
    "#64748b"  // Slate
  ];

  const translations = {
    en: {
      appName: "Antigravity Conversation Manager",
      settings: "Settings",
      appearance: "Appearance",
      theme: "Theme",
      followVsCode: "Follow VS Code theme",
      dark: "Dark",
      light: "Light",
      system: "System",
      language: "Language",
      automatic: "Automatic (VS Code)",
      english: "English",
      indonesian: "Bahasa Indonesia",
      conversationPreferences: "Conversation Preferences",
      autoBackupBeforeMove: "Auto-backup before moving conversations",
      autoBackupHint: "Create a database snapshot before moving conversations across folders",
      defaultExportFormat: "Default export format",
      portableBundle: "Portable Bundle (.acm)",
      markdownDoc: "Markdown Document (.md)",
      showPreview: "Show last message preview snippets",
      showPreviewHint: "Display summary or prompt snippet under conversation titles",
      confirmActions: "Confirm before actions",
      confirmActionsHint: "Show confirmation dialog before switching, moving or deleting",
      systemPaths: "System Configuration Paths",
      customAntigravityPath: "Custom Antigravity Path (~/.gemini/antigravity)",
      pythonPath: "Custom Python Executable Path",
      backupAndRestore: "Backup & Restore",
      backupDesc: "Manage full snapshot backups of all conversations in the database",
      backupNow: "Backup Database",
      restoreNow: "Restore Database",
      about: "About",
      version: "Version",
      developer: "Developer",
      cancel: "Cancel",
      saveSettings: "Save Settings",
      searchPlaceholder: "Search conversations...",
      newProjectTitle: "New Project Folder",
      create: "Create",
      save: "Save",
      delete: "Delete",
      switch: "Switch",
      rename: "Rename",
      move: "Move",
      exportBundle: "Export Bundle",
      importBundle: "Import Conversation Bundle (.acm)",
      exportMarkdown: "Export Markdown",
      projects: "Projects",
      conversations: "Conversations",
      loading: "Loading conversations...",
      noConversationsFound: "No matching conversations found.",
      noProjectsYet: "No conversation folders found.",
      all: "All",
      manageLabels: "Manage Labels",
      labels: "Labels",
      addLabel: "Add Label",
      newLabel: "New Label",
      editLabel: "Edit Label",
      deleteLabelConfirm: "Are you sure you want to delete this label?",
      labelNamePlaceholder: "Label name...",
      selectColor: "Select Color",
      projectLabelsTitle: "Project Folder Labels",
      conversationLabelsTitle: "Conversation Labels",
      noLabelsYet: "No labels created yet.",
      assignLabels: "Assign Labels",
      filterByLabel: "Filter by label",
      developedBy: "Developed by",
      resetToDefault: "Reset to Default",
      resetSettingsNotice: "Settings reset to defaults. Click Save to apply.",
      website: "Website"
    },
    id: {
      appName: "Antigravity Conversation Manager",
      settings: "Pengaturan",
      appearance: "Tampilan",
      theme: "Tema",
      followVsCode: "Ikuti tema VS Code",
      dark: "Gelap (Dark)",
      light: "Terang (Light)",
      system: "Sistem (System)",
      language: "Bahasa",
      automatic: "Otomatis (VS Code)",
      english: "English",
      indonesian: "Bahasa Indonesia",
      conversationPreferences: "Preferensi Percakapan",
      autoBackupBeforeMove: "Backup otomatis sebelum memindahkan percakapan",
      autoBackupHint: "Membuat snapshot cadangan database sebelum memindahkan percakapan",
      defaultExportFormat: "Format ekspor default",
      portableBundle: "Bundle Portabel (.acm)",
      markdownDoc: "Dokumen Markdown (.md)",
      showPreview: "Tampilkan cuplikan pratinjau pesan",
      showPreviewHint: "Tampilkan ringkasan atau cuplikan prompt di bawah judul percakapan",
      confirmActions: "Konfirmasi sebelum aksi",
      confirmActionsHint: "Tampilkan dialog konfirmasi sebelum berpindah, memindahkan, atau menghapus",
      systemPaths: "Jalur Konfigurasi Sistem",
      customAntigravityPath: "Jalur Kustom Antigravity (~/.gemini/antigravity)",
      pythonPath: "Jalur Kustom Executable Python",
      backupAndRestore: "Cadangan & Pemulihan",
      backupDesc: "Kelola snapshot cadangan lengkap seluruh percakapan di database",
      backupNow: "Cadangkan Database",
      restoreNow: "Pulihkan Database",
      about: "Tentang",
      version: "Versi",
      developer: "Pengembang",
      cancel: "Batal",
      saveSettings: "Simpan Pengaturan",
      searchPlaceholder: "Cari percakapan...",
      newProjectTitle: "Folder Project Baru",
      create: "Buat",
      save: "Simpan",
      delete: "Hapus",
      switch: "Beralih",
      rename: "Ubah Nama",
      move: "Pindahkan",
      exportBundle: "Ekspor Bundle",
      importBundle: "Impor Bundle Percakapan (.acm)",
      exportMarkdown: "Ekspor Markdown",
      projects: "Folder Project",
      conversations: "Percakapan",
      loading: "Memuat percakapan...",
      noConversationsFound: "Tidak ada percakapan yang cocok dengan pencarian.",
      noProjectsYet: "Belum ada folder percakapan.",
      all: "Semua",
      manageLabels: "Kelola Label",
      labels: "Label",
      addLabel: "Tambah Label",
      newLabel: "Label Baru",
      editLabel: "Ubah Label",
      deleteLabelConfirm: "Apakah Anda yakin ingin menghapus label ini?",
      labelNamePlaceholder: "Nama label...",
      selectColor: "Pilih Warna",
      projectLabelsTitle: "Label Folder Project",
      conversationLabelsTitle: "Label Percakapan",
      noLabelsYet: "Belum ada label yang dibuat.",
      assignLabels: "Pasang Label",
      filterByLabel: "Filter berdasarkan label",
      developedBy: "Dikembangkan oleh",
      resetToDefault: "Atur Ulang Default",
      resetSettingsNotice: "Pengaturan dikembalikan ke default. Klik Simpan untuk menerapkan.",
      website: "Situs Web"
    }
  };

  function currentLang() {
    if (preferences.language === "id") return "id";
    if (preferences.language === "en") return "en";
    const nav = (navigator.language || "").toLowerCase();
    return nav.startsWith("id") ? "id" : "en";
  }

  function t(key) {
    const lang = currentLang();
    return translations[lang]?.[key] || translations.en[key] || key;
  }

  function applyTheme(theme) {
    if (!theme || theme === "vscode") {
      document.documentElement.removeAttribute("data-ag-theme");
    } else if (theme === "dark") {
      document.documentElement.setAttribute("data-ag-theme", "dark");
    } else if (theme === "light") {
      document.documentElement.setAttribute("data-ag-theme", "light");
    } else if (theme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.setAttribute("data-ag-theme", isDark ? "dark" : "light");
    }
  }

  const treeContainer = document.getElementById("tree-container");
  const statsBar = document.getElementById("stats-bar");
  const searchInput = document.getElementById("search-input");
  const btnRefresh = document.getElementById("btn-refresh");
  const btnImport = document.getElementById("btn-import");
  const btnNewProject = document.getElementById("btn-new-project");
  const devLink = document.getElementById("developer-link");
  const modalContainer = document.getElementById("modal-container");
  const settingsModalContainer = document.getElementById("settings-modal-container");
  const labelsFilterBar = document.getElementById("labels-filter-bar");
  const labelModalContainer = document.getElementById("label-modal-container");
  const labelPickerContainer = document.getElementById("label-picker-container");

  function updateUiTexts() {
    if (searchInput) {
      searchInput.placeholder = t("searchPlaceholder");
    }
    if (btnNewProject) btnNewProject.title = t("newProjectTitle");
    if (btnImport) btnImport.title = t("importBundle");
    const footerPrefix = document.querySelector(".footer-prefix");
    if (footerPrefix) {
      footerPrefix.textContent = t("developedBy");
    }
    if (devLink) {
      devLink.textContent = "Boy Gilang Ramadhan (BoyGR)";
      devLink.title = "https://boygr.com";
      devLink.setAttribute("data-external-url", "https://boygr.com");
    }
  }

  function openSettings() {
    ui.settingsDraft = {
      theme: preferences.theme || "vscode",
      language: preferences.language || "auto",
      defaultExportFormat: preferences.defaultExportFormat || "bundle",
      showPreview: preferences.showPreview !== false,
      confirmActions: preferences.confirmActions !== false,
      autoBackupBeforeMove: preferences.autoBackupBeforeMove !== false,
      customAntigravityPath: preferences.customAntigravityPath || "",
      pythonPath: preferences.pythonPath || ""
    };
    ui.settingsOpen = true;
    renderSettingsModal();
  }

  function cancelSettings() {
    ui.settingsOpen = false;
    ui.settingsDraft = null;
    applyTheme(preferences.theme);
    renderSettingsModal();
  }

  function resetSettingsToDefault() {
    ui.settingsDraft = {
      theme: "vscode",
      language: "auto",
      defaultExportFormat: "bundle",
      showPreview: true,
      confirmActions: true,
      autoBackupBeforeMove: true,
      customAntigravityPath: "",
      pythonPath: ""
    };
    applyTheme(ui.settingsDraft.theme);
    renderSettingsModal();
  }

  function saveSettings() {
    if (!ui.settingsDraft) return;

    const themeSelect = document.getElementById("setting-theme");
    const langSelect = document.getElementById("setting-language");
    const exportSelect = document.getElementById("setting-export-format");
    const autoBackupCheck = document.getElementById("setting-auto-backup");
    const previewCheck = document.getElementById("setting-show-preview");
    const confirmCheck = document.getElementById("setting-confirm-actions");
    const agPathInput = document.getElementById("setting-antigravity-path");
    const pyPathInput = document.getElementById("setting-python-path");

    if (themeSelect) ui.settingsDraft.theme = themeSelect.value;
    if (langSelect) ui.settingsDraft.language = langSelect.value;
    if (exportSelect) ui.settingsDraft.defaultExportFormat = exportSelect.value;
    if (autoBackupCheck) ui.settingsDraft.autoBackupBeforeMove = autoBackupCheck.checked;
    if (previewCheck) ui.settingsDraft.showPreview = previewCheck.checked;
    if (confirmCheck) ui.settingsDraft.confirmActions = confirmCheck.checked;
    if (agPathInput) ui.settingsDraft.customAntigravityPath = agPathInput.value.trim();
    if (pyPathInput) ui.settingsDraft.pythonPath = pyPathInput.value.trim();

    preferences = { ...ui.settingsDraft };
    applyTheme(preferences.theme);
    updateUiTexts();

    vscode.postMessage({
      type: "saveSettings",
      preferences: preferences
    });

    ui.settingsOpen = false;
    ui.settingsDraft = null;
    renderSettingsModal();
    renderTree();
  }

  function renderSettingsModal() {
    if (!settingsModalContainer) return;
    if (!ui.settingsOpen || !ui.settingsDraft) {
      settingsModalContainer.innerHTML = "";
      return;
    }

    const draft = ui.settingsDraft;
    settingsModalContainer.innerHTML = `
      <div class="settings-backdrop" id="settings-backdrop">
        <section class="settings-panel" role="dialog" aria-modal="true" aria-label="${escapeHtml(t("settings"))}">
          <header class="settings-header">
            <h2>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M9.1 4.4L8.6 2H7.4l-.5 2.4-.7.3-2-1.3-.9.8 1.3 2-.2.7-2.5.5v1.2l2.5.5.3.8-1.4 2 .9.8 2-1.4.7.3.5 2.4h1.2l.5-2.4.8-.3 2 1.3.8-.9-1.3-2 .3-.8 2.4-.4V7.6l-2.4-.5-.3-.7 1.3-2-.8-.9-2 1.3-.7-.4zM8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
              </svg>
              ${escapeHtml(t("settings"))}
            </h2>
            <button type="button" class="close-btn" id="btn-close-settings" title="${escapeHtml(t("cancel"))}">×</button>
          </header>

          <div class="settings-body">
            <!-- Appearance -->
            <div class="settings-group">
              <h3>${escapeHtml(t("appearance"))}</h3>
              <label class="field">
                <span>${escapeHtml(t("theme"))}</span>
                <select id="setting-theme">
                  <option value="vscode" ${draft.theme === "vscode" ? "selected" : ""}>${escapeHtml(t("followVsCode"))}</option>
                  <option value="dark" ${draft.theme === "dark" ? "selected" : ""}>${escapeHtml(t("dark"))}</option>
                  <option value="light" ${draft.theme === "light" ? "selected" : ""}>${escapeHtml(t("light"))}</option>
                  <option value="system" ${draft.theme === "system" ? "selected" : ""}>${escapeHtml(t("system"))}</option>
                </select>
              </label>
              <label class="field">
                <span>${escapeHtml(t("language"))}</span>
                <select id="setting-language">
                  <option value="auto" ${draft.language === "auto" ? "selected" : ""}>${escapeHtml(t("automatic"))}</option>
                  <option value="en" ${draft.language === "en" ? "selected" : ""}>${escapeHtml(t("english"))}</option>
                  <option value="id" ${draft.language === "id" ? "selected" : ""}>${escapeHtml(t("indonesian"))}</option>
                </select>
              </label>
            </div>

            <!-- Conversation Preferences -->
            <div class="settings-group">
              <h3>${escapeHtml(t("conversationPreferences"))}</h3>
              <label class="field">
                <span>${escapeHtml(t("defaultExportFormat"))}</span>
                <select id="setting-export-format">
                  <option value="bundle" ${draft.defaultExportFormat === "bundle" ? "selected" : ""}>${escapeHtml(t("portableBundle"))}</option>
                  <option value="markdown" ${draft.defaultExportFormat === "markdown" ? "selected" : ""}>${escapeHtml(t("markdownDoc"))}</option>
                </select>
              </label>
              <div class="check-setting-wrap">
                <label class="check-row">
                  <input type="checkbox" id="setting-auto-backup" ${draft.autoBackupBeforeMove ? "checked" : ""}>
                  <span class="check-label-text">${escapeHtml(t("autoBackupBeforeMove"))}</span>
                </label>
                <div class="field-hint">${escapeHtml(t("autoBackupHint"))}</div>
              </div>
              <div class="check-setting-wrap">
                <label class="check-row">
                  <input type="checkbox" id="setting-show-preview" ${draft.showPreview ? "checked" : ""}>
                  <span class="check-label-text">${escapeHtml(t("showPreview"))}</span>
                </label>
                <div class="field-hint">${escapeHtml(t("showPreviewHint"))}</div>
              </div>
              <div class="check-setting-wrap">
                <label class="check-row">
                  <input type="checkbox" id="setting-confirm-actions" ${draft.confirmActions ? "checked" : ""}>
                  <span class="check-label-text">${escapeHtml(t("confirmActions"))}</span>
                </label>
                <div class="field-hint">${escapeHtml(t("confirmActionsHint"))}</div>
              </div>
            </div>

            <!-- System Paths -->
            <div class="settings-group">
              <h3>${escapeHtml(t("systemPaths"))}</h3>
              <label class="field">
                <span>${escapeHtml(t("customAntigravityPath"))}</span>
                <input type="text" id="setting-antigravity-path" value="${escapeHtml(draft.customAntigravityPath || "")}" placeholder="~/.gemini/antigravity" />
              </label>
              <label class="field">
                <span>${escapeHtml(t("pythonPath"))}</span>
                <input type="text" id="setting-python-path" value="${escapeHtml(draft.pythonPath || "")}" placeholder="python" />
              </label>
            </div>

            <!-- Backup & Restore Quick Actions -->
            <div class="settings-group">
              <h3>${escapeHtml(t("backupAndRestore"))}</h3>
              <p class="settings-desc">${escapeHtml(t("backupDesc"))}</p>
              <div class="settings-actions-row">
                <button type="button" class="btn" id="btn-quick-backup">${escapeHtml(t("backupNow"))}</button>
                <button type="button" class="btn" id="btn-quick-restore">${escapeHtml(t("restoreNow"))}</button>
              </div>
            </div>

            <!-- About -->
            <div class="settings-group">
              <h3>${escapeHtml(t("about"))}</h3>

              ${state.iconUri ? `
              <div style="text-align: center; margin: 8px 0 16px 0;">
                <img src="${escapeHtml(state.iconUri)}" width="64" height="64" style="border-radius: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.35); vertical-align: middle;" alt="Logo" />
              </div>` : ""}

              <div class="about-row">
                <span>${escapeHtml(t("appName"))}</span>
                <span>v${escapeHtml(state.version || "0.3.4")}</span>
              </div>
              <div class="about-row">
                <span>${escapeHtml(t("developer"))}</span>
                <span>Boy Gilang Ramadhan (BoyGR)</span>
              </div>
              <div class="about-row">
                <span>${escapeHtml(t("website"))}</span>
                <a href="https://boygr.com" class="developer-link" style="color: var(--ag-link); text-decoration: none; font-weight: 500;">boygr.com</a>
              </div>
            </div>
          </div>

          <footer class="settings-footer">
            <button
              type="button"
              class="btn btn-reset"
              id="btn-reset-settings"
              title="${escapeHtml(t("resetToDefault"))}"
            >
              ${escapeHtml(t("resetToDefault"))}
            </button>
            <div class="settings-footer-actions">
              <button type="button" class="btn" id="btn-cancel-settings">${escapeHtml(t("cancel"))}</button>
              <button type="button" class="btn primary-btn" id="btn-save-settings">${escapeHtml(t("saveSettings"))}</button>
            </div>
          </footer>
        </section>
      </div>
    `;

    const closeBtn = document.getElementById("btn-close-settings");
    const cancelBtn = document.getElementById("btn-cancel-settings");
    const saveBtn = document.getElementById("btn-save-settings");
    const resetBtn = document.getElementById("btn-reset-settings");
    const quickBackupBtn = document.getElementById("btn-quick-backup");
    const quickRestoreBtn = document.getElementById("btn-quick-restore");
    const backdropEl = document.getElementById("settings-backdrop");

    if (closeBtn) closeBtn.addEventListener("click", cancelSettings);
    if (cancelBtn) cancelBtn.addEventListener("click", cancelSettings);
    if (saveBtn) saveBtn.addEventListener("click", saveSettings);
    if (resetBtn) resetBtn.addEventListener("click", resetSettingsToDefault);
    if (backdropEl) {
      backdropEl.addEventListener("click", (e) => {
        if (e.target === backdropEl) cancelSettings();
      });
    }

    if (quickBackupBtn) {
      quickBackupBtn.addEventListener("click", () => {
        vscode.postMessage({ type: "backup" });
      });
    }

    if (quickRestoreBtn) {
      quickRestoreBtn.addEventListener("click", () => {
        vscode.postMessage({ type: "restore" });
      });
    }

    const themeSelect = document.getElementById("setting-theme");
    if (themeSelect) {
      themeSelect.addEventListener("change", (e) => {
        applyTheme(e.target.value);
      });
    }
  }

  if (devLink) {
    devLink.addEventListener("click", (e) => {
      e.preventDefault();
      vscode.postMessage({ type: "openExternal", url: "https://boygr.com" });
    });
  }

  // Header Toolbar Listeners
  if (btnNewProject) {
    btnNewProject.addEventListener("click", () => {
      showModal({
        type: "primary",
        symbol: "+",
        title: t("newProjectTitle"),
        description: t("newProjectTitle"),
        inputType: "text",
        inputPlaceholder: "e.g. personal-tools",
        confirmText: t("create"),
        confirmClass: "primary",
        onConfirm: (name) => {
          if (name && name.trim()) {
            vscode.postMessage({
              type: "executeCreateProject",
              name: name.trim()
            });
          }
        }
      });
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => {
      btnRefresh.classList.add("spinning");
      vscode.postMessage({ type: "refresh" });
    });
  }

  if (btnImport) {
    btnImport.addEventListener("click", () => {
      vscode.postMessage({ type: "import" });
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.filterQuery = e.target.value.toLowerCase().trim();
      renderTree();
    });
  }

  // Handle messages from Extension Host
  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg.type === "stateUpdate") {
      if (btnRefresh) btnRefresh.classList.remove("spinning");

      if (msg.preferences) {
        preferences = { ...preferences, ...msg.preferences };
        applyTheme(preferences.theme);
        updateUiTexts();
      }

      if (msg.version) {
        state.version = msg.version;
        const versionEl = document.querySelector(".footer-version");
        if (versionEl) {
          versionEl.textContent = `v${msg.version}`;
        }
      }

      if (msg.iconUri) {
        state.iconUri = msg.iconUri;
      }

      const projectsJson = JSON.stringify(msg.projects || []);
      const isInitialRender = !state.hasInitializedExpansion || treeContainer.children.length === 0;
      const dataChanged =
        projectsJson !== state.lastProjectsJson ||
        msg.activeConversationId !== state.activeConversationId;

      state.projects = msg.projects || [];
      state.allLabels = msg.allLabels || [];
      state.activeConversationId = msg.activeConversationId || null;
      state.lastProjectsJson = projectsJson;

      renderLabelsFilterBar();
      if (ui.labelModalOpen) {
        renderLabelManagerModal();
      }

      // Initialize accordion once on first load
      if (!state.hasInitializedExpansion) {
        state.hasInitializedExpansion = true;
        if (state.activeConversationId) {
          const activeProj = state.projects.find((p) =>
            p.conversations.some((c) => c.id === state.activeConversationId)
          );
          state.expandedProjectId = activeProj ? activeProj.id : (state.projects[0]?.id || null);
        } else {
          state.expandedProjectId = state.projects[0]?.id || null;
        }
      } else if (state.expandedProjectId && !state.projects.some((p) => p.id === state.expandedProjectId)) {
        // Project previously expanded was deleted or removed
        state.expandedProjectId = null;
      }

      if (statsBar) {
        statsBar.innerHTML = `<span>${msg.totalProjects} ${t("projects")} • ${msg.totalConversations} ${t("conversations")}</span>`;
      }

      // Always render on initial load or if tree is empty, or when data changes
      if (dataChanged || isInitialRender) {
        renderTree();
      }
    } else if (msg.type === "openSettings") {
      openSettings();
    } else if (msg.type === "error") {
      if (btnRefresh) btnRefresh.classList.remove("spinning");
      treeContainer.innerHTML = `<div class="empty-state" style="color: #ef4444;">${msg.message}</div>`;
    }
  });

  // Reorder projects
  function reorderProject(projId, direction) {
    const idx = state.projects.findIndex((p) => p.id === projId);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= state.projects.length) return;

    // Swap positions
    const temp = state.projects[idx];
    state.projects[idx] = state.projects[targetIdx];
    state.projects[targetIdx] = temp;

    // Instant local UI re-render
    renderTree();

    // Persist new order to app_storage.json via extension
    const newOrder = state.projects.map((p) => p.id);
    vscode.postMessage({
      type: "reorderProjects",
      newOrder: newOrder
    });
  }

  // =========================================================
  // Custom In-Webview Modal Dialogs (Matching Account Switcher)
  // =========================================================
  function showModal({
    type = "primary", // "primary" | "danger" | "warning" | "success"
    symbol = "!",
    title,
    targetName = "",
    targetSub = "",
    description = "",
    inputType = null, // null | "text" | "select"
    inputValue = "",
    inputPlaceholder = "",
    selectOptions = [], // [{ label, value }]
    confirmText = null,
    confirmClass = "primary", // "primary" | "destructive"
    cancelText = null,
    onConfirm
  }) {
    const finalConfirmText = confirmText || t("save");
    const finalCancelText = cancelText || t("cancel");
    if (!modalContainer) return;
    modalContainer.innerHTML = "";

    const backdrop = document.createElement("div");
    backdrop.className = "dialog-backdrop";

    const dialog = document.createElement("section");
    dialog.className = "confirm-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");

    let inputHtml = "";
    if (inputType === "text") {
      inputHtml = `<input type="text" class="confirm-dialog-input" id="modal-text-input" value="${escapeHtml(
        inputValue
      )}" placeholder="${escapeHtml(inputPlaceholder)}" />`;
    } else if (inputType === "select") {
      const optsHtml = selectOptions
        .map(
          (opt) =>
            `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</option>`
        )
        .join("");
      inputHtml = `<select class="confirm-dialog-select" id="modal-select-input">${optsHtml}</select>`;
    }

    dialog.innerHTML = `
      <header class="confirm-dialog-header">
        <div class="dialog-symbol ${type}">${symbol}</div>
        <div>
          <h2>${escapeHtml(title)}</h2>
          ${targetName ? `<div class="confirm-target-name">${escapeHtml(targetName)}</div>` : ""}
          ${targetSub ? `<div class="confirm-target-sub">${escapeHtml(targetSub)}</div>` : ""}
        </div>
      </header>
      <div class="confirm-dialog-body">
        ${description ? `<p class="confirm-description">${escapeHtml(description)}</p>` : ""}
        ${inputHtml}
      </div>
      <footer class="confirm-dialog-actions">
        <button type="button" class="btn" id="modal-btn-cancel">${escapeHtml(finalCancelText)}</button>
        <button type="button" class="btn ${confirmClass === "destructive" ? "destructive" : "primary-btn"}" id="modal-btn-confirm">${escapeHtml(
      finalConfirmText
    )}</button>
      </footer>
    `;

    backdrop.appendChild(dialog);
    modalContainer.appendChild(backdrop);

    const btnCancel = dialog.querySelector("#modal-btn-cancel");
    const btnConfirm = dialog.querySelector("#modal-btn-confirm");
    const textInput = dialog.querySelector("#modal-text-input");
    const selectInput = dialog.querySelector("#modal-select-input");

    const closeModal = () => {
      window.removeEventListener("keydown", handleKeydown);
      modalContainer.innerHTML = "";
    };

    const submitConfirm = () => {
      let result = null;
      if (textInput) {
        result = textInput.value;
      } else if (selectInput) {
        result = selectInput.value;
      }
      closeModal();
      if (typeof onConfirm === "function") {
        onConfirm(result);
      }
    };

    btnCancel.addEventListener("click", (e) => {
      e.stopPropagation();
      closeModal();
    });

    btnConfirm.addEventListener("click", (e) => {
      e.stopPropagation();
      submitConfirm();
    });

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        closeModal();
      }
    });

    const handleKeydown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeModal();
      } else if (e.key === "Enter" && textInput && document.activeElement === textInput) {
        e.preventDefault();
        submitConfirm();
      }
    };
    window.addEventListener("keydown", handleKeydown);

    // Auto-focus input or confirm button
    setTimeout(() => {
      if (textInput) {
        textInput.focus();
        textInput.select();
      } else if (selectInput) {
        selectInput.focus();
      } else {
        btnConfirm.focus();
      }
    }, 50);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // =========================================================
  // Label System: Filter Bar & Modals
  // =========================================================
  function renderLabelsFilterBar() {
    if (!labelsFilterBar) return;

    if (!state.allLabels || state.allLabels.length === 0) {
      labelsFilterBar.innerHTML = "";
      return;
    }

    // Calculate count per label
    const labelCounts = {};
    (state.projects || []).forEach((p) => {
      (p.conversations || []).forEach((c) => {
        (c.labels || []).forEach((l) => {
          labelCounts[l.id] = (labelCounts[l.id] || 0) + 1;
        });
      });
    });

    let html = `
      <button class="filter-chip ${state.selectedLabelFilter === "all" ? "active" : ""}" data-id="all">
        ${escapeHtml(t("all"))}
      </button>
    `;

    state.allLabels.forEach((l) => {
      const count = labelCounts[l.id] || 0;
      const isActive = state.selectedLabelFilter === l.id;
      html += `
        <button class="filter-chip ${isActive ? "active" : ""}" data-id="${escapeHtml(l.id)}" style="--chip-color: ${escapeHtml(l.color)};">
          <span class="filter-chip-dot"></span>
          <span>${escapeHtml(l.name)}</span>
          ${count > 0 ? `<span class="filter-chip-count">(${count})</span>` : ""}
        </button>
      `;
    });

    html += `
      <button class="btn-manage-labels-chip" title="${escapeHtml(t("manageLabels"))}">
        🏷️ ${escapeHtml(t("manageLabels"))}
      </button>
    `;

    labelsFilterBar.innerHTML = html;

    // Listeners
    labelsFilterBar.querySelectorAll(".filter-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const id = chip.getAttribute("data-id");
        state.selectedLabelFilter = id;
        renderLabelsFilterBar();
        renderTree();
      });
    });

    const btnManage = labelsFilterBar.querySelector(".btn-manage-labels-chip");
    if (btnManage) {
      btnManage.addEventListener("click", () => {
        openLabelManager();
      });
    }
  }

  function openLabelManager() {
    ui.labelModalOpen = true;
    renderLabelManagerModal();
  }

  function closeLabelManager() {
    ui.labelModalOpen = false;
    if (labelModalContainer) labelModalContainer.innerHTML = "";
  }

  function renderLabelManagerModal() {
    if (!labelModalContainer) return;

    let labelsListHtml = "";
    if (state.allLabels.length === 0) {
      labelsListHtml = `<div style="color: var(--ag-muted); font-size: 10px; text-align: center; padding: 12px 0;">${escapeHtml(t("noLabelsYet"))}</div>`;
    } else {
      labelsListHtml = state.allLabels.map((l) => `
        <div class="label-item-row" data-id="${escapeHtml(l.id)}">
          <div class="label-item-info">
            <span class="label-dot" style="background-color: ${escapeHtml(l.color)}; width: 10px; height: 10px;"></span>
            <span style="font-size: 11px; font-weight: 500; color: var(--ag-fg);">${escapeHtml(l.name)}</span>
          </div>
          <div class="label-item-actions">
            <button class="action-icon-btn btn-del-lbl" data-id="${escapeHtml(l.id)}" title="${escapeHtml(t("delete"))}">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
              </svg>
            </button>
          </div>
        </div>
      `).join("");
    }

    const colorSwatchesHtml = LABEL_PRESET_COLORS.map((c) => `
      <span class="color-swatch ${ui.newLabelColor === c ? "selected" : ""}" data-color="${c}" style="background-color: ${c};"></span>
    `).join("");

    labelModalContainer.innerHTML = `
      <div class="label-modal-backdrop" id="lbl-backdrop">
        <div class="label-modal-panel">
          <div class="label-modal-header">
            <span class="label-modal-title">🏷️ ${escapeHtml(t("manageLabels"))}</span>
            <button class="action-icon-btn" id="btn-close-lbl-modal">✕</button>
          </div>
          <div class="label-modal-body">
            <div class="label-form-box">
              <span style="font-size: 10px; font-weight: 600; color: var(--ag-fg);">${escapeHtml(t("newLabel"))}</span>
              <div style="display: flex; gap: 6px;">
                <input type="text" id="new-label-name" placeholder="${escapeHtml(t("labelNamePlaceholder"))}" style="flex: 1; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--ag-border); background: var(--ag-input-bg); color: var(--ag-fg); font-size: 11px;" />
                <button class="btn btn-primary" id="btn-save-new-label" style="padding: 4px 10px; font-size: 11px;">${escapeHtml(t("addLabel"))}</button>
              </div>
              <div style="font-size: 9.5px; color: var(--ag-muted); margin-top: 2px;">${escapeHtml(t("selectColor"))}:</div>
              <div class="label-color-palette" id="palette-swatches">
                ${colorSwatchesHtml}
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 6px;">
              <span style="font-size: 10px; font-weight: 600; color: var(--ag-fg);">${escapeHtml(t("labels"))} (${state.allLabels.length})</span>
              <div class="labels-list">
                ${labelsListHtml}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const closeBtn = document.getElementById("btn-close-lbl-modal");
    if (closeBtn) closeBtn.addEventListener("click", closeLabelManager);

    const backdrop = document.getElementById("lbl-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) closeLabelManager();
      });
    }

    const swatches = document.querySelectorAll("#palette-swatches .color-swatch");
    swatches.forEach((s) => {
      s.addEventListener("click", () => {
        ui.newLabelColor = s.getAttribute("data-color");
        swatches.forEach((sw) => sw.classList.remove("selected"));
        s.classList.add("selected");
      });
    });

    const btnSaveNew = document.getElementById("btn-save-new-label");
    const nameInput = document.getElementById("new-label-name");
    const handleCreate = () => {
      const name = nameInput ? nameInput.value.trim() : "";
      if (!name) return;
      vscode.postMessage({
        type: "createLabel",
        name: name,
        color: ui.newLabelColor
      });
      nameInput.value = "";
    };

    if (btnSaveNew) btnSaveNew.addEventListener("click", handleCreate);
    if (nameInput) {
      nameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleCreate();
      });
    }

    document.querySelectorAll(".label-item-row .btn-del-lbl").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        if (!id) return;
        vscode.postMessage({
          type: "deleteLabel",
          id: id
        });
      });
    });
  }

  function openLabelPicker({ targetType, targetId, targetName, currentLabels = [] }) {
    if (!labelPickerContainer) return;

    const currentLabelIds = new Set((currentLabels || []).map((l) => l.id));

    const rowsHtml = state.allLabels.map((l) => {
      const isChecked = currentLabelIds.has(l.id);
      return `
        <label class="label-picker-row">
          <input type="checkbox" data-id="${escapeHtml(l.id)}" ${isChecked ? "checked" : ""} />
          <span class="label-dot" style="background-color: ${escapeHtml(l.color)}; width: 9px; height: 9px;"></span>
          <span style="font-size: 11px; color: var(--ag-fg); font-weight: 500;">${escapeHtml(l.name)}</span>
        </label>
      `;
    }).join("");

    labelPickerContainer.innerHTML = `
      <div class="label-picker-backdrop" id="picker-backdrop">
        <div class="label-picker-panel">
          <div class="label-modal-header">
            <span class="label-modal-title">🏷️ ${escapeHtml(t("assignLabels"))}: ${escapeHtml(targetName)}</span>
            <button class="action-icon-btn" id="btn-close-picker">✕</button>
          </div>
          <div class="label-modal-body">
            ${state.allLabels.length === 0 
              ? `<div style="color: var(--ag-muted); font-size: 10px; text-align: center; padding: 12px 0;">${escapeHtml(t("noLabelsYet"))}</div>`
              : `<div class="label-picker-list">${rowsHtml}</div>`
            }
            <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 6px;">
              <button class="btn btn-secondary" id="btn-cancel-picker" style="padding: 4px 10px; font-size: 11px;">${escapeHtml(t("cancel"))}</button>
              <button class="btn btn-primary" id="btn-save-picker" style="padding: 4px 10px; font-size: 11px;">${escapeHtml(t("save"))}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const closePicker = () => {
      labelPickerContainer.innerHTML = "";
    };

    const closeBtn = document.getElementById("btn-close-picker");
    if (closeBtn) closeBtn.addEventListener("click", closePicker);

    const cancelBtn = document.getElementById("btn-cancel-picker");
    if (cancelBtn) cancelBtn.addEventListener("click", closePicker);

    const backdrop = document.getElementById("picker-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) closePicker();
      });
    }

    const saveBtn = document.getElementById("btn-save-picker");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        const checkboxes = labelPickerContainer.querySelectorAll(".label-picker-row input[type='checkbox']");
        const selectedIds = [];
        checkboxes.forEach((cb) => {
          if (cb.checked) {
            selectedIds.push(cb.getAttribute("data-id"));
          }
        });

        if (targetType === "project") {
          vscode.postMessage({
            type: "setProjectLabels",
            projectId: targetId,
            labelIds: selectedIds
          });
        } else if (targetType === "conversation") {
          vscode.postMessage({
            type: "setConversationLabels",
            conversationId: targetId,
            labelIds: selectedIds
          });
        }

        closePicker();
      });
    }
  }

  // =========================================================
  // Render Tree
  // =========================================================
  function renderTree() {
    if (!state.projects || state.projects.length === 0) {
      treeContainer.innerHTML = '<div class="empty-state">No Antigravity conversations found.</div>';
      return;
    }

    treeContainer.innerHTML = "";

    const query = state.filterQuery;
    let anyMatches = false;

    state.projects.forEach((proj, index) => {
      const activeLabelId = state.selectedLabelFilter;
      const filteredConvos = proj.conversations.filter((c) => {
        const matchesQuery = !query ||
          c.title.toLowerCase().includes(query) ||
          c.preview.toLowerCase().includes(query);
        const matchesLabel = activeLabelId === "all" ||
          (c.labels && c.labels.some((l) => l.id === activeLabelId));
        return matchesQuery && matchesLabel;
      });

      const projectHasLabel = activeLabelId === "all" ||
        (proj.labels && proj.labels.some((l) => l.id === activeLabelId));

      if (filteredConvos.length === 0 && !projectHasLabel && (query || activeLabelId !== "all")) {
        return;
      }

      anyMatches = true;

      const groupEl = document.createElement("div");
      const isExpanded = query ? true : proj.id === state.expandedProjectId;
      groupEl.className = "project-group" + (isExpanded ? "" : " collapsed");

      const projLabelsHtml = (proj.labels && proj.labels.length > 0)
        ? `<div class="project-labels">${proj.labels.map(l => `
            <span class="label-badge" style="--lbl-color: ${escapeHtml(l.color)};" title="${escapeHtml(l.name)}">
              <span class="label-dot" style="background-color: ${escapeHtml(l.color)};"></span>
              ${escapeHtml(l.name)}
            </span>
          `).join("")}</div>`
        : "";

      const headerEl = document.createElement("div");
      headerEl.className = "project-header";
      headerEl.innerHTML = `
        <div class="project-header-main">
          <span class="project-arrow">▼</span>
          <span class="project-title" title="${escapeHtml(proj.workspaceUri || proj.name)}">📁 ${escapeHtml(
          proj.name
        )}</span>
          <span class="project-count">${filteredConvos.length}</span>
          <div class="project-reorder-actions">
            <button class="reorder-btn btn-proj-labels" title="${escapeHtml(t("projectLabelsTitle"))}">🏷️</button>
            <button class="reorder-btn btn-rename-proj" title="Rename project folder">✏️</button>
            <button class="reorder-btn btn-delete-proj" title="Delete project folder" ${
              filteredConvos.length > 0 ? "style='opacity:0.3;cursor:not-allowed;' disabled" : ""
            }>🗑️</button>
            <button class="reorder-btn btn-up" title="Move folder up" ${
              index === 0 ? "disabled style='opacity:0.3;cursor:default;'" : ""
            }>▲</button>
            <button class="reorder-btn btn-down" title="Move folder down" ${
              index === state.projects.length - 1 ? "disabled style='opacity:0.3;cursor:default;'" : ""
            }>▼</button>
          </div>
        </div>
        ${projLabelsHtml}
      `;

      // Accordion Toggle: only toggles on clicking header
      headerEl.addEventListener("click", () => {
        if (state.expandedProjectId === proj.id) {
          state.expandedProjectId = null;
          groupEl.classList.add("collapsed");
        } else {
          state.expandedProjectId = proj.id;
          document.querySelectorAll(".project-group").forEach((g) => {
            if (g !== groupEl) {
              g.classList.add("collapsed");
            }
          });
          groupEl.classList.remove("collapsed");
        }
      });

      // Project Actions
      const btnLabelsProj = headerEl.querySelector(".btn-proj-labels");
      if (btnLabelsProj) {
        btnLabelsProj.addEventListener("click", (e) => {
          e.stopPropagation();
          openLabelPicker({
            targetType: "project",
            targetId: proj.id,
            targetName: proj.name,
            currentLabels: proj.labels || []
          });
        });
      }

      const btnRenameProj = headerEl.querySelector(".btn-rename-proj");
      if (btnRenameProj) {
        btnRenameProj.addEventListener("click", (e) => {
          e.stopPropagation();
          showModal({
            type: "primary",
            symbol: "✏️",
            title: "Rename Project Folder",
            targetName: proj.name,
            description: "Enter a new name for this project folder:",
            inputType: "text",
            inputValue: proj.name,
            confirmText: "Save",
            confirmClass: "primary",
            onConfirm: (newName) => {
              if (newName && newName.trim() && newName.trim() !== proj.name) {
                vscode.postMessage({
                  type: "executeRenameProject",
                  projectId: proj.id,
                  newName: newName.trim()
                });
              }
            }
          });
        });
      }

      const btnDeleteProj = headerEl.querySelector(".btn-delete-proj");
      if (btnDeleteProj) {
        btnDeleteProj.addEventListener("click", (e) => {
          e.stopPropagation();
          showModal({
            type: "danger",
            symbol: "!",
            title: "Delete Project Folder",
            targetName: proj.name,
            description: `Are you sure you want to delete the project folder "${proj.name}"? This action cannot be undone.`,
            confirmText: "Delete",
            confirmClass: "danger",
            onConfirm: () => {
              vscode.postMessage({
                type: "executeDeleteProject",
                projectId: proj.id
              });
            }
          });
        });
      }

      // Reorder buttons
      const btnUp = headerEl.querySelector(".btn-up");
      if (btnUp) {
        btnUp.addEventListener("click", (e) => {
          e.stopPropagation();
          reorderProject(proj.id, -1);
        });
      }

      const btnDown = headerEl.querySelector(".btn-down");
      if (btnDown) {
        btnDown.addEventListener("click", (e) => {
          e.stopPropagation();
          reorderProject(proj.id, 1);
        });
      }

      const listEl = document.createElement("ul");
      listEl.className = "conversation-list";

      if (filteredConvos.length === 0) {
        const emptyEl = document.createElement("li");
        emptyEl.style.cssText =
          "padding: 4px 12px; color: var(--text-muted); font-size: 11px; font-style: italic;";
        emptyEl.textContent = "No conversations yet";
        listEl.appendChild(emptyEl);
      }

      filteredConvos.forEach((convo) => {
        const itemEl = document.createElement("li");
        const isActive = convo.id === state.activeConversationId;
        itemEl.className = "conversation-item" + (isActive ? " active" : "");

        const sizeKb = (convo.dbSizeBytes / 1024).toFixed(0);
        const dateStr = convo.lastModifiedTime ? formatTime(convo.lastModifiedTime) : "";
        const metaParts = [`${convo.stepCount} steps`];
        if (sizeKb > 0) metaParts.push(`${sizeKb} KB`);
        if (dateStr) metaParts.push(dateStr);
        const metaText = metaParts.join(" • ");

        const convoLabelsHtml = (convo.labels && convo.labels.length > 0)
          ? `<div class="conversation-labels">${convo.labels.map(l => `
              <span class="label-badge" style="--lbl-color: ${escapeHtml(l.color)};" title="${escapeHtml(l.name)}">
                <span class="label-dot" style="background-color: ${escapeHtml(l.color)};"></span>
                ${escapeHtml(l.name)}
              </span>
            `).join("")}</div>`
          : "";

        itemEl.innerHTML = `
          <div class="conversation-content">
            <div class="conversation-top-row">
              <span class="conversation-title" title="${escapeHtml(convo.title)}">${escapeHtml(
          convo.title
        )}</span>
              ${
                isActive
                  ? '<span class="badge-active" title="Active conversation">Active</span>'
                  : `<button class="action-btn switch" title="${escapeHtml(t("switch"))}">⚡ ${escapeHtml(t("switch"))}</button>`
              }
            </div>
            ${convoLabelsHtml}
            ${preferences.showPreview !== false && convo.preview ? `<div class="conversation-preview" title="${escapeHtml(convo.preview)}">${escapeHtml(convo.preview)}</div>` : ""}
            <div class="conversation-bottom-row">
              <div class="conversation-meta" title="${escapeHtml(metaText)}">
                <span>${escapeHtml(metaText)}</span>
              </div>
              <div class="conversation-actions">
                <button class="action-icon-btn label" title="${escapeHtml(t("assignLabels"))}">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2 2a1 1 0 0 1 1-1h4.586a1 1 0 0 1 .707.293l7 7a1 1 0 0 1 0 1.414l-4.586 4.586a1 1 0 0 1-1.414 0l-7-7A1 1 0 0 1 2 6.586V2zm3.5 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
                  </svg>
                </button>
                <button class="action-icon-btn rename" title="${escapeHtml(t("rename"))}">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                  </svg>
                </button>
                <button class="action-icon-btn move" title="${escapeHtml(t("move"))}">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M.5 3l.04.87a1.99 1.99 0 0 0-.342.528L0 4.5V14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4.5a2 2 0 0 0-2-2h-5L7.5 1H2a2 2 0 0 0-2 2zM2 2h5.293l1.5 1.5H14a1 1 0 0 1 1 1v1H1V3a1 1 0 0 1 1-1zm-1 4h14v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6z"/>
                  </svg>
                </button>
                <button class="action-icon-btn export" title="${escapeHtml(t("exportBundle"))}">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8.186 1.113a.5.5 0 0 0-.372 0L1.846 3.5 8 5.961 14.154 3.5 8.186 1.113zM15 4.239l-6.5 2.6v7.922l6.5-2.6V4.24zM7.5 14.762V6.838L1 4.239v7.923l6.5 2.6zM7.443.184a1.5 1.5 0 0 1 1.114 0l6.229 2.492A1 1 0 0 1 15.5 3.61v8.78a1 1 0 0 1-.614.928l-6.229 2.492a1.5 1.5 0 0 1-1.314 0l-6.229-2.492A1 1 0 0 1 .5 12.39V3.61a1 1 0 0 1 .614-.928L7.443.184z"/>
                  </svg>
                </button>
                <button class="action-icon-btn md" title="${escapeHtml(t("exportMarkdown"))}">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4 0h5.293A1 1 0 0 1 10 .293L13.707 4a1 1 0 0 1 .293.707V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2zm5.5 1.5v2a1 1 0 0 0 1 1h2l-3-3zM4.5 7.5a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1h-7zM4 10a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 10zm.5 2a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1h-4z"/>
                  </svg>
                </button>
                <button class="action-icon-btn del" title="${escapeHtml(t("delete"))}">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                    <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        `;

        // Switch Action helper
        const triggerSwitch = () => {
          if (preferences.confirmActions === false) {
            vscode.postMessage({
              type: "executeSwitch",
              conversationId: convo.id,
              title: convo.title
            });
            return;
          }

          showModal({
            type: "primary",
            symbol: "⚡",
            title: `${t("switch")} ${t("conversations")}?`,
            targetName: convo.title,
            targetSub: `${convo.stepCount} steps • ID: ${convo.id.slice(0, 16)}...`,
            description:
              "Set this conversation as the active session in Antigravity IDE and VS Code.",
            confirmText: t("switch"),
            confirmClass: "primary",
            onConfirm: () => {
              vscode.postMessage({
                type: "executeSwitch",
                conversationId: convo.id,
                title: convo.title
              });
            }
          });
        };

        // Click on Title: Switch if not active, copy ID if active
        const titleEl = itemEl.querySelector(".conversation-title");
        if (titleEl) {
          titleEl.addEventListener("click", (e) => {
            e.stopPropagation();
            if (!isActive) {
              triggerSwitch();
            } else {
              vscode.postMessage({ type: "copyId", conversationId: convo.id });
            }
          });
        }

        // Switch button
        const btnSwitch = itemEl.querySelector(".action-btn.switch");
        if (btnSwitch) {
          btnSwitch.addEventListener("click", (e) => {
            e.stopPropagation();
            triggerSwitch();
          });
        }

        // Assign Labels to Conversation
        const btnLabel = itemEl.querySelector(".action-icon-btn.label");
        if (btnLabel) {
          btnLabel.addEventListener("click", (e) => {
            e.stopPropagation();
            openLabelPicker({
              targetType: "conversation",
              targetId: convo.id,
              targetName: convo.title,
              currentLabels: convo.labels || []
            });
          });
        }

        // Rename Conversation
        const btnRename = itemEl.querySelector(".action-icon-btn.rename");
        if (btnRename) {
          btnRename.addEventListener("click", (e) => {
            e.stopPropagation();
            showModal({
              type: "primary",
              symbol: "✏️",
              title: "Rename Conversation",
              targetName: convo.title,
              description: "Enter a new title for this conversation:",
              inputType: "text",
              inputValue: convo.title,
              inputPlaceholder: "Conversation title...",
              confirmText: "Save",
              confirmClass: "primary",
              onConfirm: (newTitle) => {
                if (newTitle && newTitle.trim() && newTitle.trim() !== convo.title) {
                  vscode.postMessage({
                    type: "executeRename",
                    conversationId: convo.id,
                    newTitle: newTitle.trim()
                  });
                }
              }
            });
          });
        }

        // Move Conversation
        const btnMove = itemEl.querySelector(".action-icon-btn.move");
        if (btnMove) {
          btnMove.addEventListener("click", (e) => {
            e.stopPropagation();
            const otherProjects = state.projects
              .filter((p) => p.id !== proj.id)
              .map((p) => ({ label: p.name, value: p.id }));

            if (otherProjects.length === 0) {
              showModal({
                type: "warning",
                symbol: "!",
                title: "No Other Projects",
                description: "Please create another project folder first before moving conversations.",
                confirmText: "Understood",
                confirmClass: "primary",
                onConfirm: () => {}
              });
              return;
            }

            showModal({
              type: "primary",
              symbol: "📁",
              title: "Move Conversation",
              targetName: convo.title,
              description: "Select target project folder to move this conversation into:",
              inputType: "select",
              selectOptions: otherProjects,
              confirmText: "Move",
              confirmClass: "primary",
              onConfirm: (targetProjectId) => {
                if (targetProjectId) {
                  vscode.postMessage({
                    type: "executeMove",
                    conversationId: convo.id,
                    targetProjectId
                  });
                }
              }
            });
          });
        }

        // Export .acm Bundle
        const btnExport = itemEl.querySelector(".action-icon-btn.export");
        if (btnExport) {
          btnExport.addEventListener("click", (e) => {
            e.stopPropagation();
            vscode.postMessage({ type: "exportBundle", conversationId: convo.id });
          });
        }

        // Export Markdown
        const btnMd = itemEl.querySelector(".action-icon-btn.md");
        if (btnMd) {
          btnMd.addEventListener("click", (e) => {
            e.stopPropagation();
            vscode.postMessage({ type: "exportMarkdown", conversationId: convo.id });
          });
        }

        // Delete Conversation
        const btnDel = itemEl.querySelector(".action-icon-btn.del");
        if (btnDel) {
          btnDel.addEventListener("click", (e) => {
            e.stopPropagation();
            showModal({
              type: "danger",
              symbol: "!",
              title: "Delete Conversation?",
              targetName: convo.title,
              targetSub: `${convo.stepCount} steps • ${sizeKb} KB • ID: ${convo.id.slice(0, 16)}...`,
              description:
                "Are you sure you want to delete this conversation? This will permanently remove its database files and conversation steps. This action cannot be undone.",
              confirmText: "Delete",
              confirmClass: "destructive",
              onConfirm: () => {
                vscode.postMessage({
                  type: "executeDelete",
                  conversationId: convo.id,
                  title: convo.title
                });
              }
            });
          });
        }

        listEl.appendChild(itemEl);
      });

      groupEl.appendChild(headerEl);
      groupEl.appendChild(listEl);
      treeContainer.appendChild(groupEl);
    });

    if (!anyMatches) {
      treeContainer.innerHTML = `<div class="empty-state">${escapeHtml(
        state.projects.length === 0 ? t("noProjectsYet") : t("noConversationsFound")
      )}</div>`;
    }
  }

  function formatTime(isoStr) {
    try {
      const date = new Date(isoStr);
      const now = new Date();
      const diffMs = now - date;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

      if (diffHours < 1) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return `${Math.max(1, diffMins)}m ago`;
      } else if (diffHours < 24) {
        return `${diffHours}h ago`;
      } else {
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
      }
    } catch {
      return "";
    }
  }

  // Signal extension host that webview is ready and mounted
  vscode.postMessage({ type: "ready" });
})();
