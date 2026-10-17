# little viewer

A tiny offline-ready HTML viewer. No framework, build step, analytics, external fonts, or server uploads.

## Deploy

Put the contents of the ZIP at your GitHub repo root. In **Settings → Pages**, choose **Deploy from a branch → main → / (root)**. Open the deployed HTTPS page online once to install its offline cache.

## Resume after refresh

Little Viewer stores the last imported HTML file and its progress locally in **IndexedDB** in the same browser.

- Quizzes that use `localStorage` or `sessionStorage` can restore their own progress using a sandbox-compatible storage bridge.
- Simple quizzes with **Next / Back / Start** buttons can often restore their last question by replaying saved navigation and answer selections.
- It also remembers ordinary form fields and the page's scroll position where possible.

This is **best effort**, not universal. Arbitrary JavaScript variables, custom SPA/router state, dynamically generated content, games, timed tests, remote data, page redirects, and some complex quiz widgets cannot be reconstructed reliably. Replay may also rerun a quiz's own button handlers. For full reliability, add persistence to the quiz itself (see below). Imported files are still isolated in a `sandbox="allow-scripts"` iframe without same-origin access.

### Reliable custom quiz state (optional)

When editing the imported quiz's code, save its state whenever the active question or answers change, then restore it on startup:

```js
const saved = window.littleViewer?.load();
if (saved) {
  currentQuestion = saved.currentQuestion;
  answers = saved.answers;
  renderQuestion();
}

// Call after each quiz state change.
window.littleViewer?.save({ currentQuestion, answers });
```

This opt-in hook is helpful for quizzes that store progress only in JavaScript variables. It stores JSON-serializable data, capped at 32 KB.

## Privacy & limitations

All saved HTML and progress remain in local browser storage. They aren't synced between devices or browser profiles. Browsing in private mode, clearing website data, or iOS storage eviction can erase saved progress. Keep the original HTML file as a backup. HTML files can still load external URLs if the file's own code asks for them; open only trusted HTML. Sidecar CSS/JS/images next to an imported HTML file are not imported by the single-file picker.

Fullscreen fills the page's viewport (no native browser tip). iPhone Safari's own toolbars may remain visible.

## Customize / versioning

- Rename the greeting via `HER_NAME` in `assets/js/app.js`.
- The WhatsApp-only share preview is `assets/images/thumbnail-share-v1.4.1.jpg`. For reliable previews, use a full HTTPS URL in `og:image` / `twitter:image` on the deployed domain.
- On each release, update `APP_VERSION` in `app.js`, `?v=` in `index.html`, footer fallback, and the cache name + assets in `sw.js`. Updated assets are fetched network-first while online and cached for offline use.

Current version: **1.4.1**.

## WhatsApp link preview

The share image is `assets/images/thumbnail-share-v1.4.1.jpg` (JPEG, 1200×630, about 55 KB). It is **not loaded by the viewer page**, only by chat/social crawlers.

The first 3 lines of `index.html` enable GitHub Pages' default Jekyll build (no JS runtime overhead). On a **Deploy from branch** GitHub Pages site, the `{{ site.github.url }}` template renders to the site's **absolute public HTTPS URL**, so `og:image`, `og:image:secure_url`, `og:url`, and `twitter:image` are crawlable on project pages and custom domains.

**Important:** Keep those three front-matter lines, and do **not** add a `.nojekyll` file. If you use a GitHub Actions or another host that serves `index.html` without Jekyll processing, replace each `{{ site.github.url | replace: 'http://', 'https://' }}` with your real published base URL including the project path (without a trailing slash). No browser-side JavaScript can fix social metadata for crawlers.

After publishing, visit the image's public URL directly and check the **View source** of the live page: `og:image` must be a complete `https://...jpg` URL, not contain `{{ ... }}`. Share your *published GitHub Pages URL* rather than your `github.com` repository link. WhatsApp may cache an old unfurl; testing with a new image filename and a fresh link can help.

