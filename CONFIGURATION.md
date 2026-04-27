# Configuration Reference

Settings are persisted with `electron-store` under the `settings` key.

## Default Settings

```json
{
  "ships": ["https://raw.githubusercontent.com/EstamelGG/EVE_Model_Gallery/main/docs/models/587_lite.glb", "..."],
  "rotationSpeed": 2,
  "backdropColor": "#1a1a2e",
  "lightingPreset": "ambient",
  "lightingIntensity": 1,
  "cameraDistance": 50,
  "dynamicCameraDistance": true,
  "cameraPattern": "orbit",
  "autoRotate": true,
  "displayDuration": 10000
}
```

Notes:

- `ships` starts with a bundled legacy list, then is replaced with the fetched gallery catalog when available.
- `displayDuration` is stored in milliseconds.

## Field Reference

### `ships` (array of string URLs)

- Source list used for rotation.
- Typically managed automatically from the remote catalog.

### `rotationSpeed` (number, `0.5` to `5`)

- Rotation/camera animation speed multiplier.

### `backdropColor` (string hex color)

- Renderer background color.

### `lightingPreset` (string)

Allowed values:

- `ambient`
- `bright`
- `dramatic`
- `dark`

### `lightingIntensity` (number, `0.2` to `2.5`)

- Multiplies the active lighting preset intensities.

### `cameraDistance` (number, `20` to `150`)

- Base camera distance.
- Also acts as a zoom multiplier when dynamic auto-fit is enabled.

### `dynamicCameraDistance` (boolean)

- When `true`, camera distance is auto-fit per ship size.
- When `false`, fixed `cameraDistance` is used.

### `cameraPattern` (string)

Allowed values:

- `orbit`
- `carousel`
- `showcase`
- `examine`

### `autoRotate` (boolean)

- Enables/disables automatic camera movement.

### `displayDuration` (number, `5000` to `60000`)

- Time each ship remains on screen before rotating.

## Catalog and Metadata Refresh

Settings window actions:

- `Refresh Ship Names`: refresh metadata map only.
- `Refresh Ships and Names`: refresh model catalog + metadata and update active ship list.

Cache behavior in main process:

- Catalog cache key: `shipCatalogCache`
- Metadata cache key: `shipMetadataCache`
- TTL: 24 hours

## Troubleshooting

### Settings are not persisted

- Verify the app can write to the user data directory.
- Check console output in `npm run dev` for IPC/store errors.

### Ship names are missing or stale

- Use `Refresh Ship Names` from Settings.
- If model list is also outdated, use `Refresh Ships and Names`.

For app-level usage and architecture, see [README.md](README.md).
