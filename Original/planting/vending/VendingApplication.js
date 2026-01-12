/**
 * @file VendingApplication.js
 * @description Entry application for vending macro
 */

const ConfigLoader = require('../core/ConfigLoader.js');
const VendingState = require('./VendingState.js');
const Logger = require('../services/Logger.js');
const InventoryService = require('../services/VendingInventoryService.js');
const MovementService = require('../services/VendingMovementService.js');
const AuctionService = require('../services/AuctionService.js');
const BasketService = require('../services/BasketService.js');
const MessageParser = require('../services/MessageParser.js');
const QueueService = require('../services/QueueService.js');
const JackoService = require('../services/JackoService.js');
const Scheduler = require('../services/Scheduler.js');
const EventHandler = require('../services/VendingEventHandler.js');

class VendingApplication {
    constructor() {
        this._config = null;
        this._state = new VendingState();
        this._logger = null;
        this._services = {};
        this._eventHandler = null;
    }

    initialize() {
        try {
            this._loadConfiguration();
            this._logger = new Logger(this._config);
            this._initializeServices();
            this._setupEventHandlers();
            this._displayWelcome();
            this._state.nextCheckTicks = this._services.scheduler.schedule();
            return true;
        } catch (error) {
            Chat.log(`[Vending][ERROR] Initialization failed: ${error.message}`);
            return false;
        }
    }

    shutdown() {
        if (this._eventHandler) {
            this._eventHandler.unregister();
        }

        ConfigLoader.clearCache();

        if (this._logger) {
            this._logger.warn('Application shutdown complete.', 'System');
        }
    }

    _loadConfiguration() {
        this._config = ConfigLoader.load('../config/vendingConfig.json');
        if (!this._config) {
            throw new Error('Failed to load vendingConfig.json');
        }

        this._validateConfiguration();
        this._config.cropDataMap = this._buildCropDataMap(this._config.cropData);
    }

    _validateConfiguration() {
        const required = ['scriptConfig', 'timings', 'thresholds', 'jackoData', 'cropData'];
        for (const key of required) {
            if (!this._config[key]) {
                throw new Error(`Missing configuration section: ${key}`);
            }
        }
    }

    _buildCropDataMap(cropData) {
        const map = {};
        for (const cropKey in cropData) {
            const name = (cropData[cropKey].name || '').replace(/[^a-zA-Z]+/g, '').trim();
            map[name] = cropData[cropKey];
        }
        return map;
    }

    _initializeServices() {
        this._services.inventory = new InventoryService(this._config, this._logger);
        this._services.movement = new MovementService(this._config, this._logger);
        this._services.basket = new BasketService(
            this._config,
            this._logger,
            this._services.inventory,
            this._services.movement
        );
        this._services.auction = new AuctionService(
            this._config,
            this._logger,
            this._services.inventory,
            this._state
        );
        this._services.queue = new QueueService(
            this._config,
            this._logger,
            this._state,
            this._services.auction,
            this._services.basket,
            this._config.cropData
        );
        this._services.jacko = new JackoService(
            this._config,
            this._logger,
            this._state,
            this._services.inventory,
            this._services.movement,
            this._services.basket,
            this._services.queue,
            this._config.cropDataMap
        );
        this._services.scheduler = new Scheduler(
            this._config,
            this._logger,
            this._state,
            this._services.jacko
        );
        this._services.parser = new MessageParser(this._config, this._logger);
    }

    _setupEventHandlers() {
        this._eventHandler = new EventHandler(
            this._config,
            this._logger,
            this._state,
            this._services.parser,
            this._services.queue,
            this._services.scheduler,
            () => this.shutdown()
        );
        this._eventHandler.register();
    }

    _displayWelcome() {
        this._logger.info('Vending macro started (Jacko mode enabled).', 'System');
        this._logger.info(`Close key: ${this._config.scriptConfig.closeKey}`, 'System');
    }
}

module.exports = VendingApplication;
