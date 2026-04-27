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
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'EVE-Ships-Screensaver',
      Accept: 'application/vnd.github+json',
    },
  });

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
  const response = await fetch(GALLERY_TREE_API_URL, {
    headers: {
      'User-Agent': 'EVE-Ships-Screensaver',
      Accept: 'application/vnd.github+json',
    },
  });

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

  const saved = { ...defaultSettings, ...store.get('settings') };
  const shouldUseGalleryCatalog = !Array.isArray(saved.ships) || saved.ships.length === 0 || areSameShipLists(saved.ships, LEGACY_DEFAULT_SHIPS);

  if (shouldUseGalleryCatalog) {
    saved.ships = await getAvailableShipsCatalog();
  }

  store.set('settings', saved);
  return saved;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    autoHideMenuBar: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    frame: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'ui', 'screensaver.html'));

  // Enforce fullscreen after the renderer is ready.
  mainWindow.once('ready-to-show', () => {
    if (!mainWindow?.isDestroyed()) {
      mainWindow.setFullScreen(true);
    }
  });

  if (process.argv.includes('--debug') || process.argv.includes('--inspect')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 600,
    height: 920,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  settingsWindow.loadFile(path.join(__dirname, 'ui', 'settings.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

app.on('ready', () => {
  createMainWindow();
  createMenu();
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
ipcMain.handle('get-settings', () => {
  return getOrCreateStore();
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
  createSettingsWindow();
});
