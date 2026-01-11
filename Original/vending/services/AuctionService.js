/**
 * @file AuctionService.js
 * @description Handles auction listing flows
 */

class AuctionService {
    constructor(config, logger, inventoryService, state) {
        this._config = config;
        this._logger = logger;
        this._inventoryService = inventoryService;
        this._state = state;
    }

    auction(itemName, amount) {
        const inventory = Player.openInventory();
        const itemSlots = this._inventoryService.findItemSlotsByName(inventory, itemName);
        const price = this._state.defaultAuctionPriceDynamic !== null
            ? this._state.defaultAuctionPriceDynamic
            : this._config.scriptConfig.defaultAuctionPrice;
        const targetAmount = amount || this._config.scriptConfig.defaultSellAmount;

        if (itemSlots.length === 0) {
            this._logger.warn(`Item not found: ${itemName}`, 'Auction');
            return false;
        }

        for (const slot of itemSlots) {
            const stackSize = inventory.getSlot(slot).getCount();
            if (stackSize < targetAmount) {
                continue;
            }

            inventory.swapHotbar(slot, inventory.getSelectedHotbarSlotIndex());
            Client.waitTick(this._config.timings.auctionSwapWait);

            if (stackSize > targetAmount) {
                const splitSlot = this._inventoryService.splitItemStack(inventory, slot, targetAmount);
                if (splitSlot === false) {
                    return false;
                }
                inventory.swapHotbar(splitSlot, inventory.getSelectedHotbarSlotIndex());
                Client.waitTick(this._config.timings.auctionSwapWait);
            }

            Chat.say(`/auction ${price}`);
            Client.waitTick(this._config.timings.auctionCommandWait);
            Chat.say(`/auction ${price}`);

            this._logger.info(`Listed ${targetAmount}x ${itemName} from slot ${slot} at ${price}.`, 'Auction');
            return true;
        }

        this._logger.warn(`No stack large enough for ${targetAmount}x ${itemName}.`, 'Auction');
        return false;
    }
}

module.exports = AuctionService;
