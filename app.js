const fileInput = document.getElementById('fileInput');
const uploadButton = document.getElementById('uploadButton');
const themeButton = document.getElementById('themeButton');
const fileName = document.getElementById('fileName');
const emptyState = document.getElementById('emptyState');
const emptyTitle = document.getElementById('emptyTitle');
const emptyDescription = document.getElementById('emptyDescription');
const preview = document.getElementById('preview');

function updateThemeButton() {
  const isDark = document.documentElement.dataset.theme === 'dark';
  themeButton.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
  document.querySelector('meta[name="theme-color"]').content = isDark ? '#1c2520' : '#f3f5f0';
}

updateThemeButton();

themeButton.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  updateThemeButton();
  try { localStorage.setItem('html-viewer-theme', theme); } catch { /* Storage may be unavailable. */ }
});

uploadButton.addEventListener('click', () => fileInput.click());

let openRequest = 0;

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  fileInput.value = '';

  if (!/\.html?$/i.test(file.name)) {
    showError('Please choose an .html or .htm file.');
    return;
  }

  const request = ++openRequest;
  fileName.textContent = 'Opening…';
  try {
    const html = await file.text();
    if (request !== openRequest) return;
    preview.srcdoc = html;
    preview.hidden = false;
    emptyState.hidden = true;
    fileName.textContent = file.name;
    fileName.title = file.name;
  } catch {
    if (request !== openRequest) return;
    showError('This file could not be opened. Please try another.');
  }
});

function showError(message) {
  preview.hidden = true;
  preview.removeAttribute('srcdoc');
  fileName.textContent = 'Unable to preview';
  fileName.removeAttribute('title');
  emptyTitle.textContent = 'Could not open the file.';
  emptyDescription.textContent = message;
  emptyState.hidden = false;
}
