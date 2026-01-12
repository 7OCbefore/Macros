/**
 * @file QueueService.js
 * @description Handles sale queue processing
 */

class QueueService {
    constructor(config, logger, state, auctionService, basketService, cropData) {
        this._config = config;
        this._logger = logger;
        this._state = state;
        this._auctionService = auctionService;
        this._basketService = basketService;
        this._cropData = cropData;
    }

    enqueueSale(cropName, amount) {
        this._state.enqueueSale(cropName, amount);
        this._logger.info(`Queued sale: ${amount}x ${cropName}.`, 'Queue');
    }

    processQueue() {
        if (this._state.isProcessing) {
            return;
        }

        this._state.isProcessing = true;
        try {
            while (this._state.hasQueue()) {
                const entry = this._state.dequeueSale();
                this._handleCropSold(entry.crop, entry.amount);
                Client.waitTick(this._config.timings.queueWait);
            }
        } catch (error) {
            this._logger.error(`Queue processing failed: ${error.message}`, 'Queue');
        } finally {
            this._state.isProcessing = false;
        }
    }

    _handleCropSold(cropName, amount) {
        if (this._auctionService.auction(cropName, amount)) {
            return;
        }

        const cropInfo = this._cropData[cropName];
        if (!cropInfo) {
            this._logger.warn(`Unknown crop: ${cropName}`, 'Queue');
            return;
        }

        if (!this._basketService.getBasketFromChest(cropInfo.basket, cropInfo.chestPos)) {
            this._logger.warn(`Failed to fetch basket for ${cropName}.`, 'Queue');
            return;
        }

        if (!this._basketService.openBasketInInventory(cropInfo.basket)) {
            this._logger.warn(`Failed to open basket for ${cropName}.`, 'Queue');
            return;
        }

        if (this._auctionService.auction(cropName, amount)) {
            this._logger.info(`Re-listed ${amount}x ${cropName} after restock.`, 'Queue');
        } else {
            this._logger.warn(`Failed to re-list ${cropName} after restock.`, 'Queue');
        }
    }
}

module.exports = QueueService;
