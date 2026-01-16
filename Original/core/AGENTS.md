# AGENTS.md - Original/core

## OVERVIEW
Core foundational modules providing immutable data structures, generator-based iteration, state management, and configuration loading for farming automation services.

## WHERE TO LOOK

- **Point3D**: `Original/core/Point3D.js` - Immutable 3D coordinate class with distance calculations and block conversion utilities
- **FarmIterator**: `Original/core/FarmIterator.js` - Memory-efficient generator-based farm area traversal with snake pattern
- **FarmState**: `Original/core/FarmState.js` - State management with frozen enums for phases and operation modes
- **ConfigLoader**: `Original/core/ConfigLoader.js` - JSON configuration manager with Map-based caching

## CONVENTIONS

**Immutability**: All classes follow immutable patterns. Point3D never modifies internal state after construction; new instances are returned for transformations. FarmState statistics copy on access via spread operator.

**Object.freeze Enums**: Use `Object.freeze()` for constants to prevent runtime modification. FarmState exports `StatePhase` and `OperationMode` as frozen objects, validated at state transitions.

**Generator-based Iteration**: FarmIterator uses `function*` with `yield` for O(1) space complexity instead of pre-allocating arrays. Call `iterate()` in for-of loops or `Array.from()` only for debugging.

**Caching**: ConfigLoader maintains a private `Map` for configuration caching. Check cache before file I/O with `this._cache.has()` and `this._cache.get()`. Use `clearCache()` or `reload()` for cache invalidation.

**Module Exports**: CommonJS exports via `module.exports`. Point3D exports the class directly. FarmIterator exports the class. FarmState exports an object with class and both enums. ConfigLoader exports a singleton instance (`new ConfigLoader()`).

## ANTI-PATTERNS

- **Do not mutate Point3D instances**: They have no setters for a reason. Always create new instances via `offset()` or `add()` methods.

- **Do not unfreeze enums**: Never assign to `StatePhase` or `OperationMode` properties. Use `Object.freeze()` pattern for new enum-like objects.

- **Do not call toArray() in production**: FarmIterator.toArray() defeats the memory-efficient generator pattern. Use direct iteration with for-of loops.

- **Do not bypass ConfigLoader cache**: Always use the ConfigLoader instance methods rather than direct file reads to benefit from caching.

- **Do not skip enum validation**: FarmState.setPhase() and startExecution() validate against frozen enums. Always use this pattern for state transitions.