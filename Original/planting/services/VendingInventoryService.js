/**
 * @file InventoryService.js
 * @description Inventory helpers for vending macro
 */

class InventoryService {
    constructor(config, logger, cropRegistry) {
        this._config = config;
        this._logger = logger;
        this._cropRegistry = cropRegistry;
    }

    normalizeItemName(name) {
        if (this._cropRegistry) {
            return this._cropRegistry.normalizeDisplayName(name);
        }
        return (name || '').replace(/§[0-9A-FK-OR]/gi, '').trim();
    }

    findItemSlotsByName(inventory, itemName) {
        const totalSlots = inventory.getTotalSlots();
        const target = this.normalizeItemName(itemName);
        const matched = [];

        for (let i = 0; i < totalSlots; i++) {
            const item = inventory.getSlot(i);
            if (!item) {
                continue;
            }
            const normalizedName = this.normalizeItemName(item.getName().getString());
            if (normalizedName === target) {
                matched.push(i);
            }
        }

        return matched;
    }

    countItemsByName(inventory, itemName) {
        const slots = this.findItemSlotsByName(inventory, itemName);
        let total = 0;

        for (const slot of slots) {
            total += inventory.getSlot(slot).getCount();
        }

        return total;
    }

    findEmptyHotbarSlot(inventory) {
        for (let i = 36; i < 45; i++) {
            if (!inventory.getSlot(i)) {
                return i;
            }
        }
        return -1;
    }

    splitItemStack(inventory, slot, amount) {
        const timings = this._config.timings;
        const emptyHotbarSlot = this.findEmptyHotbarSlot(inventory);

        if (emptyHotbarSlot === -1) {
            this._logger.warn('Hotbar is full, cannot split stack.', 'Inventory');
            return false;
        }

        inventory.swapHotbar(slot, emptyHotbarSlot - 36);
        Client.waitTick(timings.splitSwapWait);

        inventory.click(emptyHotbarSlot);
        Client.waitTick(timings.splitClickWait);
        inventory.click(emptyHotbarSlot, 1, 'right');
        Client.waitTick(timings.splitRightClickWait);

        for (let i = 1; i < amount; i++) {
            inventory.click(emptyHotbarSlot, 0, 'left');
            Client.waitTick(timings.splitAdjustWait);
        }

        inventory.click(-999);
        Client.waitTick(timings.splitConfirmWait);

        return emptyHotbarSlot;
    }
}

module.exports = InventoryService;
