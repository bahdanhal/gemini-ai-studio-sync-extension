# Privacy Policy

**AI Studio Local File Sync & Codebase Context** is designed to process data locally in the user's browser.

## Data handled

The extension handles:

- Code and text displayed in Google AI Studio, when the user chooses to sync a response or insert context.
- Files and folders inside a directory explicitly selected by the user through the browser's File System Access API.
- The selected directory handle and toolbar position, stored locally in the AI Studio browser profile using IndexedDB and `localStorage`.

## Use and sharing

This data is used only to provide local workspace synchronization, diff review, undo, and prompt-context insertion. The extension does not operate a backend, use analytics, sell data, or share data with the developer or other third parties. No remote code is loaded or executed.

When the user inserts context into AI Studio, the selected text is delivered to the AI Studio page through the browser's paste/input mechanism. AI Studio may process that content according to Google's own policies and the user's AI Studio account settings.

The extension does not read local files until the user selects a project directory and invokes a feature that needs those files. The browser controls the directory permission and the user can revoke it at any time.

## Security

All extension logic is bundled with the extension. Relative paths are checked to prevent path traversal, and files are written only below the user-selected project directory.

## Contact

For questions or support, use the [GitHub Issues](https://github.com/bahdanhal/gemini-ai-studio-sync-extension/issues). The maintainer's website is [bahdanhal.pl](https://bahdanhal.pl).

This extension is not affiliated with, endorsed by, or sponsored by Google. Google AI Studio is a trademark of Google LLC.
