/**
 * @file EventHandler.js
 * @description Centralized event handling for key presses and user interactions
 * @version 3.0.0
 */

const Point3D = require('../core/Point3D.js');
const { StatePhase, OperationMode } = require('../core/FarmState.js');

class EventHandler {
    constructor(config, state, farmingExecutor) {
        this._config = config;
        this._state = state;
        this._executor = farmingExecutor;
        
        this._keys = config.keybindings;
        this._listener = null;
    }

    /**
     * Register event listener
     */
    register() {
        this._listener = JsMacros.on("Key", JavaWrapper.methodToJava((event, ctx) => {
            try {
                this._handleKeyEvent(event, ctx);
            } catch (error) {
                Chat.log(`§c[Event Error] ${error.message}`);
            }
        }));
    }

    /**
     * Unregister event listener
     */
    unregister() {
        if (this._listener) {
            JsMacros.off(this._listener);
            this._listener = null;
        }
    }

    /**
     * Handle key events
     * @private
     */
    _handleKeyEvent(event, ctx) {
        if (event.key === this._keys.close) {
            this._handleCloseKey();
            return;
        }

        if (event.key === this._keys.pause && event.action === 1) {
            this._handlePauseKey();
            return;
        }

        if (event.key === this._keys.leftClick && event.action === 1) {
            this._handleLeftClick(event, ctx);
            return;
        }

        if (event.action === 1 && this._state.phase === StatePhase.MODE_SELECT) {
            this._handleModeSelection(event);
        }
    }

    /**
     * Handle close/stop key
     * @private
     */
    _handleCloseKey() {
        Chat.log('§c[System] Script terminated by user');
        this._state.printStatistics();
        JavaWrapper.stop();
    }

    /**
     * Handle pause/resume key
     * @private
     */
    _handlePauseKey() {
        const isPaused = this._state.togglePause();
        Chat.log(isPaused ? '§e[System] Script PAUSED' : '§a[System] Script RESUMED');
    }

    /**
     * Handle left click for position setup
     * @private
     */
    _handleLeftClick(event, ctx) {
        const phase = this._state.phase;
        
        if (phase !== StatePhase.GET_POS_CHEST && phase !== StatePhase.GET_POS_START) {
            return;
        }

        const target = Player.getInteractionManager().getTargetedBlock();
        if (!target) return;

        event.cancel();
        ctx.releaseLock();

        const pos = Point3D.fromBlock(target);

        if (phase === StatePhase.GET_POS_CHEST) {
            this._state.setSeedChestPos(pos);
            this._state.setPhase(StatePhase.GET_POS_START);
            
            Chat.log(Chat.createTextBuilder()
                .append(`Seed_chest position set to: (${pos.x}, ${pos.y}, ${pos.z})`)
                .withColor(0x2)
                .build());
            Chat.log(Chat.createTextBuilder()
                .append("Now click on the second block as the starting point")
                .withColor(0x2)
                .build());
            
        } else if (phase === StatePhase.GET_POS_START) {
            this._state.setStartPos(pos);
            this._state.setPhase(StatePhase.MODE_SELECT);
            
            Chat.log(Chat.createTextBuilder()
                .append(`Starting point set to: (${pos.x}, ${pos.y}, ${pos.z})`)
                .withColor(0x2)
                .build());
            Chat.log(Chat.createTextBuilder()
                .append("Positions set. Press 1 for placing soil, 2 for fertilizing, 3 for planting seeds, 4 for watering")
                .withColor(0x2)
                .build());
        }
    }


    /**
     * Handle mode selection keys
     * @private
     */
    _handleModeSelection(event) {
        if (this._state.isRunning) {
            if ([this._keys.modeSoil, this._keys.modeFertilize, this._keys.modePlant, this._keys.modeWater].includes(event.key)) {
                Chat.log("§cAnother action is already running. Please wait until it finishes.");
            }
            return;
        }

        let mode = null;

        if (event.key === this._keys.modeSoil) {
            mode = OperationMode.SOIL;
        } else if (event.key === this._keys.modeFertilize) {
            mode = OperationMode.FERTILIZE;
        } else if (event.key === this._keys.modePlant) {
            mode = OperationMode.PLANT;
        } else if (event.key === this._keys.modeWater) {
            mode = OperationMode.WATER;
        }

        if (mode) {
            this._state.resetErrors();
            this._executor.execute(this._state, mode);
            
            // Auto-chain Water after Plant if successful
            if (mode === OperationMode.PLANT && this._state.errorCount === 0) {
                Chat.log("§a[Auto] Planting finished successfully. Starting Watering...");
                Client.waitTick(20);
                this._executor.execute(this._state, OperationMode.WATER);
            }
        }
    }

}

module.exports = EventHandler;
