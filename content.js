let rootDirHandle = null;
let undoHistory = [];

const AI_STUDIO_SELECTORS = Object.freeze({
    promptInput: 'textarea[placeholder*="prompt" i], textarea[placeholder*="Ask" i], ms-autosize-textarea textarea, textarea.mat-mdc-input-element, textarea',
    editablePrompt: 'div[contenteditable="true"]'
});

const DB_NAME = 'ai_studio_sync_db';
const STORE_NAME = 'handles';

// ==========================================
// 1. IndexedDB Directory Handle Persistence
// ==========================================

function openHandleDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            req.result.createObjectStore(STORE_NAME);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveStoredHandle(handle) {
    try {
        const db = await openHandleDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(handle, 'rootDir');
        return new Promise((resolve) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    } catch {
        return false;
    }
}

async function getStoredHandle() {
    try {
        const db = await openHandleDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get('rootDir');
        return new Promise((resolve) => {
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}

// ==========================================
// 2. Toast Notification System
// ==========================================

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info', duration = 3500) {
    let container = document.getElementById('ai-sync-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'ai-sync-toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `ai-sync-toast ai-sync-toast-${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('ai-sync-toast-fade');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

const STRICT_SYNC_FORMAT_PROMPT = `Please output code changes using one of these formats only:

1. Complete files: <file path="relative/path/to/file.ext"> followed by the full, ready-to-save file content and </file>.
2. Targeted patches: SEARCH/REPLACE blocks with enough context to be unique:
${'<<<<<<<'} SEARCH
exact existing lines
${'======='}
replacement lines
${'>>>>>>> REPLACE'}

Do not provide partial excerpts, snippets, placeholders, or truncated code outside SEARCH/REPLACE blocks.`;

async function insertStrictSyncFormatPrompt() {
    await insertIntoPrompt(STRICT_SYNC_FORMAT_PROMPT);
    showToast('Appended sync format rules to prompt!', 'success');
}

// ==========================================
// 3. File System Operations & Traversal
// ==========================================

function getPathParts(relativePath) {
    const cleanPath = relativePath.replace(/^[\\\/]+/, '').replace(/[\\\/]+$/, '');
    const parts = cleanPath.split(/[\\\/]/).filter(p => p.length > 0 && p !== '.');
    if (parts.includes('..')) {
        throw new Error("Path contains '..' traversal which is blocked for safety.");
    }
    return parts;
}

async function readRelativeFile(dirHandle, relativePath) {
    try {
        const parts = getPathParts(relativePath);
        const fileName = parts.pop();
        let currentDir = dirHandle;

        for (const part of parts) {
            currentDir = await currentDir.getDirectoryHandle(part, { create: false });
        }

        const fileHandle = await currentDir.getFileHandle(fileName, { create: false });
        const file = await fileHandle.getFile();
        return await file.text();
    } catch (err) {
        if (err.name === 'NotFoundError') {
            return null;
        }
        throw err;
    }
}

async function writeRelativeFile(dirHandle, relativePath, content) {
    const parts = getPathParts(relativePath);
    const fileName = parts.pop();
    let currentDir = dirHandle;

    for (const part of parts) {
        currentDir = await currentDir.getDirectoryHandle(part, { create: true });
    }

    const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
}

async function deleteRelativeFile(dirHandle, relativePath) {
    const parts = getPathParts(relativePath);
    const fileName = parts.pop();
    let currentDir = dirHandle;

    for (const part of parts) {
        currentDir = await currentDir.getDirectoryHandle(part, { create: false });
    }

    try {
        await currentDir.removeEntry(fileName);
    } catch (err) {
        if (err.name !== 'NotFoundError') throw err;
    }
}

// ==========================================
// 4. Undo History Engine
// ==========================================

function updateUndoButtonState() {
    const undoBtn = document.getElementById('btn-undo-sync');
    if (undoBtn) {
        undoBtn.disabled = undoHistory.length === 0;
        undoBtn.title = undoHistory.length > 0 ? `Undo last sync (${undoHistory.length} action(s) available)` : 'No actions to undo';
    }
}

async function recordUndoSnapshot(dirHandle, fileEntries) {
    const items = [];
    for (const entry of fileEntries) {
        const prevContent = await readRelativeFile(dirHandle, entry.filePath);
        items.push({
            filePath: entry.filePath,
            prevContent,
            existed: prevContent !== null
        });
    }
    undoHistory.push({ timestamp: Date.now(), items });
    updateUndoButtonState();
}

async function performUndo(dirHandle) {
    if (undoHistory.length === 0) {
        showToast('Nothing to undo.', 'warning');
        return;
    }
    const lastAction = undoHistory.pop();
    updateUndoButtonState();

    let revertedCount = 0;
    try {
        for (const item of lastAction.items) {
            if (item.existed && item.prevContent !== null) {
                await writeRelativeFile(dirHandle, item.filePath, item.prevContent);
                revertedCount++;
            } else {
                await deleteRelativeFile(dirHandle, item.filePath);
                revertedCount++;
            }
        }
        showToast(`↩️ Reverted ${revertedCount} file(s) to previous state.`, 'success');
    } catch (err) {
        showToast(`Failed to undo: ${err.message}`, 'error');
    }
}

// ==========================================
// 5. Diff Engine & Prefix/Suffix Trimmed LCS Diff
// ==========================================

function isSearchReplaceDiff(text) {
    return /^<{7}\s*SEARCH\r?\n[\s\S]*?\r?\n={7}\r?\n[\s\S]*?\r?\n>{7}\s*REPLACE/m.test(text);
}

function isUnifiedDiff(text) {
    return (
        /^@@\s+-\d+(?:,\d+)?\s+\+\d+(?:,\d+)?\s+@@/m.test(text) ||
        (/^--- (?:a\/|\/dev\/null|[^\r\n]+)/m.test(text) && /^\+\+\+ (?:b\/|[^\r\n]+)/m.test(text))
    );
}

function isDiffContent(text) {
    return isSearchReplaceDiff(text) || isUnifiedDiff(text);
}

function applySearchReplace(original, patch) {
    const blockRegex = /^<{7}\s*SEARCH\r?\n([\s\S]*?)\r?\n={7}\r?\n([\s\S]*?)\r?\n>{7}\s*REPLACE/gim;
    let match;
    let updated = original;
    let replacedCount = 0;

    while ((match = blockRegex.exec(patch)) !== null) {
        const searchBlock = match[1];
        const replaceBlock = match[2];

        if (updated.includes(searchBlock)) {
            updated = updated.replace(searchBlock, replaceBlock);
            replacedCount++;
            continue;
        }

        const origLines = updated.split(/\r?\n/);
        const searchLines = searchBlock.split(/\r?\n/).map(l => l.trimEnd());
        let foundIdx = -1;

        for (let i = 0; i <= origLines.length - searchLines.length; i++) {
            let matches = true;
            for (let j = 0; j < searchLines.length; j++) {
                if (origLines[i + j].trimEnd() !== searchLines[j]) {
                    matches = false;
                    break;
                }
            }
            if (matches) {
                foundIdx = i;
                break;
            }
        }

        if (foundIdx !== -1) {
            const replaceLines = replaceBlock.split(/\r?\n/);
            origLines.splice(foundIdx, searchLines.length, ...replaceLines);
            updated = origLines.join('\n');
            replacedCount++;
        } else {
            throw new Error(`Search block could not be matched in original file:\n"${searchBlock.slice(0, 80)}..."`);
        }
    }

    if (replacedCount === 0) {
        throw new Error('No valid SEARCH/REPLACE blocks found.');
    }
    return updated;
}

function applyUnifiedPatch(original, patch) {
    const lines = patch.split(/\r?\n/);
    const origLines = original.split(/\r?\n/);
    const hunks = [];
    let currentHunk = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const hunkMatch = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);

        if (hunkMatch) {
            if (currentHunk) hunks.push(currentHunk);
            currentHunk = { oldStart: parseInt(hunkMatch[1], 10), lines: [] };
        } else if (currentHunk) {
            if (/^(?:---|\+\+\+|diff --git)/.test(line)) continue;
            currentHunk.lines.push(line);
        } else if (/^[+\- ]/.test(line)) {
            if (!currentHunk) currentHunk = { oldStart: 1, lines: [] };
            currentHunk.lines.push(line);
        }
    }
    if (currentHunk) hunks.push(currentHunk);

    if (hunks.length === 0) {
        throw new Error('No valid patch hunks found in unified diff.');
    }

    let resultLines = [...origLines];

    for (let h = hunks.length - 1; h >= 0; h--) {
        const hunk = hunks[h];
        const oldLines = [];
        const newLines = [];

        for (const line of hunk.lines) {
            const marker = line[0];
            const content = line.slice(1);
            if (marker === '-') oldLines.push(content);
            else if (marker === '+') newLines.push(content);
            else if (marker === ' ') { oldLines.push(content); newLines.push(content); }
        }

        let startIdx = Math.max(0, hunk.oldStart ? hunk.oldStart - 1 : 0);
        let foundIdx = -1;
        const searchRadius = Math.max(resultLines.length, 50);

        for (let offset = 0; offset < searchRadius; offset++) {
            const tryIndices = [startIdx + offset, startIdx - offset].filter(
                idx => idx >= 0 && idx + oldLines.length <= resultLines.length
            );

            for (const idx of tryIndices) {
                let matches = true;
                for (let j = 0; j < oldLines.length; j++) {
                    if (resultLines[idx + j].trimEnd() !== oldLines[j].trimEnd()) {
                        matches = false;
                        break;
                    }
                }
                if (matches) {
                    foundIdx = idx;
                    break;
                }
            }
            if (foundIdx !== -1) break;
        }

        if (foundIdx !== -1) {
            resultLines.splice(foundIdx, oldLines.length, ...newLines);
        } else {
            throw new Error(`Unified diff hunk near line ${hunk.oldStart} could not be aligned.`);
        }
    }

    return resultLines.join('\n');
}

function processDiffOrDirectContent(originalContent, newContent) {
    if (!isDiffContent(newContent)) {
        return { isDiff: false, content: newContent };
    }
    if (originalContent === null) {
        throw new Error('Diff received, but target file does not exist locally.');
    }
    if (isSearchReplaceDiff(newContent)) {
        return { isDiff: true, content: applySearchReplace(originalContent, newContent) };
    }
    return { isDiff: true, content: applyUnifiedPatch(originalContent, newContent) };
}

function computeLineDiff(oldText, newText) {
    const oldNorm = (oldText || '').replace(/\r\n/g, '\n');
    const newNorm = (newText || '').replace(/\r\n/g, '\n');

    const oldLines = oldNorm.split('\n');
    const newLines = newNorm.split('\n');

    if (oldText !== null && oldNorm === newNorm) {
        return oldLines.map((line, i) => ({
            type: 'unchanged',
            text: line,
            oldLine: i + 1,
            newLine: i + 1
        }));
    }

    let start = 0;
    const minLen = Math.min(oldLines.length, newLines.length);
    while (start < minLen && oldLines[start] === newLines[start]) {
        start++;
    }

    let oldEnd = oldLines.length - 1;
    let newEnd = newLines.length - 1;
    while (oldEnd >= start && newEnd >= start && oldLines[oldEnd] === newLines[newEnd]) {
        oldEnd--;
        newEnd--;
    }

    const prefix = [];
    for (let i = 0; i < start; i++) {
        prefix.push({ type: 'unchanged', text: oldLines[i], oldLine: i + 1, newLine: i + 1 });
    }

    const suffix = [];
    const suffixCount = oldLines.length - 1 - oldEnd;
    for (let i = 0; i < suffixCount; i++) {
        const oIdx = oldEnd + 1 + i;
        const nIdx = newEnd + 1 + i;
        suffix.push({ type: 'unchanged', text: oldLines[oIdx], oldLine: oIdx + 1, newLine: nIdx + 1 });
    }

    const midOld = oldLines.slice(start, oldEnd + 1);
    const midNew = newLines.slice(start, newEnd + 1);

    const n = midOld.length;
    const m = midNew.length;
    const middle = [];

    if (n > 0 && m === 0) {
        for (let i = 0; i < n; i++) {
            middle.push({ type: 'removed', text: midOld[i], oldLine: start + 1 + i });
        }
    } else if (n === 0 && m > 0) {
        for (let j = 0; j < m; j++) {
            middle.push({ type: 'added', text: midNew[j], newLine: start + 1 + j });
        }
    } else if (n > 0 && m > 0) {
        const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < m; j++) {
                if (midOld[i] === midNew[j]) {
                    dp[i + 1][j + 1] = dp[i][j] + 1;
                } else {
                    dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
                }
            }
        }

        let i = n, j = m;
        const subDiff = [];
        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && midOld[i - 1] === midNew[j - 1]) {
                subDiff.unshift({
                    type: 'unchanged',
                    text: midOld[i - 1],
                    oldLine: start + i,
                    newLine: start + j
                });
                i--; j--;
            } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
                subDiff.unshift({
                    type: 'added',
                    text: midNew[j - 1],
                    newLine: start + j
                });
                j--;
            } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
                subDiff.unshift({
                    type: 'removed',
                    text: midOld[i - 1],
                    oldLine: start + i
                });
                i--;
            }
        }
        middle.push(...subDiff);
    }

    return [...prefix, ...middle, ...suffix];
}

// ==========================================
// 6. Safe Validation & Format-Aware Placeholders
// ==========================================

function checkPlaceholders(filePath, content) {
    const extMatch = filePath.match(/\.([a-zA-Z0-9_-]+)$/);
    const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '';

    if (['.md', '.markdown', '.txt', '.rst', '.json', '.csv', '.tsv'].includes(ext)) {
        return [];
    }

    const warnings = [];
    const lines = content.split(/\r?\n/);

    const standaloneEllipsis = /^\s*(?:\/\/|#|\/\*|<!--)\s*(?:\.\.\.|…)\s*(?:\*\/|-->)?\s*$/;
    const dedicatedTruncationComment = /^\s*(?:\/\/|#|\/\*|<!--)\s*(?:\.\.\.\s*(?:existing|rest of|remaining|other|unchanged)|(?:existing|remaining|unchanged|previous)\s+code\s+(?:remains|stays|goes here)|code\s+remains\s+unchanged|TODO:\s*implement)/i;

    lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (standaloneEllipsis.test(trimmed) || dedicatedTruncationComment.test(trimmed)) {
            warnings.push(`Line ${idx + 1}: Placeholder detected ("${trimmed.slice(0, 60)}")`);
        }
    });
    return warnings;
}

function validateContent(filePath, content) {
    const warnings = checkPlaceholders(filePath, content);
    const issues = [];
    const extMatch = filePath.match(/\.([a-zA-Z0-9_-]+)$/);
    const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '';

    if (ext === '.json') {
        try {
            JSON.parse(content);
        } catch (e) {
            issues.push(`JSON Syntax Error: ${e.message}`);
        }
    } else if (['.html', '.htm', '.xml', '.svg'].includes(ext)) {
        try {
            const parser = new DOMParser();
            const mime = (ext === '.xml' || ext === '.svg') ? 'application/xml' : 'text/html';
            const doc = parser.parseFromString(content, mime);
            const parseErr = doc.querySelector('parsererror');
            if (parseErr) {
                issues.push(`Markup Syntax: ${parseErr.textContent.slice(0, 80)}`);
            }
        } catch (e) {
            issues.push(`Markup Error: ${e.message}`);
        }
    }

    return {
        valid: issues.length === 0 && warnings.length === 0,
        hasIssues: issues.length > 0,
        issues,
        warnings
    };
}

// ==========================================
// 7. Multi-File Batch Review & Diff Modal
// ==========================================

function renderDiffTable(diffLines) {
    let rowsHtml = '';
    diffLines.forEach(item => {
        const cls = item.type === 'added' ? 'ai-diff-row-added' : item.type === 'removed' ? 'ai-diff-row-removed' : 'ai-diff-row-unchanged';
        const sign = item.type === 'added' ? '+' : item.type === 'removed' ? '-' : ' ';
        const lineNum = item.newLine || item.oldLine || '';
        rowsHtml += `
            <tr class="ai-diff-row ${cls}">
                <td class="ai-diff-num">${lineNum}</td>
                <td class="ai-diff-sign">${sign}</td>
                <td>${escapeHtml(item.text)}</td>
            </tr>
        `;
    });
    return `<table class="ai-diff-table">${rowsHtml}</table>`;
}

function showBatchReviewModal(processedFiles) {
    return new Promise((resolve) => {
        const existing = document.querySelector('.ai-sync-modal-backdrop');
        if (existing) existing.remove();

        const backdrop = document.createElement('div');
        backdrop.className = 'ai-sync-modal-backdrop';

        let activeIndex = 0;
        let currentView = 'diff';

        const fileStates = processedFiles.map(f => ({
            ...f,
            selected: !f.hasDiffError && !f.isExcerpt && !f.isIdentical,
            editedContent: f.targetContent
        }));

        function cleanupAndClose(result = []) {
            document.removeEventListener('keydown', handleKeyDown);
            backdrop.remove();
            resolve(result);
        }

        function handleKeyDown(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                cleanupAndClose([]);
            }
        }

        document.addEventListener('keydown', handleKeyDown);

        function render() {
            const currentFile = fileStates[activeIndex];
            const diffLines = computeLineDiff(currentFile.originalContent || '', currentFile.editedContent);

            const sidebarItemsHtml = fileStates.map((file, idx) => `
                <div class="ai-sync-file-list-item ${idx === activeIndex ? 'active' : ''}" data-idx="${idx}">
                    <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
                        <input type="checkbox" class="file-chk" data-idx="${idx}" ${file.selected ? 'checked' : ''} />
                        <span style="white-space: nowrap; text-overflow: ellipsis; overflow: hidden;" title="${escapeHtml(file.filePath)}">${escapeHtml(file.filePath)}</span>
                    </div>
                    <span class="ai-file-status-badge ${getStatusBadgeClass(file)}">${getStatusBadgeText(file)}</span>
                </div>
            `).join('');

            backdrop.innerHTML = `
                <div class="ai-sync-modal-dialog">
                    <div class="ai-sync-modal-header">
                        <div class="ai-sync-modal-title">
                            <span>📦 Workspace Sync Review</span>
                            <span style="font-size: 12px; color: #94a3b8;">(${fileStates.filter(f => f.selected).length}/${fileStates.length} selected - <kbd style="background:#334155;padding:2px 5px;border-radius:4px;">Esc</kbd> to cancel)</span>
                        </div>
                        <button id="btn-modal-close" class="ai-sync-btn ai-sync-btn-secondary" style="padding: 4px 8px;">✕</button>
                    </div>
                    <div class="ai-sync-modal-layout">
                        <div class="ai-sync-modal-sidebar">
                            <div class="ai-sync-sidebar-header">Files to Sync</div>
                            ${sidebarItemsHtml}
                        </div>

                        <div class="ai-sync-modal-main">
                            <div class="ai-sync-main-toolbar">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <strong style="color: #38bdf8; font-size: 13px;">${escapeHtml(currentFile.filePath)}</strong>
                                    ${currentFile.isDiff ? '<span class="ai-file-status-badge badge-diff">Diff Merged</span>' : ''}
                                    ${currentFile.isExcerpt ? '<span class="ai-file-status-badge badge-warn">EXCERPT</span>' : ''}
                                    ${currentFile.isIdentical ? '<span class="ai-file-status-badge badge-same">No Changes</span>' : ''}
                                </div>
                                <div class="ai-sync-view-tabs">
                                    <button class="ai-sync-tab-btn ${currentView === 'diff' ? 'active' : ''}" id="tab-diff">🔍 Visual Diff</button>
                                    <button class="ai-sync-tab-btn ${currentView === 'editor' ? 'active' : ''}" id="tab-editor">✏️ Edit Code</button>
                                </div>
                            </div>
                            <div class="ai-sync-main-body">
                                ${currentFile.isExcerpt ? `
                                    <div class="ai-sync-alert-box ai-sync-alert-warning">
                                        <strong>EXCERPT DETECTED:</strong> This block appears to be partial code and is excluded from syncing by default. Request the complete file or a SEARCH/REPLACE patch before saving.
                                    </div>
                                ` : ''}
                                ${currentFile.hasDiffError ? `
                                    <div class="ai-sync-alert-box ai-sync-alert-danger">
                                        <strong>Diff Error:</strong> ${escapeHtml(currentFile.diffErrorMsg)}<br>
                                        You can edit code in "Edit Code" tab or force-overwrite with raw response.
                                    </div>
                                ` : ''}
                                ${currentFile.validation.issues.length > 0 ? `
                                    <div class="ai-sync-alert-box ai-sync-alert-danger">
                                        <strong>Syntax Issues:</strong><br>${currentFile.validation.issues.map(i => `• ${escapeHtml(i)}`).join('<br>')}
                                    </div>
                                ` : ''}
                                ${currentFile.validation.warnings.length > 0 ? `
                                    <div class="ai-sync-alert-box ai-sync-alert-warning">
                                        <strong>Placeholders Detected:</strong><br>${currentFile.validation.warnings.map(w => `• ${escapeHtml(w)}`).join('<br>')}
                                    </div>
                                ` : ''}

                                ${currentView === 'diff' ? `
                                    <div class="ai-diff-container">${renderDiffTable(diffLines)}</div>
                                ` : `
                                    <textarea class="ai-sync-editor-textarea" id="main-editor" spellcheck="false">${escapeHtml(currentFile.editedContent)}</textarea>
                                `}
                            </div>
                        </div>
                    </div>
                    <div class="ai-sync-modal-footer">
                        <button class="ai-sync-btn ai-sync-btn-secondary" id="btn-skip-all">Skip All (Esc)</button>
                        <div class="ai-sync-btn-group">
                            ${currentFile.isExcerpt ? `
                                <button class="ai-sync-btn ai-sync-btn-warning" id="btn-request-full">🛡️ Request Full File/Diff</button>
                            ` : ''}
                            ${currentFile.hasDiffError ? `
                                <button class="ai-sync-btn ai-sync-btn-warning" id="btn-force-raw">📄 Overwrite with Raw Block</button>
                            ` : ''}
                            <button class="ai-sync-btn ai-sync-btn-primary" id="btn-sync-selected">
                                💾 Sync ${fileStates.filter(f => f.selected).length} Selected File(s)
                            </button>
                        </div>
                    </div>
                </div>
            `;

            attachEvents();
        }

        function getStatusBadgeClass(file) {
            if (file.isExcerpt) return 'badge-warn';
            if (file.hasDiffError) return 'badge-err';
            if (file.validation.issues.length > 0) return 'badge-err';
            if (file.validation.warnings.length > 0) return 'badge-warn';
            if (file.isIdentical) return 'badge-same';
            if (file.isDiff) return 'badge-diff';
            return file.originalContent === null ? 'badge-new' : 'badge-mod';
        }

        function getStatusBadgeText(file) {
            if (file.isExcerpt) return 'EXCERPT';
            if (file.hasDiffError) return 'DIFF ERR';
            if (file.validation.issues.length > 0) return 'SYNTAX';
            if (file.validation.warnings.length > 0) return 'WARN';
            if (file.isIdentical) return 'SAME';
            if (file.isDiff) return 'DIFF';
            return file.originalContent === null ? 'NEW' : 'MOD';
        }

        function attachEvents() {
            backdrop.onclick = (e) => {
                if (e.target === backdrop) cleanupAndClose([]);
            };

            backdrop.querySelector('#btn-modal-close').onclick = () => cleanupAndClose([]);
            backdrop.querySelector('#btn-skip-all').onclick = () => cleanupAndClose([]);

            backdrop.querySelectorAll('.ai-sync-file-list-item').forEach(item => {
                item.onclick = (e) => {
                    if (e.target.tagName === 'INPUT') return;
                    activeIndex = parseInt(item.dataset.idx, 10);
                    render();
                };
            });

            backdrop.querySelectorAll('.file-chk').forEach(chk => {
                chk.onchange = (e) => {
                    e.stopPropagation();
                    const idx = parseInt(chk.dataset.idx, 10);
                    fileStates[idx].selected = chk.checked;
                    render();
                };
            });

            const tabDiff = backdrop.querySelector('#tab-diff');
            const tabEditor = backdrop.querySelector('#tab-editor');
            if (tabDiff && tabEditor) {
                tabDiff.onclick = () => { currentView = 'diff'; render(); };
                tabEditor.onclick = () => { currentView = 'editor'; render(); };
            }

            const editor = backdrop.querySelector('#main-editor');
            if (editor) {
                editor.addEventListener('keydown', (e) => {
                    if (e.key === 'Tab') {
                        e.preventDefault();
                        const start = editor.selectionStart;
                        const end = editor.selectionEnd;
                        editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
                        editor.selectionStart = editor.selectionEnd = start + 4;
                    }
                });
                editor.addEventListener('input', () => {
                    fileStates[activeIndex].editedContent = editor.value;
                    fileStates[activeIndex].validation = validateContent(fileStates[activeIndex].filePath, editor.value);
                    fileStates[activeIndex].isIdentical = (fileStates[activeIndex].originalContent || '').replace(/\r\n/g, '\n') === editor.value.replace(/\r\n/g, '\n');
                });
            }

            const forceRawBtn = backdrop.querySelector('#btn-force-raw');
            if (forceRawBtn) {
                forceRawBtn.onclick = () => {
                    fileStates[activeIndex].editedContent = fileStates[activeIndex].rawBlock;
                    fileStates[activeIndex].hasDiffError = false;
                    fileStates[activeIndex].isDiff = false;
                    fileStates[activeIndex].selected = true;
                    fileStates[activeIndex].validation = validateContent(fileStates[activeIndex].filePath, fileStates[activeIndex].rawBlock);
                    fileStates[activeIndex].isIdentical = (fileStates[activeIndex].originalContent || '').replace(/\r\n/g, '\n') === fileStates[activeIndex].rawBlock.replace(/\r\n/g, '\n');
                    render();
                };
            }

            const requestFullBtn = backdrop.querySelector('#btn-request-full');
            if (requestFullBtn) {
                requestFullBtn.onclick = async () => {
                    const file = fileStates[activeIndex];
                    await insertIntoPrompt(`The response for "${file.filePath}" was marked as an excerpt. Please provide either the complete file or a precise SEARCH/REPLACE patch.\n\n${STRICT_SYNC_FORMAT_PROMPT}`);
                    showToast(`Requested complete output for ${file.filePath}`, 'success');
                };
            }

            backdrop.querySelector('#btn-sync-selected').onclick = () => {
                const toWrite = fileStates
                    .filter(f => f.selected)
                    .map(f => ({ filePath: f.filePath, content: f.editedContent }));
                cleanupAndClose(toWrite);
            };
        }

        document.body.appendChild(backdrop);
        render();
    });
}

// ==========================================
// 8. Recursive Gitignore & Depth-Agnostic File Collector
// ==========================================

const ALWAYS_IGNORE_DIR_NAMES = new Set([
    '.git', '.svn', '.hg', '.DS_Store', 'Thumbs.db',
    'node_modules', '.venv', 'venv', 'env', '__pycache__',
    '.idea', '.vscode', '.turbo', '.output'
]);

const UNIVERSAL_DEFAULT_PATTERNS = [
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'Cargo.lock', 'composer.lock', 'poetry.lock', 'Gemfile.lock', 'symfony.lock',
    'dist/**', 'build/**', 'out/**', '.next/**', '.nuxt/**', 'coverage/**', '.nyc_output/**', '.cache/**', '*.pyc', '*.pyo', '*.swp',
    '*.png', '*.jpg', '*.jpeg', '*.gif', '*.ico', '*.webp', '*.svg', '*.mp4', '*.webm', '*.mp3', '*.wav',
    '*.pdf', '*.zip', '*.tar', '*.gz', '*.7z', '*.rar', '*.exe', '*.dll', '*.so', '*.dylib', '*.wasm', '*.bin',
    '*.ttf', '*.woff', '*.woff2', '*.eot',
    '.env', '.env.*', '*.pem', '*.key', 'id_rsa'
];

class ScopedGitignoreRule {
    constructor(pattern, basePath = '') {
        this.raw = pattern.trim();
        this.basePath = basePath.replace(/^[\\\/]+/, '').replace(/[\\\/]+$/, '');
        this.isNegated = this.raw.startsWith('!');
        let p = this.isNegated ? this.raw.slice(1).trim() : this.raw;

        this.isDirOnly = p.endsWith('/');
        if (this.isDirOnly) p = p.slice(0, -1);

        this.isRooted = p.startsWith('/');
        if (this.isRooted) p = p.slice(1);

        this.hasSlash = p.includes('/');

        let re = p
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '§§')
            .replace(/\*/g, '[^/]*')
            .replace(/§§/g, '.*')
            .replace(/\?/g, '[^/]');

        if (this.basePath) {
            const escBase = this.basePath.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            if (this.hasSlash || this.isRooted) {
                this.regex = new RegExp(`^${escBase}/${re}(?:$|/.*$)`, 'i');
            } else {
                this.regex = new RegExp(`^${escBase}/(?:.*/)?${re}(?:$|/.*$)`, 'i');
            }
        } else {
            if (this.hasSlash || this.isRooted) {
                this.regex = new RegExp(`^${re}(?:$|/.*$)`, 'i');
            } else {
                this.regex = new RegExp(`(?:^|/)${re}(?:$|/.*$)`, 'i');
            }
        }
    }

    matches(relPath, isDirectory) {
        if (this.isDirOnly && !isDirectory) return false;
        return this.regex.test(relPath);
    }
}

function parseGitignoreContent(content, basePath = '') {
    const rules = [];
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            rules.push(new ScopedGitignoreRule(trimmed, basePath));
        }
    }
    return rules;
}

function isPathIgnoredWithRules(relPath, isDirectory, rules) {
    let ignored = false;
    for (const rule of rules) {
        if (rule.matches(relPath, isDirectory)) {
            ignored = !rule.isNegated;
        }
    }
    return ignored;
}

async function collectAllRepositoryFiles(dirHandle, parentRules = null, currentPath = '') {
    const fileList = [];

    let activeRules = parentRules ? [...parentRules] : UNIVERSAL_DEFAULT_PATTERNS.map(p => new ScopedGitignoreRule(p, ''));

    try {
        const gitignoreHandle = await dirHandle.getFileHandle('.gitignore', { create: false });
        const gitignoreFile = await gitignoreHandle.getFile();
        const gitignoreText = await gitignoreFile.text();
        const localRules = parseGitignoreContent(gitignoreText, currentPath);
        activeRules.push(...localRules);
    } catch {
        // No .gitignore
    }

    for await (const entry of dirHandle.values()) {
        const entryName = entry.name;
        const entryRelPath = currentPath ? `${currentPath}/${entryName}` : entryName;
        const isDir = entry.kind === 'directory';

        if (isDir && ALWAYS_IGNORE_DIR_NAMES.has(entryName)) {
            continue;
        }
        if (!isDir && (entryName === '.DS_Store' || entryName === 'Thumbs.db')) {
            continue;
        }

        if (isPathIgnoredWithRules(entryRelPath, isDir, activeRules)) {
            continue;
        }

        if (isDir) {
            const subDirHandle = await dirHandle.getDirectoryHandle(entryName);
            const subFiles = await collectAllRepositoryFiles(subDirHandle, activeRules, entryRelPath);
            fileList.push(...subFiles);
        } else if (entry.kind === 'file') {
            try {
                const file = await entry.getFile();
                if (file.size > 800 * 1024) continue;

                const text = await file.text();
                if (text.includes('\0')) continue;

                const tokens = Math.round(text.length / 4);
                fileList.push({
                    filePath: entryRelPath,
                    size: file.size,
                    charCount: text.length,
                    tokens: tokens,
                    content: text,
                    selected: true
                });
            } catch {
                // Ignore locked/unreadable
            }
        }
    }

    return fileList;
}

function buildTokenHierarchyTree(files) {
    const root = {
        name: 'root',
        path: '',
        isDir: true,
        children: new Map(),
        fileRef: null,
        totalTokens: 0,
        totalBytes: 0,
        totalFiles: 0,
        selectedTokens: 0,
        selectedBytes: 0,
        selectedFiles: 0,
        selected: true,
        indeterminate: false
    };

    for (const file of files) {
        const parts = file.filePath.split('/');
        let cur = root;
        let curPath = '';

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            curPath = curPath ? `${curPath}/${part}` : part;
            const isFile = i === parts.length - 1;

            if (!cur.children.has(part)) {
                cur.children.set(part, {
                    name: part,
                    path: curPath,
                    isDir: !isFile,
                    children: new Map(),
                    fileRef: isFile ? file : null,
                    totalTokens: 0,
                    totalBytes: 0,
                    totalFiles: 0,
                    selectedTokens: 0,
                    selectedBytes: 0,
                    selectedFiles: 0,
                    selected: file.selected,
                    indeterminate: false
                });
            }
            cur = cur.children.get(part);
        }
    }

    function aggregateAndSort(node) {
        if (!node.isDir && node.fileRef) {
            node.totalTokens = node.fileRef.tokens;
            node.totalBytes = node.fileRef.size;
            node.totalFiles = 1;
            node.selectedTokens = node.fileRef.selected ? node.totalTokens : 0;
            node.selectedBytes = node.fileRef.selected ? node.totalBytes : 0;
            node.selectedFiles = node.fileRef.selected ? 1 : 0;
            node.selected = node.fileRef.selected;
            node.indeterminate = false;
            return;
        }

        let sumTokens = 0, sumBytes = 0, sumFiles = 0;
        let selTokens = 0, selBytes = 0, selFiles = 0;

        const childArr = Array.from(node.children.values());
        for (const child of childArr) {
            aggregateAndSort(child);
            sumTokens += child.totalTokens;
            sumBytes += child.totalBytes;
            sumFiles += child.totalFiles;
            selTokens += child.selectedTokens;
            selBytes += child.selectedBytes;
            selFiles += child.selectedFiles;
        }

        node.totalTokens = sumTokens;
        node.totalBytes = sumBytes;
        node.totalFiles = sumFiles;
        node.selectedTokens = selTokens;
        node.selectedBytes = selBytes;
        node.selectedFiles = selFiles;

        const allSelected = childArr.every(c => c.selected && !c.indeterminate);
        const noneSelected = childArr.every(c => !c.selected && !c.indeterminate);

        if (allSelected) {
            node.selected = true;
            node.indeterminate = false;
        } else if (noneSelected) {
            node.selected = false;
            node.indeterminate = false;
        } else {
            node.selected = false;
            node.indeterminate = true;
        }

        childArr.sort((a, b) => {
            if (b.totalTokens !== a.totalTokens) return b.totalTokens - a.totalTokens;
            if (b.totalBytes !== a.totalBytes) return b.totalBytes - a.totalBytes;
            return a.name.localeCompare(b.name);
        });

        node.sortedChildren = childArr;
    }

    aggregateAndSort(root);
    return root;
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatTokens(tokens) {
    if (tokens < 1000) return `${tokens} t`;
    if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}k t`;
    return `${(tokens / 1000000).toFixed(2)}M t`;
}

function formatCodebaseContext(files, rootName = 'workspace') {
    const activeFiles = files.filter(f => f.selected);

    const paths = activeFiles.map(f => f.filePath).sort();
    const treeStructure = buildTreeFromPaths(paths);

    let xml = `This file is a merged representation of the entire codebase, packed into a single document for AI context.\n\n`;
    xml += `<file_summary>\nThis section contains a summary of this file.\n\n`;
    xml += `<purpose>\nThis file contains a packed representation of the entire repository's contents.\nIt is designed to be easily consumable by AI systems for analysis, code review,\nor other automated processes.\n</purpose>\n\n`;
    xml += `<file_format>\nThe content is organized as follows:\n1. This summary section\n2. Repository information\n3. Directory structure\n4. Repository files\n5. Multiple file entries, each consisting of:\n  - File path as an attribute\n  - Full contents of the file\n</file_format>\n\n`;
    xml += `<notes>\n- Total files packed: ${activeFiles.length}\n- Project root: ${rootName}\n- Files matching .gitignore and default ignore patterns were excluded\n</notes>\n</file_summary>\n\n`;

    xml += `<sync_instructions>\nWhen modifying or creating code files, follow these strict formatting rules:\n1. FULL FILES: Use <file path="relative/path/to/file.ext"> with exact paths and full, complete, ready-to-save content.\n2. TARGETED DIFFS: Use SEARCH/REPLACE blocks with enough context lines to be unique.\nCRITICAL: NEVER output partial excerpts, incomplete snippets, or truncated code outside SEARCH/REPLACE format.\n</sync_instructions>\n\n`;

    xml += `<directory_structure>\n${treeStructure}</directory_structure>\n\n`;

    xml += `<files>\nThis section contains the contents of the repository's files.\n\n`;
    for (const file of activeFiles) {
        xml += `<file path="${file.filePath}">\n${file.content}\n</file>\n\n`;
    }
    xml += `</files>\n`;

    return xml;
}

function buildTreeFromPaths(paths) {
    const root = {};
    for (const path of paths) {
        const parts = path.split('/');
        let cur = root;
        for (const part of parts) {
            if (!cur[part]) cur[part] = {};
            cur = cur[part];
        }
    }

    function renderNode(node, prefix = '') {
        const keys = Object.keys(node).sort((a, b) => {
            const aIsDir = Object.keys(node[a]).length > 0;
            const bIsDir = Object.keys(node[b]).length > 0;
            if (aIsDir === bIsDir) return a.localeCompare(b);
            return aIsDir ? -1 : 1;
        });

        let str = '';
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const isLast = i === keys.length - 1;
            const isDir = Object.keys(node[key]).length > 0;
            const branch = isLast ? '└── ' : '├── ';
            const nextPrefix = prefix + (isLast ? '    ' : '│   ');
            str += `${prefix}${branch}${key}${isDir ? '/' : ''}\n`;
            if (isDir) {
                str += renderNode(node[key], nextPrefix);
            }
        }
        return str;
    }

    return renderNode(root);
}

function showContextPackerModal(files, rootName) {
    return new Promise((resolve) => {
        const existing = document.querySelector('.ai-sync-modal-backdrop');
        if (existing) existing.remove();

        const backdrop = document.createElement('div');
        backdrop.className = 'ai-sync-modal-backdrop';

        let fileListState = [...files];
        let filterText = '';
        const expandedDirs = new Set(['']);

        fileListState.forEach(f => {
            const parts = f.filePath.split('/');
            if (parts.length > 1) expandedDirs.add(parts[0]);
        });

        function cleanupAndClose(result = null) {
            document.removeEventListener('keydown', handleKeyDown);
            backdrop.remove();
            resolve(result);
        }

        function handleKeyDown(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                cleanupAndClose(null);
            }
        }

        document.addEventListener('keydown', handleKeyDown);

        function toggleFolderSelection(node, isSelected) {
            if (!node.isDir && node.fileRef) {
                node.fileRef.selected = isSelected;
            } else if (node.sortedChildren) {
                for (const child of node.sortedChildren) {
                    toggleFolderSelection(child, isSelected);
                }
            }
        }

        function renderTreeRowsHtml(node, level, maxRootTokens) {
            if (!node.sortedChildren) return '';
            let html = '';

            for (const child of node.sortedChildren) {
                if (filterText && !child.path.toLowerCase().includes(filterText.toLowerCase())) {
                    const hasMatchingDescendant = fileListState.some(
                        f => f.filePath.startsWith(child.path) && f.filePath.toLowerCase().includes(filterText.toLowerCase())
                    );
                    if (!hasMatchingDescendant) continue;
                }

                const isExpanded = expandedDirs.has(child.path);
                const indentPadding = level * 18;
                const tokenPercent = maxRootTokens > 0 ? (child.totalTokens / maxRootTokens) * 100 : 0;
                const isHighPercent = tokenPercent > 20;

                const icon = child.isDir ? (isExpanded ? '📂' : '📁') : '📄';
                const expanderHtml = child.isDir
                    ? `<span class="packer-expander" data-toggle-expand="${escapeHtml(child.path)}">${isExpanded ? '▼' : '▶'}</span>`
                    : `<span class="packer-expander-spacer"></span>`;

                html += `
                    <div class="packer-tree-row ${child.isDir ? 'packer-tree-row-dir' : 'packer-tree-row-file'}" style="padding-left: ${16 + indentPadding}px;">
                        <div class="packer-col-name">
                            ${expanderHtml}
                            <input type="checkbox" class="packer-tree-chk" data-path="${escapeHtml(child.path)}" data-isdir="${child.isDir}"
                                ${child.selected ? 'checked' : ''} ${child.indeterminate ? 'data-indeterminate="true"' : ''} />
                            <span style="font-size: 13px;">${icon}</span>
                            <span class="packer-row-name-text" title="${escapeHtml(child.path)}">${escapeHtml(child.name)}${child.isDir ? '/' : ''}</span>
                        </div>
                        <div class="packer-col-tokens">
                            <div class="packer-token-meter-cell">
                                <div class="packer-mini-bar" title="${tokenPercent.toFixed(1)}% of codebase">
                                    <div class="packer-mini-bar-fill ${isHighPercent ? 'packer-mini-bar-fill-high' : ''}" style="width: ${Math.max(3, tokenPercent)}%;"></div>
                                </div>
                                <span class="packer-token-count">~${formatTokens(child.totalTokens)}</span>
                            </div>
                        </div>
                        <div class="packer-col-size">
                            <span class="packer-size-count">${formatBytes(child.totalBytes)}</span>
                        </div>
                    </div>
                `;

                if (child.isDir && isExpanded) {
                    html += renderTreeRowsHtml(child, level + 1, maxRootTokens);
                }
            }

            return html;
        }

        function render() {
            const treeRoot = buildTokenHierarchyTree(fileListState);
            const totalCodebaseTokens = treeRoot.totalTokens;
            const selectedFiles = fileListState.filter(f => f.selected);
            const totalChars = selectedFiles.reduce((acc, f) => acc + f.charCount, 0);
            const totalBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);
            const selectedTokens = Math.round(totalChars / 4);
            const percentageOfTotal = totalCodebaseTokens > 0 ? ((selectedTokens / totalCodebaseTokens) * 100).toFixed(1) : 100;

            const treeRowsHtml = renderTreeRowsHtml(treeRoot, 0, totalCodebaseTokens);

            backdrop.innerHTML = `
                <div class="ai-sync-modal-dialog context-packer-dialog">
                    <div class="ai-sync-modal-header">
                        <div class="ai-sync-modal-title">
                            <span>📊 Codebase Context Packer</span>
                            <div class="context-packer-stats-bar">
                                <span class="context-packer-stat-badge">📄 ${selectedFiles.length}/${fileListState.length} files</span>
                                <span class="context-packer-stat-badge">💾 ${formatBytes(totalBytes)}</span>
                                <span class="context-packer-stat-badge" style="color: #4ade80;">⚡ ~${selectedTokens.toLocaleString()} tokens (${percentageOfTotal}%)</span>
                            </div>
                        </div>
                        <button id="btn-packer-close" class="ai-sync-btn ai-sync-btn-secondary" style="padding: 4px 8px;">✕</button>
                    </div>

                    <div class="context-packer-filter-container">
                        <input type="text" class="context-packer-input" id="packer-search" placeholder="🔍 Search files..." value="${escapeHtml(filterText)}" />
                        <input type="text" class="context-packer-input" id="packer-custom-ignore" placeholder="Exclude globs (e.g. *.test.ts, docs/*)" />
                        <button class="ai-sync-btn ai-sync-btn-secondary" id="btn-apply-exclude" style="font-size: 11px;">Apply Globs</button>
                        <button class="ai-sync-btn ai-sync-btn-secondary" id="btn-expand-all" style="font-size: 11px;">Expand All</button>
                        <button class="ai-sync-btn ai-sync-btn-secondary" id="btn-collapse-all" style="font-size: 11px;">Collapse All</button>
                        <button class="ai-sync-btn ai-sync-btn-secondary" id="btn-toggle-all" style="font-size: 11px;">
                            ${selectedFiles.length === fileListState.length ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>

                    <div class="packer-tree-wrapper">
                        <div class="packer-tree-header">
                            <div class="packer-col-name">Folder & File Structure (Sorted from Max Tokens)</div>
                            <div class="packer-col-tokens">Tokens & Usage %</div>
                            <div class="packer-col-size">Size</div>
                        </div>
                        <div class="packer-tree-body">
                            ${treeRowsHtml || '<div style="padding: 24px; text-align: center; color: #64748b;">No files matching filter.</div>'}
                        </div>
                    </div>

                    <div class="ai-sync-modal-footer">
                        <button class="ai-sync-btn ai-sync-btn-secondary" id="btn-packer-cancel">Cancel (Esc)</button>
                        <div class="ai-sync-btn-group">
                            <button class="ai-sync-btn ai-sync-btn-secondary" id="btn-packer-copy">📋 Copy Context XML</button>
                            <button class="ai-sync-btn ai-sync-btn-primary" id="btn-packer-insert">
                                📥 Insert Context (~${formatTokens(selectedTokens)}) into Prompt
                            </button>
                        </div>
                    </div>
                </div>
            `;

            backdrop.querySelectorAll('.packer-tree-chk[data-indeterminate="true"]').forEach(chk => {
                chk.indeterminate = true;
            });

            attachEvents(treeRoot);
        }

        function findNodeByPath(root, targetPath) {
            if (root.path === targetPath) return root;
            if (root.sortedChildren) {
                for (const child of root.sortedChildren) {
                    const found = findNodeByPath(child, targetPath);
                    if (found) return found;
                }
            }
            return null;
        }

        function attachEvents(treeRoot) {
            backdrop.onclick = (e) => {
                if (e.target === backdrop) cleanupAndClose(null);
            };

            backdrop.querySelector('#btn-packer-close').onclick = () => cleanupAndClose(null);
            backdrop.querySelector('#btn-packer-cancel').onclick = () => cleanupAndClose(null);

            const searchInput = backdrop.querySelector('#packer-search');
            searchInput.oninput = (e) => {
                filterText = e.target.value;
                render();
                const newSearch = backdrop.querySelector('#packer-search');
                newSearch.focus();
                newSearch.setSelectionRange(newSearch.value.length, newSearch.value.length);
            };

            backdrop.querySelectorAll('[data-toggle-expand]').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const path = btn.dataset.toggleExpand;
                    if (expandedDirs.has(path)) {
                        expandedDirs.delete(path);
                    } else {
                        expandedDirs.add(path);
                    }
                    render();
                };
            });

            backdrop.querySelectorAll('.packer-tree-chk').forEach(chk => {
                chk.onchange = (e) => {
                    e.stopPropagation();
                    const path = chk.dataset.path;
                    const node = findNodeByPath(treeRoot, path);
                    if (node) {
                        toggleFolderSelection(node, chk.checked);
                        render();
                    }
                };
            });

            backdrop.querySelector('#btn-expand-all').onclick = () => {
                fileListState.forEach(f => {
                    const parts = f.filePath.split('/');
                    let cur = '';
                    for (let i = 0; i < parts.length - 1; i++) {
                        cur = cur ? `${cur}/${parts[i]}` : parts[i];
                        expandedDirs.add(cur);
                    }
                });
                render();
            };

            backdrop.querySelector('#btn-collapse-all').onclick = () => {
                expandedDirs.clear();
                expandedDirs.add('');
                render();
            };

            backdrop.querySelector('#btn-toggle-all').onclick = () => {
                const allSelected = fileListState.every(f => f.selected);
                fileListState.forEach(f => f.selected = !allSelected);
                render();
            };

            backdrop.querySelector('#btn-apply-exclude').onclick = () => {
                const patternInput = backdrop.querySelector('#packer-custom-ignore').value.trim();
                if (!patternInput) return;
                const patterns = patternInput.split(',').map(p => p.trim()).filter(Boolean);
                const rules = patterns.map(p => new ScopedGitignoreRule(p, ''));

                let excludedCount = 0;
                fileListState.forEach(f => {
                    if (isPathIgnoredWithRules(f.filePath, false, rules)) {
                        f.selected = false;
                        excludedCount++;
                    }
                });
                showToast(`Excluded ${excludedCount} file(s) matching custom pattern(s)`, 'info', 2000);
                render();
            };

            backdrop.querySelector('#btn-packer-copy').onclick = async () => {
                const contextXml = formatCodebaseContext(fileListState, rootName);
                await navigator.clipboard.writeText(contextXml);
                showToast('📋 Codebase context copied to clipboard!', 'success');
                cleanupAndClose(null);
            };

            backdrop.querySelector('#btn-packer-insert').onclick = async () => {
                const contextXml = formatCodebaseContext(fileListState, rootName);
                await insertIntoPrompt(contextXml);
                showToast(`📥 Packed codebase context (${fileListState.filter(f => f.selected).length} files) into prompt attachment!`, 'success');
                cleanupAndClose(null);
            };
        }

        document.body.appendChild(backdrop);
        render();
    });
}

// ==========================================
// 9. Prompt Context Insertion (Native Paste Interception & Artifact Trigger)
// ==========================================

async function insertIntoPrompt(text) {
    const inputEl = document.querySelector(AI_STUDIO_SELECTORS.promptInput);

    try {
        await navigator.clipboard.writeText(text);
    } catch {
        // Fallback
    }

    if (inputEl) {
        inputEl.focus();

        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', text);
        dataTransfer.setData('text/html', `<pre>${escapeHtml(text)}</pre>`);

        const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            composed: true,
            clipboardData: dataTransfer
        });

        const isHandledByAIStudio = !inputEl.dispatchEvent(pasteEvent);

        if (!isHandledByAIStudio) {
            let inserted = false;
            try {
                inserted = document.execCommand('insertText', false, text);
            } catch {
                inserted = false;
            }

            if (!inserted) {
                const currentVal = inputEl.value;
                const separator = currentVal.trim().length > 0 ? '\n\n' : '';
                inputEl.value = currentVal + separator + text;
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
        inputEl.scrollTop = inputEl.scrollHeight;
    } else {
        const editableEl = document.querySelector(AI_STUDIO_SELECTORS.editablePrompt);
        if (editableEl) {
            editableEl.focus();
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', text);
            const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                composed: true,
                clipboardData: dataTransfer
            });
            const handled = !editableEl.dispatchEvent(pasteEvent);
            if (!handled) {
                const current = editableEl.innerText.trim();
                editableEl.innerText = (current ? current + '\n\n' : '') + text;
                editableEl.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    }
}

function handleSkippedFilesResolution(skippedFiles) {
    if (!skippedFiles || skippedFiles.length === 0) return;
    const fileListText = skippedFiles.map(f => `- \`${f.filePath}\`${f.reason ? ` (${f.reason})` : ''}`).join('\n');
    const promptMessage = `The following file(s) were skipped or could not be fully synced to disk:\n${fileListText}\n\nPlease provide the full, completed, ready-to-save code for these file(s) without placeholders.`;
    insertIntoPrompt(promptMessage);
}

// ==========================================
// 10. Robust Path Extraction (Markdown & Large-Text Dual Engine)
// ==========================================

function isValidFileCandidate(candidate) {
    if (!candidate || candidate.length > 220) return false;
    const clean = cleanCandidatePath(candidate);
    if (/^(?:https?:\/\/|www\.|git@|mailto:)/i.test(clean)) return false;
    if (/(?:github\.com|gitlab\.com|shields\.io|google\.com|localhost|mozilla\.org)/i.test(clean)) return false;

    // Special known no-extension files or dotfiles
    const knownSpecial = new Set(['license', 'makefile', 'dockerfile', 'procfile', '.gitignore', '.env', '.dockerignore', '.editorconfig', '.npmignore', '.prettierrc', '.eslintrc']);
    if (knownSpecial.has(clean.toLowerCase()) || knownSpecial.has(clean.split('/').pop().toLowerCase())) {
        return true;
    }

    const extMatch = clean.match(/\.([a-zA-Z0-9_-]+)$/);
    if (!extMatch) return false;
    const ext = extMatch[1].toLowerCase();

    const invalidExts = new Set(['com', 'org', 'net', 'io', 'dev', 'app', 'ai', 'co', 'uk', 'html#', 'md#', 'pl']);
    if (invalidExts.has(ext) && !clean.includes('/')) return false;

    return true;
}

function cleanCandidatePath(raw) {
    if (!raw) return null;
    let clean = String(raw).trim();
    clean = clean.replace(/^(?:#{1,6}\s*)?(?:\d+[\.\)]|\*|-|\+)\s+/, '');
    clean = clean.replace(/[`"'*]/g, '').trim();
    clean = clean.replace(/\s*\([^)]*\)\s*$/i, '').trim();
    clean = clean.replace(/\s*[-—:]\s*(?:excerpt|snippet|diff|patch|part|update).*$/i, '').trim();
    return clean;
}

function isExcerptMarker(text) {
    return /\b(?:excerpt|snippet|partial)\b/i.test(text || '');
}

function extractFilesFromRawText(text) {
    const files = [];

    // 1. XML Format: <file path="...">...</file>
    const xmlFileRegex = /<file\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/file>/gi;
    let xmlMatch;
    while ((xmlMatch = xmlFileRegex.exec(text)) !== null) {
        const filePath = cleanCandidatePath(xmlMatch[1]);
        const content = xmlMatch[2].trim();
        if (isValidFileCandidate(filePath)) {
            files.push({ filePath, content });
        }
    }

    // 2. Markdown Header + Code Block (Supports 3, 4, 5+ backticks/tildes)
    const mdHeaderBlockRegex = /(?:^|\n)(?:#{1,6}\s+|(?:\*\*|\*)?(?:File|Path|Filename)?[:\s*]*)(?:(?:\d+[\.\)]|\*|-|\+)\s*)?`?([a-zA-Z0-9_\-.\/]+\.[a-zA-Z0-9_-]+)`?[^\n]*\n+(`{3,5}|~{3,5})[a-zA-Z0-9_-]*\r?\n([\s\S]*?)\r?\n\2/gi;
    let mdMatch;
    while ((mdMatch = mdHeaderBlockRegex.exec(text)) !== null) {
        const filePath = cleanCandidatePath(mdMatch[1]);
        const content = mdMatch[3];
        if (isValidFileCandidate(filePath)) {
            files.push({ filePath, content, isExcerpt: isExcerptMarker(mdMatch[0]) });
        }
    }

    return files;
}

function extractFilesFromTurn(turnElement) {
    const rawFiles = [];

    // Mode A: Parse raw message text (works seamlessly for .very-large-text-container and raw markdown)
    const turnText = turnElement.innerText || turnElement.textContent || '';
    const textFiles = extractFilesFromRawText(turnText);
    rawFiles.push(...textFiles);

    // Mode B: Parse DOM <ms-code-block> elements (for standard rendered mode)
    const codeBlocks = turnElement.querySelectorAll('ms-code-block');

    codeBlocks.forEach((codeBlock) => {
        let filePath = null;
        let isExcerpt = false;

        const containerHtml = codeBlock.parentElement ? codeBlock.parentElement.innerHTML : '';
        const tagMatch = containerHtml.match(/<(?:file|artifact|code)[^>]+(?:path|filename|name)=["']([^"']+)["']/i);
        if (tagMatch && isValidFileCandidate(tagMatch[1])) {
            filePath = cleanCandidatePath(tagMatch[1]);
            isExcerpt = isExcerptMarker(containerHtml);
        }

        const codeEl = codeBlock.querySelector('pre code');
        if (!codeEl) return;
        let rawText = codeEl.innerText;

        if (!filePath) {
            const commentMatch = rawText.match(/(?:\/\/|#|\/\*|<!--)\s*(?:filepath:|file:|path:)?\s*(?:(?:\d+[\.\)]|\*|-|\+)\s*)?([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9_-]+)/i);
            if (commentMatch && isValidFileCandidate(commentMatch[1])) {
                filePath = cleanCandidatePath(commentMatch[1]);
            }
        }

        if (!filePath) {
            let prev = codeBlock.previousElementSibling;
            let distance = 0;
            while (prev && distance < 2) {
                if (prev.tagName === 'MS-CODE-BLOCK' || prev.querySelector('ms-code-block') || prev.tagName === 'HR') {
                    break;
                }

                const prevText = prev.innerText.trim();
                if (isExcerptMarker(prevText)) isExcerpt = true;

                if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(prev.tagName)) {
                    const labelMatch = prevText.match(/(?:file|path|filename)?[:\s*]*(?:(?:\d+[\.\)]|\*|-|\+)\s*)?[`"]?([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9_-]+)[`"]?/i);
                    if (labelMatch && isValidFileCandidate(labelMatch[1])) {
                        filePath = cleanCandidatePath(labelMatch[1]);
                        break;
                    }
                } else if (['P', 'LI'].includes(prev.tagName)) {
                    const text = prevText;
                    const explicitMatch = text.match(/^(?:(?:###?\s*)?(?:File|Path|Filename):\s*|`)(?:(?:\d+[\.\)]|\*|-|\+)\s*)?([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9_-]+)`?/i);
                    if (explicitMatch && isValidFileCandidate(explicitMatch[1])) {
                        filePath = cleanCandidatePath(explicitMatch[1]);
                        break;
                    }
                }
                prev = prev.previousElementSibling;
                distance++;
            }
        }

        // A path may have been found in a code comment or tag; still inspect
        // nearby prose so an excerpt marker cannot be missed.
        if (filePath && !isExcerpt) {
            let prev = codeBlock.previousElementSibling;
            let distance = 0;
            while (prev && distance < 3) {
                if (prev.tagName === 'MS-CODE-BLOCK' || prev.querySelector('ms-code-block') || prev.tagName === 'HR') break;
                if (isExcerptMarker(prev.innerText || prev.textContent || '')) {
                    isExcerpt = true;
                    break;
                }
                prev = prev.previousElementSibling;
                distance++;
            }
        }

        if (filePath) {
            rawFiles.push({
                filePath: cleanCandidatePath(filePath),
                content: rawText,
                codeBlockElement: codeBlock,
                isExcerpt
            });
        }
    });

    // Deduplication: Group by filePath and retain the largest, most complete block
    const fileMap = new Map();
    for (const file of rawFiles) {
        if (!fileMap.has(file.filePath)) {
            fileMap.set(file.filePath, file);
        } else {
            const existing = fileMap.get(file.filePath);
            if (file.content.length > existing.content.length) {
                fileMap.set(file.filePath, file);
            }
        }
    }

    return Array.from(fileMap.values());
}

// ==========================================
// 11. Execution & UI Injection
// ==========================================

async function syncFileBatch(dirHandle, fileEntries) {
    const processedFiles = [];

    for (const file of fileEntries) {
        const originalText = await readRelativeFile(dirHandle, file.filePath);
        let targetContent = file.content;
        let isDiff = false;
        let hasDiffError = false;
        let diffErrorMsg = '';

        try {
            const result = processDiffOrDirectContent(originalText, file.content);
            targetContent = result.content;
            isDiff = result.isDiff;
        } catch (err) {
            hasDiffError = true;
            diffErrorMsg = err.message;
            targetContent = file.content;
            isDiff = isDiffContent(file.content);
        }

        const validation = validateContent(file.filePath, targetContent);
        const isIdentical = originalText !== null && (originalText.replace(/\r\n/g, '\n') === targetContent.replace(/\r\n/g, '\n'));

        processedFiles.push({
            filePath: file.filePath,
            rawBlock: file.content,
            originalContent: originalText,
            targetContent,
            isDiff,
            hasDiffError,
            diffErrorMsg,
            isIdentical,
            isExcerpt: Boolean(file.isExcerpt),
            validation
        });
    }

    if (processedFiles.length > 0 && processedFiles.every(f => f.isIdentical)) {
        showToast('All files are already up to date!', 'info');
        return { writtenCount: processedFiles.length, skipped: [], alreadyIdentical: true };
    }

    const needsReview = processedFiles.some(f => !f.isIdentical && (!f.validation.valid || f.hasDiffError || f.isDiff || f.isExcerpt));
    let filesToWrite = [];

    if (needsReview || processedFiles.length > 1) {
        filesToWrite = await showBatchReviewModal(processedFiles);
    } else {
        filesToWrite = processedFiles
            .filter(f => !f.isIdentical)
            .map(f => ({ filePath: f.filePath, content: f.targetContent }));
    }

    if (filesToWrite.length === 0) {
        const actualProblemFiles = processedFiles.filter(f => !f.isIdentical);
        return { writtenCount: 0, skipped: actualProblemFiles };
    }

    await recordUndoSnapshot(dirHandle, filesToWrite);

    for (const item of filesToWrite) {
        await writeRelativeFile(dirHandle, item.filePath, item.content);
    }

    const writtenPaths = new Set(filesToWrite.map(f => f.filePath));
    const skipped = processedFiles.filter(f => !writtenPaths.has(f.filePath) && !f.isIdentical);

    return { writtenCount: filesToWrite.length, skipped };
}

async function updateFileStatusBadges(turn) {
    if (!rootDirHandle) return;
    const files = extractFilesFromTurn(turn);

    for (const file of files) {
        if (!file.codeBlockElement || !file.codeBlockElement.querySelector) continue;
        const actionsWrapper = file.codeBlockElement.querySelector('.projected-actions-wrapper');
        if (!actionsWrapper) continue;

        let badge = actionsWrapper.querySelector('.ai-block-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'ai-file-status-badge ai-block-badge';
            actionsWrapper.prepend(badge);
        }

        const localContent = await readRelativeFile(rootDirHandle, file.filePath);
        const exists = localContent !== null;
        const isDiff = isDiffContent(file.content);
        const isIdentical = exists && (localContent.replace(/\r\n/g, '\n') === file.content.replace(/\r\n/g, '\n'));

        if (file.isExcerpt) {
            badge.className = 'ai-file-status-badge ai-block-badge badge-warn';
            badge.innerText = 'EXCERPT';
        } else if (isIdentical) {
            badge.className = 'ai-file-status-badge ai-block-badge badge-same';
            badge.innerText = 'SAME';
        } else if (isDiff) {
            badge.className = 'ai-file-status-badge ai-block-badge badge-diff';
            badge.innerText = 'DIFF';
        } else if (exists) {
            badge.className = 'ai-file-status-badge ai-block-badge badge-mod';
            badge.innerText = 'MOD';
        } else {
            badge.className = 'ai-file-status-badge ai-block-badge badge-new';
            badge.innerText = 'NEW';
        }
    }
}

function injectUI() {
    document.querySelectorAll('ms-chat-turn').forEach((turn) => {
        if (turn.dataset.syncInjected) return;

        const actionsBar = turn.querySelector('.actions-container .actions');
        if (actionsBar) {
            const syncTurnBtn = document.createElement('button');
            syncTurnBtn.className = 'btn-turn-sync';
            syncTurnBtn.innerHTML = '⚡ Sync to Disk';

            syncTurnBtn.onclick = async (e) => {
                e.stopPropagation();
                if (!rootDirHandle) {
                    showToast('Connect your Project Root first (bottom right).', 'warning');
                    return;
                }

                const files = extractFilesFromTurn(turn);
                if (files.length === 0) {
                    showToast('No files with valid paths detected.', 'warning');
                    return;
                }

                syncTurnBtn.innerText = `⏳ Writing ${files.length} file(s)...`;
                try {
                    const result = await syncFileBatch(rootDirHandle, files);
                    if (result.alreadyIdentical) {
                        syncTurnBtn.innerText = `✅ Up to Date`;
                    } else if (result.writtenCount > 0) {
                        showToast(`Successfully synced ${result.writtenCount} file(s)!`, 'success');
                        syncTurnBtn.innerText = `✅ Synced ${result.writtenCount}/${files.length}`;
                    } else {
                        syncTurnBtn.innerText = `⚡ Sync to Disk`;
                    }
                    if (result.skipped && result.skipped.length > 0) {
                        handleSkippedFilesResolution(result.skipped);
                        showToast(`${result.skipped.length} file(s) skipped and appended to prompt.`, 'info');
                    }
                    setTimeout(() => { syncTurnBtn.innerText = '⚡ Sync to Disk'; }, 3000);
                } catch (err) {
                    showToast(`Sync error: ${err.message}`, 'error');
                    syncTurnBtn.innerText = '❌ Error';
                }
            };

            actionsBar.prepend(syncTurnBtn);
        }

        const files = extractFilesFromTurn(turn);
        files.forEach((file) => {
            if (!file.codeBlockElement || !file.codeBlockElement.querySelector) return;
            const actionsWrapper = file.codeBlockElement.querySelector('.projected-actions-wrapper');
            if (actionsWrapper && !actionsWrapper.dataset.syncInjected) {
                const singleBtn = document.createElement('button');
                singleBtn.className = 'btn-block-sync';
                singleBtn.title = `Sync ${file.filePath} to disk`;
                singleBtn.innerHTML = '💾 Sync';

                singleBtn.onclick = async (e) => {
                    e.stopPropagation();
                    if (!rootDirHandle) {
                        showToast('Please connect your folder first!', 'warning');
                        return;
                    }
                    try {
                        const result = await syncFileBatch(rootDirHandle, [file]);
                        if (result.alreadyIdentical) {
                            singleBtn.innerHTML = '✅ Up to Date';
                        } else if (result.writtenCount > 0) {
                            showToast(`Saved ${file.filePath} to disk`, 'success');
                            singleBtn.innerHTML = '✅ Saved';
                        } else {
                            singleBtn.innerHTML = '⚠️ Skipped';
                            if (result.skipped && result.skipped.length > 0) {
                                handleSkippedFilesResolution(result.skipped);
                            }
                        }
                        setTimeout(() => { singleBtn.innerHTML = '💾 Sync'; }, 2500);
                    } catch (err) {
                        showToast(`Write failed: ${err.message}`, 'error');
                    }
                };

                actionsWrapper.prepend(singleBtn);
                actionsWrapper.dataset.syncInjected = 'true';
            }
        });

        updateFileStatusBadges(turn);
        turn.dataset.syncInjected = 'true';
    });
}

// ==========================================
// 12. Floating Toolbar, Persistence & Context Menu
// ==========================================

async function setupPersistentDirectory() {
    try {
        const stored = await getStoredHandle();
        if (stored) {
            const permission = await stored.queryPermission({ mode: 'readwrite' });
            if (permission === 'granted') {
                rootDirHandle = stored;
                updateFolderStatus(`📂 ${rootDirHandle.name}`, 'Change');
                showToast(`Restored connection to ${rootDirHandle.name}`, 'info', 2000);
            } else {
                updateFolderStatus(`📂 ${stored.name} (Click to re-grant)`, 'Re-grant');
            }
        }
    } catch (e) {
        console.error('Failed to load stored directory handle:', e);
    }
}

function updateFolderStatus(label, btnText) {
    const lbl = document.getElementById('sync-folder-name');
    const btn = document.getElementById('btn-pick-folder');
    if (lbl) lbl.innerText = label;
    if (btn) btn.innerText = btnText;
}

function createFloatingToolbar() {
    if (document.getElementById('ai-studio-sync-bar')) return;

    const bar = document.createElement('div');
    bar.id = 'ai-studio-sync-bar';
    bar.innerHTML = `
        <div class="ai-sync-drag-handle" title="Drag to reposition">⋮⋮</div>
        <span id="sync-folder-name" style="cursor: grab;">📁 No folder connected</span>
        <button id="btn-pick-folder">Connect Project Root</button>
        <button id="btn-undo-sync" disabled>↩️ Undo</button>
        <button id="btn-context-menu">📎 Context ▾</button>
        <div id="ai-sync-context-dropdown" class="ai-sync-dropdown-menu" style="display: none;">
            <button class="ai-sync-dropdown-item ai-sync-dropdown-item-featured" id="btn-pack-context">📊 Pack Codebase Context</button>
            <button class="ai-sync-dropdown-item" id="btn-insert-diff-prompt">📋 Insert Diff Format Instructions</button>
            <button class="ai-sync-dropdown-item" id="btn-attach-tree">🌳 Insert Directory Tree</button>
            <button class="ai-sync-dropdown-item" id="btn-attach-file">📄 Attach Local File</button>
        </div>
    `;

    document.body.appendChild(bar);

    // --- Restore Saved Position ---
    try {
        const savedPos = JSON.parse(localStorage.getItem('ai_studio_sync_bar_pos') || 'null');
        if (savedPos && savedPos.left !== undefined && savedPos.top !== undefined) {
            const clampedLeft = Math.max(10, Math.min(window.innerWidth - 300, savedPos.left));
            const clampedTop = Math.max(10, Math.min(window.innerHeight - 60, savedPos.top));
            bar.style.bottom = 'auto';
            bar.style.right = 'auto';
            bar.style.left = `${clampedLeft}px`;
            bar.style.top = `${clampedTop}px`;
        }
    } catch {
        // Fallback to CSS bottom/right
    }

    // --- Draggable Logic ---
    let isDragging = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;

    function onPointerDown(e) {
        // Only drag when clicking handle, label, or bar body (ignore buttons/inputs)
        if (e.target.closest('button') || e.target.closest('.ai-sync-dropdown-menu')) return;

        isDragging = true;
        bar.classList.add('ai-sync-dragging');

        const rect = bar.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startLeft = rect.left;
        startTop = rect.top;

        // Switch positioning mode to absolute top/left
        bar.style.bottom = 'auto';
        bar.style.right = 'auto';
        bar.style.left = `${startLeft}px`;
        bar.style.top = `${startTop}px`;

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    }

    function onPointerMove(e) {
        if (!isDragging) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        const rect = bar.getBoundingClientRect();
        const maxLeft = window.innerWidth - rect.width - 10;
        const maxTop = window.innerHeight - rect.height - 10;

        const newLeft = Math.max(10, Math.min(maxLeft, startLeft + deltaX));
        const newTop = Math.max(10, Math.min(maxTop, startTop + deltaY));

        bar.style.left = `${newLeft}px`;
        bar.style.top = `${newTop}px`;
    }

    function onPointerUp() {
        if (!isDragging) return;
        isDragging = false;
        bar.classList.remove('ai-sync-dragging');

        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);

        // Save position
        const rect = bar.getBoundingClientRect();
        localStorage.setItem('ai_studio_sync_bar_pos', JSON.stringify({ left: rect.left, top: rect.top }));
    }

    bar.addEventListener('pointerdown', onPointerDown);

    // --- Button Actions ---
    const pickBtn = document.getElementById('btn-pick-folder');
    pickBtn.onclick = async () => {
        try {
            const stored = await getStoredHandle();
            if (pickBtn.innerText.includes('Re-grant') && stored) {
                const permission = await stored.requestPermission({ mode: 'readwrite' });
                if (permission === 'granted') {
                    rootDirHandle = stored;
                    updateFolderStatus(`📂 ${rootDirHandle.name}`, 'Change');
                    showToast(`Re-connected to ${rootDirHandle.name}`, 'success');
                    return;
                }
            }

            rootDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            await saveStoredHandle(rootDirHandle);
            updateFolderStatus(`📂 ${rootDirHandle.name}`, 'Change');
            showToast(`Connected to ${rootDirHandle.name}`, 'success');
        } catch (err) {
            if (err.name !== 'AbortError') {
                showToast(`Folder connection failed: ${err.message}`, 'error');
            }
        }
    };

    document.getElementById('btn-undo-sync').onclick = () => {
        if (rootDirHandle) performUndo(rootDirHandle);
    };

    const contextBtn = document.getElementById('btn-context-menu');
    const dropdown = document.getElementById('ai-sync-context-dropdown');

    contextBtn.onclick = (e) => {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === 'none' ? 'flex' : 'none';
    };

    document.addEventListener('click', () => {
        if (dropdown) dropdown.style.display = 'none';
    });

    document.getElementById('btn-pack-context').onclick = async () => {
        if (!rootDirHandle) {
            showToast('Connect your project folder first!', 'warning');
            return;
        }
        showToast('Scanning codebase & parsing recursive .gitignore rules...', 'info', 2000);
        try {
            const files = await collectAllRepositoryFiles(rootDirHandle);
            if (files.length === 0) {
                showToast('No source files found after applying gitignore.', 'warning');
                return;
            }
            await showContextPackerModal(files, rootDirHandle.name);
        } catch (err) {
            showToast(`Context packing failed: ${err.message}`, 'error');
        }
    };

    document.getElementById('btn-insert-diff-prompt').onclick = insertStrictSyncFormatPrompt;

    document.getElementById('btn-attach-tree').onclick = async () => {
        if (!rootDirHandle) {
            showToast('Connect your project folder first!', 'warning');
            return;
        }
        showToast('Generating directory tree...', 'info', 1500);
        try {
            const files = await collectAllRepositoryFiles(rootDirHandle);
            const paths = files.map(f => f.filePath).sort();
            const tree = buildTreeFromPaths(paths);
            await insertIntoPrompt(`Project Directory Structure:\n\`\`\`\n${tree}\`\`\``);
            showToast('Directory tree added to prompt!', 'success');
        } catch (err) {
            showToast(`Tree generation failed: ${err.message}`, 'error');
        }
    };

    document.getElementById('btn-attach-file').onclick = async () => {
        if (!rootDirHandle) {
            showToast('Connect your project folder first!', 'warning');
            return;
        }
        const relPath = prompt('Enter relative path to attach (e.g. src/index.ts):');
        if (!relPath) return;

        try {
            const content = await readRelativeFile(rootDirHandle, relPath.trim());
            if (content === null) {
                showToast(`File not found: ${relPath}`, 'error');
                return;
            }
            const ext = relPath.split('.').pop() || '';
            await insertIntoPrompt(`### File: \`${relPath}\`\n\`\`\`${ext}\n${content}\n\`\`\``);
            showToast(`Attached ${relPath} to prompt!`, 'success');
        } catch (err) {
            showToast(`Failed to read file: ${err.message}`, 'error');
        }
    };
}

// ==========================================
// 13. Initialization
// ==========================================

createFloatingToolbar();
setupPersistentDirectory();

const observer = new MutationObserver(() => {
    injectUI();
});
observer.observe(document.body, { childList: true, subtree: true });
