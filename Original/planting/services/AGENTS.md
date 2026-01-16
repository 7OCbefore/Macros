# Planting Services Architecture

## OVERVIEW
Modular service layer providing farming automation with clear separation of concerns across movement, inventory, player actions, event handling, and scheduling.

## WHERE TO LOOK
- **Core Farming**: `MovementService.js`, `InventoryService.js`, `PlayerService.js`, `FarmingExecutor.js`, `EventHandler.js`
- **Scheduling**: `Scheduler.js`, `JackoService.js`
- **Vending**: `VendingMovementService.js`, `VendingInventoryService.js`, `VendingEventHandler.js`
- **Utilities**: `Logger.js`, `BasketService.js`, `QueueService.js`, `MessageParser.js`, `AuctionService.js`

## CONVENTIONS
All services follow identical patterns:
- **Dependency Injection via Constructor**: Services receive `config`, `logger`, and other services as constructor parameters, enabling straightforward testing and composition
- **Underscore Private Fields**: Internal state uses `_` prefix (`this._config`, `this._logger`) signaling implementation details not to be accessed externally
- **Logger Levels and Color Codes**: Four levels (`debug`, `info`, `warn`, `error`) with Minecraft color codes: debug=§7, info=§b, warn=§6, error=§c
- **Configuration-based Timings/Thresholds**: All timing waits (`timings.*`) and distance thresholds (`thresholds.*`) read from config, never hardcoded
- **Exception Handling in Event Callbacks**: Event handlers wrap core logic in try-catch blocks, logging errors without crashing the macro
- **CommonJS module.exports**: Each file exports a single class via `module.exports = ClassName`

## ANTI-PATTERNS
- **Direct field access**: Never use `service._config` externally; use exposed methods only
- **Hardcoded timing values**: Avoid `Client.waitTick(20)`; define in config and use `this._waitTicks`
- **Unhandled exceptions in callbacks**: Event handlers must wrap logic in try-catch; uncaught errors terminate scripts
- **Circular dependencies**: Constructor injection prevents cycles; if you need `ServiceA` in `ServiceB`, pass it during construction
- **Modifying shared state**: Services should manage their own `_` prefixed state; external modifications break encapsulation
