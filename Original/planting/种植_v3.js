/**
 * @file 种植.js
 * @description Automated Planting Script - Refactored v3.0.0
 * @version 3.0.0
 * @architecture Google JavaScript Standards Compliant
 * 
 * @description
 * Comprehensive refactoring with focus on:
 * - Performance: Generator-based iteration, caching, optimized algorithms
 * - Data Structures: Map/Set for O(1) lookups, immutable Point3D
 * - Maintainability: Modular design, JSDoc, error handling, configuration externalization
 * 
 * @module OriginPlanting
 */

const ConfigLoader = require('../core/ConfigLoader.js');
const Point3D = require('../core/Point3D.js');
const { FarmState, StatePhase } = require('../core/FarmState.js');
const MovementService = require('../services/MovementService.js');
const InventoryService = require('../services/InventoryService.js');
const PlayerService = require('../services/PlayerService.js');
const FarmingExecutor = require('../services/FarmingExecutor.js');
const EventHandler = require('../services/EventHandler.js');
const CropRegistry = require('../services/CropRegistry.js');
const SupplyCheckService = require('../services/SupplyCheckService.js');

/**
 * Main application class
 */
class PlantingApplication {
    constructor() {
        this._config = null;
        this._cropRegistry = null;
        this._state = null;
        this._services = {};
        this._eventHandler = null;
    }

    /**
     * Initialize application
     * @returns {boolean} Success status
     */
    initialize() {
        try {
            this._loadConfiguration();
            this._initializeState();
            this._initializeServices();
            this._setupEventHandlers();
            this._displayWelcomeMessage();
            
            return true;
        } catch (error) {
            Chat.log(`§c[Fatal] Initialization failed: ${error.message}`);
            Chat.log(`§c[Stack] ${error.stack}`);
            return false;
        }
    }

    /**
     * Load and validate configuration
     * @private
     */
    _loadConfiguration() {
        this._config = ConfigLoader.load('../config/plantingConfig.json');
        const cropsConfig = ConfigLoader.load('../config/cropsConfig.json');

        if (!this._config) {
            throw new Error('Failed to load plantingConfig.json');
        }
        if (!cropsConfig) {
            throw new Error('Failed to load cropsConfig.json');
        }

        this._cropRegistry = new CropRegistry(cropsConfig);
        this._syncSeedItems();
        this._validateConfiguration();
    }

    _syncSeedItems() {
        const seedItems = this._cropRegistry.getSeedItems();
        if (!this._config.items) {
            this._config.items = {};
        }
        this._config.items.seeds = seedItems;

        const transferList = Array.isArray(this._config.items.transferList)
            ? [...this._config.items.transferList]
            : [];
        for (const seed of seedItems) {
            if (!transferList.includes(seed)) {
                transferList.push(seed);
            }
        }
        this._config.items.transferList = transferList;
    }

    /**
     * Validate configuration structure
     * @private
     */
    _validateConfiguration() {
        const required = ['positions', 'chests', 'items', 'keybindings', 'timings', 'thresholds'];
        
        for (const key of required) {
            if (!this._config[key]) {
                throw new Error(`Missing configuration section: ${key}`);
            }
        }
    }

    /**
     * Initialize application state
     * @private
     */
    _initializeState() {
        this._state = new FarmState();
        this._applySeedConfig();
    }

    _applySeedConfig() {
        const cropId = this._config?.scriptConfig?.activeCrop;
        const seedsByCrop = this._config?.seedsByCrop || {};
        const seedConfig = seedsByCrop[cropId];
        if (cropId && seedConfig?.supply) {
            this._state.setActiveCrop(cropId);
            this._state.setSeedChestPos(Point3D.from(seedConfig.supply));
            if (seedConfig.dump) {
                this._state.setSeedDumpPos(Point3D.from(seedConfig.dump));
            }
            this._state.setPhase(StatePhase.GET_POS_START);
        }
    }

    /**
     * Initialize all services
     * @private
     */
    _initializeServices() {
        this._services.movement = new MovementService(this._config);
        this._services.inventory = new InventoryService(this._config);
        this._services.player = new PlayerService(this._config);
        this._services.executor = new FarmingExecutor(
            this._config,
            this._services.movement,
            this._services.inventory,
            this._services.player
        );
        this._services.supplyCheck = new SupplyCheckService(
            this._config,
            this._cropRegistry,
            this._services.movement,
            this._services.inventory
        );
    }

    /**
     * Setup event handlers
     * @private
     */
    _setupEventHandlers() {
        Hud.clearDraw3Ds();
        
        this._eventHandler = new EventHandler(
            this._config,
            this._state,
            this._services.executor,
            this._services.supplyCheck
        );
        
        this._eventHandler.register();
    }

    /**
     * Display welcome message
     * @private
     */
    _displayWelcomeMessage() {
        const cropId = this._config?.scriptConfig?.activeCrop;
        const seedConfig = this._config?.seedsByCrop?.[cropId];
        if (cropId && seedConfig?.supply) {
            Chat.log(Chat.createTextBuilder()
                .append(`Seed chest set for crop: ${cropId}`)
                .withColor(0x2)
                .build());
            Chat.log(Chat.createTextBuilder()
                .append("Click on the block as the starting point")
                .withColor(0x2)
                .build());
            return;
        }
        Chat.log(Chat.createTextBuilder()
            .append("Click on the seed chest to select crop")
            .withColor(0x2)
            .build());
    }


    /**
     * Cleanup and shutdown
     */
    shutdown() {
        if (this._eventHandler) {
            this._eventHandler.unregister();
        }
        
        if (this._services.inventory) {
            this._services.inventory.clearCache();
        }
        
        Chat.log('§c[System] Application shutdown complete');
    }
}

try {
    const app = new PlantingApplication();
    
    if (!app.initialize()) {
        Chat.log('§c[Fatal] Application failed to start');
        throw new Error('Initialization failed');
    }

    Chat.log('§a[System] Application running. Press X to exit.');

} catch (error) {
    Chat.log('§c[Critical Error] ' + error.message);
    Chat.log('§7' + error.stack);
}

