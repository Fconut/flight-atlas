# Airport search and screenshot parsing

Both manual flight entry and screenshot review use `AirportSearch` in `dist/airport-search.js`. Do not add airport-specific branches in either UI.

## Data
- The existing 8,798-airport snapshot supplies English names, cities, countries and coordinates.
- `dist/airport-search-data.js` adds ICAO identifiers from the existing OurAirports/airport-codes CSV snapshot and Chinese names and city labels for 309 airports from [Timeon1/TMC_Dataset](https://github.com/Timeon1/TMC_Dataset), MIT, plus curated international aliases.
- Existing `airport-zh.json` remains a display-label source; a city abbreviation is not a complete airport name.
- Chinese aliases do not yet cover all airports worldwide. Missing or ambiguous names must remain editable; do not fabricate a code.
- The generated data is loaded before the shared search module and editor. Its rows are joined by IATA to the current airport snapshot; no new airport or coordinate is invented.

## Matching contract
Normalize Unicode, common traditional character variants, quotes, next-day OCR prefixes and terminal suffixes. Search canonical IATA/ICAO first, then exact names and aliases, cities, partial names, and bounded edit distance. Return ranked candidates with a reason. Only an unambiguous code or exact airport name can resolve automatically. City and fuzzy results require selection, including cities with multiple airports. Preserve screenshot source text beside airport fields.

An index is cached by airport/name object reference. Rebuild only when those data sources change. Candidate UI uses textContent, not HTML.

## Screenshot contracts
List screenshots associate date/year, flight number and successive time/airport lines. An undated card inherits the preceding complete date in the same screenshot. A first cropped card stays incomplete; an explicit month/day without a year blocks inheritance until a complete date is available.
Detail screenshots with a planned date and horizontal route form one flight from the header. Scheduled departure is used, not an arrival status timestamp; duplicate footer flight numbers are ignored. Aircraft text is retained as shown rather than guessed.

## Validation
`tests/airport-search.test.cjs` exercises the real airport snapshot, aliases, ICAO codes, ambiguous cities, typo candidates, cached index and clickable candidate controls. `tests/image-import.test.cjs` covers representative list and detail OCR text plus missing-field feedback. These are text/logic tests; they do not assert that every screenshot pixel is read correctly by Tesseract.

Query results are bounded to 100 cached searches per index. OCR workers are owned by one dialog and released idempotently on success, failure or cancellation. Field captions label only their own input; candidate buttons are sibling controls.
