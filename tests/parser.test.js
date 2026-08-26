const assert = require('node:assert/strict');
const test = require('node:test');

const {
    applyUnifiedPatch,
    extractFilesFromRawText,
    processDiffOrDirectContent
} = require('../content.js');

test('extracts and applies a fenced multi-file git diff', () => {
    const response = `Here is the change:\n\n\`\`\`diff
diff --git a/src/one.js b/src/one.js
--- a/src/one.js
+++ b/src/one.js
@@ -1,2 +1,2 @@
 const one = 1;
-const two = 2;
+const two = 22;
diff --git a/docs/readme.md b/docs/readme.md
--- a/docs/readme.md
+++ b/docs/readme.md
@@ -1,2 +1,2 @@
 # Title
-Old text
+New text
\`\`\``;

    const files = extractFilesFromRawText(response);
    assert.deepEqual(files.map(file => file.filePath), ['src/one.js', 'docs/readme.md']);
    assert.equal(
        processDiffOrDirectContent('const one = 1;\nconst two = 2;\n', files[0].content).content,
        'const one = 1;\nconst two = 22;\n'
    );
    assert.equal(
        processDiffOrDirectContent('# Title\nOld text\n', files[1].content).content,
        '# Title\nNew text\n'
    );
});

test('accepts a new file diff from /dev/null', () => {
    const response = `\`\`\`diff
diff --git a/new.txt b/new.txt
new file mode 100644
--- /dev/null
+++ b/new.txt
@@ -0,0 +1,2 @@
+first
+second
\`\`\``;

    const [file] = extractFilesFromRawText(response);
    assert.equal(file.filePath, 'new.txt');
    assert.equal(processDiffOrDirectContent(null, file.content).content, 'first\nsecond\n');
});

test('preserves Markdown code fences inside a six-backtick diff fence', () => {
    const response = `\`\`\`\`\`\`diff
diff --git a/README.md b/README.md
--- a/README.md
+++ b/README.md
@@ -1,4 +1,4 @@
 Example:
 \`\`\`js
-console.log("old");
+console.log("new");
 \`\`\`
\`\`\`\`\`\``;

    const [file] = extractFilesFromRawText(response);
    const original = 'Example:\n\`\`\`js\nconsole.log("old");\n\`\`\`\n';
    assert.equal(
        processDiffOrDirectContent(original, file.content).content,
        'Example:\n\`\`\`js\nconsole.log("new");\n\`\`\`\n'
    );
});

test('preserves a trailing blank context line before the next file diff', () => {
    const response = `\`\`\`\`\`\`diff
diff --git a/src/Controller.php b/src/Controller.php
--- a/src/Controller.php
+++ b/src/Controller.php
@@ -1,7 +1,7 @@
 first
 second
 third
-} catch (\\RuntimeException) {
+} catch (\\Throwable) {
     return response();
 }
 
diff --git a/src/Other.php b/src/Other.php
--- a/src/Other.php
+++ b/src/Other.php
@@ -1 +1 @@
-old
+new
\`\`\`\`\`\``;

    const files = extractFilesFromRawText(response);
    assert.equal(files.length, 2);
    assert.equal(
        processDiffOrDirectContent(
            'first\nsecond\nthird\n} catch (\\RuntimeException) {\n    return response();\n}\n\n',
            files[0].content
        ).content,
        'first\nsecond\nthird\n} catch (\\Throwable) {\n    return response();\n}\n\n'
    );
});

test('accepts ---/+++ patches when the model omits diff --git', () => {
    const response = `\`\`\`diff
--- a/src/value.ts
+++ b/src/value.ts
@@ -1 +1 @@
-export const value = 1;
+export const value = 2;
\`\`\``;

    const [file] = extractFilesFromRawText(response);
    assert.equal(file.filePath, 'src/value.ts');
    assert.equal(applyUnifiedPatch('export const value = 1;\n', file.content), 'export const value = 2;\n');
});

test('repairs symmetric hunk-count drift when exact source context matches', () => {
    const offByOne = `diff --git a/a.js b/a.js
--- a/a.js
+++ b/a.js
@@ -1,2 +1,2 @@
 before
-old
+new
 after`;

    assert.equal(
        applyUnifiedPatch('before\nold\nafter\n', offByOne),
        'before\nnew\nafter\n'
    );
});

test('rejects asymmetric truncated hunks instead of partially applying them', () => {
    const malformed = `diff --git a/a.js b/a.js
--- a/a.js
+++ b/a.js
@@ -1,1 +1,2 @@
-old
+new`;

    assert.throws(
        () => applyUnifiedPatch('old\nsecond\n', malformed),
        /Malformed unified diff hunk/
    );
});

test('rejects a shifted hunk when its context is ambiguous', () => {
    const ambiguous = `diff --git a/a.js b/a.js
--- a/a.js
+++ b/a.js
@@ -9 +9 @@
-same
+changed`;

    assert.throws(
        () => applyUnifiedPatch('same\nbetween\nsame\n', ambiguous),
        /ambiguous/
    );
});

test('rejects deletion diffs instead of replacing a file with empty content', () => {
    const deletion = `diff --git a/a.js b/a.js
deleted file mode 100644
--- a/a.js
+++ /dev/null
@@ -1 +0,0 @@
-content`;

    assert.throws(
        () => processDiffOrDirectContent('content\n', deletion),
        /deletion diffs are not supported/
    );
});

test('keeps legacy SEARCH/REPLACE support', () => {
    const patch = `<<<<<<< SEARCH
const value = 1;
=======
const value = 2;
>>>>>>> REPLACE`;

    assert.equal(processDiffOrDirectContent('const value = 1;\n', patch).content, 'const value = 2;\n');
});

test('extracts a complete file introduced by natural-language prose', () => {
    const response = `Here is the complete, full file content for \`src/Market/Infrastructure/Mail/SmtpTransport.php\`:

\`\`\`php
<?php

declare(strict_types=1);
\`\`\``;

    const files = extractFilesFromRawText(response);
    assert.equal(files.length, 1);
    assert.equal(files[0].filePath, 'src/Market/Infrastructure/Mail/SmtpTransport.php');
    assert.equal(files[0].content, '<?php\n\ndeclare(strict_types=1);');
});
