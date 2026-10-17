# little html viewer

A small, mobile-first HTML viewer for GitHub Pages.

## Personalize

Change one line at the top of `app.js`:

```js
const HER_NAME = 'delilah';
```

The home screen shows `hi there delilah ❀` (with your chosen name).

## Deploy

1. Add all five files to the root of your GitHub repository.
2. Go to **Settings → Pages → Deploy from a branch**.
3. Select `main` and `/ (root)`, then save.

No dependencies, builds, or accounts required.

## Using it

Tap **upload html** to choose an `.html` or `.htm` file. Once the preview opens, the toolbar lets you choose another HTML file or enter/exit full screen. On iPhone Safari, full screen expands the preview to the available viewport; the browser's address bar may remain visible.

Files are read locally in your browser. The preview is isolated in a sandboxed iframe. Inline CSS and JS work; local linked assets next to the HTML file can't be automatically read through this single-file picker. Remote linked resources may still access the internet, so open files you trust. Theme toggle affects the viewer, not the uploaded page.
