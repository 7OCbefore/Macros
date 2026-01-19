# v3 Service Architecture Reference

## Service Lifecycle
1. **Construction**: Initialize private state and inject dependencies.
2. **Initialization**: Load specific configurations via `ConfigLoader`.
3. **Execution**: Perform tasks (movement, inventory, interaction).
4. **Shutdown**: Clear timers, unbind events, and persist state.

## Implementation Standards

### JSDoc Header Template
```javascript
/**
 * @file [ServiceName].js
 * @description [Brief description]
 * @version 1.0.0
 */
```

### Private Member Convention
```javascript
class ExampleService {
    constructor() {
        this._state = null; // Private
    }
}
```

### Handling jsMacros Events
Use the `EventHandler` service to wrap `JsMacros.on()`. This ensures that all events are tracked and can be cleaned up during shutdown.

## Common Pitfalls
- **Sync vs Async**: jsMacros is mostly synchronous. Use `Client.waitTick()` to prevent freezing the game loop.
- **Java Interop**: Use `Java.type()` for native Java classes but prefer jsMacros wrappers (`World`, `Player`) when available.
- **Coordinate Precision**: Always use `Point3D` for coordinate math to avoid off-by-one errors in block detection.
