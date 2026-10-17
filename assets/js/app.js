const APP_VERSION = '1.3.0';
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

// One local copy of the most recently opened HTML file.
const database = new Promise((resolve, reject) => {
  if (!('indexedDB' in window)) return reject(new Error('Storage unavailable'));
  const request = indexedDB.open('little-viewer-files', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('files');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
  request.onblocked = () => reject(new Error('Storage busy'));
});

async function loadLastFile() {
  const db = await database;
  return new Promise((resolve, reject) => {
    const request = db.transaction('files', 'readonly').objectStore('files').get('latest');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveLastFile(name, html) {
  const db = await database;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('files', 'readwrite');
    transaction.objectStore('files').put({ name, html }, 'latest');
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

function showFile(name, html) {
  preview.srcdoc = html;
  preview.hidden = false;
  emptyState.hidden = true;
  workspaceBar.hidden = false;
  $('fileName').textContent = name;
  $('fileName').title = name;
}

let fileRequest = 0;
let safelyStored = false;

// Restoring from IndexedDB does not require picking the file again.
loadLastFile().then(saved => {
  if (saved?.name && typeof saved.html === 'string' && fileRequest === 0) {
    safelyStored = true;
    showFile(saved.name, saved.html);
    setSaveStatus('saved');
  }
}).catch(() => { /* The viewer still works when private storage is unavailable. */ });

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
    showFile(file.name, html);
    setSaveStatus('saving…');
    safelyStored = false;
    try {
      await saveLastFile(file.name, html);
      if (request !== fileRequest) return;
      safelyStored = true;
      setSaveStatus('saved');
    } catch {
      if (request === fileRequest) setSaveStatus('not saved', true);
    }
  } catch {
    if (request === fileRequest) showError('this one wouldn’t open. mind trying another file?');
  }
});

function showError(message) {
  // Keep an already opened file in view if a replacement fails.
  if (!preview.hidden) {
    setSaveStatus(message, true);
    return;
  }
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

// Use a viewport-filling layout instead of the native Fullscreen API,
// which shows a browser-controlled "press Esc to exit" message.
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
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Refresh on app updates, but not if an open file failed to save.
        if (hadController && !refreshed && (preview.hidden || safelyStored)) {
          refreshed = true;
          location.reload();
        }
      });
    } catch { /* Offline support is optional when service workers are blocked. */ }
  });
}
