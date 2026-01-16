# Original/planting/services/ – AGENTS

## OVERVIEW
Service layer for movement, inventory, vending, scheduling, and events.

## WHERE TO LOOK
- Movement: `MovementService.js`, `VendingMovementService.js`
- Inventory: `InventoryService.js`, `VendingInventoryService.js`
- Execution: `FarmingExecutor.js`
- Events: `EventHandler.js`, `VendingEventHandler.js`
- Scheduling: `Scheduler.js`, `QueueService.js`
- Auction/vending: `AuctionService.js`, `BasketService.js`, `JackoService.js`
- Parsing/logging: `MessageParser.js`, `Logger.js`

## CONVENTIONS
- Constructor-based dependency injection (pass `config`, `logger`, collaborators).
- Private fields use underscore prefix (`this._config`, `this._logger`).
- Timings/thresholds read from config, not literals.
- Event callbacks wrap handler logic in try/catch and log errors.
- Logger levels: debug/info/warn/error with Minecraft color codes.
- `InventoryService` uses short-lived caches for item lookup.
- `Scheduler` reads bossbar time and computes tick delays.
- CommonJS exports (`module.exports = ClassName`).

## ANTI-PATTERNS
- Hardcoding tick delays inside services instead of config values.
- Calling `Chat.log` directly in vending services when `Logger` exists.
- Skipping pause/stop checks in long-running loops.
- Adding circular dependencies instead of passing services in constructors.
- Parsing chat messages without `MessageParser` normalization.
