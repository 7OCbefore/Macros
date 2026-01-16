#捡漏 (FindingBargain) - AGENTS Documentation

## OVERVIEW
Automated auction house bargain hunting bot that compares AH prices against CSV reference data and executes purchases when prices fall below thresholds.

## WHERE TO LOOK
- **Entry Point**: `FindingBargain.js` - Main script containing the complete bargain hunting workflow
- **Price Reference**: `inventory_data.csv` - CSV file with item names, regular prices, and CareFinish prices for comparison
- **Purchase Log**: `FindingBargain_Log.csv` - CSV log recording all successful purchases with timestamps, prices, and sellers
- **Supporting Script**: `get新物品信息.js` - Optimized variant with caching improvements and batch processing

## CONVENTIONS
- **CSV Read/Write Pattern**: Scripts use `FS.open()` with `readLines()` iterator for CSV reading; `FS.append()` for log writing with automatic header creation on new files
- **Random Intervals**: Main loop uses `getRandomNumber()` function (default range: 14-42 ticks) to randomize check intervals and avoid detection patterns
- **Logging**: All successful purchases are logged to CSV with timestamp, item name, AH unit price, CSV reference price, price type (Regular/CareFinish), quantity, and seller
- **Key Binding**: Press `X` key to gracefully stop the script via `JsMacros.on("Key")` event listener
- **Price Types**: Scripts distinguish between regular prices and CareFinish prices (for Finish Token items), supporting p2w/f2p crate variants

## ANTI-PATTERNS
- **Monolithic Structure**: Unlike service-oriented modules, these scripts contain all logic in single files (370+ lines) including UI interaction, price parsing, business logic, and main loops without clear separation of concerns
- **Hardcoded Paths**: File paths are absolute Windows paths (e.g., `E:\minecraft\...\捡漏\...`) instead of using relative paths or configuration files
- **Blocking Waits**: Main loop uses `Client.waitTick()` with blocking semantics rather than async/await patterns or event-driven alternatives
- **Global State**: Scripts rely on global variables like `isPurchasing`, `lastPurchaseSuccessful`, and caches that persist across function calls without encapsulation
- **Limited Error Recovery**: While basic try-catch blocks exist for file operations, network timeouts and GUI state issues have minimal recovery logic beyond returning empty arrays
