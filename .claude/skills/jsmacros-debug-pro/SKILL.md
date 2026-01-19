name: jsmacros-debug-pro
description: Professional debugging and optimization skill for jsMacros scripts. Use this skill when: (1) Fixing script crashes or runtime errors, (2) Resolving timing/sync issues with Minecraft containers and inventories, (3) Optimizing performance to reduce game lag or tick drops, (4) Debugging movement/anti-cheat detection issues, or (5) Analyzing Chat logs and stack traces for root cause analysis.

# jsMacros Debug Pro

This skill implements the "Sisyphus" diagnostic protocol for Minecraft automation.

## The Diagnostic Protocol (RCA-Cycle)

### 1. Data Collection
- **LSP Check**: Run `lsp_diagnostics` immediately on the target file.
- **Log Extraction**: Look for `Logger.error` or `Chat.log` output in the user's description.
- **State Capture**: Inspect `FarmState` or service-specific `_state` variables.

### 2. Identify the Failure Mode
- **Timing/Race Condition**: Script acts faster than the server responds (common with chests/menus).
- **Environment Sync**: Player position or world block data is stale.
- **Reference Error**: Accessing properties of `null` (e.g., `Player.getPlayer()` returning null during world load).
- **Anti-Cheat Trigger**: Rotations too fast or movement too "snappy."

### 3. Apply the Fix
- **Safe Access**: Always check if `Player.getPlayer()` exists before usage.
- **Retry Logic**: Implement wait loops for container synchronization.
- **Timing Adjustments**: Increase `waitTick` values in `plantingConfig.json`.

## Performance Optimization

### The "O(1) Rule"
- Avoid `Array.from()` or `toArray()` on large `FarmIterator` sequences.
- Use `this._cache` in services to avoid redundant `World.getBlock()` calls.

### Game Thread Safety
- Never run heavy computation inside event listeners.
- Use `Client.waitTick(1)` to yield to the main Minecraft thread.

## Reference Materials
- [DEBUG_PATTERNS.md](references/DEBUG_PATTERNS.md): Catalog of common errors and their solutions.
- [SYNC_HANDBOOK.md](references/SYNC_HANDBOOK.md): Managing container and world state synchronization.
- [PERFORMANCE.md](references/PERFORMANCE.md): Memory and CPU optimization for jsMacros.
