const { normalizeName } = require('./VendingUtils.js');

class VendingInventoryOps {
    constructor(timings) {
        this._timings = timings;
    }

    normalizeName(name) {
        return normalizeName(name);
    }

    findItemSlotsByName(inventory, itemName) {
        if (!inventory || !itemName) return [];
        const targetName = normalizeName(itemName);
        if (!targetName) return [];
        const totalSlots = inventory.getTotalSlots();
        const matchedSlots = [];

        for (let i = 0; i < totalSlots; i++) {
            const item = inventory.getSlot(i);
            if (!item || typeof item.getName !== 'function') continue;
            const slotName = normalizeName(item.getName().getString());
            if (slotName === targetName) {
                matchedSlots.push(i);
            }
        }
        return matchedSlots;
    }

    findEmptyHotbarSlot(inventory) {
        for (let i = 36; i < 45; i++) {
            const slot = inventory.getSlot(i);
            if (!slot) return i;
            if (typeof slot.getItemId === 'function' && slot.getItemId() === "minecraft:air") {
                return i;
            }
        }
        return -1;
    }

    splitStack(inventory, slot, amount) {
        const emptyHotbarSlot = this.findEmptyHotbarSlot(inventory);
        if (emptyHotbarSlot === -1) {
            Chat.log('Hotbar full; cannot split stack.');
            return false;
        }
        inventory.swapHotbar(slot, emptyHotbarSlot - 36);
        Client.waitTick(this._timings.splitSwapWait);
        inventory.click(emptyHotbarSlot);
        Client.waitTick(this._timings.splitClickWait);
        inventory.click(emptyHotbarSlot, 1, 'right');
        Client.waitTick(this._timings.splitRightClickWait);
        for (let i = 1; i < amount; i++) {
            inventory.click(emptyHotbarSlot, 0, 'left');
            Client.waitTick(this._timings.splitAdjustWait);
        }
        inventory.click(-999);
        Client.waitTick(this._timings.splitConfirmWait);
        return emptyHotbarSlot;
    }

    countItemByName(inventory, itemName) {
        const slots = this.findItemSlotsByName(inventory, itemName);
        let total = 0;
        for (const slot of slots) {
            const item = inventory.getSlot(slot);
            if (item && typeof item.getCount === 'function') {
                total += item.getCount();
            }
        }
        return total;
    }
}

module.exports = VendingInventoryOps;
