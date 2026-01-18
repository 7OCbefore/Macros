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

/**
 * Main application class
 */
class PlantingApplication {
    constructor() {
        this._config = null;
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
        
        if (!this._config) {
            throw new Error('Failed to load plantingConfig.json');
        }

        this._validateConfiguration();
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
            this._services.executor
        );
        
        this._eventHandler.register();
    }

    /**
     * Display welcome message
     * @private
     */
    _displayWelcomeMessage() {
        Chat.log(Chat.createTextBuilder()
            .append("Click on the first block to set seed_chest position")
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

