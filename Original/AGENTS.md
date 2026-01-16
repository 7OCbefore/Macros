# AGENTS.md

## OVERVIEW

Original macros directory containing farming automation, auction house bargain hunting, and legacy scripts with mixed architecture patterns.

## STRUCTURE

```
Original/
├── core/                          # Core utilities
│   ├── ConfigLoader.js           # JSON loader with caching
│   ├── Point3D.js                # Immutable 3D coordinates
│   ├── FarmState.js              # State + enums
│   └── FarmIterator.js           # Generator iteration
├── planting/                      # Farming automation (v3 refactored)
│   ├── 种植_v3.js                # Main entry
│   ├── 收菜.js                   # Harvest entry
│   ├── 浇水.js                   # Watering entry
│   ├── 作物自动售货机-v2.js      # Vending entry
│   ├── services/                 # Business logic (10 services)
│   └── vending/                  # Vending subsystem
├── config/                        # Externalized configs
│   ├── plantingConfig.json       # Farming params
│   └── vendingConfig.json        # Vending params
├── draft/                         # Pre-refactoring prototypes
├── example/                       # Reference implementations
├── 备份/                          # Deprecated backups
└── 捡漏/                          # Auction bargain hunter
    ├── FindingBargain.js         # Main bot
    └── inventory_data.csv        # Price data
```

## WHERE TO LOOK

**Farming (Modern):** Start `planting/种植_v3.js` entry → `core/ConfigLoader.js` config → `planting/services/` for logic.

**Legacy Prototypes:** `draft/种植.js` shows original monolithic architecture before Google JavaScript standards.

**Auction Bot:** `捡漏/FindingBargain.js` monolithic CSV-based price comparison script.

**Config:** `config/plantingConfig.json` contains all positions, keybindings, timings, item definitions.

## CONVENTIONS

**Naming:** Chinese names with version suffixes (v3, -v2) for entries. Services use PascalCase + Service.js. Core uses PascalCase.

**Documentation:** JSDoc on all classes/methods. File header: `@file`, `@description`, `@version`. Google JavaScript Style Guide compliance.

**Config:** JSON files in `config/`. No hardcoded positions/timings. All parameters externalized.

**Architecture:** Service layer pattern. Dependency injection via constructor. Single responsibility per class. Private methods `_prefixed`.

**State:** `FarmState.js` with enums (StatePhase, OperationMode). Statistics tracking for blocks processed, items used.

**Coordinates:** `Point3D.js` immutable. Factory methods `from(array)`, `fromBlock(block)`. Distance utility methods.

**Performance:** Generator iteration (O(1) memory). Caching in ConfigLoader/InventoryService. Map/Set for O(1) lookups.

**Modules:** `require()` for deps. `module.exports` single instance or class export.

**Entries:** Create Application class → initialize() → setup handlers → display instructions → error handling with stack traces.

## ANTI-PATTERNS

**Mixed Architecture:** `draft/` and `备份/` contain monolithic scripts with hardcoded values, not maintained.

**Global State:** Some scripts use globals instead of state objects. New code should follow FarmState pattern.

**Missing Tests:** `tests/` referenced in docs but not present in file system.

**Hardcoded Paths:** `捡漏/FindingBargain.js` has absolute Windows paths instead of `__dirname` relative paths.

**Magic Numbers:** Hardcoded timing values (14, 20 ticks) in scripts instead of config files.
