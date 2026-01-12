/**
 * @file MovementService.js
 * @description Movement helpers for vending macro
 */

const Point3D = require('../../../core/Point3D.js');

class MovementService {
    constructor(config, logger) {
        this._config = config;
        this._logger = logger;
    }

    moveToBlock(x, y, z, distanceThreshold) {
        const threshold = distanceThreshold || this._config.thresholds.moveDistance || 5;
        const target = new Point3D(x, y, z).toCenter();
        const player = Player.getPlayer();
        const timeout = this._config.timings.moveTimeout || 500;
        let ticks = 0;

        player.lookAt(target.x, target.y, target.z);

        while (player.distanceTo(target.x, target.y, target.z) > threshold) {
            if (ticks >= timeout) {
                this._logger.warn(`Move timeout after ${timeout} ticks.`, 'Movement');
                break;
            }

            player.lookAt(target.x, target.y, target.z);
            KeyBind.keyBind('key.forward', true);
            KeyBind.keyBind('key.sprint', true);
            Client.waitTick(this._config.timings.moveTick || 1);
            ticks += this._config.timings.moveTick || 1;
        }

        KeyBind.keyBind('key.forward', false);
        KeyBind.keyBind('key.sprint', false);
    }
}

module.exports = MovementService;
