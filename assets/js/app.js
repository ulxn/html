const APP_VERSION = '1.6.2';
const HER_NAME = 'delilah'; // Change her nickname here.

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
  try { localStorage.setItem('little-viewer-theme', theme); } catch { /* Optional preference. */ }
});

// Safari can discard a background tab and reload it without its sessionStorage.
// Keep independent copies of this tab's identity in its history entry and
// browsing-context name. A genuinely new tab still starts with a new ID.
const TAB_KEY = 'little-viewer-tab-v160';
const STATE_KEY = 'little-viewer-checkpoint-v160';
const HISTORY_KEY = '__littleViewerTab';
const WINDOW_PREFIX = 'little-viewer-tab:';
const randomId = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const validId = id => typeof id === 'string' && /^[\w-]{8,90}$/.test(id);
const instanceId = randomId();
let storedTab = null;
try { storedTab = sessionStorage.getItem(TAB_KEY); } catch { /* Session may be unavailable. */ }
let historyTab = null;
try { historyTab = history.state?.[HISTORY_KEY]; } catch { /* No history state. */ }
let namedTab = null;
try {
  if (window.name.startsWith(WINDOW_PREFIX)) namedTab = window.name.slice(WINDOW_PREFIX.length);
} catch { /* Browsing context name is optional. */ }
let tabId = [storedTab, historyTab, namedTab].find(validId) || randomId();
let identityAvailable = false;
function rememberTabId() {
  try { sessionStorage.setItem(TAB_KEY, tabId); identityAvailable = true; } catch { /* Optional. */ }
  try {
    const state = history.state && typeof history.state === 'object' ? history.state : {};
    history.replaceState({ ...state, [HISTORY_KEY]: tabId }, '');
    identityAvailable = true;
  } catch { /* Optional. */ }
  try { window.name = WINDOW_PREFIX + tabId; identityAvailable = true; } catch { /* Optional. */ }
}
rememberTabId();

// Duplicating a tab may clone sessionStorage. Detect another live tab with this
// identifier and fork the new tab before restoring its saved HTML.
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('little-viewer-tabs-v160') : null;
let forked = false;
let initialized = false;
if (channel) {
  channel.addEventListener('message', event => {
    const data = event.data;
    if (!data || data.instanceId === instanceId) return;
    if (data.type === 'probe' && data.tabId === tabId) {
      channel.postMessage({ type: 'occupied', tabId, target: data.instanceId, instanceId });
    } else if (data.type === 'occupied' && data.target === instanceId && data.tabId === tabId && !initialized) {
      tabId = randomId();
      forked = true;
      rememberTabId();
      try { sessionStorage.removeItem(STATE_KEY); } catch { /* Optional. */ }
    }
  });
  channel.postMessage({ type: 'probe', tabId, instanceId });
}

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
async function writeFile(data) {
  const db = await database;
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put(data, `tab:${tabId}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Save interrupted'));
  });
}

function setSaveStatus(message, warning = false) {
  saveStatus.textContent = message;
  saveStatus.hidden = !message;
  saveStatus.classList.toggle('warning', warning);
}

// Keep a durable per-tab checkpoint alongside the original uploaded HTML.
// sessionStorage remains the fastest path, while IndexedDB survives typical
// Safari background eviction even when sessionStorage does not.
function flushCheckpoint() {
  clearTimeout(checkpointTimer);
  checkpointTimer = 0;
  if (!activeDocument?.checkpoint) return;
  const snapshot = { ...activeDocument };
  saveWriting = saveWriting.catch(() => {}).then(() => writeFile(snapshot));
  saveWriting.catch(() => setSaveStatus('couldn’t save progress', true));
}
function queueCheckpoint() {
  clearTimeout(checkpointTimer);
  checkpointTimer = setTimeout(flushCheckpoint, 150);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && checkpointTimer) flushCheckpoint();
});
window.addEventListener('pagehide', () => {
  if (checkpointTimer) flushCheckpoint();
});

async function showRecoverOption() {
  if (activeDocument || fileRequest || !recoverButton) return;
  try {
    const db = await database;
    const records = await new Promise((resolve, reject) => {
      const req = db.transaction('files', 'readonly').objectStore('files').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const latest = records.filter(r => r?.name && typeof r.html === 'string')
      .sort((a, b) => (b.lastActiveAt || b.savedAt || 0) - (a.lastActiveAt || a.savedAt || 0))[0];
    if (!latest || activeDocument || fileRequest) return;
    recoverButton.hidden = false;
    recoverButton.textContent = `restore ${latest.name}`;
    recoverButton.title = `Recover ${latest.name} and its saved progress`;
    recoverButton.addEventListener('click', async () => {
      // Clone into this tab's unique key so recovery never overwrites another tab.
      if (activeDocument) return;
      const recovered = { ...latest, id: randomId(), savedAt: Date.now() };
      activeDocument = recovered;
      clearCheckpoint();
      showFile(recovered.name, recovered.html, recovered.checkpoint || null);
      recoverButton.hidden = true;
      setSaveStatus('saving…');
      try {
        saveWriting = saveWriting.catch(() => {}).then(() => writeFile(recovered));
        await saveWriting;
        stored = true;
        setSaveStatus('saved in this tab');
      } catch { setSaveStatus('refresh may not restore this file', true); }
    }, { once: true });
  } catch { /* No recoverable file, or storage is unavailable. */ }
}

let activeDocument = null;
let bridgeToken = '';
let fileRequest = 0;
let saveWriting = Promise.resolve();
let stored = false;
let checkpointTimer = 0;
const recoverButton = $('recoverButton');

function injectBridge(html, state, token) {
  const boot = JSON.stringify({ token, state: state || null }).replace(/</g, '\\u003c');
  const script = `<script>window.__LITTLE_VIEWER_BOOT__=${boot};<\/script>` +
    `<script src="assets/js/bridge.js?v=${APP_VERSION}"><\/script>`;
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, match => match + script);
  if (/<html\b[^>]*>/i.test(html)) return html.replace(/<html\b[^>]*>/i, match => match + '<head>' + script + '</head>');
  return html.replace(/^(<!doctype[^>]*>)?/i, match => match + '<head>' + script + '</head>');
}
function showFile(name, html, state = null) {
  bridgeToken = randomId();
  preview.srcdoc = injectBridge(html, state, bridgeToken);
  preview.hidden = false;
  emptyState.hidden = true;
  workspaceBar.hidden = false;
  $('fileName').textContent = name;
  $('fileName').title = name;
}

function readCheckpoint(id) {
  try {
    const value = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null');
    if (value?.id === id && value.state && typeof value.state === 'object') return value.state;
  } catch { /* No saved state. */ }
  return null;
}
function clearCheckpoint() {
  try { sessionStorage.removeItem(STATE_KEY); } catch { /* Not available. */ }
}

// The iframe is intentionally sandboxed: it cannot access this storage directly.
window.addEventListener('message', event => {
  if (event.source !== preview.contentWindow || !activeDocument) return;
  const data = event.data;
  if (data?.channel !== 'little-viewer-state' || data.token !== bridgeToken) return;
  try {
    if (!data.state || typeof data.state !== 'object') return;
    const payload = JSON.stringify({ id: activeDocument.id, state: data.state });
    if (payload.length > 96000) return;
    activeDocument.checkpoint = data.state;
    activeDocument.lastActiveAt = Date.now();
    try { sessionStorage.setItem(STATE_KEY, payload); } catch { /* IndexedDB still saves. */ }
    queueCheckpoint();
  } catch { /* Ignore oversized or non-serializable state. */ }
});

// Unlike the old global "latest" record, only this tab's key is restored.
// Wait briefly for another active tab to reject a copied session id.
setTimeout(async () => {
  initialized = true;
  if (forked || fileRequest) { if (forked) showRecoverOption(); return; }
  try {
    const data = identityAvailable ? await readSaved(`tab:${tabId}`) : null;
    if (!data?.name || typeof data.html !== 'string' || fileRequest) {
      showRecoverOption();
      return;
    }
    activeDocument = data;
    stored = true;
    showFile(data.name, data.html, readCheckpoint(data.id) || data.checkpoint || null);
    setSaveStatus('saved in this tab');
  } catch { showRecoverOption(); }
}, 220);

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
    clearCheckpoint();
    clearTimeout(checkpointTimer);
    recoverButton.hidden = true;
    stored = false;
    const data = { id: randomId(), name: file.name, html, savedAt: Date.now() };
    activeDocument = data;
    showFile(file.name, html);
    setSaveStatus('saving…');
    try {
      // Serialize writes within one tab. Distinct tabs use separate DB keys.
      saveWriting = saveWriting.catch(() => {}).then(() => writeFile(data));
      await saveWriting;
      if (request === fileRequest && activeDocument?.id === data.id) {
        stored = true;
        if (activeDocument.checkpoint) queueCheckpoint();
        setSaveStatus('saved in this tab');
      }
    } catch {
      if (request === fileRequest) setSaveStatus('refresh won’t restore this file', true);
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
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      if (navigator.onLine) registration.update().catch(() => {});
      // Never force-reload an open quiz when a newer service worker activates.
      // Network-first navigation loads updates on the user's next visit/reload.
    } catch { /* Offline support is best effort. */ }
  });
}
