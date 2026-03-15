# Full Diagram — webtrees Chart Module

A [MyHeritage](https://www.myheritage.com/) "Family View" style visualization for [webtrees](https://webtrees.net/), showing direct ancestors and descendants as well as siblings and their spouses in a single interactive diagram.

## Features

- Combined ancestor and descendant tree in one view
- Siblings and their spouses displayed alongside the main lineage
- Interactive SVG diagram with pan and zoom (D3.js + ELK layout)
- Configurable generation limits for ancestors and descendants
- Available as both a standalone chart and an individual-page tab
- Hover cards with summary information

## How the Layout Works

The diagram is laid out using [ELK](https://www.eclipse.dev/elk/) (Eclipse Layout Kernel) and its layered (Sugiyama) algorithm. The family tree is modelled as a directed graph where each person is a node and couples are connected through small invisible "union" nodes. ELK's layered algorithm assigns each node to a horizontal layer (one per generation), minimises edge crossings between layers, and positions nodes to keep connecting edges short.

Spouses are fed into ELK as adjacent nodes with model-order constraints so they stay next to each other. After ELK computes X positions, Y coordinates are snapped to a strict generation grid and orthogonal bus-line connectors (couple bars, vertical drops, horizontal child rails) are drawn manually rather than relying on ELK's edge routing.

## Requirements

- [webtrees](https://webtrees.net/) 2.2+
- PHP 8.2+

## Installation

1. Download the [latest release](../../releases/latest).
2. Extract it into the `modules_v4/` directory of your webtrees installation so the structure is `modules_v4/webtrees-full-diagram/module.php`.
3. Go to **Control panel > Modules > Charts** and enable "Full Diagram".

## Development

```bash
# Start the local dev environment (webtrees + MariaDB)
cd docker && docker compose up -d

# Install JS dependencies
npm install

# Build the JS bundle (watches for changes)
npm run watch

# One-off production build
npm run build
```

## License

This program is free software: you can redistribute it and/or modify it under the terms of the [GNU Affero General Public License](LICENSE) as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
