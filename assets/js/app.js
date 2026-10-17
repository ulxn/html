const APP_VERSION = '1.4.1';
const HER_NAME = 'delilah'; // Change the nickname here.

const $ = id => document.getElementById(id);
const fileInput = $('fileInput');
const emptyState = $('emptyState');
const preview = $('preview');
const workspace = $('workspace');
const workspaceBar = $('workspaceBar');
const themeButton = $('themeButton');
const fullscreenButton = $('fullscreenButton');
const saveStatus = $('saveStatus');

$('emptyTitle').textContent = `hi there ${HER_NAME.trim() || 'sunshine'} ❀`;
$('version').textContent = `v${APP_VERSION}`;

function updateTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  themeButton.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} mode`);
  document.querySelector('meta[name="theme-color"]').content = dark ? '#141d2c' : '#f0f5fc';
}
updateTheme();
themeButton.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  updateTheme();
  try { localStorage.setItem('little-viewer-theme', theme); } catch { /* Storage may be restricted. */ }
});

const database = new Promise((resolve, reject) => {
  if (!('indexedDB' in window)) return reject(new Error('Storage unavailable'));
  const request = indexedDB.open('little-viewer-files', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('files');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
  request.onblocked = () => reject(new Error('Storage busy'));
});

async function readSaved(key) {
  const db = await database;
  return new Promise((resolve, reject) => {
    const request = db.transaction('files', 'readonly').objectStore('files').get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveFile(documentData) {
  const db = await database;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('files', 'readwrite');
    const store = transaction.objectStore('files');
    store.put(documentData, 'latest');
    store.delete('view-state');
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Storage aborted'));
  });
}

async function saveState(id, state) {
  const db = await database;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('files', 'readwrite');
    transaction.objectStore('files').put({ id, state }, 'view-state');
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Storage aborted'));
  });
}

function setSaveStatus(message, warning = false) {
  saveStatus.textContent = message;
  saveStatus.hidden = !message;
  saveStatus.classList.toggle('warning', warning);
}

let activeDocument = null;
let bridgeToken = '';
let fileRequest = 0;
let safelyStored = false;
let pendingState = null;
let stateTimer = null;
let stateWriting = Promise.resolve();
let fileWriting = Promise.resolve();

function injectBridge(html, state, token) {
  const boot = JSON.stringify({ token, state: state || null }).replace(/</g, '\\u003c');
  const script = `<script>window.__LITTLE_VIEWER_BOOT__=${boot};<\/script>` +
    `<script src="assets/js/bridge.js?v=${APP_VERSION}"><\/script>`;
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, match => match + script);
  if (/<html\b[^>]*>/i.test(html)) return html.replace(/<html\b[^>]*>/i, match => match + '<head>' + script + '</head>');
  return html.replace(/^(<!doctype[^>]*>)?/i, match => match + '<head>' + script + '</head>');
}

function showFile(name, html, state = null) {
  bridgeToken = crypto.randomUUID?.() || String(Date.now()) + Math.random();
  preview.srcdoc = injectBridge(html, state, bridgeToken);
  preview.hidden = false;
  emptyState.hidden = true;
  workspaceBar.hidden = false;
  $('fileName').textContent = name;
  $('fileName').title = name;
}

async function flushState() {
  if (!pendingState || !safelyStored || !activeDocument) return;
  const snapshot = pendingState;
  const id = activeDocument.id;
  pendingState = null;
  stateWriting = stateWriting.catch(() => {}).then(() => saveState(id, snapshot));
  try {
    await stateWriting;
    if (activeDocument?.id === id) setSaveStatus('saved');
  } catch {
    if (activeDocument?.id === id) setSaveStatus('not saved', true);
  }
}

function queueState(state) {
  pendingState = state;
  clearTimeout(stateTimer);
  stateTimer = setTimeout(flushState, 120);
}

window.addEventListener('message', event => {
  if (event.source !== preview.contentWindow) return;
  const data = event.data;
  if (data?.channel !== 'little-viewer-state' || data.token !== bridgeToken || !activeDocument) return;
  try {
    if (JSON.stringify(data.state).length > 96000) return;
    if (!data.state || typeof data.state !== 'object') return;
    queueState(data.state);
  } catch { /* Ignore malformed or oversized state. */ }
});

// Persist checkpoints before iOS suspends the tab where possible.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { clearTimeout(stateTimer); void flushState(); }
});
window.addEventListener('pagehide', () => { clearTimeout(stateTimer); void flushState(); });

// Old saved files from v1.3.0 have no id; they're still restorable.
Promise.all([readSaved('latest'), readSaved('view-state')]).then(([saved, checkpoint]) => {
  if (!saved?.name || typeof saved.html !== 'string' || fileRequest !== 0) return;
  activeDocument = { ...saved, id: saved.id || 'legacy' };
  safelyStored = true;
  const restored = checkpoint?.id === activeDocument.id ? checkpoint.state : null;
  showFile(saved.name, saved.html, restored);
  setSaveStatus('saved');
}).catch(() => { /* The viewer still works without IndexedDB. */ });

const chooseFile = () => fileInput.click();
$('uploadButton').addEventListener('click', chooseFile);
$('replaceButton').addEventListener('click', chooseFile);

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  fileInput.value = '';
  const request = ++fileRequest;

  if (!/\.html?$/i.test(file.name)) {
    showError('please choose an .html or .htm file.');
    return;
  }

  try {
    const html = await file.text();
    if (request !== fileRequest) return;
    clearTimeout(stateTimer);
    pendingState = null;
    safelyStored = false;
    const documentData = { id: crypto.randomUUID?.() || String(Date.now()) + Math.random(), name: file.name, html };
    activeDocument = documentData;
    showFile(file.name, html);
    setSaveStatus('saving…');
    try {
      await stateWriting.catch(() => {});
      fileWriting = fileWriting.catch(() => {}).then(() => saveFile(documentData));
      await fileWriting;
      if (request !== fileRequest) return;
      safelyStored = true;
      setSaveStatus('saved');
      if (pendingState) void flushState();
    } catch {
      if (request === fileRequest) setSaveStatus('not saved', true);
    }
  } catch {
    if (request === fileRequest) showError('this one wouldn’t open. mind trying another file?');
  }
});

function showError(message) {
  if (!preview.hidden) { setSaveStatus(message, true); return; }
  $('emptyTitle').textContent = 'oops, tiny hiccup.';
  $('emptyDescription').textContent = message;
}

function setExpanded(expanded) {
  workspace.classList.toggle('expanded', expanded);
  document.documentElement.classList.toggle('preview-expanded', expanded);
  fullscreenButton.setAttribute('aria-label', expanded ? 'Exit full screen' : 'Enter full screen');
  fullscreenButton.setAttribute('aria-pressed', String(expanded));
  fullscreenButton.title = expanded ? 'Exit full screen' : 'Full screen';
}
fullscreenButton.addEventListener('click', () => setExpanded(!workspace.classList.contains('expanded')));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && workspace.classList.contains('expanded')) setExpanded(false);
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', async () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      if (navigator.onLine) registration.update().catch(() => {});
      let refreshed = false;
      navigator.serviceWorker.addEventListener('controllerchange', async () => {
        if (hadController && !refreshed && (preview.hidden || safelyStored)) {
          refreshed = true;
          clearTimeout(stateTimer);
          await flushState();
          location.reload();
        }
      });
    } catch { /* Offline support is optional when service workers are blocked. */ }
  });
}
