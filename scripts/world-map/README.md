# Land-only world map

Run `node scripts/world-map/build.cjs`, or add `--check` for a read-only consistency check.

The runtime map uses only the existing Natural Earth `land` object in `dist/data/world.json`, already merged across countries. Country polygon outlines are not drawn or bundled, avoiding border lines and seams between separately filled country polygons. Only referenced land arcs are packed into `miniprogram/lib/world.js`, reducing payload and decoding work.

Mercator projection, scale, geographic placement, airports and routes are unchanged. The homepage (including empty state), exported/shared posters and flight replay all consume the same land-only module. Rebuild the 100 palette previews with `scripts/palette-library/build.cjs --images` after changes; increment their asset revision to invalidate old preview caches.

Source and license: Natural Earth, public domain, https://www.naturalearthdata.com/about/terms-of-use/ . No new geographic dataset is introduced. Country data retained in the source topology is not used by the mini-program renderer. The preceding Zangnan boundary-specific build and source segment are preserved as historical records under the parent workspace's `outputs/reviews/2026-11-17/map-audit/`; boundary patching is no longer part of this build.

Removing country boundaries is a visual/content choice, not a declaration of exemption from map review.
