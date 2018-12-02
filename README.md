# Content-Type-Fixer-extension
Firefox extension to override dumb Content-Type headers with correct values. Built-in support for downloads with these extensions: .acsm, .doc/docx, .epub, .pdf, .ppt/pptx, .psd, .rar, .rtf, .xls/xlsx, .zip, and .7z. You can define your own Content-Type associations for other file extensions, either filling in the real one or a fictitious one.

https://addons.mozilla.org/firefox/addon/content-type-fixer/

By default, this extension is not listening. Use the toolbar button to turn listening on and off.

When you turn it on, the extension checks every request to see whether it has a file extension that should be assigned a specific Content-Type header.

The extension keeps a log of its activity, and offers Add and Edit buttons so you can add a custom Content-Type as needed. The log is not saved to disk and is flushed when you snooze the extension.

**Permissions Note:** While it is listening, the extension reads the Content-Type and Content-Disposition headers that servers send with files. It may modify those headers. The extension does not read web pages.

**Test Page:** Without the extension running, you get bad results for the zip files on this page, and the extension fixes it: https://www.jeffersonscher.com/res/badct/

**Hat tip:** The code draws from the Display inline extension from samlh - https://github.com/samlh/display-inline
