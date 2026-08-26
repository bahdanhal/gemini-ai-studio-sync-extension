let rootDirHandle = null;

// ==========================================
// 1. File System Operations
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

// ==========================================
// 2. Diff Detection & Application
// ==========================================

function isSearchReplaceDiff(text) {
    // Requires distinct multi-line markers anchored to line beginnings
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
            throw new Error(`Search block could not be matched in original file:\n"${searchBlock.slice(0, 90)}..."`);
        }
    }

    if (replacedCount === 0) {
        throw new Error('No valid SEARCH/REPLACE blocks found in patch.');
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
            currentHunk = {
                oldStart: parseInt(hunkMatch[1], 10),
                lines: []
            };
        } else if (currentHunk) {
            if (/^(?:---|\+\+\+|diff --git)/.test(line)) continue;
            currentHunk.lines.push(line);
        } else if (/^[+\- ]/.test(line)) {
            if (!currentHunk) {
                currentHunk = { oldStart: 1, lines: [] };
            }
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
            if (marker === '-') {
                oldLines.push(content);
            } else if (marker === '+') {
                newLines.push(content);
            } else if (marker === ' ') {
                oldLines.push(content);
                newLines.push(content);
            }
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
        throw new Error('Diff received, but the target file does not exist on disk to apply changes to.');
    }

    if (isSearchReplaceDiff(newContent)) {
        return { isDiff: true, content: applySearchReplace(originalContent, newContent) };
    }

    return { isDiff: true, content: applyUnifiedPatch(originalContent, newContent) };
}

// ==========================================
// 3. Validation Logic (Placeholders & Syntax)
// ==========================================

function checkPlaceholders(content) {
    const warnings = [];
    const lines = content.split(/\r?\n/);
    const placeholderRegex = /(?:\/\/|#|\/\*|<!--)\s*(?:\.\.\.|existing code|rest of code|code remains unchanged|unchanged code|TODO:|remaining code|keep original|insert here|content goes here|other methods)/i;

    lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (placeholderRegex.test(trimmed) || /^(?:\/\/\s*\.\.\.|\/\*\s*\.\.\.\s*\*\/|#\s*\.\.\.|\.\.\.)$/.test(trimmed)) {
            warnings.push(`Line ${idx + 1}: Placeholder detected ("${trimmed.slice(0, 70)}")`);
        }
    });

    return warnings;
}

function checkBrackets(content, ext) {
    const issues = [];
    const stack = [];
    const pairs = { ')': '(', ']': '[', '}': '{' };
    const opening = new Set(['(', '[', '{']);
    const closing = new Set([')', ']', '}']);

    let inString = null;
    let inLineComment = false;
    let inBlockComment = false;
    let isEscaped = false;

    let line = 1;
    let col = 0;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const nextChar = content[i + 1];

        if (char === '\n') {
            line++;
            col = 0;
            inLineComment = false;
            isEscaped = false;
            if (inString === "'" || inString === '"') {
                inString = null;
            }
            continue;
        }
        col++;

        if (isEscaped) {
            isEscaped = false;
            continue;
        }
        if (char === '\\' && inString) {
            isEscaped = true;
            continue;
        }

        if (!inString && !inBlockComment && !inLineComment) {
            if (char === '/' && nextChar === '/') {
                inLineComment = true;
                i++;
                continue;
            }
            if (char === '/' && nextChar === '*') {
                inBlockComment = true;
                i++;
                continue;
            }
            if (char === '#' && ['.py', '.sh', '.yaml', '.yml', '.rb'].includes(ext)) {
                inLineComment = true;
                continue;
            }
        }

        if (inBlockComment) {
            if (char === '*' && nextChar === '/') {
                inBlockComment = false;
                i++;
            }
            continue;
        }

        if (inLineComment) continue;

        if (char === '"' || char === "'" || (char === '`' && ['.js', '.jsx', '.ts', '.tsx', '.go', '.vue', '.svelte'].includes(ext))) {
            if (!inString) {
                inString = char;
            } else if (inString === char) {
                inString = null;
            }
            continue;
        }

        if (inString) continue;

        if (opening.has(char)) {
            stack.push({ char, line, col });
        } else if (closing.has(char)) {
            if (stack.length === 0) {
                issues.push(`Line ${line}:${col} - Unmatched closing delimiter '${char}'`);
            } else {
                const top = stack.pop();
                if (top.char !== pairs[char]) {
                    issues.push(`Line ${line}:${col} - Mismatched delimiter: '${char}' closes '${top.char}' from line ${top.line}`);
                }
            }
        }
    }

    if (inBlockComment) {
        issues.push('Unclosed multi-line comment /* ... */');
    }

    while (stack.length > 0) {
        const unclosed = stack.pop();
        issues.push(`Line ${unclosed.line}:${unclosed.col} - Unclosed delimiter '${unclosed.char}'`);
    }

    return issues;
}

function validateContent(filePath, content) {
    const warnings = checkPlaceholders(content);
    const issues = [];
    const extMatch = filePath.match(/\.([a-zA-Z0-9_-]+)$/);
    const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '';

    const supportedBracketExts = [
        '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json',
        '.py', '.c', '.cpp', '.h', '.hpp', '.cs', '.java',
        '.rs', '.go', '.php', '.css', '.scss', '.less', '.dart',
        '.swift', '.kt', '.vue', '.svelte'
    ];

    if (ext === '.json') {
        try {
            JSON.parse(content);
        } catch (err) {
            issues.push(`JSON syntax error: ${err.message}`);
        }
    } else if (['.html', '.htm', '.xml', '.svg'].includes(ext)) {
        try {
            const parser = new DOMParser();
            const mime = (ext === '.xml' || ext === '.svg') ? 'application/xml' : 'text/html';
            const doc = parser.parseFromString(content, mime);
            const parseErr = doc.querySelector('parsererror');
            if (parseErr) {
                issues.push(`XML/HTML parsing error: ${parseErr.textContent.slice(0, 100)}`);
            }
        } catch (err) {
            issues.push(`Markup validation error: ${err.message}`);
        }
    } else if (supportedBracketExts.includes(ext)) {
        issues.push(...checkBrackets(content, ext));
    }

    return {
        valid: issues.length === 0 && warnings.length === 0,
        hasIssues: issues.length > 0,
        issues,
        warnings
    };
}

// ==========================================
// 4. Modal Confirmation & Editable Preview
// ==========================================

function showValidationModal({ filePath, isDiff, issues = [], warnings = [], initialContent, rawOriginalBlock }) {
    return new Promise((resolve) => {
        const existing = document.querySelector('.ai-sync-modal-backdrop');
        if (existing) existing.remove();

        const backdrop = document.createElement('div');
        backdrop.className = 'ai-sync-modal-backdrop';

        const dialog = document.createElement('div');
        dialog.className = 'ai-sync-modal-dialog';

        const header = document.createElement('div');
        header.className = 'ai-sync-modal-header';
        header.innerHTML = `
            <div class="ai-sync-modal-title">
                <span>⚠️ Review & Confirm:</span>
                <code style="color: #38bdf8;">${filePath}</code>
            </div>
        `;

        const body = document.createElement('div');
        body.className = 'ai-sync-modal-body';

        if (isDiff) {
            const info = document.createElement('div');
            info.className = 'ai-sync-alert-box ai-sync-alert-info';
            info.innerHTML = `<strong>Diff Status:</strong> Changes were merged with existing file on disk.`;
            body.appendChild(info);
        }

        if (issues && issues.length > 0) {
            const danger = document.createElement('div');
            danger.className = 'ai-sync-alert-box ai-sync-alert-danger';
            danger.innerHTML = `<strong>Issues / Errors:</strong><br>` + issues.map(i => `• ${i}`).join('<br>');
            body.appendChild(danger);
        }

        if (warnings && warnings.length > 0) {
            const warn = document.createElement('div');
            warn.className = 'ai-sync-alert-box ai-sync-alert-warning';
            warn.innerHTML = `<strong>Potential Placeholders / Incomplete Content:</strong><br>` + warnings.map(w => `• ${w}`).join('<br>');
            body.appendChild(warn);
        }

        const previewWrapper = document.createElement('div');
        previewWrapper.className = 'ai-sync-preview-container';
        previewWrapper.innerHTML = `
            <div class="ai-sync-preview-header">
                <span>Editable Target Content (You can make adjustments directly below)</span>
            </div>
            <textarea class="ai-sync-editor-textarea" spellcheck="false"></textarea>
        `;
        const textarea = previewWrapper.querySelector('textarea');
        textarea.value = initialContent;

        // Support Tab key inside textarea
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 4;
            }
        });

        body.appendChild(previewWrapper);

        const footer = document.createElement('div');
        footer.className = 'ai-sync-modal-footer';

        // Skip Button
        const skipBtn = document.createElement('button');
        skipBtn.className = 'ai-sync-btn ai-sync-btn-secondary';
        skipBtn.innerText = '⏭️ Skip File';
        skipBtn.onclick = () => {
            backdrop.remove();
            resolve({ action: 'skip' });
        };
        footer.appendChild(skipBtn);

        // Force Full Overwrite Button (if diff was attempted or raw available)
        if (rawOriginalBlock && isDiff) {
            const forceRawBtn = document.createElement('button');
            forceRawBtn.className = 'ai-sync-btn ai-sync-btn-warning';
            forceRawBtn.innerText = '📄 Force Overwrite Raw';
            forceRawBtn.title = 'Overwrite file completely with the response without applying diff';
            forceRawBtn.onclick = () => {
                backdrop.remove();
                resolve({ action: 'write', content: rawOriginalBlock });
            };
            footer.appendChild(forceRawBtn);
        }

        // Apply/Save Button
        const saveBtn = document.createElement('button');
        saveBtn.className = 'ai-sync-btn ai-sync-btn-primary';
        saveBtn.innerText = '💾 Save to Disk';
        saveBtn.onclick = () => {
            const finalContent = textarea.value;
            backdrop.remove();
            resolve({ action: 'write', content: finalContent });
        };
        footer.appendChild(saveBtn);

        dialog.appendChild(header);
        dialog.appendChild(body);
        dialog.appendChild(footer);
        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);
    });
}

// ==========================================
// 5. Prompt Auto-Insert For Skipped Files
// ==========================================

function insertIntoPrompt(text) {
    const inputEl = document.querySelector(
        'textarea[placeholder*="prompt" i], textarea[placeholder*="Ask" i], ms-autosize-textarea textarea, textarea.mat-mdc-input-element, textarea'
    );

    if (inputEl) {
        inputEl.focus();
        const currentVal = inputEl.value;
        const separator = currentVal.trim().length > 0 ? '\n\n' : '';
        inputEl.value = currentVal + separator + text;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        inputEl.scrollTop = inputEl.scrollHeight;
    } else {
        const editableEl = document.querySelector('div[contenteditable="true"]');
        if (editableEl) {
            editableEl.focus();
            const current = editableEl.innerText.trim();
            editableEl.innerText = (current ? current + '\n\n' : '') + text;
            editableEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
}

function handleSkippedFilesResolution(skippedFiles) {
    if (!skippedFiles || skippedFiles.length === 0) return;

    const fileListText = skippedFiles
        .map(f => `- \`${f.filePath}\`${f.reason ? ` (${f.reason})` : ''}`)
        .join('\n');

    const promptMessage = `The following file(s) were skipped or could not be fully synced to disk:\n${fileListText}\n\nPlease provide the full, completed, ready-to-save code for these file(s) without placeholders or truncated sections.`;

    insertIntoPrompt(promptMessage);
}

// ==========================================
// 6. Processing & Orchestration
// ==========================================

async function processAndWriteFile(dirHandle, fileEntry) {
    const originalText = await readRelativeFile(dirHandle, fileEntry.filePath);

    let processed;
    let diffFailed = false;
    let diffErrorMsg = '';

    try {
        processed = processDiffOrDirectContent(originalText, fileEntry.content);
    } catch (diffErr) {
        diffFailed = true;
        diffErrorMsg = diffErr.message;
        processed = { isDiff: true, content: fileEntry.content };
    }

    if (diffFailed) {
        const decision = await showValidationModal({
            filePath: fileEntry.filePath,
            isDiff: true,
            issues: [`Diff application failed: ${diffErrorMsg}`, `You can edit the content, force raw overwrite, or skip.`],
            warnings: [],
            initialContent: fileEntry.content,
            rawOriginalBlock: fileEntry.content
        });

        if (decision.action === 'write') {
            await writeRelativeFile(dirHandle, fileEntry.filePath, decision.content);
            return { success: true };
        }
        return { success: false, reason: `Diff failed: ${diffErrorMsg}` };
    }

    const validation = validateContent(fileEntry.filePath, processed.content);

    if (!validation.valid) {
        const decision = await showValidationModal({
            filePath: fileEntry.filePath,
            isDiff: processed.isDiff,
            issues: validation.issues,
            warnings: validation.warnings,
            initialContent: processed.content,
            rawOriginalBlock: fileEntry.content
        });

        if (decision.action === 'write') {
            await writeRelativeFile(dirHandle, fileEntry.filePath, decision.content);
            return { success: true };
        }
        return { success: false, reason: validation.issues.concat(validation.warnings).join('; ') };
    }

    await writeRelativeFile(dirHandle, fileEntry.filePath, processed.content);
    return { success: true };
}

// ==========================================
// 7. Extraction & UI Injection
// ==========================================

function extractFilesFromTurn(turnElement) {
    const files = [];
    const codeBlocks = turnElement.querySelectorAll('ms-code-block');

    codeBlocks.forEach((codeBlock) => {
        let filePath = null;

        let prev = codeBlock.previousElementSibling;
        while (prev) {
            if (['H1', 'H2', 'H3', 'H4', 'H5', 'P'].includes(prev.tagName)) {
                const inlineCode = prev.querySelector('.inline-code, code');
                const candidate = inlineCode ? inlineCode.innerText : prev.innerText;
                const match = candidate.match(/([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9_-]+)/);
                if (match) {
                    filePath = match[1];
                    break;
                }
            }
            prev = prev.previousElementSibling;
        }

        const codeEl = codeBlock.querySelector('pre code');
        if (!codeEl) return;
        const rawText = codeEl.innerText;

        if (!filePath) {
            const commentMatch = rawText.match(/(?:\/\/|#|\/\*)\s*(?:filepath:|file:)?\s*([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9_-]+)/i);
            if (commentMatch) {
                filePath = commentMatch[1];
            }
        }

        if (filePath) {
            files.push({
                filePath: filePath.trim(),
                content: rawText,
                codeBlockElement: codeBlock
            });
        }
    });

    return files;
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
                    alert('Please click "Connect Project Root" in the bottom right corner first.');
                    return;
                }

                const files = extractFilesFromTurn(turn);
                if (files.length === 0) {
                    alert('No files with recognizable file paths detected in this message.');
                    return;
                }

                syncTurnBtn.innerText = `⏳ Writing ${files.length} file(s)...`;
                let writtenCount = 0;
                const skipped = [];

                try {
                    for (const file of files) {
                        const result = await processAndWriteFile(rootDirHandle, file);
                        if (result.success) {
                            writtenCount++;
                        } else {
                            skipped.push({ filePath: file.filePath, reason: result.reason });
                        }
                    }

                    if (skipped.length > 0) {
                        handleSkippedFilesResolution(skipped);
                        syncTurnBtn.innerText = `⚠️ Synced ${writtenCount}/${files.length} (Skipped appended to prompt)`;
                    } else {
                        syncTurnBtn.innerText = `✅ Synced ${writtenCount}/${files.length} file(s)!`;
                    }

                    setTimeout(() => { syncTurnBtn.innerText = '⚡ Sync to Disk'; }, 3500);
                } catch (err) {
                    console.error(err);
                    alert('Failed to sync files: ' + err.message);
                    syncTurnBtn.innerText = '❌ Error';
                }
            };

            actionsBar.prepend(syncTurnBtn);
        }

        const files = extractFilesFromTurn(turn);
        files.forEach((file) => {
            const actionsWrapper = file.codeBlockElement.querySelector('.projected-actions-wrapper');
            if (actionsWrapper && !actionsWrapper.dataset.syncInjected) {
                const singleBtn = document.createElement('button');
                singleBtn.className = 'btn-block-sync';
                singleBtn.title = `Sync ${file.filePath} to disk`;
                singleBtn.innerHTML = '💾';

                singleBtn.onclick = async (e) => {
                    e.stopPropagation();
                    if (!rootDirHandle) {
                        alert('Please connect your folder first!');
                        return;
                    }
                    try {
                        const result = await processAndWriteFile(rootDirHandle, file);
                        if (result.success) {
                            singleBtn.innerHTML = '✅';
                        } else {
                            singleBtn.innerHTML = '⚠️';
                            handleSkippedFilesResolution([{ filePath: file.filePath, reason: result.reason }]);
                        }
                        setTimeout(() => { singleBtn.innerHTML = '💾'; }, 2500);
                    } catch (err) {
                        alert('Write failed: ' + err.message);
                    }
                };

                actionsWrapper.prepend(singleBtn);
                actionsWrapper.dataset.syncInjected = "true";
            }
        });

        turn.dataset.syncInjected = "true";
    });
}

function createFloatingToolbar() {
    if (document.getElementById('ai-studio-sync-bar')) return;

    const bar = document.createElement('div');
    bar.id = 'ai-studio-sync-bar';
    bar.innerHTML = `
        <span id="sync-folder-name">📁 No folder connected</span>
        <button id="btn-pick-folder">Connect Project Root</button>
    `;

    document.body.appendChild(bar);

    document.getElementById('btn-pick-folder').onclick = async () => {
        try {
            rootDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            document.getElementById('sync-folder-name').innerText = `📂 ${rootDirHandle.name}`;
            document.getElementById('btn-pick-folder').innerText = 'Change';
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error(err);
            }
        }
    };
}

// Initialize
createFloatingToolbar();
const observer = new MutationObserver(() => {
    injectUI();
});
observer.observe(document.body, { childList: true, subtree: true });