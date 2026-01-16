# Original/ – AGENTS

## OVERVIEW
Primary jsMacros scripts, configs, and services for Origin Realms automation.

## STRUCTURE
```
Original/
├── core/        # Shared utilities (Point3D, FarmState, FarmIterator, ConfigLoader)
├── planting/    # Farming + vending automation
├── config/      # plantingConfig.json, vendingConfig.json
├── 捡漏/       # Auction bargain hunting scripts
├── draft/       # Prototypes and experiments
├── example/     # Example scripts
└── 备份/       # Backups
```

## WHERE TO LOOK
- Main farming entry: `planting/种植_v3.js`
- Vending entry: `planting/作物自动售货机-v2.js` → `planting/vending/`
- Legacy harvest/water: `planting/收菜.js`, `planting/浇水.js`
- Shared services: `planting/services/`
- Shared core utilities: `core/`
- Auction bargain bot: `捡漏/FindingBargain.js`
- Configs: `config/plantingConfig.json`, `config/vendingConfig.json`

## CONVENTIONS
- CommonJS module pattern throughout.
- Refactored v3 code uses service layer + JSDoc headers.
- Coordinates/timings/keybindings are externalized to JSON.
- Private fields use underscore prefix.
- Enums defined with `Object.freeze()` in core state modules.
- Movement/iteration uses `Point3D` and generator-based traversal.

## ANTI-PATTERNS
- Editing files in `备份/` or `draft/`.
- Copying patterns from legacy single-file scripts into v3 services.
- Embedding coordinates or timings directly in scripts.
