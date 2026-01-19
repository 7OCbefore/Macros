name: jsmacros-v3-dev
description: Specialized skill for developing and maintaining v3 service-oriented jsMacros scripts for Minecraft. Use this skill when: (1) Creating or modifying modular services in 'Original/planting/services/', (2) Working with core utilities like 'Point3D', 'FarmState', or 'FarmIterator', (3) Implementing configuration-driven logic using 'ConfigLoader', (4) Refactoring legacy single-file scripts into the service architecture, or (5) Debugging jsMacros API interactions using generated headers.

# jsMacros v3 Development Skill

This skill provides the architectural blueprints and procedural knowledge for the "Sisyphus" v3 jsMacros automation framework.

## Core Architecture: Service-Oriented Design

The codebase has evolved from "Legacy" (flat scripts) to "v3" (Modular Services).

### 1. The Service Pattern
Every service in `Original/planting/services/` follows a consistent pattern:
- **CommonJS**: Use `module.exports`.
- **Private Fields**: Use underscore prefix (e.g., `this._config`).
- **Dependency Injection**: Services are typically instantiated in the main application and cross-referenced.
- **JSDoc**: Strict adherence to JSDoc for types and documentation.

### 2. Core Utilities (`Original/core/`)
Always leverage these instead of reimplementing:
- **Point3D**: Immutable 3D math. Never mutate; use `.add()`, `.offset()`.
- **ConfigLoader**: Singleton for loading JSON from `Original/config/`. Uses caching.
- **FarmState**: Central state machine with frozen Enums.
- **FarmIterator**: Generator-based snake-pattern traversal.

## Workflow: Legacy to v3 Refactoring

When converting a legacy script (like `Original/planting/收菜.js`):
1. **Identify Logic**: Extract pure logic from global functions.
2. **Assign Service**: Determine if it belongs in an existing service (e.g., `MovementService`) or needs a new one.
3. **Externalize Config**: Move hardcoded constants to `Original/config/plantingConfig.json`.
4. **Wrap in App**: Use the `PlantingApplication` pattern from `种植_v3.js`.

## API Reference (jsMacros)

Refer to `headers/` for detailed type definitions:
- `JsMacros-2.0.0-beta-d31365b.d.ts`: Main API surface.
- `Minecraft.d.ts`: Access to underlying Minecraft classes.

### Common Globals
- `Chat.log(msg)`: Use Minecraft color codes (`§c`, `§a`).
- `Client.waitTick(n)`: Primary timing mechanism.
- `Player.getPlayer().getRaw()`: Access the raw Minecraft player object.

## Reference Materials
- [ARCHITECTURE.md](references/ARCHITECTURE.md): Deep dive into the service layer.
- [CONFIGURATION.md](references/CONFIGURATION.md): JSON schema and ConfigLoader usage.
- [SERVICE_TEMPLATE.js](assets/SERVICE_TEMPLATE.js): Boilerplate for new services.
