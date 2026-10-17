// Replace 'delilah' with her name or nickname.
const HER_NAME = 'delilah';

const fileInput = document.getElementById('fileInput');
const uploadButton = document.getElementById('uploadButton');
const replaceButton = document.getElementById('replaceButton');
const themeButton = document.getElementById('themeButton');
const fullscreenButton = document.getElementById('fullscreenButton');
const workspace = document.getElementById('workspace');
const workspaceBar = document.getElementById('workspaceBar');
const fileName = document.getElementById('fileName');
const emptyState = document.getElementById('emptyState');
const emptyTitle = document.getElementById('emptyTitle');
const emptyDescription = document.getElementById('emptyDescription');
const preview = document.getElementById('preview');

emptyTitle.textContent = `hi there ${HER_NAME.trim() || 'sunshine'} ❀`;

function updateTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  themeButton.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} mode`);
  document.querySelector('meta[name="theme-color"]').content = dark ? '#1c2520' : '#f3f5f0';
}

updateTheme();
themeButton.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  updateTheme();
  try { localStorage.setItem('html-viewer-theme', theme); } catch { /* Storage may be unavailable. */ }
});

const chooseFile = () => fileInput.click();
uploadButton.addEventListener('click', chooseFile);
replaceButton.addEventListener('click', chooseFile);

let openRequest = 0;
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  fileInput.value = '';
  if (!/\.html?$/i.test(file.name)) {
    showError('please choose an .html or .htm file.');
    return;
  }

  const request = ++openRequest;
  try {
    const html = await file.text();
    if (request !== openRequest) return;
    preview.srcdoc = html;
    preview.hidden = false;
    emptyState.hidden = true;
    workspaceBar.hidden = false;
    fileName.textContent = file.name;
    fileName.title = file.name;
  } catch {
    if (request !== openRequest) return;
    showError('this one wouldn’t open. mind trying another file?');
  }
});

function showError(message) {
  preview.hidden = true;
  preview.removeAttribute('srcdoc');
  workspaceBar.hidden = true;
  setExpanded(false);
  emptyTitle.textContent = 'oops, tiny hiccup.';
  emptyDescription.textContent = message;
  emptyState.hidden = false;
}

function setExpanded(expanded) {
  workspace.classList.toggle('expanded', expanded);
  document.documentElement.classList.toggle('preview-expanded', expanded);
  fullscreenButton.setAttribute('aria-label', expanded ? 'Exit full screen' : 'Enter full screen');
  fullscreenButton.setAttribute('aria-pressed', String(expanded));
  fullscreenButton.title = expanded ? 'Exit full screen' : 'Full screen';
}

let usedNativeFullscreen = false;
fullscreenButton.addEventListener('click', async () => {
  if (workspace.classList.contains('expanded')) {
    if (document.fullscreenElement === workspace && document.exitFullscreen) {
      try { await document.exitFullscreen(); } catch { /* CSS fallback still exits. */ }
    }
    usedNativeFullscreen = false;
    setExpanded(false);
    return;
  }

  setExpanded(true);
  if (workspace.requestFullscreen) {
    try {
      await workspace.requestFullscreen();
      usedNativeFullscreen = true;
    } catch { /* iPhone Safari uses the full-viewport CSS fallback. */ }
  }
});

document.addEventListener('fullscreenchange', () => {
  if (usedNativeFullscreen && document.fullscreenElement !== workspace) {
    usedNativeFullscreen = false;
    setExpanded(false);
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && workspace.classList.contains('expanded')) {
    if (document.fullscreenElement === workspace) document.exitFullscreen?.();
    usedNativeFullscreen = false;
    setExpanded(false);
  }
});
