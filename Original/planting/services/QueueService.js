/**
 * @file QueueService.js
 * @description Handles sale queue processing
 */

class QueueService {
    constructor(config, logger, state, auctionService, basketService, cropRegistry) {
        this._config = config;
        this._logger = logger;
        this._state = state;
        this._auctionService = auctionService;
        this._basketService = basketService;
        this._cropRegistry = cropRegistry;
    }

    enqueueSale(cropId, quality, amount) {
        this._state.enqueueSale(cropId, quality, amount);
        const displayName = this._cropRegistry.getCropDisplayName(cropId);
        this._logger.info(`Queued sale: ${amount}x ${displayName} (${quality}).`, 'Queue');
    }

    processQueue() {
        if (this._state.isProcessing) {
            return;
        }

        this._state.isProcessing = true;
        try {
            while (this._state.hasQueue()) {
                const entry = this._state.dequeueSale();
                this._handleCropSold(entry.cropId, entry.quality, entry.amount);
                Client.waitTick(this._config.timings.queueWait);
            }
        } catch (error) {
            this._logger.error(`Queue processing failed: ${error.message}`, 'Queue');
        } finally {
            this._state.isProcessing = false;
        }
    }

    _handleCropSold(cropId, quality, amount) {
        if (!this._cropRegistry.canSellQuality(quality)) {
            return;
        }

        const itemName = this._cropRegistry.getItemName(cropId, quality);
        if (this._auctionService.auction(itemName, amount)) {
            return;
        }

        if (quality !== 'star3') {
            return;
        }

        const basketInfo = this._cropRegistry.getBasketInfo(cropId, 'star3');
        if (!basketInfo) {
            this._logger.warn(`No star3 basket config for ${this._cropRegistry.getCropDisplayName(cropId)}.`, 'Queue');
            return;
        }

        if (!this._basketService.getBasketFromChest(basketInfo.name, basketInfo.chestPos)) {
            this._logger.warn(`Failed to fetch basket for ${itemName}.`, 'Queue');
            return;
        }

        if (!this._basketService.openBasketInInventory(basketInfo.name)) {
            this._logger.warn(`Failed to open basket for ${itemName}.`, 'Queue');
            return;
        }

        if (this._auctionService.auction(itemName, amount)) {
            this._logger.info(`Re-listed ${amount}x ${itemName} after restock.`, 'Queue');
        } else {
            this._logger.warn(`Failed to re-list ${itemName} after restock.`, 'Queue');
        }
    }
}

module.exports = QueueService;
