# Scholar PDF Reader with Annotations

This extension adds annotation capabilities to the Google Scholar PDF Reader extension. The extended features include:

- Highlight text with colors (yellow, green, blue, pink, red).
- Easily remove individual annotations or clear them all at once. 

Currently, annotations are stored in the browser's local storage and associated with each document URL. The PDF files are not modified, but annotations persist across browser sessions.

![Screenshot](screenshot.png)

The extension maintains all the functionality of the original Google Scholar PDF Reader:

- Preview references as you read. Click the in-text citation to see a summary and find the PDF.
- Read faster with the AI outline. Get a quick overview and click on interesting bullets to jump within the paper.
- Click in-text figure mentions to see the figure and the back button to keep reading.
- Make it right for your eyes with light, dark, and night modes.
- Copy and paste common citation formats without leaving the paper.
- Save articles to your Scholar Library to read or cite later.

The annotation functionality is implemented through separate modules without modifying the original extension's code.

## Installation

The extension works with all Chromium-based browsers, including Google Chrome, Microsoft Edge, and Brave.
Unfortunately, the original extension uses features unsupported by Firefox or Safari, so it cannot be installed on those browsers.

To install the extension, follow these steps:

1. Uninstall the original Google Scholar PDF Reader extension if you have it installed.
2. Download the latest release from [Releases](https://github.com/salcc/Scholar-PDF-Reader-with-Annotations/releases).
3. Extract the ZIP file to a folder on your computer.
4. Open the browser's extension management page:
   - Google Chrome: `chrome://extensions`
   - Microsoft Edge: `edge://extensions`
   - Brave: `brave://extensions`
   - Other Chromium-based browsers: check the browser's documentation for the extension management page.
5. Enable developer mode if it is not already enabled (usually a toggle switch in the top right corner).
6. Click "Load unpacked" and select the "extension" folder inside the extracted ZIP file.

The extension should now be installed and ready to use!

Note that the extension will not automatically update when new versions are released. To update the extension, download the latest release and repeat the installation steps. You can watch the GitHub repository to receive notifications of new releases.

## Planned Features

The following features are planned for future releases:

- Local annotation storage through direct PDF file modification.
- Drawing tools.
- Text comments.
- Annotation management interface for selective storage cleanup, annotation file import/export, and annotation transfer between PDF files.


## Implementation Questions

Q: Why there is no support for Firefox or Safari?
   A: The original extension uses the sandbox key in the manifest.json file, which is only supported by Chromium-based browsers. Firefox and Safari do not support this key, so the extension cannot be installed on those browsers. [[MDN](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_security_policy#browser_compatibility)]

Q: Why is the code of the original extension included in this one? Why not just make an extension that works with the original one?
   A: Browser extensions are sandboxed and cannot directly interact with each other.

If you find workarounds to these limitations, contributions are welcome!


## Support & Contributions

For bug reports and feature suggestions, please open an issue on GitHub. Feel free to also submit pull requests that enhance the extension.

## Disclaimer

This project is not affiliated with, supported, or endorsed by Google.
