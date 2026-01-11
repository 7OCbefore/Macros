/**
 * @file EventHandler.js
 * @description Event wiring for vending macro
 */

class EventHandler {
    constructor(config, logger, state, messageParser, queueService, scheduler, onShutdown) {
        this._config = config;
        this._logger = logger;
        this._state = state;
        this._messageParser = messageParser;
        this._queueService = queueService;
        this._scheduler = scheduler;
        this._onShutdown = onShutdown;
        this._listeners = [];
    }

    register() {
        this._listeners.push(
            JsMacros.on('Key', JavaWrapper.methodToJava((event, ctx) => {
                try {
                    this._handleKey(event, ctx);
                } catch (error) {
                    this._logger.error(`Key handler error: ${error.message}`, 'Event');
                }
            }))
        );

        this._listeners.push(
            JsMacros.on('RecvMessage', JavaWrapper.methodToJava((event) => {
                try {
                    this._handleMessage(event);
                } catch (error) {
                    this._logger.error(`Message handler error: ${error.message}`, 'Event');
                }
            }))
        );

        this._listeners.push(
            JsMacros.on('Tick', JavaWrapper.methodToJava(() => {
                try {
                    this._scheduler.tick();
                } catch (error) {
                    this._logger.error(`Tick handler error: ${error.message}`, 'Event');
                }
            }))
        );
    }

    unregister() {
        for (const listener of this._listeners) {
            JsMacros.off(listener);
        }
        this._listeners = [];
    }

    _handleKey(event) {
        if (event.key !== this._config.scriptConfig.closeKey) {
            return;
        }

        this._logger.warn('Script stopped by user.', 'System');
        if (this._onShutdown) {
            this._onShutdown();
        }
        JavaWrapper.stop();
    }

    _handleMessage(event) {
        const text = event.text ? event.text.getString() : '';
        const parsed = this._messageParser.parseSaleMessage(text, this._config.cropData);
        if (!parsed) {
            return;
        }

        if (this._state.defaultAuctionPriceDynamic === null) {
            this._state.defaultAuctionPriceDynamic = parsed.price;
            this._logger.info(`Default price set to ${parsed.price}.`, 'Auction');
        }

        this._queueService.enqueueSale(parsed.cropName, parsed.amount);
        if (!this._state.isJackoMode && !this._state.isProcessing) {
            this._queueService.processQueue();
        }
    }
}

module.exports = EventHandler;
