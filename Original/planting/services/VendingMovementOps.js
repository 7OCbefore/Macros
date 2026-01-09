const Point3D = require('../core/Point3D.js');

class VendingMovementOps {
    constructor(timings, thresholds, guard) {
        this._timings = timings;
        this._thresholds = thresholds;
        this._guard = guard;
    }

    moveTo(point, distanceThreshold = null) {
        const targetPos = point instanceof Point3D ? point : Point3D.from(point);
        if (!targetPos) return false;

        if (this._guard && this._guard.isSafeMode()) {
            Chat.log(`[DryRun] Move to ${targetPos}`);
            return true;
        }

        const player = Player.getPlayer();
        const center = targetPos.toCenter();
        const threshold = distanceThreshold !== null ? distanceThreshold : this._thresholds.moveDistance;
        let timeout = this._timings.moveTimeout;

        try {
            while (player.distanceTo(center.x, center.y, center.z) > threshold && timeout > 0) {
                player.lookAt(center.x, center.y, center.z);
                KeyBind.keyBind("key.forward", true);
                KeyBind.keyBind("key.sprint", true);
                Client.waitTick(this._timings.moveTick);
                timeout--;
            }
            return timeout > 0;
        } finally {
            KeyBind.keyBind("key.forward", false);
            KeyBind.keyBind("key.sprint", false);
        }
    }
}

module.exports = VendingMovementOps;
