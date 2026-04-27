import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron';
import Store from 'electron-store';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GALLERY_TREE_API_URL = 'https://api.github.com/repos/EstamelGG/EVE_Model_Gallery/git/trees/main?recursive=1';
const GALLERY_RAW_BASE_URL = 'https://raw.githubusercontent.com/EstamelGG/EVE_Model_Gallery/main/';
const GALLERY_INDEX_EN_URL = 'https://raw.githubusercontent.com/EstamelGG/EVE_Model_Gallery/main/docs/statics/resources_index_en.json';
const GALLERY_INDEX_ZH_URL = 'https://raw.githubusercontent.com/EstamelGG/EVE_Model_Gallery/main/docs/statics/resources_index_zh.json';
const SHIP_CATALOG_CACHE_KEY = 'shipCatalogCache';
const SHIP_METADATA_CACHE_KEY = 'shipMetadataCache';
const SHIP_CATALOG_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const LEGACY_DEFAULT_SHIPS = [
  'https://raw.githubusercontent.com/EstamelGG/EVE_Model_Gallery/main/docs/models/587_lite.glb',
  'https://raw.githubusercontent.com/EstamelGG/EVE_Model_Gallery/main/docs/models/603_lite.glb',
  'https://raw.githubusercontent.com/EstamelGG/EVE_Model_Gallery/main/docs/models/626_lite.glb',
  'https://raw.githubusercontent.com/EstamelGG/EVE_Model_Gallery/main/docs/models/629_lite.glb',
  'https://raw.githubusercontent.com/EstamelGG/EVE_Model_Gallery/main/docs/models/24698_lite.glb',
];

let mainWindow;
let settingsWindow;
const store = new Store();

// Default settings
const defaultSettings = {
  ships: LEGACY_DEFAULT_SHIPS,
  rotationSpeed: 2,
  backdropColor: '#1a1a2e',
  lightingPreset: 'ambient',
  lightingIntensity: 1,
  cameraDistance: 50,
  dynamicCameraDistance: true,
  cameraPattern: 'orbit',
  autoRotate: true,
  displayDuration: 10000, // milliseconds
};

function parseScreensaverLaunchMode(argv = process.argv) {
  const args = Array.isArray(argv) ? argv.slice(1) : [];
  let mode = 'app';
  let previewHandle = null;

  const normalizeArg = (rawArg) => {
    if (typeof rawArg !== 'string') {
      return '';
    }

    return rawArg.trim().replace(/^"+|"+$/g, '').toLowerCase();
  };

  for (let index = 0; index < args.length; index += 1) {
    const rawArg = args[index];
    if (typeof rawArg !== 'string') {
      continue;
    }

    const arg = normalizeArg(rawArg);
    if (!arg) {
      continue;
    }

    if (arg === '/s' || arg === '-s' || arg.startsWith('/s:') || arg.startsWith('-s:')) {
      mode = 'screensaver';
      continue;
    }

    if (arg === '/c' || arg === '-c' || arg.startsWith('/c:') || arg.startsWith('-c:')) {
      mode = 'config';
      continue;
    }

    if (arg === '/p' || arg === '-p' || arg.startsWith('/p:') || arg.startsWith('-p:')) {
      mode = 'preview';

      const inlineHandle = arg.split(':')[1];
      if (inlineHandle) {
        previewHandle = inlineHandle;
        continue;
      }

      const nextArg = normalizeArg(args[index + 1]);
      if (nextArg) {
        previewHandle = nextArg;
        index += 1;
      }
    }
  }

  return { mode, previewHandle };
}

function areSameShipLists(firstList = [], secondList = []) {
  if (firstList.length !== secondList.length) {
    return false;
  }

  return firstList.every((ship, index) => ship === secondList[index]);
}

function normalizeModelFilename(modelPath = '') {
  if (typeof modelPath !== 'string' || modelPath.length === 0) {
    return null;
  }

  let pathname = modelPath;

  try {
    pathname = new URL(modelPath, GALLERY_RAW_BASE_URL).pathname;
  } catch {
    pathname = modelPath;
  }

  const normalized = pathname.split('#')[0].split('?')[0].replace(/\\/g, '/');
  const filename = normalized.split('/').pop();

  if (!filename) {
    return null;
  }

  return decodeURIComponent(filename).toLowerCase();
}

function extractShipMetadataFromIndex(indexData) {
  const metadataByFilename = {};

  if (!Array.isArray(indexData)) {
    return metadataByFilename;
  }

  for (const category of indexData) {
    if (!Array.isArray(category?.groups)) {
      continue;
    }

    for (const group of category.groups) {
      if (!Array.isArray(group?.types)) {
        continue;
      }

      for (const type of group.types) {
        const displayName = type.name_en || type.name || type.name_zh || '';

        const addMetadata = (modelPath, entry) => {
          const filename = normalizeModelFilename(modelPath);
          if (!filename || !entry.displayName) {
            return;
          }

          // Keep first match to avoid variant/duplicate overwrites.
          if (!metadataByFilename[filename]) {
            metadataByFilename[filename] = entry;
          }
        };

        addMetadata(type.model_path, {
          typeId: type.id,
          displayName,
          name: type.name || displayName,
          nameEn: type.name_en || '',
          nameZh: type.name_zh || '',
        });

        if (!Array.isArray(type.variants)) {
          continue;
        }

        for (const variant of type.variants) {
          const variantDisplayName = variant.name_en || variant.name || variant.name_zh || displayName;
          addMetadata(variant.model_path, {
            typeId: type.id,
            variantCode: variant.variant_code || '',
            displayName: variantDisplayName,
            name: variant.name || variantDisplayName,
            nameEn: variant.name_en || '',
            nameZh: variant.name_zh || '',
          });
        }
      }
    }
  }

  return metadataByFilename;
}

async function fetchJsonWithGitHubHeaders(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  let response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'EVE-Ships-Screensaver',
        Accept: 'application/vnd.github+json',
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`GitHub fetch failed for ${url} with status ${response.status}`);
  }

  return response.json();
}

async function fetchShipMetadataCatalog() {
  const indexCandidates = [GALLERY_INDEX_EN_URL, GALLERY_INDEX_ZH_URL];
  const errors = [];

  for (const indexUrl of indexCandidates) {
    try {
      const indexData = await fetchJsonWithGitHubHeaders(indexUrl);
      const metadataByFilename = extractShipMetadataFromIndex(indexData);

      if (Object.keys(metadataByFilename).length > 0) {
        return metadataByFilename;
      }

      errors.push(new Error(`Index ${indexUrl} returned no usable metadata entries`));
    } catch (error) {
      errors.push(error);
    }
  }

  throw new Error(errors.map((error) => error.message).join(' | '));
}

async function getShipMetadataCatalog(forceRefresh = false) {
  const cachedMetadata = store.get(SHIP_METADATA_CACHE_KEY);
  const hasUsableCache = cachedMetadata && typeof cachedMetadata.entries === 'object' && Object.keys(cachedMetadata.entries).length > 0;
  const cacheIsFresh = hasUsableCache && (Date.now() - cachedMetadata.fetchedAt) < SHIP_CATALOG_CACHE_TTL_MS;

  if (!forceRefresh && cacheIsFresh) {
    return cachedMetadata.entries;
  }

  try {
    const entries = await fetchShipMetadataCatalog();

    store.set(SHIP_METADATA_CACHE_KEY, {
      fetchedAt: Date.now(),
      entries,
    });

    return entries;
  } catch (error) {
    console.warn('Unable to refresh ship metadata catalog, falling back to cached metadata:', error);

    if (hasUsableCache) {
      return cachedMetadata.entries;
    }

    return {};
  }
}

async function fetchGalleryShipCatalog() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  let response;
  try {
    response = await fetch(GALLERY_TREE_API_URL, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'EVE-Ships-Screensaver',
        Accept: 'application/vnd.github+json',
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`GitHub API request failed with status ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload.tree)) {
    throw new Error('GitHub API response did not include a repository tree');
  }

  return payload.tree
    .filter((entry) => entry.type === 'blob' && entry.path.startsWith('docs/models/') && entry.path.endsWith('_lite.glb'))
    .map((entry) => `${GALLERY_RAW_BASE_URL}${entry.path}`)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

async function getAvailableShipsCatalog(forceRefresh = false) {
  const cachedCatalog = store.get(SHIP_CATALOG_CACHE_KEY);
  const hasUsableCache = Array.isArray(cachedCatalog?.ships) && cachedCatalog.ships.length > 0;
  const cacheIsFresh = hasUsableCache && (Date.now() - cachedCatalog.fetchedAt) < SHIP_CATALOG_CACHE_TTL_MS;

  if (!forceRefresh && cacheIsFresh) {
    return cachedCatalog.ships;
  }

  try {
    const ships = await fetchGalleryShipCatalog();
    if (ships.length === 0) {
      throw new Error('Gallery catalog was empty');
    }

    store.set(SHIP_CATALOG_CACHE_KEY, {
      fetchedAt: Date.now(),
      ships,
    });

    return ships;
  } catch (error) {
    console.warn('Unable to refresh ship catalog, falling back to cached or legacy list:', error);

    if (hasUsableCache) {
      return cachedCatalog.ships;
    }

    return LEGACY_DEFAULT_SHIPS;
  }
}

async function getOrCreateStore() {
  if (!store.has('settings')) {
    store.set('settings', defaultSettings);
  }

  const persistedSettings = store.get('settings');
  const safePersistedSettings = persistedSettings && typeof persistedSettings === 'object' ? persistedSettings : {};
  const saved = { ...defaultSettings, ...safePersistedSettings };
  const shouldUseGalleryCatalog = !Array.isArray(saved.ships) || saved.ships.length === 0 || areSameShipLists(saved.ships, LEGACY_DEFAULT_SHIPS);

  if (shouldUseGalleryCatalog) {
    // Use cached catalog synchronously to avoid blocking startup on network access.
    // A fresh background refresh will push updated ships to the window when ready.
    const cachedCatalog = store.get(SHIP_CATALOG_CACHE_KEY);
    if (Array.isArray(cachedCatalog?.ships) && cachedCatalog.ships.length > 0) {
      saved.ships = cachedCatalog.ships;
    } else {
      saved.ships = LEGACY_DEFAULT_SHIPS;
    }

    // Kick off a background refresh without awaiting it
    getAvailableShipsCatalog().then((ships) => {
      const current = { ...defaultSettings, ...store.get('settings') };
      if (!areSameShipLists(current.ships, ships)) {
        current.ships = ships;
        store.set('settings', current);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('settings-updated', current);
        }
      }
    }).catch(() => { /* silent — catalog refresh is best-effort */ });
  }

  store.set('settings', saved);
  return saved;
}

function createMainWindow(options = {}) {
  const {
    fullscreen = true,
    preview = false,
    skipTaskbar = true,
    alwaysOnTop = false,
    focusWindow = false,
  } = options;

  mainWindow = new BrowserWindow({
    width: preview ? 480 : 1920,
    height: preview ? 270 : 1080,
    fullscreen,
    autoHideMenuBar: true,
    skipTaskbar,
    resizable: preview,
    alwaysOnTop,
    movable: preview,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    frame: preview,
  });

  mainWindow.loadFile(path.join(__dirname, 'ui', 'screensaver.html'));

  // Enforce fullscreen and optionally foreground focus after renderer is ready.
  mainWindow.once('ready-to-show', () => {
    if (focusWindow && !mainWindow?.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }

    if (fullscreen) {
      if (!mainWindow?.isDestroyed()) {
        mainWindow.setFullScreen(true);
      }
    }
  });

  if (process.argv.includes('--debug') || process.argv.includes('--inspect')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createSettingsWindow(options = {}) {
  const {
    alwaysOnTop = false,
    focusWindow = true,
  } = options;

  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 600,
    height: 920,
    resizable: false,
    alwaysOnTop,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  settingsWindow.loadFile(path.join(__dirname, 'ui', 'settings.html'));

  settingsWindow.once('ready-to-show', () => {
    if (focusWindow && !settingsWindow?.isDestroyed()) {
      settingsWindow.show();
      settingsWindow.focus();
    }
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

app.on('ready', () => {
  const { mode, previewHandle } = parseScreensaverLaunchMode();

  if (mode === 'config') {
    createSettingsWindow({
      alwaysOnTop: true,
      focusWindow: true,
    });
    return;
  }

  if (mode === 'preview') {
    // Electron cannot reliably embed into the Win32 preview host handle,
    // so we run a compact preview-safe window instead of crashing.
    console.log(`Launching preview mode (host handle: ${previewHandle || 'none'})`);
    createMainWindow({
      fullscreen: false,
      preview: true,
      skipTaskbar: false,
      alwaysOnTop: true,
      focusWindow: true,
    });
    return;
  }

  const shouldRunFullscreen = mode === 'screensaver' || mode === 'app';
  createMainWindow({
    fullscreen: shouldRunFullscreen,
    preview: false,
  });

  // Keep the menu for normal app launches, but hide it for screensaver mode.
  if (mode === 'app') {
    createMenu();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Settings',
          click: createSettingsWindow,
        },
        {
          label: 'Exit',
          click: () => {
            app.quit();
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// IPC handlers
ipcMain.handle('get-settings', async () => {
  try {
    return await getOrCreateStore();
  } catch (error) {
    console.error('Failed to get settings, resetting to defaults:', error);
    const fallback = { ...defaultSettings };
    store.set('settings', fallback);
    return fallback;
  }
});

ipcMain.handle('save-settings', (event, settings) => {
  store.set('settings', settings);
  // Send updated settings to main window
  if (mainWindow) {
    mainWindow.webContents.send('settings-updated', settings);
  }
  return { success: true };
});

ipcMain.handle('get-available-ships', async () => {
  return getAvailableShipsCatalog();
});

ipcMain.handle('get-ship-metadata', async () => {
  return getShipMetadataCatalog();
});

ipcMain.handle('refresh-ship-metadata', async () => {
  try {
    const metadata = await getShipMetadataCatalog(true);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ship-metadata-updated', metadata);
    }

    return {
      success: true,
      entryCount: Object.keys(metadata).length,
      refreshedAt: Date.now(),
    };
  } catch (error) {
    console.error('Failed to refresh ship metadata:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('refresh-ship-catalog-and-metadata', async () => {
  try {
    const [ships, metadata] = await Promise.all([
      getAvailableShipsCatalog(true),
      getShipMetadataCatalog(true),
    ]);

    const currentSettings = { ...defaultSettings, ...store.get('settings') };
    const updatedSettings = {
      ...currentSettings,
      ships,
    };

    store.set('settings', updatedSettings);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('settings-updated', updatedSettings);
      mainWindow.webContents.send('ship-metadata-updated', metadata);
    }

    return {
      success: true,
      shipCount: ships.length,
      metadataCount: Object.keys(metadata).length,
      refreshedAt: Date.now(),
    };
  } catch (error) {
    console.error('Failed to refresh ship catalog and metadata:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('minimize-settings', () => {
  if (settingsWindow) {
    settingsWindow.minimize();
  }
});

ipcMain.handle('close-settings', () => {
  if (settingsWindow) {
    settingsWindow.close();
  }
});

ipcMain.handle('open-settings', () => {
  createSettingsWindow({
    alwaysOnTop: true,
    focusWindow: true,
  });
});
