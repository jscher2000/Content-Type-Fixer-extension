# Content-Type-Fixer-extension
Firefox extension to override dumb Content-Type headers with correct values (initially for zip, rtf, pdf, acsm)
https://addons.mozilla.org/en-US/firefox/addon/content-type-fixer/

By default, this extension is not listening. Use the toolbar button to turn listening on and off.

When you turn it on, the extension checks every request to see whether it has a file extension that should be assigned a specific Content-Type header.

To be expanded with the ability to add more content types in the future.

Permissions Note: While it is listening, the extension reads the Content-Type and Content-Disposition headers that servers send with files. It may modify the Content-Type header. The extension does not read web pages.

Test Page: Without the extension running, you get bad results for the zip files on this page, and the extension fixes it: https://www.jeffersonscher.com/res/badct/

Hat tip: The code draws heavily from the Display inline extension from samlh - https://github.com/samlh/display-inline
