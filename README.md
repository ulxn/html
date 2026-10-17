# little viewer

A tiny offline-ready HTML viewer. No framework, build step, analytics, external fonts, or server uploads.

## Deploy

Deploy the files so they are publicly served at **`https://ulxn.github.io/html/`**. If your repository is `ulxn.github.io`, copy all files into its `/html/` directory. If your repository is a separate project named `html`, copy files into that repository’s root. In **Settings → Pages**, use your existing deployment setup. Open the deployed HTTPS page online once to install its offline cache.

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
- The WhatsApp-only share preview is `assets/images/thumbnail-share-v1.4.2.jpg`, referenced by full HTTPS URL in the HTML metadata.
- On each release, update `APP_VERSION` in `app.js`, `?v=` in `index.html`, footer fallback, and the cache name + assets in `sw.js`. Updated assets are fetched network-first while online and cached for offline use.

Current version: **1.4.2**.

## WhatsApp link preview

The WhatsApp thumbnail is a **baseline JPEG, 1200×630 px, under 100 KB**, at `assets/images/thumbnail-share-v1.4.2.jpg`. It is never used as the app's background or loaded in the viewer UI.

Social crawlers need **actual absolute URLs in the HTML source**. `index.html` now explicitly contains:

```
<meta property="og:url" content="https://ulxn.github.io/html/">
<meta property="og:image" content="https://ulxn.github.io/html/assets/images/thumbnail-share-v1.4.2.jpg">
```

The same URL is set for `og:image:secure_url` and `twitter:image`. No Jekyll processing is required; deploy normally, including GitHub Pages from a branch or Actions.

**Deployment for this project:** place these files at the public `/html/` directory of the site, so the homepage is `https://ulxn.github.io/html/`. If the site's public URL changes later, update the OG absolute URLs too.

After publishing, check that opening `https://ulxn.github.io/html/assets/images/thumbnail-share-v1.4.2.jpg` directly displays the image. Then share `https://ulxn.github.io/html/?v=142` once to nudge WhatsApp to fetch a fresh preview if it previously cached the URL. A preview depends on WhatsApp's crawler and link-preview settings, so it cannot be guaranteed even with correct metadata.

---

**Release:** v1.4.2 · OG URL + baseline JPEG + SW cache-busting only. Quiz progress and local saved files remain compatible with v1.4.1.
