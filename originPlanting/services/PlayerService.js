/**
 * @file PlayerService.js
 * @description Player-related actions (eating, health management)
 * @version 3.0.0
 */

class PlayerService {
    constructor(config) {
        this._config = config;
        this._eatWaitTicks = config.timings.eatWaitTicks || 66;
        this._postEatWaitTicks = config.timings.postEatWaitTicks || 20;
        this._foodThreshold = config.thresholds.foodLevel || 20;
        this._rightClickKey = config.keybindings.rightClick || 'key.mouse.right';
    }

    /**
     * Automatically eat food to restore hunger
     * @returns {boolean} Whether eating was necessary
     */
    eat() {
        const player = Player.getPlayer();
        let foodLevel = player.getFoodLevel();

        if (foodLevel >= this._foodThreshold) {
            return false;
        }

        Chat.log(`§b[Eat] Current hunger: ${foodLevel}. Eating...`);

        let attempts = 0;
        const maxAttempts = 10;

        while (foodLevel < this._foodThreshold && attempts < maxAttempts) {
            player.lookAt("up");
            
            KeyBind.key(this._rightClickKey, true);
            Client.waitTick(this._eatWaitTicks);
            KeyBind.key(this._rightClickKey, false);

            Client.waitTick(this._postEatWaitTicks);

            foodLevel = player.getFoodLevel();
            attempts++;

            if (foodLevel >= this._foodThreshold) {
                Chat.log(`§a[Eat] Hunger restored to ${foodLevel}`);
                return true;
            }
        }

        if (attempts >= maxAttempts) {
            Chat.log('§c[Eat] Failed to eat - no food available?');
            return false;
        }

        return true;
    }

    /**
     * Check if player has low health
     * @param {number} threshold - Health threshold (default 10)
     * @returns {boolean}
     */
    hasLowHealth(threshold = 10) {
        const player = Player.getPlayer();
        return player.getHealth() < threshold;
    }

    /**
     * Get player's current position as Point3D
     * @returns {Point3D}
     */
    getCurrentPosition() {
        const Point3D = require('../core/Point3D.js');
        const player = Player.getPlayer();
        return new Point3D(
            player.getX(),
            player.getY(),
            player.getZ()
        );
    }

    /**
     * Check if player has item in inventory
     * @param {string} itemId 
     * @returns {boolean}
     */
    hasItem(itemId) {
        const inv = Player.openInventory();
        const slots = inv.findItem(itemId);
        inv.closeAndDrop();
        return slots.length > 0;
    }
}

module.exports = PlayerService;
