# EVE Ships Screensaver

Electron-based Windows screensaver-style app that displays EVE Online ships in 3D using Three.js, with configurable camera and lighting behavior.

## Quick Start

```bash
npm install
npm start
```

Development mode (opens Chromium devtools):

```bash
npm run dev
```

Build Windows installer:

```bash
npm run build:win
```

## What It Does

- Loads ship models from the EVE Model Gallery (`_lite.glb` files).
- Displays ships fullscreen with smooth camera motion and lighting presets.
- Persists user settings with `electron-store`.
- Supports one-click refresh for ship catalog and name metadata.

## Controls

- `ESC`: Exit screensaver window
- Right-click: Open Settings
- Menu -> File -> Settings: Open Settings

## Settings Overview

- Backdrop color
- Rotation speed
- Lighting preset (`ambient`, `bright`, `dramatic`, `dark`)
- Lighting intensity multiplier
- Camera distance
- Dynamic camera distance auto-fit
- Camera pattern (`orbit`, `carousel`, `showcase`, `examine`)
- Auto-rotate toggle
- Display duration per ship

Full field reference and defaults: see [CONFIGURATION.md](CONFIGURATION.md).

## Ship Catalog and Metadata

On startup, the app attempts to fetch:

- Full ship model catalog from EVE Model Gallery repository tree
- Ship name metadata index for human-readable overlay names

Caching behavior:

- Catalog and metadata are cached locally for 24 hours
- If remote fetch fails, app falls back to cached data
- If no cache is available, app falls back to bundled legacy starter ships

Settings UI actions:

- `Refresh Ship Names`: refreshes metadata map only
- `Refresh Ships and Names`: refreshes model catalog + metadata and updates active ship list

## Project Structure

```text
src/
  main.js                Electron main process and IPC handlers
  preload.cjs            Context-isolated API bridge
  ShipManager.js         Ship list helpers
  CameraController.js    Camera pattern logic helpers
  ui/
    screensaver.html     Fullscreen renderer shell
    screensaver.js       Three.js scene, loading, animation
    settings.html        Settings UI
    settings.js          Settings UI logic
```

## Documentation Layout

This project now uses two maintained docs:

- [README.md](README.md): setup, usage, architecture, operations
- [CONFIGURATION.md](CONFIGURATION.md): complete settings reference

## Troubleshooting

### Models do not load

- Verify internet access to GitHub for initial catalog fetch
- Run with `npm run dev` and check devtools console for loader/network errors

### Settings seem not to apply

- Change a setting in the Settings window and close/reopen screensaver
- Confirm no runtime errors in devtools console

### Performance is stuttery

- Lower rotation speed
- Increase camera distance
- Use `ambient` preset with reduced lighting intensity

## License

MIT
