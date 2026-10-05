# Mineral showcase assets

Served at `/assets/*`. Drop the Blender pipeline outputs here (FRD §8.3); the
`MineralAsset` rows in the DB point at these paths.

Per commodity+version:
- `<commodity>-<version>-poster.webp` — premium still render (hero + fallback, FR-87/88)
- `<commodity>-concentrate-<version>.glb` — Draco-compressed GLB (FR-82/92)

Until the real files exist, `MineralShowcase` falls back to the poster and then a
gradient card, so the catalog still renders.
