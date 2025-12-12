/**
 * @file FarmingExecutor.js
 * @description Main execution engine for farming operations
 * @version 3.0.0
 */

const FarmIterator = require('../core/FarmIterator.js');
const Point3D = require('../core/Point3D.js');
const { OperationMode } = require('../core/FarmState.js');

class FarmingExecutor {
    constructor(config, movementService, inventoryService, playerService) {
        this._config = config;
        this._movementService = movementService;
        this._inventoryService = inventoryService;
        this._playerService = playerService;
        
        this._fertilizeWaitTicks = config.timings.fertilizeWaitTicks || 1;
        this._cropEndPos = Point3D.from(config.positions.cropEnd);
        
        this._modeConfigs = this._buildModeConfigs();
    }

    /**
     * Build mode configuration mappings
     * @private
     */
    _buildModeConfigs() {
        const cfg = this._config;
        
        return {
            [OperationMode.SOIL]: {
                name: 'Soil Placement',
                chestPos: Point3D.from(cfg.chests.soil.supply),
                dumpPos: Point3D.from(cfg.chests.soil.dump),
                itemId: cfg.items.soil
            },
            [OperationMode.FERTILIZE]: {
                name: 'Fertilizing',
                chestPos: Point3D.from(cfg.chests.fertilizer.supply),
                dumpPos: Point3D.from(cfg.chests.fertilizer.dump),
                itemId: cfg.items.fertilizer
            },
            [OperationMode.PLANT]: {
                name: 'Planting Seeds',
                itemId: cfg.items.seeds
            }
        };
    }

    /**
     * Execute farming task
     * @param {FarmState} state 
     * @param {OperationMode} mode 
     */
    execute(state, mode) {
        if (!OperationMode[mode]) {
            throw new Error(`Invalid mode: ${mode}`);
        }

        const modeConfig = this._modeConfigs[mode];
        
        let chestPos = modeConfig.chestPos;
        let dumpPos = modeConfig.dumpPos;
        const itemId = modeConfig.itemId;
        const actionName = modeConfig.name;

        if (mode === OperationMode.PLANT) {
            if (!state.seedChestPos) {
                Chat.log('§c[Error] Seed chest position not set!');
                return;
            }
            chestPos = state.seedChestPos;
            dumpPos = new Point3D(
                chestPos.x,
                chestPos.y + 2,
                chestPos.z + 1
            );
        }

        Chat.log(`§a[Start] ${actionName}...`);
        state.startExecution(mode);

        try {
            this._executeSnakeWalk(state, chestPos, itemId);
            
            this._inventoryService.transferToChest(
                dumpPos,
                this._config.items.transferList,
                this._movementService
            );
            
            this._playerService.eat();
            
            Chat.log(`§a[Done] ${actionName} finished.`);
            state.printStatistics();
            
        } catch (error) {
            Chat.log(`§c[Error] ${actionName} failed: ${error.message}`);
            state.incrementError();
        } finally {
            state.stopExecution();
            state.setPhase('MODE_SELECT');
        }
    }

    /**
     * Execute snake-walk pattern over farm area
     * @private
     */
    _executeSnakeWalk(state, chestPos, itemId) {
        const iterator = new FarmIterator(
            state.startPos,
            this._cropEndPos,
            this._config.thresholds.stepSize
        );

        const totalBlocks = iterator.getTotalBlocks();
        let processedBlocks = 0;

        Chat.log(`§e[Info] Processing ${totalBlocks} blocks...`);

        for (const pos of iterator.iterate()) {
            if (!state.isRunning) {
                Chat.log('§c[Stop] Execution stopped by user');
                break;
            }

            this._waitIfPaused(state);

            if (!this._movementService.moveTo(pos, state)) {
                Chat.log(`§c[Warning] Failed to reach ${pos}`);
                state.incrementError();
                continue;
            }

            this._inventoryService.checkAndRefill(
                chestPos,
                itemId,
                this._movementService,
                state
            );

            this._performBlockInteraction(pos);

            processedBlocks++;
            state.incrementStat('blocksProcessed');

            if (processedBlocks % 100 === 0) {
                Chat.log(`§b[Progress] ${processedBlocks}/${totalBlocks} blocks processed`);
            }
        }
    }

    /**
     * Perform interaction with block
     * @private
     */
    _performBlockInteraction(pos) {
        try {
            Player.getInteractionManager().interactBlock(
                pos.x,
                pos.y,
                pos.z,
                1,
                false
            );
            Client.waitTick(this._fertilizeWaitTicks);
        } catch (error) {
            Chat.log(`§c[Interaction Error] at ${pos}: ${error.message}`);
        }
    }

    /**
     * Wait while paused
     * @private
     */
    _waitIfPaused(state) {
        while (state.isPaused) {
            Client.waitTick(20);
        }
    }
}

module.exports = FarmingExecutor;
