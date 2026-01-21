/**
 * @file MessageParser.js
 * @description Sale message parsing for vending macro
 */

class MessageParser {
    constructor(config, logger, cropRegistry) {
        this._config = config;
        this._logger = logger;
        this._cropRegistry = cropRegistry;
    }

    parseSaleMessage(message) {
        if (!message || !message.includes('bought your')) {
            return null;
        }

        const match = message.match(/bought your (\d+)x (.+) for (\d+) rubies/);
        if (!match) {
            this._logger.warn('Sale message matched but parse failed.', 'Parser');
            return null;
        }

        const amount = parseInt(match[1], 10);
        const rawItemName = match[2].trim();
        const price = parseInt(match[3], 10);

        const parsed = this._cropRegistry.parseItemName(rawItemName);
        if (!parsed.cropId) {
            this._logger.warn(`Unknown crop in sale message: ${rawItemName}`, 'Parser');
            return null;
        }

        if (!this._cropRegistry.canSellQuality(parsed.quality)) {
            return null;
        }

        const itemName = this._cropRegistry.getItemName(parsed.cropId, parsed.quality);
        return { cropId: parsed.cropId, quality: parsed.quality, amount, price, itemName };
    }
}

module.exports = MessageParser;
