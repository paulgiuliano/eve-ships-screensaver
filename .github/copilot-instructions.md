# EVE Ships Screensaver - Project Instructions

This is an Electron-based Windows screensaver displaying EVE Online ships with 3D rendering, customizable lighting, and backdrop options.

## Project Overview

- **Type**: Electron Desktop Application with WebGL/Three.js 3D Rendering
- **Target**: Windows Screensaver
- **Main Technologies**: Electron, Three.js, Node.js
- **Status**: Development Ready

## Architecture

- **Main Process**: `src/main.js` - Handles window management and IPC
- **Preload Script**: `src/preload.cjs` - Secure IPC bridge
- **UI Layer**: `src/ui/` - HTML/CSS/JS for screensaver and settings
- **3D Rendering**: Three.js with GLTFLoader for ship models
- **Settings**: electron-store for persistent configuration

## Key Features

1. **3D Ship Display** - Loads EVE Online ships from glTF/glB models
2. **Customizable Settings** - Backdrop color, lighting, rotation speed, camera distance
3. **Multiple Camera Patterns** - Orbit, carousel, showcase, examine modes
4. **Lighting Presets** - Ambient, Bright, Dramatic, Dark
5. **Persistent Settings** - Saves user preferences locally

## Development Workflow

### Getting Started

```bash
npm install              # Install dependencies
npm start               # Run application
npm run dev             # Run with developer tools
npm run build:win       # Build Windows installer
```

### Project Structure

```
src/
├── main.js              # Electron main process
├── preload.cjs          # IPC security bridge
├── ShipManager.js       # Ship loading and management
├── CameraController.js  # Advanced camera animations
└── ui/
    ├── screensaver.html # Main display
    ├── screensaver.js   # 3D rendering logic
    ├── settings.html    # Settings dialog
    └── settings.js      # Settings management
```

## Important Notes

- **Models**: Ship models are sourced from [EVE Model Gallery](https://github.com/EstamelGG/EVE_Model_Gallery) as glTF/glB files
- **Security**: Uses contextIsolation and preload script for secure IPC
- **Performance**: Optimized for 1080p+ displays with modern GPUs
- **Platform**: Currently Windows-focused, but Electron code is cross-platform

## Configuration Files

- **package.json** - Project dependencies and build configuration
- **CONFIGURATION.md** - Detailed settings reference
- **README.md** - Full project documentation

## Settings Management

Settings are stored via electron-store and include:

- `ships` - Array of ship model URLs/paths
- `rotationSpeed` - Camera rotation multiplier (0.5-5)
- `backdropColor` - Background hex color
- `lightingPreset` - Lighting style (ambient/bright/dramatic/dark)
- `cameraDistance` - Camera zoom distance (20-150)
- `autoRotate` - Auto-rotation toggle
- `displayDuration` - Time to show each ship (ms)
- `cameraPattern` - Movement pattern (orbit/carousel/showcase/examine)

## Development Guidelines

1. **Code Style**: ES6 modules, use async/await
2. **Three.js**: Using r158+ with CDN for GLTFLoader and OrbitControls
3. **Electron IPC**: Always use preload.cjs for secure context-isolated communication
4. **Performance**: Minimize draw calls, use efficient geometries
5. **UI**: Responsive design, works at any resolution

## Key Files to Edit

- **Add Ships**: Modify `ShipManager.js` `loadDefaultShips()` method
- **New Lighting**: Add presets in `screensaver.js` `applyLightingPreset()` method
- **New Camera Pattern**: Add to `CameraController.js` update methods
- **Settings UI**: Modify `settings.html` and `settings.js`

## Running and Testing

```bash
# Development mode with devtools
npm run dev

# Production build
npm run build:win

# The installer will be in dist/ folder
```

## Troubleshooting

- **Models not loading**: Check browser console in dev tools (F12)
- **Settings not saving**: Verify electron-store configuration
- **Performance issues**: Reduce rotation speed, increase camera distance
- **Network issues during install**: Use `npm install --legacy-peer-deps`

## Next Steps for Enhancement

1. [ ] Ship selection UI in settings
2. [ ] Multiple simultaneous ships
3. [ ] Custom animation patterns
4. [ ] Audio/music integration
5. [ ] Screenshot capture feature
6. [ ] Ship information overlay

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [Three.js Documentation](https://threejs.org/docs/)
- [EVE Model Gallery](https://github.com/EstamelGG/EVE_Model_Gallery)
- [electron-store Documentation](https://github.com/sindresorhus/electron-store)

## Testing Checklist

- [ ] Ships load and display correctly
- [ ] Settings save and persist
- [ ] Lighting presets apply visually
- [ ] Camera patterns work smoothly
- [ ] Rotation speed affects animation
- [ ] ESC key exits screensaver
- [ ] Right-click opens settings menu
- [ ] Window resizing works properly
- [ ] No memory leaks during extended use

---

**Project Ready for Development** ✓
