/**
 * @file VendingState.js
 * @description Runtime state for vending macro
 */

class VendingState {
    constructor() {
        this.defaultAuctionPriceDynamic = null;
        this.isProcessing = false;
        this.isJackoMode = false;
        this.queue = [];
        this.nextCheckTicks = 0;
        this.isScheduling = false;
        this.adDelayTicks = 0;
    }

    enqueueSale(crop, amount) {
        this.queue.push({ crop, amount });
    }

    dequeueSale() {
        return this.queue.shift();
    }

    hasQueue() {
        return this.queue.length > 0;
    }
}

module.exports = VendingState;
