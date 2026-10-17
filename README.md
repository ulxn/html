# HTML Viewer

A tiny, mobile-friendly HTML file viewer for GitHub Pages.

Open a local `.html` or `.htm` file to preview its markup, styles, and scripts. The viewer reads files in your browser. The preview runs in a sandboxed iframe, separate from the viewer itself.

## Deploy

1. Upload the files in this folder to the root of a GitHub repository.
2. Under **Settings > Pages**, select **Deploy from a branch**, then choose `main` and `/ (root)`.
3. Open the GitHub Pages URL on your iPhone and tap **Open HTML**.

No install, build step, framework, or external dependencies.

## Notes

- CSS and JavaScript embedded in the HTML file work. Relative references to local files alongside the selected HTML file are not available through the browser's single-file picker.
- Remote images, stylesheets, scripts, and other resources may request internet access. Preview only HTML you trust.
- The iframe intentionally omits same-origin access. Some scripts that require local storage, cookies, or unrestricted browser permissions may not work.
- Dark/light mode changes the viewer interface, not the opened document.
