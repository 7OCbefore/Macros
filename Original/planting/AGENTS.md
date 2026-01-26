# Original/planting/ – AGENTS

## OVERVIEW
Planting and vending automation with v3 services plus legacy scripts.

## STRUCTURE
```
planting/
├── services/                  # Movement, inventory, executor, logger, scheduler
├── vending/                   # VendingApplication, VendingState
├── 种植_v3.js                   # Main v3 planting entry
├── 收菜.js                      # Legacy harvest entry
├── 浇水.js                      # Legacy watering entry
└── 作物自动售货机-v2.js           # Vending entry
```

## WHERE TO LOOK
- v3 planting app: `种植_v3.js` (state + services + EventHandler wiring)
- Vending app: `作物自动售货机-v2.js` → `vending/VendingApplication.js`
- Movement + pathing: `services/MovementService.js`
- Inventory + chests: `services/InventoryService.js`
- Execution loop: `services/FarmingExecutor.js`
- Event bindings: `services/EventHandler.js`, `services/VendingEventHandler.js`
- Logging: `services/Logger.js`

## CONVENTIONS
- CommonJS `require()` + `module.exports` across all modules.
- Config loaded via `core/ConfigLoader.js` from `../config/*.json`.
- Timings are ticks; avoid hardcoded waits in scripts.
- v3 files use JSDoc headers and underscore-prefixed private fields.
- Logging uses `§` color codes and consistent prefixes.
- Event listeners wrap handlers with try/catch and log errors.

## ANTI-PATTERNS
- Known issues listed in `种植_v3.js` (restock edge misses, large-angle smoothing, GUI interference).
- Legacy scripts (`收菜.js`, `浇水.js`) bypass the service layer.
