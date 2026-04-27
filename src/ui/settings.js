let currentSettings = {};

function setRefreshStatus(message, tone = '') {
    const statusEl = document.getElementById('refresh-status');
    if (!statusEl) {
        return;
    }

    statusEl.textContent = message;
    statusEl.classList.remove('success', 'error');
    if (tone === 'success' || tone === 'error') {
        statusEl.classList.add(tone);
    }
}

function setLastRefreshTimestamp(timestampMs) {
    const lastUpdatedEl = document.getElementById('refresh-last-updated');
    if (!lastUpdatedEl) {
        return;
    }

    if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
        lastUpdatedEl.textContent = '';
        return;
    }

    const refreshedAt = new Date(timestampMs);
    lastUpdatedEl.textContent = `Last refreshed: ${refreshedAt.toLocaleString()}`;
}

async function loadSettings() {
    try {
        currentSettings = await window.electronAPI.getSettings();
        applySettingsToUI();
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

function applySettingsToUI() {
    // Backdrop color
    const backdropColorInput = document.getElementById('backdrop-color');
    if (currentSettings.backdropColor) {
        backdropColorInput.value = currentSettings.backdropColor;
    }

    // Rotation speed
    const rotationSpeedInput = document.getElementById('rotation-speed');
    if (currentSettings.rotationSpeed) {
        rotationSpeedInput.value = currentSettings.rotationSpeed;
        document.getElementById('rotation-speed-display').textContent = 
            currentSettings.rotationSpeed.toFixed(1) + 'x';
    }

    // Lighting preset
    const lightingPreset = currentSettings.lightingPreset || 'ambient';
    document.querySelectorAll('.preset-btn').forEach(btn => {
        if (btn.getAttribute('data-preset') === lightingPreset) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Lighting intensity
    const lightingIntensityInput = document.getElementById('lighting-intensity');
    if (currentSettings.lightingIntensity !== undefined) {
        lightingIntensityInput.value = currentSettings.lightingIntensity;
        document.getElementById('lighting-intensity-display').textContent =
            currentSettings.lightingIntensity.toFixed(1) + 'x';
    }

    // Camera distance
    const cameraDistanceInput = document.getElementById('camera-distance');
    if (currentSettings.cameraDistance) {
        cameraDistanceInput.value = currentSettings.cameraDistance;
        document.getElementById('camera-distance-display').textContent = currentSettings.cameraDistance;
    }

    // Dynamic camera distance
    const dynamicCameraDistanceInput = document.getElementById('dynamic-camera-distance');
    dynamicCameraDistanceInput.checked = currentSettings.dynamicCameraDistance !== false;

    // Camera pattern
    const cameraPatternInput = document.getElementById('camera-pattern');
    cameraPatternInput.value = currentSettings.cameraPattern || 'orbit';

    // Display duration
    const displayDurationInput = document.getElementById('display-duration');
    if (currentSettings.displayDuration) {
        const seconds = Math.round(currentSettings.displayDuration / 1000);
        displayDurationInput.value = seconds;
        document.getElementById('display-duration-display').textContent = seconds;
    }

    // Auto-rotate
    const autoRotateInput = document.getElementById('auto-rotate');
    if (currentSettings.autoRotate !== undefined) {
        autoRotateInput.checked = currentSettings.autoRotate;
    }
}

function setupEventListeners() {
    // Range inputs - update display on input, save on change
    document.getElementById('rotation-speed').addEventListener('input', (e) => {
        document.getElementById('rotation-speed-display').textContent = parseFloat(e.target.value).toFixed(1) + 'x';
    });
    document.getElementById('rotation-speed').addEventListener('change', saveSettings);

    document.getElementById('camera-distance').addEventListener('input', (e) => {
        document.getElementById('camera-distance-display').textContent = e.target.value;
    });
    document.getElementById('camera-distance').addEventListener('change', saveSettings);

    document.getElementById('dynamic-camera-distance').addEventListener('change', saveSettings);

    document.getElementById('camera-pattern').addEventListener('change', saveSettings);

    document.getElementById('display-duration').addEventListener('input', (e) => {
        document.getElementById('display-duration-display').textContent = e.target.value;
    });
    document.getElementById('display-duration').addEventListener('change', saveSettings);

    document.getElementById('lighting-intensity').addEventListener('input', (e) => {
        document.getElementById('lighting-intensity-display').textContent = parseFloat(e.target.value).toFixed(1) + 'x';
    });
    document.getElementById('lighting-intensity').addEventListener('change', saveSettings);

    // Backdrop color
    document.getElementById('backdrop-color').addEventListener('input', saveSettings);

    // Auto-rotate
    document.getElementById('auto-rotate').addEventListener('change', saveSettings);

    // Preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            saveSettings();
        });
    });

    const refreshButton = document.getElementById('refresh-ship-metadata');
    if (refreshButton) {
        refreshButton.addEventListener('click', refreshShipMetadata);
    }

    const refreshCatalogMetadataButton = document.getElementById('refresh-ship-catalog-metadata');
    if (refreshCatalogMetadataButton) {
        refreshCatalogMetadataButton.addEventListener('click', refreshShipCatalogAndMetadata);
    }
}

async function refreshShipMetadata() {
    const refreshButton = document.getElementById('refresh-ship-metadata');

    if (!refreshButton) {
        return;
    }

    refreshButton.disabled = true;
    setRefreshStatus('Refreshing ship metadata...');

    try {
        const result = await window.electronAPI.refreshShipMetadata();
        if (result?.success) {
            const count = Number.isFinite(result.entryCount) ? result.entryCount : 0;
            currentSettings = await window.electronAPI.getSettings();
            setRefreshStatus(`Ship metadata refreshed (${count} mapped models).`, 'success');
            setLastRefreshTimestamp(result.refreshedAt);
            return;
        }

        setRefreshStatus(`Refresh failed: ${result?.error || 'Unknown error'}`, 'error');
    } catch (error) {
        setRefreshStatus(`Refresh failed: ${error.message}`, 'error');
    } finally {
        refreshButton.disabled = false;
    }
}

async function refreshShipCatalogAndMetadata() {
    const refreshButton = document.getElementById('refresh-ship-catalog-metadata');

    if (!refreshButton) {
        return;
    }

    refreshButton.disabled = true;
    setRefreshStatus('Refreshing ship catalog and metadata...');

    try {
        const result = await window.electronAPI.refreshShipCatalogAndMetadata();
        if (result?.success) {
            const shipCount = Number.isFinite(result.shipCount) ? result.shipCount : 0;
            const metadataCount = Number.isFinite(result.metadataCount) ? result.metadataCount : 0;
            currentSettings = await window.electronAPI.getSettings();
            setRefreshStatus(`Catalog refreshed (${shipCount} ships, ${metadataCount} name mappings).`, 'success');
            setLastRefreshTimestamp(result.refreshedAt);
            return;
        }

        setRefreshStatus(`Refresh failed: ${result?.error || 'Unknown error'}`, 'error');
    } catch (error) {
        setRefreshStatus(`Refresh failed: ${error.message}`, 'error');
    } finally {
        refreshButton.disabled = false;
    }
}

async function saveSettings() {
    const settings = {
        backdropColor: document.getElementById('backdrop-color').value,
        rotationSpeed: parseFloat(document.getElementById('rotation-speed').value),
        lightingPreset: document.querySelector('.preset-btn.active').getAttribute('data-preset'),
        lightingIntensity: parseFloat(document.getElementById('lighting-intensity').value),
        cameraDistance: parseInt(document.getElementById('camera-distance').value),
        dynamicCameraDistance: document.getElementById('dynamic-camera-distance').checked,
        cameraPattern: document.getElementById('camera-pattern').value,
        displayDuration: parseInt(document.getElementById('display-duration').value) * 1000,
        autoRotate: document.getElementById('auto-rotate').checked,
        ships: currentSettings.ships || [],
    };

    try {
        await window.electronAPI.saveSettings(settings);
        currentSettings = settings;
        console.log('Settings saved successfully');
        // Optionally close the window after saving
        // window.electronAPI.closeSettings();
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

// Initialize when page loads
window.addEventListener('load', () => {
    loadSettings();
    setupEventListeners();
});

// Make saveSettings globally accessible
window.saveSettings = saveSettings;
