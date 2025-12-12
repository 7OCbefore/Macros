/**
 * @file MovementService.js
 * @description Optimized player movement and navigation
 * @version 3.0.0
 */

const Point3D = require('./Point3D.js');

class MovementService {
    constructor(config) {
        this._config = config;
        this._moveWaitTicks = config.timings.moveWaitTicks || 1;
        this._reachDistance = config.thresholds.playerReach || 3;
    }

    /**
     * Move player to target position with optimization
     * @param {Point3D} targetPos 
     * @param {Object} state - Farming state for pause checks
     * @returns {boolean} Success status
     */
    moveTo(targetPos, state = null) {
        if (!(targetPos instanceof Point3D)) {
            throw new TypeError('targetPos must be a Point3D instance');
        }

        const player = Player.getPlayer();
        const center = targetPos.toCenter();

        let currentDistance = this._calculateDistance(player, center);

        if (currentDistance <= this._reachDistance) {
            return true;
        }

        let timeout = 500;
        let lastDistance = currentDistance;
        let stuckCount = 0;

        try {
            while (currentDistance > this._reachDistance && timeout > 0) {
                if (state?.isPaused) {
                    this._waitDuringPause(state);
                }

                player.lookAt(center.x, center.y, center.z);
                
                KeyBind.keyBind("key.forward", true);
                KeyBind.keyBind("key.sprint", true);
                
                Client.waitTick(this._moveWaitTicks);

                currentDistance = this._calculateDistance(player, center);

                if (Math.abs(currentDistance - lastDistance) < 0.01) {
                    stuckCount++;
                    if (stuckCount > 20) {
                        Chat.log(`§c[Movement] Stuck at ${targetPos}. Attempting jump...`);
                        player.setJumping(true);
                        Client.waitTick(5);
                        player.setJumping(false);
                        stuckCount = 0;
                    }
                } else {
                    stuckCount = 0;
                }

                lastDistance = currentDistance;
                timeout--;
            }

            return timeout > 0;

        } finally {
            KeyBind.keyBind("key.forward", false);
            KeyBind.keyBind("key.sprint", false);
        }
    }

    /**
     * Calculate distance from player to target
     * @private
     */
    _calculateDistance(player, center) {
        const px = player.getX();
        const pz = player.getZ();
        const dx = center.x - px;
        const dz = center.z - pz;
        return Math.sqrt(dx * dx + dz * dz);
    }

    /**
     * Wait while state is paused
     * @private
     */
    _waitDuringPause(state) {
        while (state.isPaused) {
            Client.waitTick(20);
        }
    }

    /**
     * Teleport-style fast movement (creative mode compatible)
     * @param {Point3D} targetPos 
     */
    teleportTo(targetPos) {
        const center = targetPos.toCenter();
        const player = Player.getPlayer();
        player.setPos(center.x, center.y, center.z);
    }
}

module.exports = MovementService;
