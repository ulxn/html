# little viewer

A tiny, private HTML viewer for iPhone and desktop. No framework, build step, uploads to a server, or external dependencies.

## Deploy

Upload the files **inside** this directory to your GitHub repository root. In GitHub **Settings → Pages**, select **Deploy from a branch → main → / (root)**.

The app shell is cached after the first online visit, so the viewer works offline. When online it fetches current files instead of relying on an old cache. A new service worker updates its cache when a new version is deployed; CDN propagation can still take time.

## Saved files

The most recently opened HTML document and filename are saved locally in **IndexedDB**. Refreshing, reopening the site, and going offline keep the last document available on the **same browser and device**, as long as the browser retains its site data. Opening a new HTML file replaces the previous saved document. The toolbar displays **saved** after storage succeeds or **not saved** if storage was blocked/full. Clearing Safari website data, private browsing, or automatic storage eviction can remove the file. To keep a permanent copy, also keep the original `.html` file.

Embedded JavaScript is allowed inside a sandboxed iframe with no same-origin permission. Runtime changes or scroll position *inside* an HTML page are not persisted; only the imported HTML source is saved. Additional local images/CSS/JS next to the imported document are not included by the single-file picker. Linked remote resources can use the network, so preview trusted HTML files only.

Fullscreen is a viewport-filling layout with an exit button, not the browser Fullscreen API. This avoids native browser exit tips, but mobile browser navigation bars can remain visible.

## Customize

Change `HER_NAME` and `APP_VERSION` in `assets/js/app.js`. Edit website copy/metadata in `index.html`. The WhatsApp share thumbnail lives **only** in `assets/images/thumbnail.jpg`, and isn't loaded in the viewer canvas. For reliable social previews, use an absolute HTTPS URL for `og:image` and `twitter:image` on the deployed domain.

When publishing a new version, change:
- `APP_VERSION` in `assets/js/app.js`;
- versioned CSS/JS links and the footer fallback in `index.html`;
- cache name and precache paths in `sw.js`.

For offline testing, first visit the deployed HTTPS page online and allow its service worker to install, then test without network. Offline support does not run from a local `file://` URL.
