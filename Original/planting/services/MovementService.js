/**
 * @file MovementService.js
 * @description Optimized player movement and navigation
 * @version 3.0.0
 */

const Point3D = require('../core/Point3D.js');

class InputQueue {
    constructor() {
        this._queue = [];
    }

    enqueue(frame) {
        this._queue.push(frame);
    }

    enqueueMany(frames) {
        for (const frame of frames) {
            this._queue.push(frame);
        }
    }

    processNext() {
        if (this._queue.length === 0) {
            return false;
        }
        const frame = this._queue.shift();
        const input = Player.createPlayerInput(
            frame.forward,
            frame.sideways,
            frame.yaw,
            frame.pitch,
            frame.jump,
            frame.sneak,
            frame.sprint
        );
        Player.addInput(input);
        return true;
    }

    clear() {
        this._queue = [];
        Player.clearInputs();
    }
}

class MovementService {
    constructor(config) {
        this._config = config;
        this._moveWaitTicks = config.timings.moveWaitTicks || 1;
        this._reachDistance = config.thresholds.playerReach || 3;
        this._stuckThreshold = config.thresholds.stuckJumpThreshold || 20;
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
        const center = targetPos.toBlockCenter();
        const inputQueue = new InputQueue();

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

                const rotation = this._smoothLookAt(center.x, center.y, center.z);
                const shouldJump = stuckCount > this._stuckThreshold;

                inputQueue.enqueue(this._buildMovementFrame(rotation.yaw, rotation.pitch, {
                    jump: shouldJump
                }));
                inputQueue.processNext();

                Client.waitTick(this._moveWaitTicks);

                if (shouldJump) {
                    Chat.log(`§c[Movement] Stuck at ${targetPos}. Attempting jump...`);
                    stuckCount = 0;
                }

                currentDistance = this._calculateDistance(player, center);

                if (Math.abs(currentDistance - lastDistance) < 0.01) {
                    stuckCount++;
                } else {
                    stuckCount = 0;
                }

                lastDistance = currentDistance;
                timeout--;
            }

            if (timeout === 0) {
                Chat.log(`§c[Movement] Timeout moving to ${targetPos}`);
                return false;
            }

            return true;

        } finally {
            inputQueue.clear();
        }
    }

    _buildMovementFrame(yaw, pitch, options = {}) {
        return {
            forward: options.forward !== undefined ? options.forward : 1.0,
            sideways: options.sideways !== undefined ? options.sideways : 0.0,
            yaw,
            pitch,
            jump: options.jump === true,
            sneak: options.sneak === true,
            sprint: options.sprint !== undefined ? options.sprint : true
        };
    }

    /**
     * Smoothly rotate toward target using Grim GCD algorithm
     * @private
     */
    _smoothLookAt(targetX, targetY, targetZ) {
        const player = Player.getPlayer();
        const currentYaw = player.getYaw();
        const currentPitch = player.getPitch();

        const eyeHeight = player.getEyeHeight ? player.getEyeHeight() : 1.62;
        const playerEyeY = player.getY() + eyeHeight;

        const dx = targetX - player.getX();
        const dy = targetY - playerEyeY;
        const dz = targetZ - player.getZ();
        const dist = Math.sqrt(dx * dx + dz * dz);

        const rawTargetYaw = Math.atan2(-dx, dz) * (180 / Math.PI);
        const rawTargetPitch = Math.atan2(-dy, dist) * (180 / Math.PI);

        const speed = this._config.timings.lookSmoothSpeed || 0.2;
        const idealYawDelta = this._normalizeAngle(rawTargetYaw - currentYaw) * speed;
        const idealPitchDelta = this._normalizeAngle(rawTargetPitch - currentPitch) * speed;

        const idealNextYaw = currentYaw + idealYawDelta;
        const idealNextPitch = currentPitch + idealPitchDelta;

        const finalYaw = this._grimSnap(currentYaw, idealNextYaw);
        const finalPitch = this._grimSnap(currentPitch, idealNextPitch);

        return { yaw: finalYaw, pitch: finalPitch };
    }

    /**
     * Grim GCD snap to valid mouse increments
     * @private
     */
    _grimSnap(current, target) {
        const gcd = this._getGcd();
        const delta = this._normalizeAngle(target - current);
        const mousePoints = Math.round(delta / gcd);
        return current + (mousePoints * gcd);
    }

    /**
     * Get GCD from mouse sensitivity
     * @private
     */
    _getGcd() {
        const options = Client.getGameOptions();
        let sensitivity = 0.5;

        try {
            const sensObj = options.getMouseSensitivity ? options.getMouseSensitivity() : options.mouseSensitivity;
            if (typeof sensObj === 'number') {
                sensitivity = sensObj;
            } else if (sensObj && typeof sensObj.getValue === 'function') {
                sensitivity = sensObj.getValue();
            }
        } catch (error) {
            sensitivity = 0.5;
        }

        const f = sensitivity * 0.6 + 0.2;
        return f * f * f * 8.0 * 0.15;
    }

    /**
     * Normalize angle to [-180, 180]
     * @private
     */
    _normalizeAngle(angle) {
        let adjusted = angle;
        while (adjusted > 180) adjusted -= 360;
        while (adjusted < -180) adjusted += 360;
        return adjusted;
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
        const center = targetPos.toBlockCenter();
        const player = Player.getPlayer();
        player.setPos(center.x, center.y, center.z);
    }
}

module.exports = MovementService;

