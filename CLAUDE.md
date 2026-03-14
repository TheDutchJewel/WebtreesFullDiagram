# Full Diagram - webtrees Chart Module

## Project Overview
webtrees 2.2 chart module that visualizes the entire family tree (ancestors, descendants, siblings) in a single interactive SVG diagram. Inspired by MyHeritage "Family View".

## Tech Stack
- **PHP 8.2+** — webtrees 2.2 module (extends AbstractModule, implements ModuleChartInterface + ModuleCustomInterface)
- **Namespace**: `FullDiagram\`
- **D3.js v7** (cherry-picked: d3-hierarchy, d3-selection, d3-zoom, d3-shape, d3-transition) — SVG rendering
- **Rollup** — JS bundling
- **Docker Compose** — local dev (webtrees + MariaDB)

## Key Conventions
- PSR-4 autoloading: `FullDiagram\` → `src/`
- Views in `resources/views/modules/full-diagram/`
- JS source in `resources/js/modules/`, built to `resources/js/full-diagram.min.js`
- CSS in `resources/css/full-diagram.css`
- Route pattern: `/tree/{tree}/full-diagram/{xref}`

## Development
```bash
# Start dev environment
cd docker && docker compose up -d

# JS development
npm install && npm run watch

# Build for release
npm run prepare
```

## Architecture
- `module.php` — entry point, autoloads namespace, returns Module instance
- `src/Module.php` — route registration, request handling, view rendering
- `src/Configuration.php` — generation limits, display toggles
- `src/Facade/DataFacade.php` — bidirectional tree traversal (ancestors + descendants + siblings)
- `src/Model/NodeData.php` — person data (JsonSerializable)
- `src/Model/FamilyNode.php` — family unit: couple + children
- JS uses dual d3.tree() layout: ancestors upward, descendants downward, stitched at root

## Important Notes
- webtrees uses `view()` helper for templates with `::` namespace syntax
- Route registration uses `Registry::routeFactory()` in `boot()`
- Access control via `Auth::checkComponentAccess()`
- Individual data accessed via `$individual->facts()`, `childFamilies()`, `spouseFamilies()`
