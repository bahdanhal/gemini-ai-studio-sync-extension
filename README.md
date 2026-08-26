# ⚡ AI Studio Local File Sync & Codebase Context

[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest_V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-success.svg)]()
[![Platform](https://img.shields.io/badge/Platform-Google_AI_Studio-orange.svg)](https://aistudio.google.com/)

A developer-focused Chrome extension that connects **Google AI Studio** directly to your local workspace using the Web [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API).

Write files, apply AI-generated diffs, preview visual line-by-line changes, roll back edits with undo history, and pack your entire repository context using a **WinDirStat-style token analyzer**—all with zero external servers and complete local privacy.

---

## ✨ Features

### 💾 1. Two-Way Workspace Synchronization
* **Direct File Writing:** Save single code blocks (`💾 Sync`) or sync all files in a chat turn (`⚡ Sync to Disk`) directly to your local file system.
* **Reliable Diff Workflow:** Uses canonical multi-file git diffs as the primary sync format. File paths come from `diff --git` / `---` / `+++` headers instead of fragile nearby Markdown headings. Safe symmetric LLM hunk-count mistakes are repaired only after exact source matching; fenced, unfenced, SEARCH/REPLACE, and clearly introduced complete-file responses remain supported.
* **Persistent Connection:** Uses browser IndexedDB to remember your connected project directory across refreshes.

### 🔍 2. Visual Diff Viewer & In-Modal Code Editor
* **Prefix/Suffix Trimmed LCS Diffing:** High-performance line-by-line visual diffs with added (`+`) and deleted (`-`) line highlighting.
* **Live In-Modal Code Editor:** Edit target content on the fly before saving to disk.
* **Status Badges:** Live badges indicating `[NEW]`, `[MOD]`, `[DIFF]`, `[SAME]`, or `[WARN]` status.

### 📊 3. Codebase Context Packer (WinDirStat-Style Token Tree)
* **Token-Sorted Folder Tree:** Aggregates and sorts all folders and files from **maximum to minimum token weight**, showing you exactly which directories consume your context window.
* **Recursive `.gitignore` Support:** Automatically parses root and nested `.gitignore` files, ignoring system directories (`.git`, `node_modules`, `.venv`, binaries, lockfiles, secrets) at any depth.
* **AI Studio Attachment Packaging:** Sends the packed context through a browser-native paste event with `DataTransfer`. For sufficiently large content, AI Studio may process that event on its side and represent it as a compact **attachment card** rather than expanding all text inline.
* **Custom Exclusion Globs:** Instantly filter out test suites or documentation (`*.test.ts, docs/*`) before packing.

### 🛡️ 4. Safety & Developer Quality-of-Life
* **Dual-Mode Parsing Engine:** Parses files across normal AI Studio components and high-volume raw `.very-large-text-container` rendering modes.
* **Smart Up-to-Date Detection:** Files matching disk content (`SAME`) are skipped to avoid unnecessary writes.
* **Fail-Closed Patch Validation:** Unified-diff hunk counts and source context must match before a patch can be applied; significant whitespace—including blank context lines—is preserved exactly, and malformed output remains safely unselected instead of being partially written.
* **One-Click Undo:** Revert written files back to their exact previous state with the floating toolbar's **↩️ Undo** button.
* **Keyboard Navigation:** Press <kbd>Esc</kbd> or click the backdrop to instantly cancel/close review dialogs.

---

## 🚀 Installation

### Option 1: Load Unpacked (Developer Mode)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/bahdanhal/gemini-ai-studio-sync-extension.git
   ```
2. Open Google Chrome (or any Chromium browser like Brave, Edge, or Arc).
3. Navigate to **`chrome://extensions`**.
4. Enable **Developer mode** using the toggle switch in the top-right corner.
5. Click **Load unpacked** in the top-left corner and select the cloned directory.
6. Open [Google AI Studio](https://aistudio.google.com/) and refresh the page.

---

## 📖 Usage Guide

### 1. Connect Your Workspace
1. In the bottom-right corner of Google AI Studio, click **Connect Project Root**.
2. Select your local project directory and grant read/write permissions.

### 2. Pack Codebase Context into AI Studio
1. Click **📎 Context ▾** on the floating toolbar.
2. Select **📊 Pack Codebase Context**.
3. Inspect your repository hierarchy sorted by token size:
   - Check/uncheck individual files or entire folders.
   - Enter exclusion globs (e.g. `*.spec.ts, assets/*`) and click **Apply Globs**.
4. Click **📥 Insert Context into Prompt**. The extension inserts the packed context through a paste event; AI Studio may convert sufficiently large content into an attachment card.

### 3. Sync AI Responses Back to Disk
* **Preferred response format:** Click **📎 Context ▾ → 📋 Insert Diff Format Instructions** before asking the model to edit code. The model is instructed to return one canonical git diff in a six-backtick outer fence (so Markdown files can safely contain ordinary code fences), including `/dev/null` headers for new files.
* **Single File:** Click the **`💾 Sync`** button on any code block header.
* **Turn Sync:** Click the **`⚡ Sync to Disk`** button in the chat turn action bar to review and batch-sync all generated files.
* **Review Modal:** Inspect visual diffs, toggle which files to apply, make code tweaks in the editor tab, and click **💾 Sync Selected File(s)**.
* **Undo:** Click **`↩️ Undo`** on the toolbar if you need to rollback the last sync.

---

## 🔒 Security & Privacy

* **100% Client-Side:** Everything runs locally within your browser tab via standard Chrome Content Scripts and the Web File System Access API.
* **No Telemetry / No Servers:** Zero external network calls, trackers, or third-party APIs.
* **Path Traversal Guards:** All relative file operations are validated against directory traversal attacks (`..`).

This extension is not affiliated with, endorsed by, or sponsored by Google. Google AI Studio is a trademark of Google LLC.

---

## 📂 Project Structure

```text
├── manifest.json   # Chrome Extension Manifest (Manifest V3)
├── content.js      # Core engine: File System API, Diff Parser, Token Tree & UI
├── styles.css      # Dark-themed modern UI styles, diff viewers, and tree meters
├── LICENSE         # MIT Open Source License
├── PRIVACY.md      # Privacy policy for Chrome Web Store
├── .gitignore      # Git exclusion rules
└── README.md       # Project documentation
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check the [issues page](https://github.com/bahdanhal/gemini-ai-studio-sync-extension/issues) for support, bug reports, and feature requests.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.

## Support & Privacy

For support, visit the [GitHub Issues](https://github.com/bahdanhal/gemini-ai-studio-sync-extension/issues). The maintainer's website is [bahdanhal.pl](https://bahdanhal.pl). See the [Privacy Policy](PRIVACY.md) for details about local file and AI Studio content handling.
