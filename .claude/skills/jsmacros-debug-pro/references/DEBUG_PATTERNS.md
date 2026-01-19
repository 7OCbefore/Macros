# Common Debugging Patterns in jsMacros

## 1. The "Null Player" Crash
**Symptoms**: `TypeError: Cannot read property '...' of null` at script startup.
**Cause**: Script executes before the player has fully joined the world.
**Solution**:
```javascript
const player = Player.getPlayer();
if (!player) {
    Client.waitTick(20);
    return; // Or retry
}
```

## 2. Container Sync Issues
**Symptoms**: Inventory transfer fails or items "ghost" back to their original slots.
**Cause**: GUI opens on the client but the server hasn't synced the inventory contents.
**Solution**:
```javascript
// Wait for specific slot to be non-empty or use a safety delay
let timeout = 0;
while (Hud.isContainer() && inv.getSlot(0).isEmpty() && timeout < 20) {
    Client.waitTick(1);
    timeout++;
}
```

## 3. Rotation Snap (Anti-Cheat)
**Symptoms**: Player gets kicked for "Unfair Advantage" or "Illegal Rotation."
**Cause**: `Player.getPlayer().lookAt()` is instantaneous.
**Solution**: Use the `MovementService`'s smooth rotation logic which interpolates angles over multiple ticks.

## 4. Tick Freezing
**Symptoms**: Game FPS drops to 1, or the client becomes unresponsive.
**Cause**: An infinite loop without `Client.waitTick()`.
**Solution**:
```javascript
while(condition) {
    // ... logic
    Client.waitTick(1); // Crucial for yielding thread
}
```
