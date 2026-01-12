/**
 * @file MessageParser.js
 * @description Sale message parsing for vending macro
 */

class MessageParser {
    constructor(config, logger) {
        this._config = config;
        this._logger = logger;
    }

    parseSaleMessage(message, cropData) {
        if (!message || !message.includes('bought your')) {
            return null;
        }

        let cropName = '';
        let amount = this._config.scriptConfig.defaultSellAmount;
        let price = this._config.scriptConfig.defaultAuctionPrice;

        const match = message.match(/bought your (\d+)x ([\w\s]+) for (\d+) rubies/);
        if (match) {
            amount = parseInt(match[1], 10);
            cropName = match[2].trim();
            price = parseInt(match[3], 10);
        }

        for (const cropKey in cropData) {
            if (message.includes(cropData[cropKey].name)) {
                cropName = cropData[cropKey].name;
                break;
            }
        }

        if (!cropName) {
            this._logger.warn('Sale message matched but crop name not found.', 'Parser');
            return null;
        }

        return { cropName, amount, price };
    }
}

module.exports = MessageParser;
