/**
 * @file InventoryService.js
 * @description High-performance inventory and container management
 * @version 3.0.0
 */

const Point3D = require('../core/Point3D.js');

class InventoryService {
    constructor(config) {
        this._config = config;
        this._containerTimeout = config.timings.containerWaitTimeout || 100;
        this._chestWaitTicks = config.timings.chestWaitTicks || 34;
        this._invCloseWaitTicks = config.timings.invCloseWaitTicks || 6;
        this._refillThreshold = config.thresholds.refillThreshold || 6;
        
        this._itemCache = new Map();
    }

    /**
     * Check and refill item from chest with inventory-first optimization
     * @param {Point3D} chestPos 
     * @param {string} itemId 
     * @param {MovementService} movementService 
     * @param {Object} state 
     * @returns {boolean} Success status
     */
    checkAndRefill(chestPos, itemId, movementService, state) {
        if (!(chestPos instanceof Point3D)) {
            throw new TypeError('chestPos must be Point3D');
        }

        const player = Player.getPlayer();
        const inv = Player.openInventory();

        const mainHandItem = player.getMainHand();
        const mainHandCount = mainHandItem.getCount();

        if (mainHandCount > this._refillThreshold) {
            return true;
        }

        const itemSlots = this._findItemInInventory(inv, itemId);
        const bestSlot = this._findBestRefillSlot(inv, itemSlots);

        if (bestSlot !== -1) {
            inv.swapHotbar(bestSlot, inv.getSelectedHotbarSlotIndex());
            Client.waitTick(this._config.timings.refillWaitTicks);
            state?.incrementStat('refillCount');
            return true;
        }

        return this._refillFromChest(chestPos, itemId, movementService, state);
    }

    /**
     * Find item slots in inventory
     * @private
     */
    _findItemInInventory(inv, itemId) {
        const cacheKey = `find_${itemId}`;
        
        if (this._itemCache.has(cacheKey)) {
            const cached = this._itemCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 500) {
                return cached.slots;
            }
        }

        const slots = inv.findItem(itemId);
        this._itemCache.set(cacheKey, { slots, timestamp: Date.now() });
        return slots;
    }

    /**
     * Find best slot for refilling (most items)
     * @private
     */
    _findBestRefillSlot(inv, itemSlots) {
        let bestSlot = -1;
        let maxCount = this._refillThreshold;

        for (const slot of itemSlots) {
            const count = inv.getSlot(slot).getCount();
            if (count > maxCount) {
                bestSlot = slot;
                maxCount = count;
            }
        }

        return bestSlot;
    }

    /**
     * Refill from chest
     * @private
     */
    _refillFromChest(chestPos, itemId, movementService, state) {
        Chat.log(`§e[Refill] ${itemId} count low. Going to chest at ${chestPos}...`);
        
        if (!movementService.moveTo(chestPos, state)) {
            Chat.log('§c[Refill] Failed to reach chest');
            return false;
        }

        const player = Player.getPlayer();
        const interactionMgr = Player.getInteractionManager();
        
        interactionMgr.interactBlock(
            chestPos.x, 
            chestPos.y, 
            chestPos.z, 
            player.getFacingDirection().getName(), 
            false
        );

        if (!this._waitForContainer()) {
            Chat.log('§c[Refill] Timeout opening chest');
            return false;
        }

        Client.waitTick(5);

        const chestInv = Player.openInventory();
        const chestSlots = chestInv.findItem(itemId);

        if (chestSlots.length === 0) {
            Chat.log(`§c[Refill] No ${itemId} in chest!`);
            chestInv.closeAndDrop();
            return false;
        }

        this._transferFromChest(chestInv, chestSlots);
        
        chestInv.closeAndDrop();
        Client.waitTick(this._invCloseWaitTicks);
        
        state?.incrementStat('refillCount');
        return true;
    }

    /**
     * Transfer items from chest to inventory
     * @private
     */
    _transferFromChest(chestInv, chestSlots) {
        for (const slot of chestSlots) {
            if (this.isInventoryFull(chestInv)) break;
            
            const count = chestInv.getSlot(slot).getCount();
            if (count > 0) {
                chestInv.quick(slot);
                Client.waitTick(1);
            }
        }
    }

    /**
     * Wait for container GUI to open
     * @private
     * @returns {boolean}
     */
    _waitForContainer() {
        let timeout = this._containerTimeout;
        while (!Hud.isContainer() && timeout > 0) {
            Client.waitTick(1);
            timeout--;
        }
        return timeout > 0;
    }

    /**
     * Transfer specific items to chest
     * @param {Point3D} chestPos 
     * @param {string[]} itemIds 
     * @param {MovementService} movementService 
     * @returns {boolean}
     */
    transferToChest(chestPos, itemIds, movementService) {
        if (!movementService.moveTo(chestPos)) {
            return false;
        }

        const player = Player.getPlayer();
        Player.getInteractionManager().interactBlock(
            chestPos.x, 
            chestPos.y, 
            chestPos.z, 
            player.getFacingDirection().getName(), 
            false
        );

        if (!this._waitForContainer()) {
            Chat.log('§c[Transfer] Timeout opening chest');
            return false;
        }

        Client.waitTick(5);

        const inv = Player.openInventory();
        const map = inv.getMap();

        if (!map?.main) {
            inv.closeAndDrop();
            return false;
        }

        const itemSet = new Set(itemIds);
        const mainStart = map.main[0];

        for (let i = mainStart; i < mainStart + this._config.constants.maxInventorySlots; i++) {
            const item = inv.getSlot(i);
            if (itemSet.has(item.getItemId())) {
                inv.quick(i);
                Client.waitTick(1);
            }
        }

        Client.waitTick(20);
        inv.closeAndDrop();
        Client.waitTick(this._invCloseWaitTicks);
        
        return true;
    }

    /**
     * Check if player inventory is full
     * @param {Object} inv - Optional inventory instance
     * @returns {boolean}
     */
    isInventoryFull(inv = null) {
        const shouldClose = !inv;
        if (!inv) {
            inv = Player.openInventory();
        }

        const map = inv.getMap();
        let isFull = true;

        if (map?.main) {
            for (const idx of map.main) {
                if (inv.getSlot(idx).isEmpty()) {
                    isFull = false;
                    break;
                }
            }
        }

        if (shouldClose) {
            inv.closeAndDrop();
        }

        return isFull;
    }

    /**
     * Clear item cache
     */
    clearCache() {
        this._itemCache.clear();
    }
}

module.exports = InventoryService;
