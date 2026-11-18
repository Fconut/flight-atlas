# Third-party components

Retain upstream copyright and license notices when redistributing.

## Mini-program screenshot import

- Tesseract.js 5.1.1 and tesseract.js-core: Apache-2.0; license files remain in the cloud function npm dependencies.
- Long-screenshot decoding: pngjs 7.0.0 (MIT) and jpeg-js 0.4.4 (BSD-3-Clause); license files remain in the cloud function npm dependencies.
- @tesseract.js-data/chi_sim and /eng 1.0.0: MIT package wrappers; upstream Tesseract language data: Apache-2.0.
- Mini-program airport search metadata reuses the web dataset, including Timeon1/TMC_Dataset (MIT, Copyright 2024 YanWei). Full license: licenses/TMC_Dataset-MIT.txt.

- D3: https://github.com/d3/d3 (ISC)
- TopoJSON Client: https://github.com/topojson/topojson-client (ISC)
- SheetJS Community Edition: https://git.sheetjs.com/sheetjs/sheetjs (Apache-2.0)
- html-to-image: https://github.com/bubkoo/html-to-image (MIT)
- OurAirports: https://ourairports.com/data/ (public domain)
- Natural Earth: https://www.naturalearthdata.com/about/terms-of-use/ (public domain)

### Eastern China–India boundary correction (2026-11-17)

Historical correction: one shared boundary arc was updated from Natural Earth's China POV geographic data (Git blob `464406c710df1add2c6025b1c90b67c207b4002b`, public domain). The mini-program subsequently switched to merged land geometry, so that country-boundary arc is no longer bundled or rendered. Historical source records are retained in the parent workspace's map audit outputs.

### Land-only mini-program map (2026-11-17)

The mini-program uses the existing Natural Earth merged `land` topology, with coastlines and islands but no country polygons or boundaries. Mercator projection and geographic route positions are retained. Build instructions: `scripts/world-map/README.md`. Natural Earth licensing remains public domain; this presentation change does not constitute map-approval certification. The website implementation is unchanged.

### Travel stamps (2026-11-17)

The 100 travel stamps are original geometric Canvas illustrations defined in `miniprogram/lib/stamp-draw.js` and `design/stamps/catalog.v1.json`. Shipped PNG previews are generated from these vector commands; they are not crops from the AI-generated concept contact sheet. No airline symbols, flags, official seals or third-party icon libraries are included. The public-domain map data attribution above remains applicable to poster examples.

- Supabase JS: https://github.com/supabase/supabase-js (MIT); bundled license: dist/vendor/supabase-LICENSE.txt

## Airline logo images

The PNG files under dist/assets/airline-logos/ are sourced from https://github.com/imgmongelli/airlines-logos-dataset at revision 7b001fb8d5d0a2f875d57b2b5a8a8056b2fbc63a. Its README declares MIT licensing for the repository. Airline names, logos and trademarks remain the property of their respective owners; this attribution does not imply airline endorsement or grant additional trademark rights. Matching uses the existing ICAO directory rather than guessing reused IATA codes. Missing or failed images fall back to text. No runtime third-party image requests are needed.

## Mini-program airline symbols (2026-11-14)

Mini-program symbols now use Soaring Symbols revision 0d0ff8c1f7c3133412f3cce595caa12abc52cdfd (MIT, Copyright 2024 Anh Thang). Historical license retained at docs/legal/airline-logos/symbols-LICENSE.txt; the mini-program symbol images and their former NOTICE file were subsequently retired. Fifty symbol-only images replace old wordmarks; 31 unsupported airlines fall back to flight text. All 81 original files were verified against upstream Git blob hashes. Per-file provenance, checksums and rights caveats: docs/legal/airline-logos/inventory.json. Upstream does not grant airline-specific trademark or copyright authorization; airline ownership and endorsement must not be inferred from repository licensing. Website assets are unchanged.

## Airline code marks (2026-11-14)

The mini-program now draws plain airline codes in a common typeface and shape, using existing representative UI colors. All 50 airline symbol PNGs and their runtime catalog have been removed from the mini-program package. Airline image provenance and upstream license records above are retained as historical audit evidence in docs/legal/airline-logos; they do not describe currently shipped mini-program images. Website assets are unchanged.
## Airport search names
Chinese airport full names and city labels in airport-search-data.js include Timeon1/TMC_Dataset (MIT, Copyright 2024 YanWei). License: licenses/TMC_Dataset-MIT.txt. ICAO identifiers use the existing OurAirports/airport-codes snapshot. See docs/airport-search.md.
