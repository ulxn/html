# little viewer

A tiny, offline-ready HTML file viewer for GitHub Pages. Vanilla HTML/CSS/JS, no framework, no build tools, no analytics, and no server-side file uploads.

## What changed in v1.6.1

The public HTML library from v1.5.0 is removed. Each browser tab now opens its **own local HTML file**:

- **Tab A** can upload `quiz-a.html`; **Tab B** can upload `quiz-b.html`.
- **Refresh the same tab:** its HTML file and compatible quiz progress return.
- **Close the tab and open a new one:** the new tab starts on the welcome/upload screen.
- **Duplicate an existing tab:** a `BroadcastChannel` check tries to give the duplicate a fresh session, instead of sharing the original's file.

The page uses `sessionStorage` for that tab's identity and progress. The HTML file itself is stored in IndexedDB under the tab's identity, because HTML can be larger than `sessionStorage` limits. Old IndexedDB records can persist after a tab closes, but **new tabs don't restore them**. Browsers can sometimes restore a previously closed tab and its session data; in that case, its progress may also return. Completely clearing Safari website data removes saved files. Safari may evict them when storage is low.

**When updating from v1.4.x or v1.5.0**, re-upload the HTML file in each tab once. The older global `latest` record is intentionally not restored so separate tabs can't accidentally overwrite each other.

## Deploy

Publish the contents of this ZIP to the site at `https://ulxn.github.io/html/` (do not nest an additional folder inside the deployed `/html/` path). Keep `index.html`, `sw.js`, `manifest.webmanifest`, `.gitignore`, and `README.md` at the deployment root. All assets are in `assets/`.

- The `< >` logo and favicon are unchanged.
- Pastel-blue light/dark mode and fullscreen are preserved.
- The WhatsApp metadata remains from v1.5.0: title **little viewer**, description **here's little html viewer made exclusively just for you.**, and a light JPEG preview at `assets/images/thumbnail-share-v1.5.0.jpg` (not displayed in the app).
- Change the greeting with `HER_NAME` at the top of `assets/js/app.js`.
- Footer displays **v1.6.1**.

## Quiz-state compatibility

**New in v1.6.1:** The bridge now understands quizzes using `#options-container`, `#quick-nav`, and `#badge-num` (including both provided TPA quizzes). It saves **the selected answers, active question, category filter, and instant-answer mode** on each action and restores them after refresh. Original quiz files do not need edits. This is not a generic snapshot of every JavaScript application; quizzes with different markup or internal state may still need custom integration. Progress never saved in previous versions cannot be recovered.

For reliable resume of a quiz you can edit, have it explicitly save progress using the injected API:

```js
const saved = window.littleViewer?.load();
if (saved) {
  currentQuestion = saved.currentQuestion;
  answers = saved.answers;
  renderQuestion();
}
// Call whenever a question/answer changes:
window.littleViewer?.save({ currentQuestion, answers });
```

The quiz runs in a sandboxed iframe. It cannot access the parent app's storage directly. Imported HTML with external assets may need connectivity, and its dependencies aren't automatically bundled by the viewer. Open only trusted HTML files.

## Offline and updates

The app shell is cached after the first online visit. Uploaded inline HTML files are available offline in the same tab after they have been saved. Online requests use a network-first service worker and cache fallback. Reload when the new release is live to activate the service worker. Site storage may be removed by the browser.

This project was checked with JavaScript syntax validation and simulated multi-tab/reload cases; a full iPhone Safari run and live PageSpeed audit have **not** been performed. A perfect PageSpeed score can't be guaranteed before testing the deployed URL.

### Quiz files with external dependencies

Both provided examples load Tailwind from cdn.tailwindcss.com, icons from cdnjs, and a Google font. Their *content and progress* can be stored in the tab, but external CSS/fonts/scripts may not load without internet. This does not prevent the viewer's offline shell from working.

### Testing

Syntax and browser tests of the two original HTML files are included in the release QA (reload with answer and active question, tab isolation). Real iPhone Safari behavior and PageSpeed 100 require device/live verification.
