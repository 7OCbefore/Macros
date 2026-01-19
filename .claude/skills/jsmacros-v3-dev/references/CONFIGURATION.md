# Configuration Standards

## JSON Structure (`Original/config/*.json`)
All configurations must be hierarchical and use snake_case for keys where possible, or camelCase if following existing service patterns.

Example:
```json
{
  "movement": {
    "speed": 1.0,
    "tolerance": 0.5
  },
  "farm": {
    "start_pos": {"x": 100, "y": 64, "z": 100},
    "end_pos": {"x": 110, "y": 64, "z": 110}
  }
}
```

## ConfigLoader Usage
```javascript
const ConfigLoader = require('../../core/ConfigLoader');
const config = ConfigLoader.load('../config/plantingConfig.json');

if (config) {
    const speed = config.movement.speed;
}
```

## Immutable Coordinates
Always use `Point3D` for positions in config.
```javascript
const Point3D = require('../../core/Point3D');
const startPos = new Point3D(config.farm.start_pos.x, config.farm.start_pos.y, config.farm.start_pos.z);
```
