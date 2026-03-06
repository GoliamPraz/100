const STORAGE_KEY = 'playground_files_v1';
const THEME_STORAGE_KEY = 'playground_theme_v1';
const AUTOCOMPLETE_STORAGE_KEY = 'playground_autocomplete_v1';
const ACTIVE_FILE_STORAGE_KEY = 'playground_active_file_v1';
const PROJECTS_STORAGE_KEY = 'playground_projects_v1';
const ACTIVE_PROJECT_STORAGE_KEY = 'playground_active_project_v1';

const defaultFiles = [
  {
    name: 'index.html',
    type: 'html',
    content: `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Canvas Demo</title>
</head>
<body>
  <h1>Canvas Пример: Анимирана топка</h1>
  <p>Кликни върху канваса, за да пуснеш или спреш топката.</p>
  <canvas id="scene" width="720" height="400" aria-label="Canvas demo"></canvas>
</body>
</html>`
  },
  {
    name: 'style.css',
    type: 'css',
    content: `* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  font-family: "Segoe UI", Tahoma, sans-serif;
  background: radial-gradient(circle at top, #fef3c7, #e0f2fe 45%, #c7d2fe);
  color: #0f172a;
  display: grid;
  place-items: center;
  padding: 16px;
}

h1 {
  margin: 0 0 8px;
  font-size: clamp(22px, 4vw, 36px);
}

p {
  margin: 0 0 14px;
}

canvas {
  width: min(92vw, 720px);
  height: auto;
  display: block;
  border: 2px solid #0f172a;
  border-radius: 14px;
  background: #ffffffb0;
  box-shadow: 0 10px 35px rgba(15, 23, 42, 0.2);
}`
  },
  {
    name: 'app.js',
    type: 'js',
    content: `const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');

if (!ctx) {
  throw new Error('Canvas 2D context is not supported.');
}

const ball = {
  x: 120,
  y: 90,
  vx: 3.2,
  vy: 2.6,
  r: 18
};

let hue = 210;
let isRunning = true;

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#dbeafe');
  gradient.addColorStop(1, '#bfdbfe');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.08)';
  for (let i = 0; i < canvas.width; i += 40) {
    ctx.fillRect(i, 0, 1, canvas.height);
  }
}

function drawBall() {
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fillStyle = 'hsl(' + hue + ', 85%, 45%)';
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function updateBall() {
  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.x - ball.r <= 0 || ball.x + ball.r >= canvas.width) {
    ball.vx *= -1;
    hue = (hue + 35) % 360;
  }

  if (ball.y - ball.r <= 0 || ball.y + ball.r >= canvas.height) {
    ball.vy *= -1;
    hue = (hue + 35) % 360;
  }
}

function frame() {
  drawBackground();
  if (isRunning) {
    updateBall();
  }
  drawBall();
  requestAnimationFrame(frame);
}

canvas.addEventListener('click', () => {
  isRunning = !isRunning;
});

frame();`
  }
];

const previewFrame = document.getElementById('preview');
const runBtn = document.getElementById('runBtn');
const resetBtn = document.getElementById('resetBtn');
const themeToggle = document.getElementById('themeToggle');
const autocompleteToggle = document.getElementById('autocompleteToggle');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const newFileBtn = document.getElementById('newFileBtn');
const deleteFileBtn = document.getElementById('deleteFileBtn');
const fileList = document.getElementById('fileList');
const activeFileLabel = document.getElementById('activeFileLabel');
const projectSelect = document.getElementById('projectSelect');
const openProjectBtn = document.getElementById('openProjectBtn');
const saveProjectBtn = document.getElementById('saveProjectBtn');
const saveAsProjectBtn = document.getElementById('saveAsProjectBtn');

const layout = document.querySelector('.layout');
const leftPanel = document.querySelector('.left');
const splitter = document.getElementById('splitter');
const topbar = document.querySelector('.topbar');

const fallbackEditorsWrap = document.getElementById('fallbackEditors');
const fallbackEditor = document.getElementById('fallbackEditor');

let monacoEditorInstance = null;
let monacoModels = new Map();
let debounceId = null;
let currentTheme = 'light';
let autocompleteEnabled = true;
let previewObjectUrls = [];
let resetConfirmTimer = null;
let projects = [];
let currentProjectId = '';
let immersiveMode = false;

let files = [];
let activeFileName = 'index.html';

function cloneDefaultFiles() {
  return defaultFiles.map((file) => ({ ...file }));
}

function cloneFilesState(sourceFiles) {
  return sourceFiles.map((file) => ({
    name: file.name,
    type: file.type,
    content: file.content
  }));
}

function makeProjectId() {
  return `project_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeProjectName(name) {
  const value = typeof name === 'string' ? name.trim() : '';
  return value || 'Project';
}

function extensionToType(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.html')) return 'html';
  if (lower.endsWith('.css')) return 'css';
  if (lower.endsWith('.js')) return 'js';
  return null;
}

function toMonacoLanguage(type) {
  if (type === 'html') return 'html';
  if (type === 'css') return 'css';
  return 'javascript';
}

function loadFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return cloneDefaultFiles();

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return cloneDefaultFiles();
    const valid = parsed
      .map((item) => ({
        name: typeof item.name === 'string' ? item.name.trim() : '',
        type: extensionToType(typeof item.name === 'string' ? item.name : ''),
        content: typeof item.content === 'string' ? item.content : ''
      }))
      .filter((item) => item.name && item.type);
    return valid.length ? valid : cloneDefaultFiles();
  } catch {
    return cloneDefaultFiles();
  }
}

function loadProjectsFromStorage() {
  const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((project) => {
        const loadedFiles = Array.isArray(project.files)
          ? project.files
            .map((file) => ({
              name: typeof file.name === 'string' ? file.name.trim() : '',
              type: extensionToType(typeof file.name === 'string' ? file.name : ''),
              content: typeof file.content === 'string' ? file.content : ''
            }))
            .filter((file) => file.name && file.type)
          : [];

        if (!loadedFiles.length) return null;

        const safeActive = typeof project.activeFileName === 'string' && loadedFiles.some((file) => file.name === project.activeFileName)
          ? project.activeFileName
          : loadedFiles[0].name;

        return {
          id: typeof project.id === 'string' && project.id ? project.id : makeProjectId(),
          name: normalizeProjectName(project.name),
          files: loadedFiles,
          activeFileName: safeActive,
          updatedAt: typeof project.updatedAt === 'number' ? project.updatedAt : Date.now()
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function persistProjectsToStorage() {
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, currentProjectId);
}

function getCurrentProject() {
  return projects.find((project) => project.id === currentProjectId) || null;
}

function persistCurrentProjectFromState() {
  const current = getCurrentProject();
  if (!current) return;
  current.files = cloneFilesState(files);
  current.activeFileName = activeFileName;
  current.updatedAt = Date.now();
  persistProjectsToStorage();
}

function renderProjectList() {
  if (!projectSelect) return;
  projectSelect.innerHTML = '';

  projects.forEach((project) => {
    const option = document.createElement('option');
    option.value = project.id;
    option.textContent = project.name;
    if (project.id === currentProjectId) option.selected = true;
    projectSelect.appendChild(option);
  });
}

function initProjectsState() {
  const legacyFiles = loadFromStorage();
  projects = loadProjectsFromStorage();

  if (!projects.length) {
    projects = [{
      id: makeProjectId(),
      name: 'Project 1',
      files: cloneFilesState(legacyFiles),
      activeFileName: legacyFiles[0]?.name || 'index.html',
      updatedAt: Date.now()
    }];
  }

  const savedProjectId = localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
  currentProjectId = projects.some((project) => project.id === savedProjectId)
    ? savedProjectId
    : projects[0].id;

  const current = getCurrentProject();
  files = cloneFilesState(current ? current.files : cloneDefaultFiles());
  activeFileName = current?.activeFileName && files.some((file) => file.name === current.activeFileName)
    ? current.activeFileName
    : (files[0]?.name || 'index.html');

  renderProjectList();
  persistProjectsToStorage();
}

function openSelectedProject() {
  if (!projectSelect) return;

  saveCurrentEditorIntoState();
  persistCurrentProjectFromState();

  const targetId = projectSelect.value;
  const target = projects.find((project) => project.id === targetId);
  if (!target) return;

  currentProjectId = target.id;
  files = cloneFilesState(target.files);
  activeFileName = target.activeFileName && files.some((file) => file.name === target.activeFileName)
    ? target.activeFileName
    : files[0].name;

  if (monacoEditorInstance) {
    rebuildMonacoModels();
  }

  renderProjectList();
  renderFileList();
  selectFile(activeFileName);
  saveToStorage();
}

function saveCurrentProject() {
  saveToStorage();
  renderProjectList();
}

function saveCurrentProjectAs() {
  const suggestedName = `${getCurrentProject()?.name || 'Project'} Copy`;
  const inputName = prompt('Име на нов проект', suggestedName);
  if (!inputName) return;

  const projectName = normalizeProjectName(inputName);
  saveCurrentEditorIntoState();

  const created = {
    id: makeProjectId(),
    name: projectName,
    files: cloneFilesState(files),
    activeFileName,
    updatedAt: Date.now()
  };

  projects.push(created);
  currentProjectId = created.id;

  renderProjectList();
  saveToStorage();
}

function applyTheme(theme, save = true) {
  currentTheme = theme === 'dark' ? 'dark' : 'light';
  document.body.classList.toggle('dark-theme', currentTheme === 'dark');

  themeToggle.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
  themeToggle.title = currentTheme === 'dark' ? 'Светла тема' : 'Тъмна тема';

  if (window.monaco) {
    monaco.editor.setTheme(currentTheme === 'dark' ? 'vs-dark' : 'vs');
  }

  if (save) {
    localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  applyTheme(savedTheme === 'dark' ? 'dark' : 'light', false);
}

function updateAutocompleteButton() {
  autocompleteToggle.textContent = autocompleteEnabled ? 'AutoComplete ON' : 'AutoComplete OFF';
  autocompleteToggle.classList.toggle('toggle-off', !autocompleteEnabled);

  if (monacoEditorInstance) {
    monacoEditorInstance.updateOptions({
      quickSuggestions: autocompleteEnabled,
      suggestOnTriggerCharacters: autocompleteEnabled,
      wordBasedSuggestions: autocompleteEnabled ? 'currentDocument' : 'off'
    });
  }
}

function initAutocompleteToggle() {
  const saved = localStorage.getItem(AUTOCOMPLETE_STORAGE_KEY);
  autocompleteEnabled = saved !== 'off';
  updateAutocompleteButton();
}

function getActiveFile() {
  return files.find((file) => file.name === activeFileName) || null;
}

function saveCurrentEditorIntoState() {
  const active = getActiveFile();
  if (!active) return;

  if (monacoEditorInstance) {
    const model = monacoModels.get(active.name);
    if (model) active.content = model.getValue();
  } else {
    active.content = fallbackEditor.value;
  }
}

function saveToStorage() {
  saveCurrentEditorIntoState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  localStorage.setItem(ACTIVE_FILE_STORAGE_KEY, activeFileName);
  persistCurrentProjectFromState();
}

function renderFileList() {
  fileList.innerHTML = '';
  files.forEach((file) => {
    const li = document.createElement('li');
    li.textContent = file.name;
    li.classList.toggle('active', file.name === activeFileName);
    li.addEventListener('click', () => {
      if (file.name !== activeFileName) {
        selectFile(file.name);
      }
    });
    fileList.appendChild(li);
  });
}

function selectFile(fileName) {
  saveCurrentEditorIntoState();

  activeFileName = fileName;
  const active = getActiveFile();
  if (!active) return;

  activeFileLabel.textContent = active.name;

  if (monacoEditorInstance) {
    const model = monacoModels.get(active.name);
    if (model) {
      monacoEditorInstance.setModel(model);
      monacoEditorInstance.focus();
    }
  } else {
    fallbackEditor.value = active.content;
  }

  renderFileList();
  runPreview();
  saveToStorage();
}

function clearPreviewObjectUrls() {
  previewObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  previewObjectUrls = [];
}

function createPreviewFileUrlMap() {
  clearPreviewObjectUrls();

  const urlMap = new Map();
  files.forEach((file) => {
    if (file.type !== 'js' && file.type !== 'css') return;
    const mimeType = file.type === 'js' ? 'text/javascript' : 'text/css';
    const blob = new Blob([file.content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    urlMap.set(file.name.toLowerCase(), url);
    previewObjectUrls.push(url);
  });

  return urlMap;
}

function extractReferencedFiles(htmlCode) {
  const referenced = {
    js: new Set(),
    css: new Set()
  };

  if (!htmlCode) return referenced;

  const scriptSrcRegex = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match = scriptSrcRegex.exec(htmlCode);
  while (match) {
    const normalized = match[1].split(/[?#]/)[0].toLowerCase();
    referenced.js.add(normalized);
    match = scriptSrcRegex.exec(htmlCode);
  }

  const linkRegex = /<link\b[^>]*>/gi;
  let linkMatch = linkRegex.exec(htmlCode);
  while (linkMatch) {
    const tag = linkMatch[0];
    const isStylesheet = /\brel\s*=\s*["']stylesheet["']/i.test(tag);
    const hrefMatch = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (isStylesheet && hrefMatch?.[1]) {
      const normalized = hrefMatch[1].split(/[?#]/)[0].toLowerCase();
      referenced.css.add(normalized);
    }
    linkMatch = linkRegex.exec(htmlCode);
  }

  return referenced;
}

function rewriteAssetReferences(htmlCode, urlMap) {
  if (!htmlCode || !urlMap.size) return htmlCode;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlCode, 'text/html');

    doc.querySelectorAll('script[src]').forEach((scriptEl) => {
      const src = scriptEl.getAttribute('src');
      if (!src) return;
      const normalized = src.split(/[?#]/)[0].toLowerCase();
      const mappedUrl = urlMap.get(normalized);
      if (mappedUrl) scriptEl.setAttribute('src', mappedUrl);
    });

    doc.querySelectorAll('link[rel="stylesheet"][href]').forEach((linkEl) => {
      const href = linkEl.getAttribute('href');
      if (!href) return;
      const normalized = href.split(/[?#]/)[0].toLowerCase();
      const mappedUrl = urlMap.get(normalized);
      if (mappedUrl) linkEl.setAttribute('href', mappedUrl);
    });

    const hasDoctype = /^\s*<!doctype/i.test(htmlCode);
    const doctypePrefix = hasDoctype ? '<!doctype html>\n' : '';
    return `${doctypePrefix}${doc.documentElement.outerHTML}`;
  } catch {
    return htmlCode;
  }
}

function injectAndCompose(htmlCode, cssCode, jsCode, fileUrlMap) {
  const styleTag = `<style>${cssCode}</style>`;
  const userScriptTag = `<script>${jsCode.replace(/<\/script>/gi, '<\\/script>')}<\/script>`;

  let documentHtml = htmlCode || '<!doctype html><html><head></head><body></body></html>';

  if (!/<html[^>]*>/i.test(documentHtml)) {
    documentHtml = `<!doctype html><html><head></head><body>${documentHtml}</body></html>`;
  }

  documentHtml = rewriteAssetReferences(documentHtml, fileUrlMap);

  if (/<head[^>]*>/i.test(documentHtml)) {
    documentHtml = documentHtml.replace(/<head[^>]*>/i, (headTag) => `${headTag}${styleTag}`);
  } else {
    documentHtml = `<!doctype html><html><head>${styleTag}</head><body>${documentHtml}</body></html>`;
  }

  if (/<\/body>/i.test(documentHtml)) {
    return documentHtml.replace(/<\/body>/i, `${userScriptTag}</body>`);
  }

  return `${documentHtml}${userScriptTag}`;
}

function runPreview() {
  saveCurrentEditorIntoState();

  const html = files.find((file) => file.type === 'html')?.content || '';
  const referenced = extractReferencedFiles(html);

  const css = files
    .filter((file) => file.type === 'css' && !referenced.css.has(file.name.toLowerCase()))
    .map((file) => file.content)
    .join('\n\n');

  const js = files
    .filter((file) => file.type === 'js' && !referenced.js.has(file.name.toLowerCase()))
    .map((file) => file.content)
    .join('\n\n');

  const fileUrlMap = createPreviewFileUrlMap();

  previewFrame.srcdoc = injectAndCompose(html, css, js, fileUrlMap);
}

function createModel(file) {
  if (!window.monaco) return;
  const model = monaco.editor.createModel(file.content, toMonacoLanguage(file.type));
  model.onDidChangeContent(() => {
    clearTimeout(debounceId);
    debounceId = setTimeout(() => {
      runPreview();
      saveToStorage();
    }, 350);
  });
  monacoModels.set(file.name, model);
}

function rebuildMonacoModels() {
  if (!window.monaco) return;
  monacoModels.forEach((model) => model.dispose());
  monacoModels.clear();
  files.forEach((file) => createModel(file));
}

function addNewFile() {
  const name = prompt('Име на нов файл (пример: helper.js, theme.css, page.html)');
  if (!name) return;
  const fileName = name.trim();
  const type = extensionToType(fileName);

  if (!type) {
    alert('Поддържат се само .html, .css и .js файлове.');
    return;
  }
  if (files.some((file) => file.name === fileName)) {
    alert('Вече има файл с това име.');
    return;
  }

  saveCurrentEditorIntoState();
  const newFile = { name: fileName, type, content: '' };
  files.push(newFile);

  if (monacoEditorInstance) {
    createModel(newFile);
  }

  renderFileList();
  selectFile(fileName);
  saveToStorage();
}

function deleteActiveFile() {
  if (files.length <= 1) {
    alert('Трябва да остане поне един файл.');
    return;
  }

  const ok = confirm(`Сигурен ли си, че искаш да изтриеш ${activeFileName}?`);
  if (!ok) return;

  const target = activeFileName;
  files = files.filter((file) => file.name !== target);

  if (monacoEditorInstance) {
    const model = monacoModels.get(target);
    if (model) model.dispose();
    monacoModels.delete(target);
  }

  activeFileName = files[0].name;
  renderFileList();
  selectFile(activeFileName);
  saveToStorage();
}

function resetProject() {
  if (!resetBtn.classList.contains('confirm-pending')) {
    resetBtn.classList.add('confirm-pending');
    resetBtn.textContent = 'Confirm';
    if (resetConfirmTimer) clearTimeout(resetConfirmTimer);
    resetConfirmTimer = setTimeout(() => {
      resetBtn.classList.remove('confirm-pending');
      resetBtn.textContent = 'Restart';
      resetConfirmTimer = null;
    }, 2500);
    return;
  }

  if (resetConfirmTimer) {
    clearTimeout(resetConfirmTimer);
    resetConfirmTimer = null;
  }
  resetBtn.classList.remove('confirm-pending');
  resetBtn.textContent = 'Restart';

  files = cloneDefaultFiles();
  activeFileName = files[0].name;

  if (monacoEditorInstance) {
    rebuildMonacoModels();
  }

  renderFileList();
  selectFile(activeFileName);
  saveToStorage();
}

function loadActiveFileName() {
  const saved = localStorage.getItem(ACTIVE_FILE_STORAGE_KEY);
  if (!saved) return;
  if (files.some((file) => file.name === saved)) {
    activeFileName = saved;
  }
}

function persistImmediately() {
  saveToStorage();
}

function updateFullscreenButton() {
  const isFullscreen = !!document.fullscreenElement;
  const isActive = isFullscreen || immersiveMode;
  if (!fullscreenBtn) return;
  fullscreenBtn.textContent = isActive ? 'Exit Full' : 'Full';
  fullscreenBtn.title = isActive ? 'Изход от цял дисплей' : 'Цял дисплей';
  fullscreenBtn.classList.toggle('toggle-off', !isActive);
}

function toggleImmersiveMode(forceValue) {
  immersiveMode = typeof forceValue === 'boolean' ? forceValue : !immersiveMode;
  document.body.classList.toggle('immersive-mode', immersiveMode);
  updateFullscreenButton();
  updatePaneHeights();
}

async function toggleFullscreenMode() {
  const root = document.documentElement;
  const isFullscreen = !!document.fullscreenElement;

  if (isFullscreen) {
    await document.exitFullscreen();
    return;
  }

  if (root.requestFullscreen) {
    try {
      await root.requestFullscreen();
      immersiveMode = false;
      document.body.classList.remove('immersive-mode');
      updateFullscreenButton();
      updatePaneHeights();
      return;
    } catch {
      toggleImmersiveMode(true);
      return;
    }
  }

  toggleImmersiveMode();
}

function initFallbackEditor() {
  document.getElementById('editor').hidden = true;
  fallbackEditorsWrap.hidden = false;

  fallbackEditor.addEventListener('input', () => {
    clearTimeout(debounceId);
    debounceId = setTimeout(() => {
      runPreview();
      saveToStorage();
    }, 350);
  });

  renderFileList();
  selectFile(activeFileName);
}

function initMonacoEditor() {
  if (typeof require === 'undefined') {
    initFallbackEditor();
    return;
  }

  require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs' } });
  require(['vs/editor/editor.main'], () => {
    rebuildMonacoModels();

    monacoEditorInstance = monaco.editor.create(document.getElementById('editor'), {
      model: monacoModels.get(activeFileName),
      theme: currentTheme === 'dark' ? 'vs-dark' : 'vs',
      minimap: { enabled: false },
      automaticLayout: true,
      fontSize: 14,
      wordWrap: 'on',
      quickSuggestions: autocompleteEnabled,
      suggestOnTriggerCharacters: autocompleteEnabled,
      wordBasedSuggestions: autocompleteEnabled ? 'currentDocument' : 'off'
    });

    renderFileList();
    selectFile(activeFileName);
    updateAutocompleteButton();
  }, () => {
    initFallbackEditor();
  });
}

function applySplit(leftWidthPx) {
  const layoutRect = layout.getBoundingClientRect();
  const minPanelWidth = window.innerWidth <= 980 ? 180 : 280;
  const splitterWidth = 6;
  const maxLeft = layoutRect.width - minPanelWidth - splitterWidth;
  const safeLeft = Math.min(Math.max(leftWidthPx, minPanelWidth), maxLeft);
  layout.style.gridTemplateColumns = `${safeLeft}px ${splitterWidth}px minmax(${minPanelWidth}px, 1fr)`;
}

function initResizablePanels() {
  if (!splitter || !layout || !leftPanel) return;

  let isDragging = false;

  const startDrag = (event) => {
    isDragging = true;
    layout.classList.add('is-resizing');
    event.preventDefault();
  };

  splitter.addEventListener('mousedown', startDrag);
  splitter.addEventListener('touchstart', (event) => {
    if (!event.touches?.length) return;
    startDrag(event);
  }, { passive: false });

  window.addEventListener('mousemove', (event) => {
    if (!isDragging) return;
    const layoutRect = layout.getBoundingClientRect();
    applySplit(event.clientX - layoutRect.left);
  });

  window.addEventListener('touchmove', (event) => {
    if (!isDragging || !event.touches?.length) return;
    const layoutRect = layout.getBoundingClientRect();
    applySplit(event.touches[0].clientX - layoutRect.left);
    event.preventDefault();
  }, { passive: false });

  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    layout.classList.remove('is-resizing');
  });

  window.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    layout.classList.remove('is-resizing');
  });

  splitter.addEventListener('keydown', (event) => {
    const currentLeft = leftPanel.getBoundingClientRect().width;
    if (event.key === 'ArrowLeft') {
      applySplit(currentLeft - 20);
      event.preventDefault();
    }
    if (event.key === 'ArrowRight') {
      applySplit(currentLeft + 20);
      event.preventDefault();
    }
  });
}

function initMobileHorizontalSwipe() {
  if (!layout) return;

  let active = false;
  let panning = false;
  let startX = 0;
  let startY = 0;
  let startScrollLeft = 0;

  layout.addEventListener('touchstart', (event) => {
    if (window.innerWidth > 980) return;
    if (!event.touches?.length || event.touches.length > 1) return;

    const target = event.target;
    if (
      target instanceof Element &&
      target.closest('.actions button, .actions a, .projectsControls select, .projectsButtons button, .fileActions button, #splitter')
    ) {
      active = false;
      panning = false;
      return;
    }

    const touch = event.touches[0];
    active = true;
    panning = false;
    startX = touch.clientX;
    startY = touch.clientY;
    startScrollLeft = layout.scrollLeft;
  }, { passive: true });

  layout.addEventListener('touchmove', (event) => {
    if (!active || window.innerWidth > 980 || !event.touches?.length) return;

    const touch = event.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    if (!panning) {
      if (Math.abs(dx) < 10 || Math.abs(dx) <= Math.abs(dy)) return;
      panning = true;
    }

    layout.scrollLeft = startScrollLeft - dx;
    event.preventDefault();
  }, { passive: false });

  const stop = () => {
    active = false;
    panning = false;
  };

  layout.addEventListener('touchend', stop, { passive: true });
  layout.addEventListener('touchcancel', stop, { passive: true });
}

function updatePaneHeights() {
  const topbarHeight = topbar ? topbar.getBoundingClientRect().height : 0;
  const reserved = topbarHeight + 10;
  const minMainHeight = window.innerWidth <= 600 ? 180 : 240;
  const computedMain = Math.max(minMainHeight, window.innerHeight - reserved);

  document.body.style.setProperty('--main-pane-height', `${computedMain}px`);

  if (monacoEditorInstance) {
    monacoEditorInstance.layout();
  }
}

window.addEventListener('resize', updatePaneHeights);
document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement) {
    immersiveMode = false;
    document.body.classList.remove('immersive-mode');
  }
  updateFullscreenButton();
  updatePaneHeights();
});
window.addEventListener('beforeunload', clearPreviewObjectUrls);
window.addEventListener('beforeunload', persistImmediately);
window.addEventListener('pagehide', persistImmediately);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persistImmediately();
});

runBtn.addEventListener('click', runPreview);
resetBtn.addEventListener('click', resetProject);
fullscreenBtn?.addEventListener('click', () => {
  toggleFullscreenMode();
});
themeToggle.addEventListener('click', () => {
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
});
autocompleteToggle.addEventListener('click', () => {
  autocompleteEnabled = !autocompleteEnabled;
  localStorage.setItem(AUTOCOMPLETE_STORAGE_KEY, autocompleteEnabled ? 'on' : 'off');
  updateAutocompleteButton();
});
newFileBtn.addEventListener('click', addNewFile);
deleteFileBtn.addEventListener('click', deleteActiveFile);
openProjectBtn?.addEventListener('click', openSelectedProject);
saveProjectBtn?.addEventListener('click', saveCurrentProject);
saveAsProjectBtn?.addEventListener('click', saveCurrentProjectAs);

initProjectsState();
loadActiveFileName();

resetBtn.textContent = 'Restart';

initTheme();
initAutocompleteToggle();
initResizablePanels();
initMobileHorizontalSwipe();
initMonacoEditor();
updateFullscreenButton();
updatePaneHeights();
