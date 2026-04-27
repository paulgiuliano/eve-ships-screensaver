import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/loaders/GLTFLoader.js';
import { DRACOLoader } from './vendor/three/loaders/DRACOLoader.js';
import { OrbitControls } from './vendor/three/controls/OrbitControls.js';

class ShipsScreensaver {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.currentShip = null;
        this.currentShipIndex = 0;
        this.settings = {};
        this.loader = new GLTFLoader();
        
        // Use a document-relative decoder path so dev and packaged modes resolve identically.
        const dracoPath = './vendor/three/libs/draco/';
        
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath(dracoPath);
        this.loader.setDRACOLoader(dracoLoader);
        this.shipRotation = 0;
        this.containerWidth = window.innerWidth;
        this.containerHeight = window.innerHeight;
        this.ships = [];
        this.shipMetadataByFilename = {};
        this.shipRotationAxis = new THREE.Vector3(0, 1, 0); // Rotate around Y axis
        this.shipTimer = null;
        this.cameraAnimationTime = 0;
        this.lastFrameTime = performance.now();
        this.currentShipRadius = 10;
        this.activeCameraDistance = 50;
        this.shipTransitionDurationMs = 900;
        this.cameraDistanceTransitionDurationMs = 900;
        this.cameraDistanceTransition = null;
        this.lastSettingsOpenTime = 0;
        
        this.setupScene();
        this.setupLighting();
        this.loadSettings();
        this.setupEventListeners();
        this.animate();
    }

    getDefaultSettings() {
        return {
            ships: [
                'https://raw.githubusercontent.com/EstamelGG/EVE_Model_Gallery/main/docs/models/587_lite.glb',
                'https://raw.githubusercontent.com/EstamelGG/EVE_Model_Gallery/main/docs/models/603_lite.glb',
                'https://raw.githubusercontent.com/EstamelGG/EVE_Model_Gallery/main/docs/models/626_lite.glb',
                'https://raw.githubusercontent.com/EstamelGG/EVE_Model_Gallery/main/docs/models/629_lite.glb',
                'https://raw.githubusercontent.com/EstamelGG/EVE_Model_Gallery/main/docs/models/24698_lite.glb',
            ],
            rotationSpeed: 2,
            backdropColor: '#1a1a2e',
            lightingPreset: 'ambient',
            lightingIntensity: 1,
            cameraDistance: 50,
            dynamicCameraDistance: true,
            cameraPattern: 'orbit',
            autoRotate: true,
            displayDuration: 10000,
        };
    }

    normalizeSettings(settings) {
        const defaults = this.getDefaultSettings();
        const safeSettings = settings && typeof settings === 'object' ? settings : {};
        const merged = { ...defaults, ...safeSettings };

        if (!Array.isArray(merged.ships)) {
            merged.ships = defaults.ships;
        }

        return merged;
    }

    setupScene() {
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            this.containerWidth / this.containerHeight,
            0.1,
            1000
        );
        this.camera.position.z = 50;

        // Renderer
        const container = document.getElementById('canvas-container');
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: false,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(this.containerWidth, this.containerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x1a1a2e);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        container.appendChild(this.renderer.domElement);

        // Orbit controls (for demo purposes)
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 2;
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = true;
        this.controls.enablePan = false;

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        // Directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 10, 7);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        // Point light for extra detail
        const pointLight = new THREE.PointLight(0xff6b6b, 0.5);
        pointLight.position.set(-10, 5, 10);
        this.scene.add(pointLight);

        this.directionalLight = directionalLight;
        this.ambientLight = ambientLight;
        this.pointLight = pointLight;
    }

    async loadSettings() {
        const api = window.electronAPI;
        if (!api?.getSettings) {
            this.settings = this.getDefaultSettings();
            this.shipMetadataByFilename = {};
            this.applySettings();
            if (this.settings.ships.length > 0) {
                this.currentShipIndex = Math.floor(Math.random() * this.settings.ships.length);
                await this.loadShip(this.settings.ships[this.currentShipIndex]);
                this.scheduleNextShip();
            }
            return;
        }

        try {
            // Fetch settings immediately; metadata with timeout to prevent indefinite blocking
            const settings = await api.getSettings();

            // Metadata failures should never block startup.
            const metadataPromise = api.getShipMetadata
                ? api.getShipMetadata().catch(() => ({}))
                : Promise.resolve({});
            const timeoutPromise = new Promise((resolve) => {
                setTimeout(() => resolve({}), 5000);
            });
            const shipMetadataByFilename = await Promise.race([metadataPromise, timeoutPromise]);

            this.settings = this.normalizeSettings(settings);
            this.shipMetadataByFilename = shipMetadataByFilename || {};
            this.applySettings();
            
            // Load initial ship if available
            if (this.settings.ships && this.settings.ships.length > 0) {
                this.currentShipIndex = Math.floor(Math.random() * this.settings.ships.length);
                await this.loadShip(this.settings.ships[this.currentShipIndex]);
                this.scheduleNextShip();
            } else {
                document.getElementById('ship-name').textContent = 'No ships configured';
            }
            
            // Listen for settings updates
            if (api.onSettingsUpdated) {
                api.onSettingsUpdated((settingsUpdate) => {
                    const normalizedUpdate = this.normalizeSettings(settingsUpdate);
                    const durationChanged = normalizedUpdate.displayDuration !== this.settings.displayDuration;
                    this.settings = normalizedUpdate;
                    this.applySettings();
                    if (durationChanged) this.scheduleNextShip();
                });
            }

            if (api.onShipMetadataUpdated) {
                api.onShipMetadataUpdated((shipMetadataByFilenameUpdate) => {
                    this.shipMetadataByFilename = shipMetadataByFilenameUpdate || {};

                    if (this.settings?.ships && this.settings.ships.length > 0 && this.currentShipIndex >= 0) {
                        const currentModelUrl = this.settings.ships[this.currentShipIndex];
                        if (currentModelUrl) {
                            const shipName = this.resolveShipDisplayName(currentModelUrl);
                            document.getElementById('ship-name').textContent = `Ship: ${shipName}`;
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            // Last-resort startup path with in-memory defaults.
            this.settings = this.getDefaultSettings();
            this.shipMetadataByFilename = {};
            this.applySettings();
            if (this.settings.ships.length > 0) {
                this.currentShipIndex = Math.floor(Math.random() * this.settings.ships.length);
                await this.loadShip(this.settings.ships[this.currentShipIndex]);
                this.scheduleNextShip();
            } else {
                document.getElementById('ship-name').textContent = 'No ships configured';
            }
        }
    }

    applySettings() {
        // Apply backdrop color
        if (this.settings.backdropColor) {
            this.renderer.setClearColor(this.settings.backdropColor);
        }

        // Apply lighting preset
        if (this.settings.lightingPreset) {
            this.applyLightingPreset(this.settings.lightingPreset);
        }

        // Apply rotation speed
        if (this.settings.rotationSpeed) {
            this.controls.autoRotateSpeed = this.settings.rotationSpeed;
        }

        // Apply camera distance
        if (this.settings.cameraDistance) {
            this.updateCameraDistanceForShip();
        }

        this.applyCameraPatternMode();

    }

    applyCameraPatternMode() {
        const pattern = this.settings.cameraPattern || 'orbit';
        const autoRotateEnabled = this.settings.autoRotate !== false;
        const orbitMode = pattern === 'orbit';

        this.controls.enabled = orbitMode;
        this.controls.autoRotate = orbitMode && autoRotateEnabled;
    }

    getEffectiveCameraDistance() {
        const baseDistance = this.settings.cameraDistance || 50;
        const dynamicEnabled = this.settings.dynamicCameraDistance !== false;

        if (!dynamicEnabled || !Number.isFinite(this.currentShipRadius) || this.currentShipRadius <= 0) {
            return baseDistance;
        }

        const fovRadians = THREE.MathUtils.degToRad(this.camera.fov);
        const fitDistance = (this.currentShipRadius / Math.tan(fovRadians / 2)) * 1.35;
        const zoomMultiplier = baseDistance / 50;

        return THREE.MathUtils.clamp(fitDistance * zoomMultiplier, 15, 220);
    }

    setCameraDistance(distance) {
        const dir = this.camera.position.clone().normalize();
        if (dir.length() === 0) {
            dir.set(0, 0, 1);
        }

        this.cameraDistanceTransition = null;
        this.activeCameraDistance = distance;
        this.camera.position.copy(dir.multiplyScalar(distance));
        this.controls.update();
    }

    startCameraDistanceTransition(targetDistance, durationMs = this.cameraDistanceTransitionDurationMs) {
        const currentDistance = Number.isFinite(this.activeCameraDistance) && this.activeCameraDistance > 0
            ? this.activeCameraDistance
            : this.camera.position.length() || 50;

        if (Math.abs(targetDistance - currentDistance) < 0.05) {
            this.setCameraDistance(targetDistance);
            return;
        }

        this.cameraDistanceTransition = {
            from: currentDistance,
            to: targetDistance,
            duration: Math.max(200, durationMs || 0),
            startedAt: performance.now(),
        };
    }

    updateCameraDistanceTransition() {
        if (!this.cameraDistanceTransition) {
            return;
        }

        const { from, to, duration, startedAt } = this.cameraDistanceTransition;
        const elapsed = performance.now() - startedAt;
        const progress = THREE.MathUtils.clamp(elapsed / duration, 0, 1);
        const eased = progress * progress * (3 - 2 * progress);
        this.activeCameraDistance = THREE.MathUtils.lerp(from, to, eased);

        const pattern = this.settings.cameraPattern || 'orbit';
        const isPatternDrivingCamera = pattern !== 'orbit' && this.settings.autoRotate !== false;

        if (!isPatternDrivingCamera) {
            const dir = this.camera.position.clone().normalize();
            if (dir.length() === 0) {
                dir.set(0, 0, 1);
            }
            this.camera.position.copy(dir.multiplyScalar(this.activeCameraDistance));
        }

        if (progress >= 1) {
            this.cameraDistanceTransition = null;
            this.activeCameraDistance = to;
        }
    }

    updateCameraDistanceForShip({ animate = false } = {}) {
        const targetDistance = this.getEffectiveCameraDistance();
        if (animate) {
            this.startCameraDistanceTransition(targetDistance);
            return;
        }

        this.setCameraDistance(targetDistance);
    }

    updatePatternCamera(deltaTimeMs) {
        const pattern = this.settings.cameraPattern || 'orbit';
        if (pattern === 'orbit' || this.settings.autoRotate === false) {
            return;
        }

        const rotationSpeed = this.settings.rotationSpeed || 2;
        const distance = this.activeCameraDistance || this.settings.cameraDistance || 50;
        const lookAtY = distance * 0.1;

        this.cameraAnimationTime += (deltaTimeMs / 1000) * rotationSpeed;
        const t = this.cameraAnimationTime;

        switch (pattern) {
            case 'carousel':
                this.camera.position.x = Math.sin(t * 0.7) * distance;
                this.camera.position.z = Math.sin(t * 1.4) * distance * 0.7;
                this.camera.position.y = (distance * 0.35) + (Math.cos(t * 1.2) * distance * 0.2);
                break;
            case 'showcase':
                this.camera.position.x = Math.cos(t * 0.55) * distance;
                this.camera.position.z = Math.sin(t * 0.55) * distance * 0.85;
                this.camera.position.y = (distance * 0.2) + (Math.sin(t * 0.3) * distance * 0.5);
                break;
            case 'examine':
                this.camera.position.x = Math.cos(t * 1.0) * distance * 0.6;
                this.camera.position.z = Math.sin(t * 1.0) * distance * 0.6;
                this.camera.position.y = (distance * 0.2) + (Math.sin(t * 2.0) * distance * 0.12);
                break;
            default:
                break;
        }

        this.camera.lookAt(0, lookAtY, 0);
    }

    scheduleNextShip() {
        if (this.shipTimer) clearTimeout(this.shipTimer);
        const duration = (this.settings.displayDuration) || 10000;
        this.shipTimer = setTimeout(() => this.nextShip(), duration);
    }

    getRandomShipIndex(ships, currentIndex = -1) {
        if (!ships || ships.length === 0) {
            return -1;
        }

        if (ships.length === 1) {
            return 0;
        }

        let nextIndex = currentIndex;
        while (nextIndex === currentIndex) {
            nextIndex = Math.floor(Math.random() * ships.length);
        }

        return nextIndex;
    }

    async nextShip() {
        const ships = this.settings.ships;
        if (!ships || ships.length < 2) return;
        this.currentShipIndex = this.getRandomShipIndex(ships, this.currentShipIndex);
        await this.loadShip(ships[this.currentShipIndex]);
        this.scheduleNextShip();
    }

    applyLightingPreset(preset) {
        const intensityMultiplier = this.settings.lightingIntensity || 1;

        switch(preset) {
            case 'bright':
                this.ambientLight.intensity = 0.8 * intensityMultiplier;
                this.directionalLight.intensity = 1.2 * intensityMultiplier;
                this.pointLight.intensity = 0.8 * intensityMultiplier;
                break;
            case 'ambient':
                this.ambientLight.intensity = 0.6 * intensityMultiplier;
                this.directionalLight.intensity = 0.8 * intensityMultiplier;
                this.pointLight.intensity = 0.5 * intensityMultiplier;
                break;
            case 'dramatic':
                this.ambientLight.intensity = 0.3 * intensityMultiplier;
                this.directionalLight.intensity = 1.5 * intensityMultiplier;
                this.pointLight.intensity = 1.0 * intensityMultiplier;
                break;
            case 'dark':
                this.ambientLight.intensity = 0.2 * intensityMultiplier;
                this.directionalLight.intensity = 0.6 * intensityMultiplier;
                this.pointLight.intensity = 0.3 * intensityMultiplier;
                break;
        }
    }

    async loadShip(modelUrl) {
        try {
            const previousShip = this.currentShip;

            // Wrap loader in timeout to prevent preview from appearing permanently stuck.
            const loadPromise = this.loader.loadAsync(modelUrl);
            const timeoutPromise = new Promise((resolve, reject) => {
                setTimeout(() => reject(new Error('Model load timeout')), 12000);
            });
            const gltf = await Promise.race([loadPromise, timeoutPromise]);
            const model = gltf.scene;

            // Scale and position the model
            model.scale.set(10, 10, 10);
            model.position.set(0, 0, 0);

            // Re-center every model so camera patterns and dynamic fit use a stable origin.
            const initialBox = new THREE.Box3().setFromObject(model);
            const modelCenter = initialBox.getCenter(new THREE.Vector3());
            model.position.sub(modelCenter);

            const centeredBox = new THREE.Box3().setFromObject(model);
            const centeredSphere = centeredBox.getBoundingSphere(new THREE.Sphere());
            this.currentShipRadius = Number.isFinite(centeredSphere.radius) && centeredSphere.radius > 0
                ? centeredSphere.radius
                : 10;

            // Enable shadows
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            this.scene.add(model);
            this.currentShip = model;

            if (previousShip) {
                this.setModelOpacity(model, 0);
                await this.crossfadeShips(previousShip, model, this.shipTransitionDurationMs);
                this.disposeShipModel(previousShip);
            } else {
                this.setModelOpacity(model, 1);
            }

            this.updateCameraDistanceForShip({ animate: Boolean(previousShip) });

            const shipName = this.resolveShipDisplayName(modelUrl);
            document.getElementById('ship-name').textContent = `Ship: ${shipName}`;

            return model;
        } catch (error) {
            console.error('Error loading ship:', error);
            document.getElementById('ship-name').textContent = 'Failed to load ship model';
            // Schedule next ship after brief delay so user can see the error
            if (this.shipTimer) clearTimeout(this.shipTimer);
            this.shipTimer = setTimeout(() => this.nextShip(), 2000);
        }
    }

    setModelOpacity(model, opacity) {
        model.traverse((child) => {
            if (!child.isMesh || !child.material) {
                return;
            }

            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((material) => {
                if (!material || typeof material.opacity !== 'number') {
                    return;
                }

                if (material.userData._fadeOriginalTransparent === undefined) {
                    material.userData._fadeOriginalTransparent = material.transparent;
                }

                material.transparent = opacity < 1 ? true : material.userData._fadeOriginalTransparent;
                material.opacity = opacity;
                material.needsUpdate = true;
            });
        });
    }

    async crossfadeShips(fromModel, toModel, durationMs) {
        const minDuration = 200;
        const totalDuration = Math.max(minDuration, durationMs || 0);
        const startTime = performance.now();

        await new Promise((resolve) => {
            const step = () => {
                const elapsed = performance.now() - startTime;
                const progress = THREE.MathUtils.clamp(elapsed / totalDuration, 0, 1);
                const eased = progress * progress * (3 - 2 * progress);

                this.setModelOpacity(fromModel, 1 - eased);
                this.setModelOpacity(toModel, eased);

                if (progress < 1) {
                    requestAnimationFrame(step);
                } else {
                    resolve();
                }
            };

            step();
        });
    }

    disposeShipModel(model) {
        this.scene.remove(model);
        model.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach((mat) => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }

    normalizeModelFilename(modelPath) {
        if (!modelPath || typeof modelPath !== 'string') {
            return null;
        }

        let pathname = modelPath;

        try {
            pathname = new URL(modelPath, window.location.href).pathname;
        } catch {
            pathname = modelPath;
        }

        const normalized = pathname
            .split('#')[0]
            .split('?')[0]
            .replace(/\\/g, '/');

        const filename = normalized.split('/').pop();
        if (!filename) {
            return null;
        }

        try {
            return decodeURIComponent(filename).toLowerCase();
        } catch {
            return filename.toLowerCase();
        }
    }

    getFallbackShipName(modelUrl) {
        const filename = this.normalizeModelFilename(modelUrl);
        if (!filename) {
            return 'Unknown Ship';
        }

        const stripped = filename
            .replace(/\.(?:gltf|glb)$/i, '')
            .replace(/_lite$/i, '')
            .replace(/_/g, ' ')
            .trim();

        return this.sanitizeShipDisplayName(stripped) || 'Unknown Ship';
    }

    openSettingsWindow() {
        if (!window.electronAPI?.openSettings) {
            return;
        }

        // Debounce to avoid duplicate open calls from overlapping right-click handlers.
        const now = Date.now();
        if ((now - this.lastSettingsOpenTime) < 300) {
            return;
        }

        this.lastSettingsOpenTime = now;
        window.electronAPI.openSettings().catch((error) => {
            console.error('Failed to open settings window:', error);
        });
    }

    sanitizeShipDisplayName(name) {
        if (typeof name !== 'string') {
            return '';
        }

        return name
            .replace(/^\s*\d+\s*[-_:|]\s*/, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }

    resolveShipDisplayName(modelUrl) {
        const filename = this.normalizeModelFilename(modelUrl);
        const metadata = filename ? this.shipMetadataByFilename[filename] : null;

        if (metadata && typeof metadata.displayName === 'string' && metadata.displayName.length > 0) {
            return this.sanitizeShipDisplayName(metadata.displayName) || metadata.displayName;
        }

        return this.getFallbackShipName(modelUrl);
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.cleanup();
                window.close();
            }
        });

        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.openSettingsWindow();
        });

        document.addEventListener('mousedown', (e) => {
            if (e.button === 2) {
                e.preventDefault();
                this.openSettingsWindow();
            }
        });

        // Explicit canvas handler for environments where document-level contextmenu is suppressed.
        this.renderer.domElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.openSettingsWindow();
        });

        // Cleanup on window close
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    cleanup() {
        // Dispose of Three.js resources
        if (this.currentShip) {
            this.disposeShipModel(this.currentShip);
        }

        // Dispose renderer
        if (this.renderer) {
            this.renderer.dispose();
        }
    }

    onWindowResize() {
        this.containerWidth = window.innerWidth;
        this.containerHeight = window.innerHeight;
        this.camera.aspect = this.containerWidth / this.containerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.containerWidth, this.containerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const now = performance.now();
        const deltaTimeMs = now - this.lastFrameTime;
        this.lastFrameTime = now;

        this.updateCameraDistanceTransition();
        this.updatePatternCamera(deltaTimeMs);

        if (this.controls) {
            this.controls.update();
        }

        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize screensaver when page loads
window.addEventListener('load', () => {
    try {
        new ShipsScreensaver();
    } catch (error) {
        console.error('Screensaver failed to initialize:', error);
        const shipNameEl = document.getElementById('ship-name');
        if (shipNameEl) {
            shipNameEl.textContent = `Initialization failed: ${error.message}`;
        }
    }
});
