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
                itemNames: cfg.items.soil
            },
            [OperationMode.FERTILIZE]: {
                name: 'Fertilizing',
                chestPos: Point3D.from(cfg.chests.fertilizer.supply),
                dumpPos: Point3D.from(cfg.chests.fertilizer.dump),
                itemNames: cfg.items.fertilizer
            },
            [OperationMode.PLANT]: {
                name: 'Planting Seeds',
                itemNames: cfg.items.seeds,
                logName: 'seeds'
            },
            [OperationMode.WATER]: {
                name: 'Watering Plants',
                chestPos: Point3D.from(cfg.chests.water.supply),
                itemNames: cfg.items.water
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
        const itemNames = modeConfig.itemNames;
        const actionName = modeConfig.name;


        if (mode === OperationMode.PLANT) {
            if (!state.seedChestPos) {
                Chat.log('§c[Error] Seed chest position not set!');
                return;
            }
            chestPos = state.seedChestPos;
            dumpPos = new Point3D(
                chestPos.x,
                chestPos.y + 4,
                chestPos.z + 2
            );
        }


        if (mode === OperationMode.WATER) {
            Chat.log(`§a[Start] ${actionName}...`);
            state.startExecution(mode);
            try {
                this._equipWateringCan(state, chestPos, itemNames);
                this._executeWateringWalk(state);
                Chat.log(`§a[Done] ${actionName} finished.`);
                state.printStatistics();
            } catch (error) {
                Chat.log(`§c[Error] ${actionName} failed: ${error.message}`);
                state.incrementError();
            } finally {
                state.stopExecution();
                state.setPhase('MODE_SELECT');
            }
            return;
        }

        Chat.log(`§a[Start] ${actionName}...`);
        state.startExecution(mode);

        try {
            this._executeSnakeWalk(state, chestPos, itemNames, modeConfig.logName);
            
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
     * Equip watering can
     * @private
     */
    _equipWateringCan(state, chestPos, itemNames) {
        const inv = Player.openInventory();
        let slots = this._inventoryService.findItemSlots(itemNames);
        
        if (slots.length === 0) {
            // Not in inventory, try chest - fetch ONLY ONE
            if (!this._inventoryService.retrieveItem(chestPos, itemNames, this._movementService, 1)) {
                throw new Error("Could not find watering can in chest");
            }
            Client.waitTick(10);
            slots = this._inventoryService.findItemSlots(itemNames);
            if (slots.length === 0) {
                throw new Error("Watering can not found after chest access");
            }
        }

        const slot = slots[0];
        // Equip to slot 9 (index 8)
        if (slot !== 8) {
            inv.swapHotbar(slot, 8);
            Client.waitTick(5);
        }
        inv.setSelectedHotbarSlotIndex(8);
        Client.waitTick(5);
        Chat.log(`§a[Water] Equipped Watering Can`);
    }

    /**
     * Execute watering walk (sparse center iteration)
     * @private
     */
    _executeWateringWalk(state) {
        const start = state.startPos;
        const end = this._cropEndPos;
        const stepSize = 5;

        // Calculate bounds logic from original script
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        const minZ = Math.min(start.z, end.z);
        const maxZ = Math.max(start.z, end.z);

        // Start from +2 offset (center of 5x5)
        let x = minX + 2;
        let z = maxZ - 2;
        let goingUp = true;
        let processed = 0;

        Chat.log(`§e[Info] Starting watering cycle...`);

        while (x <= maxX - 2) {
            if (!state.isRunning) break;

            if (goingUp) {
                while (z >= minZ + 2) {
                    if (!state.isRunning) break;
                    this._processWateringCenter(state, new Point3D(x, start.y, z));
                    z -= stepSize;
                    processed++;
                }
                z = minZ + 2;
            } else {
                while (z <= maxZ - 2) {
                    if (!state.isRunning) break;
                    this._processWateringCenter(state, new Point3D(x, start.y, z));
                    z += stepSize;
                    processed++;
                }
                z = maxZ - 2;
            }

            x += stepSize;
            goingUp = !goingUp;
        }
    }

    /**
     * Process single watering center
     * @private
     */
    _processWateringCenter(state, centerPos) {
        this._waitIfPaused(state);

        // Move to center block
        if (!this._movementService.moveTo(centerPos, state)) {
            Chat.log(`§c[Warning] Failed to reach ${centerPos}`);
            state.incrementError();
            return;
        }

        // Water source is 4 blocks above center
        const waterSource = new Point3D(centerPos.x, centerPos.y + 4, centerPos.z);
        const player = Player.getPlayer();
        const interactionMgr = Player.getInteractionManager();

        try {
            // 1. Refill from source (Look up and interact)
            // Use smooth lookAt from MovementService with 3.5x speed
            if (this._movementService.lookAt(waterSource, state, 2)) {
                Client.waitTick(1); // Reduced from 2
                interactionMgr.interactBlock(waterSource.x, waterSource.y, waterSource.z, 0, false);
                Client.waitTick(1);
            }

            // 2. Water the crop (Look down at center and interact)
            if (this._movementService.lookAt(centerPos, state, 2)) {
                Client.waitTick(1);
                interactionMgr.interactBlock(centerPos.x, centerPos.y, centerPos.z, 1, false);
                Client.waitTick(1);
            }

            state.incrementStat('blocksProcessed');
        } catch (error) {
            Chat.log(`§c[Error] Watering at ${centerPos} failed: ${error.message}`);
        }
    }

    /**
     * Execute snake-walk pattern over farm area
     * @private
     */
    _executeSnakeWalk(state, chestPos, itemNames, logName) {
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
            this._handleResumeCheck(state, chestPos, itemNames, logName);

            // Skip 5x5区域中心方块（灌溉方块），该方块交互不消耗物品
            const offsetX = pos.x - state.startPos.x;
            const offsetZ = pos.z - state.startPos.z;
            if (offsetX % 5 === 2 && offsetZ % 5 === 2) {
                state.incrementStat('blocksProcessed');
                continue;
            }

            if (!this._movementService.moveTo(pos, state)) {
                Chat.log(`§c[Warning] Failed to reach ${pos}`);
                state.incrementError();
                continue;
            }

            this._inventoryService.checkAndRefill(
                chestPos,
                itemNames,
                this._movementService,
                state,
                logName
            );

            this._performBlockInteraction(pos);

            processedBlocks++;
            state.incrementStat('blocksProcessed');

            if (processedBlocks % 300 === 0) {
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

    _handleResumeCheck(state, chestPos, itemNames, logName) {
        if (!state.consumeResumeCheck()) {
            return;
        }

        const inv = Player.openInventory();
        const slots = this._inventoryService.findItemSlots(itemNames);

        if (slots.length === 0) {
            Chat.log('§e[Resume] Inventory empty after pause. Rechecking supplies...');
            this._inventoryService.checkAndRefill(
                chestPos,
                itemNames,
                this._movementService,
                state,
                logName
            );
            return;
        }

        const selected = inv.getSelectedHotbarSlotIndex();
        if (!slots.includes(selected)) {
            inv.swapHotbar(slots[0], selected);
            Client.waitTick(2);
        }
    }
}

module.exports = FarmingExecutor;
