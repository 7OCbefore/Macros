# Original/planting

Modular planting automation with service-oriented architecture for farm management and crop vending operations.

## STRUCTURE

```
planting/
├── services/                      # 11 service modules for business logic
│   ├── EventHandler.js            # Centralized key event handling
│   ├── Logger.js                  # Color-coded logging utility
│   ├── MovementService.js         # Player navigation with GCD snap
│   ├── InventoryService.js        # Inventory & container management
│   ├── PlayerService.js           # Player state (hunger, position)
│   ├── FarmingExecutor.js         # Main farming operation engine
│   ├── VendingMovementService.js  # Vending-specific movement
│   ├── VendingInventoryService.js # Vending inventory handling
│   ├── VendingEventHandler.js     # Vending key bindings
│   ├── AuctionService.js          # Auction house integration
│   ├── BasketService.js           # Basket management
│   ├── MessageParser.js           # Chat message parsing
│   ├── QueueService.js            # Operation queue management
│   ├── Scheduler.js               # Periodic task scheduling
│   └── JackoService.js            # Jacko market operations
├── vending/                       # Vending application state & logic
│   ├── VendingApplication.js      # Vending entry orchestrator
│   └── VendingState.js            # Vending state management
├── core/                          # Shared data structures (referenced from ../core/)
│   ├── ConfigLoader.js            # JSON config loader with caching
│   ├── Point3D.js                 # Immutable 3D coordinates
│   ├── FarmState.js               # Farm state & statistics
│   └── FarmIterator.js            # Generator-based area traversal
├── 种植_v3.js                      # Main planting entry point (refactored v3)
├── 收菜.js                         # Harvest script (legacy pattern)
├── 浇水.js                         # Watering script (standalone)
└── 作物自动售货机-v2.js             # Crop vending machine entry
```

## WHERE TO LOOK

**Entry Points:**
- `种植_v3.js`: Main automated planting with ConfigLoader, EventHandler registration, and service orchestration
- `收菜.js`: Standalone harvest script using snake-walk algorithm and chest inventory management
- `浇水.js`: Single-function watering script with pause/close keybindings
- `作物自动售货机-v2.js`: Vending orchestrator using VendingApplication module

**Service Layer:**
- `services/EventHandler.js`: Centralized key handling (close, pause, left-click mode selection)
- `services/Logger.js`: Consistent color-coded logging (`§3[Prefix]§b[INFO] message§r`)
- `services/MovementService.js`: GCD snap algorithm for smooth lookAt (`_grimSnap()` method)
- `services/InventoryService.js`: Cached item lookups with 500ms TTL

**Vending System:**
- `vending/VendingApplication.js`: Dependency injection container for all vending services
- `vending/VendingState.js`: Market state tracking

**Configuration:**
- `../config/plantingConfig.json`: Positions, keybindings, timings, thresholds
- `../config/vendingConfig.json`: Vending settings, crop data, jacko configuration

## CONVENTIONS

**Module System:**
- CommonJS `require()` for all dependencies
- `module.exports` at end of files
- Services use constructor injection for dependencies

**Logging Pattern:**
```javascript
// Color-coded format: §3[Prefix]§X[LEVEL] message§r
Chat.log('§a[System] Operation successful');    // Green
Chat.log('§e[Warning] Low items');              // Yellow
Chat.log('§c[Error] Failed: message');          // Red
Logger.info('Message', 'Context');              // Via Logger service
```

**Keybinding Configuration:**
- Defined in config JSON under `keybindings`
- Standard keys: `close` (X), `pause` (Z), `leftClick`, `modeSoil` (1), `modeFertilize` (2), `modePlant` (3)

**Event Handling Pattern:**
```javascript
class EventHandler {
    constructor(config, state, executor) {
        this._config = config;
        this._keys = config.keybindings;
        this._listener = null;
    }
    
    register() {
        this._listener = JsMacros.on("Key", JavaWrapper.methodToJava((event, ctx) => {
            this._handleKeyEvent(event, ctx);
        }));
    }
    
    unregister() {
        JsMacros.off(this._listener);
    }
}
```

**JSDoc Headers (v3.0+):**
```javascript
/**
 * @file ScriptName.js
 * @description Functional description
 * @version 3.0.0
 * @architecture Google JavaScript Standards Compliant
 */
```

**Configuration Loading:**
- Use `ConfigLoader.load('../config/xxxConfig.json')`
- Cache automatically managed with `ConfigLoader.clearCache()` on shutdown
- Validate required sections after load

## ANTI-PATTERNS

**Known Issues (种植_v3.js):**
1. Post-refill resume skips blocks: After chest refill, execution may miss 1-2 blocks (edge case)
2. Large angle smooth rotation: Jerky movement when turning >90 degrees
3. GUI interaction interference: Target blocks are interactable containers; opening GUI mid-operation causes missed blocks

**TODO (作物自动售货机-v2.js):**
- Smart crop stocking and restocking functionality unimplemented

**Legacy Scripts:**
- `收菜.js` and `浇水.js` use monolithic pattern without service modularization
- Hardcoded coordinates instead of config-driven approach
- No state management or error recovery

**Performance Concerns:**
- `收菜.js` uses O(n) array operations instead of Map/Set for item lookups
- No pause state checking during long operations (浇水.js has basic pause support)
- No cache for player position or inventory state
