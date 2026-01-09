class VendingAuctionService {
    constructor(config, state, inventoryOps, basketService, cropMap, guard) {
        this._config = config;
        this._state = state;
        this._inventory = inventoryOps;
        this._basketService = basketService;
        this._cropMap = cropMap;
        this._guard = guard;
    }

    sellItem(itemName, amount) {
        const inventory = Player.openInventory();
        const itemSlots = this._inventory.findItemSlotsByName(inventory, itemName);
        const price = this._state.defaultAuctionPriceDynamic !== null
            ? this._state.defaultAuctionPriceDynamic
            : this._config.scriptConfig.defaultAuctionPrice;

        if (itemSlots.length === 0) {
            Chat.log(`Item not found: ${itemName}.`);
            return false;
        }

        for (const slot of itemSlots) {
            const slotItem = inventory.getSlot(slot);
            if (!slotItem || typeof slotItem.getCount !== 'function') continue;

            const stackSize = slotItem.getCount();
            if (stackSize < amount) continue;

            if (this._guard && this._guard.isSafeMode()) {
                Chat.log(`[DryRun] Auction ${amount}x ${itemName} at ${price}`);
                return true;
            }

            inventory.swapHotbar(slot, inventory.getSelectedHotbarSlotIndex());
            Client.waitTick(this._config.timings.auctionSwapWait);

            if (stackSize > amount) {
                const splitSlot = this._inventory.splitStack(inventory, slot, amount);
                if (splitSlot === false) {
                    return false;
                }
                inventory.swapHotbar(splitSlot, inventory.getSelectedHotbarSlotIndex());
                Client.waitTick(this._config.timings.splitSwapWait);
            }

            Chat.say(`/auction ${price}`);
            Client.waitTick(this._config.timings.auctionCommandWait);
            Chat.say(`/auction ${price}`);
            Chat.log(`Listed ${amount}x ${itemName} from slot ${slot}.`);
            return true;
        }

        Chat.log(`No stack with ${amount}x ${itemName} found.`);
        return false;
    }

    handleCropSold(cropName, amount) {
        if (this.sellItem(cropName, amount)) {
            return true;
        }

        const cropInfo = this._cropMap.get(cropName);
        if (!cropInfo) {
            Chat.log(`Unknown crop: ${cropName}.`);
            return false;
        }

        if (!this._basketService.pullBasket(cropInfo.basket, cropInfo.chestPos)) {
            return false;
        }

        if (!this._basketService.openBasketInInventory(cropInfo.basket)) {
            return false;
        }

        if (this.sellItem(cropName, amount)) {
            Chat.log(`Listed ${amount}x ${cropName}.`);
            return true;
        }

        Chat.log(`Failed to list ${cropName}.`);
        return false;
    }
}

module.exports = VendingAuctionService;
