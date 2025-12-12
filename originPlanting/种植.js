// 种植.js - Optimized & Refactored
// Version: 2.0.0
// Description: Automated farming script for Origin Realms with optimized performance and structure.

// --- Configuration & Constants ---
const Config = {
    // Keys
    CLOSE_KEY: "key.keyboard.x",
    PAUSE_KEY: "key.keyboard.z",
    SPRINT_KEY: "key.forward",
    FORWARD_KEY: "key.sprint",
    RIGHT_CLICK: "key.mouse.right",
    LEFT_CLICK: "key.mouse.left",
    MODE_KEYS: {
        SOIL: "key.keyboard.1",
        FERTILIZE: "key.keyboard.2",
        PLANT: "key.keyboard.3"
    },

    // Delays (Strictly Preserved)
    PING_MEASUREMENT_COUNT: 34,
    PING_THRESHOLD_MULTIPLIER: 1.1,
    CONTAINER_WAIT_TIMEOUT: 100,
    EAT_WAIT_TICKS: 66,
    POST_EAT_WAIT_TICKS: 20,
    CHEST_WAIT_TICKS: 34,
    INV_CLOSE_WAIT_TICKS: 6,
    ATTACK_WAIT_TICKS: 1,
    MOVE_WAIT_TICKS: 1,
    REFILL_WAIT_TICKS: 16,
    FERTILIZE_WAIT_TICKS: 1,
    
    // Thresholds & Limits
    STEP_SIZE: 5,
    REFILL_THRESHOLD: 6,
    FOOD_LEVEL_THRESHOLD: 20,
    MAX_INVENTORY_SLOTS: 36,
    MAX_STACK_SIZE: 64,
    PLAYER_REACH_DISTANCE: 3,

    // Items
    ITEMS: {
        SOIL: "minecraft:dirt",
        FERTILIZER: "minecraft:bone_meal",
        SEED: "minecraft:wheat_seeds",
        REFILL_TRIGGER: "minecraft:paper" // Used as a token/trigger item in original script logic
    },

    // Fixed Locations
    LOCATIONS: {
        CROP_END: { x: 276, y: 56, z: 329 },
        CHEST_SOIL: { x: 220, y: 55, z: 397 },
        CHEST_SOIL_DUMP: { x: 220, y: 58, z: 398 },
        CHEST_FERTILIZER: { x: 221, y: 55, z: 397 },
        CHEST_FERTILIZER_DUMP: { x: 222, y: 58, z: 399 }
    }
};

// --- Data Structures ---

class Point3D {
    constructor(x, y, z) {
        this.x = Math.floor(x);
        this.y = Math.floor(y);
        this.z = Math.floor(z);
    }

    static fromArray(arr) {
        if (!arr || arr.length < 3) return null;
        return new Point3D(arr[0], arr[1], arr[2]);
    }

    static fromBlock(block) {
        return new Point3D(block.getX(), block.getY(), block.getZ());
    }

    toArray() {
        return [this.x, this.y, this.z];
    }

    distanceTo(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const dz = this.z - other.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    
    // For movement targets (center of block)
    toCenter() {
        return { x: this.x + 0.5, y: this.y + 0.5, z: this.z + 0.5 };
    }
}

class FarmState {
    constructor() {
        this.isPaused = false;
        this.isActionRunning = false;
        this.scriptPhase = "GET_POS_CHEST"; // GET_POS_CHEST -> GET_POS_START -> MODE_SELECT
        this.seedChestPos = null;
        this.startPos = null;
    }
}

// --- Logic Modules ---

/**
 * Handles complex iteration logic for the farm area using Generators for performance.
 */
class FarmIterator {
    constructor(startPos, endPos, stepSize = 5) {
        this.startPos = startPos;
        this.endPos = endPos;
        this.stepSize = stepSize;
        this.xStep = Math.sign(endPos.x - startPos.x) || 1;
        this.zStepInitial = Math.sign(endPos.z - startPos.z) || 1;
    }

    /**
     * Generator that yields Point3D for each target block.
     * Lazy evaluation saves memory compared to pre-allocating large arrays.
     */
    *iterate() {
        let currentX = this.startPos.x;
        let group = 0;

        while ((this.xStep > 0 && currentX <= this.endPos.x) || 
               (this.xStep < 0 && currentX >= this.endPos.x)) {
            
            const zStart = (group % 2 === 0) ? this.startPos.z : this.endPos.z;
            const zEnd = (zStart === this.startPos.z) ? this.endPos.z : this.startPos.z;
            const zStep = (zStart === this.startPos.z) ? this.zStepInitial : -this.zStepInitial;

            // Z-axis traversal
            for (let z = zStart; 
                 (zStep > 0 && z <= zEnd) || (zStep < 0 && z >= zEnd); 
                 z += zStep) {
                
                // X-axis strip traversal
                for (let localX = currentX;
                     (this.xStep > 0 && localX < currentX + this.stepSize * this.xStep && localX <= this.endPos.x) ||
                     (this.xStep < 0 && localX > currentX + this.stepSize * this.xStep && localX >= this.endPos.x);
                     localX += this.xStep) {
                    
                    yield new Point3D(localX, this.startPos.y, z);
                }
            }
            currentX += this.stepSize * this.xStep;
            group++;
        }
    }
}

class ActionService {
    static waitIfPaused(state) {
        while (state.isPaused) {
            Client.waitTick(20);
        }
    }

    static moveToBlock(targetPos) {
        const player = Player.getPlayer();
        const center = targetPos.toCenter();
        let currentPos = { x: player.getX(), y: player.getY(), z: player.getZ() };
        
        let dx = center.x - currentPos.x;
        let dz = center.z - currentPos.z;
        let distance = Math.sqrt(dx * dx + dz * dz);

        while (distance > Config.PLAYER_REACH_DISTANCE) {
            player.lookAt(center.x, center.y, center.z);
            
            // Re-calculate distance
            currentPos = { x: player.getX(), y: player.getY(), z: player.getZ() };
            dx = center.x - currentPos.x;
            dz = center.z - currentPos.z;
            distance = Math.sqrt(dx * dx + dz * dz);

            KeyBind.keyBind(Config.SPRINT_KEY, true);
            KeyBind.keyBind(Config.FORWARD_KEY, true);
            Client.waitTick(Config.MOVE_WAIT_TICKS);
        }
        KeyBind.keyBind(Config.SPRINT_KEY, false);
    }

    static eat() {
        const player = Player.getPlayer();
        let foodLevel = player.getFoodLevel();

        if (foodLevel >= Config.FOOD_LEVEL_THRESHOLD) return;

        Chat.log(`§b[Eat] Food level: ${foodLevel}. Eating...`);

        while (foodLevel < 20) {
            player.lookAt("up");
            KeyBind.key(Config.RIGHT_CLICK, true);
            Client.waitTick(Config.EAT_WAIT_TICKS);
            KeyBind.key(Config.RIGHT_CLICK, false);

            Client.waitTick(Config.POST_EAT_WAIT_TICKS);
            foodLevel = player.getFoodLevel();

            Chat.log(`§b[Eat] Food level is now ${foodLevel}`);
            if (foodLevel >= Config.FOOD_LEVEL_THRESHOLD) break;
        }
    }

    static checkAndRefillItem(chestPos, itemId) {
        const player = Player.getPlayer();
        const inv = Player.openInventory();
        const mainHandItem = player.getMainHand();

        if (mainHandItem.getCount() > Config.REFILL_THRESHOLD) return;

        // Optimization: Try to refill from inventory first
        const itemSlots = inv.findItem(itemId);
        let selectedSlot = -1;

        // Find a slot with enough items
        for (const slot of itemSlots) {
            if (inv.getSlot(slot).getCount() > Config.REFILL_THRESHOLD) {
                selectedSlot = slot;
                break;
            }
        }

        if (selectedSlot !== -1) {
            inv.swapHotbar(selectedSlot, inv.getSelectedHotbarSlotIndex());
            Client.waitTick(Config.REFILL_WAIT_TICKS);
        } else {
            // Refill from chest
            Chat.log(`§e[Refill] ${itemId} low. Going to chest...`);
            ActionService.moveToBlock(chestPos); // chestPos is Point3D
            
            Player.getInteractionManager().interactBlock(chestPos.x, chestPos.y, chestPos.z, player.getFacingDirection().getName(), false);

            while (!Hud.isContainer()) {
                Client.waitTick();
            }
            Client.waitTick(5);

            const chestInv = Player.openInventory();
            const chestSlots = chestInv.findItem(itemId);
            
            let emptySlots = 0;
            for (let i = 0; i < Config.MAX_INVENTORY_SLOTS; i++) {
                 if (inv.getSlot(i).getItemId() === "minecraft:air") emptySlots++;
            }
            // Add slots that are low to empty count approximate
             for (const slot of itemSlots) {
                if (inv.getSlot(slot).getCount() <= Config.REFILL_THRESHOLD) emptySlots++;
             }


            if (chestSlots.length > 0) {
                for (const chestSlot of chestSlots) {
                    if (chestInv.getSlot(chestSlot).getCount() > 0) {
                        chestInv.quick(chestSlot);
                        Client.waitTick();
                    }
                    // Optimize: break if full? (omitted to keep original aggressive refill logic)
                }
            } else {
                Chat.log(`§c[Error] No ${itemId} in chest!`);
            }

            chestInv.closeAndDrop();
            Client.waitTick();
        }
    }

    static transferItemsToChest(chestPos, itemsToTransfer) {
        const player = Player.getPlayer();
        ActionService.moveToBlock(chestPos);
        
        Player.getInteractionManager().interactBlock(chestPos.x, chestPos.y, chestPos.z, player.getFacingDirection().getName(), false);

        let timeout = Config.CONTAINER_WAIT_TIMEOUT;
        while (!Hud.isContainer() && timeout > 0) {
            Client.waitTick(1);
            timeout--;
        }

        if (timeout === 0) {
            Chat.log("§c[Error] Timeout opening chest.");
            return;
        }

        Client.waitTick(5);
        const inv = Player.openInventory();
        const map = inv.getMap();
        if (!map || !map.main) { inv.closeAndDrop(); return; }

        const mainStart = map.main[0];
        
        // Use Set for O(1) lookup
        const transferSet = new Set(itemsToTransfer);
        const slotsToTransfer = [];

        // Scan inventory
        for (let i = mainStart; i < mainStart + Config.MAX_INVENTORY_SLOTS; i++) {
            if (transferSet.has(inv.getSlot(i).getItemId())) {
                slotsToTransfer.push(i);
            }
        }

        // Batch transfer
        for (const slot of slotsToTransfer) {
            inv.quick(slot);
            Client.waitTick();
        }

        Client.waitTick(20);
        inv.closeAndDrop();
        Client.waitTick(20);
    }
}

class ModeExecutor {
    static async snakeWalk(state, chestPos, itemId, actionName) {
        Chat.log(`§a[Start] ${actionName}...`);
        
        const iterator = new FarmIterator(state.startPos, new Point3D(Config.LOCATIONS.CROP_END.x, Config.LOCATIONS.CROP_END.y, Config.LOCATIONS.CROP_END.z), Config.STEP_SIZE);
        
        for (const pos of iterator.iterate()) {
            ActionService.waitIfPaused(state);
            if (!state.isActionRunning) break;

            ActionService.moveToBlock(pos);
            ActionService.checkAndRefillItem(chestPos, itemId);

            // Interact
            Player.getInteractionManager().interactBlock(pos.x, pos.y, pos.z, 1, false);
            Client.waitTick(Config.FERTILIZE_WAIT_TICKS);
        }

        state.isActionRunning = false;
        state.scriptPhase = "MODE_SELECT";
        Chat.log(`§a[Done] ${actionName} finished.`);
    }

    static runTask(state, taskType) {
        state.isActionRunning = true;
        let chestPos, dumpChestPos, actionName;
        
        // Common transfer list
        const itemsToTransfer = [Config.ITEMS.REFILL_TRIGGER]; 

        switch (taskType) {
            case 'SOIL':
                chestPos = new Point3D(Config.LOCATIONS.CHEST_SOIL.x, Config.LOCATIONS.CHEST_SOIL.y, Config.LOCATIONS.CHEST_SOIL.z);
                dumpChestPos = new Point3D(Config.LOCATIONS.CHEST_SOIL_DUMP.x, Config.LOCATIONS.CHEST_SOIL_DUMP.y, Config.LOCATIONS.CHEST_SOIL_DUMP.z);
                actionName = "Soil Placement";
                break;
            case 'FERTILIZE':
                chestPos = new Point3D(Config.LOCATIONS.CHEST_FERTILIZER.x, Config.LOCATIONS.CHEST_FERTILIZER.y, Config.LOCATIONS.CHEST_FERTILIZER.z);
                dumpChestPos = new Point3D(Config.LOCATIONS.CHEST_FERTILIZER_DUMP.x, Config.LOCATIONS.CHEST_FERTILIZER_DUMP.y, Config.LOCATIONS.CHEST_FERTILIZER_DUMP.z);
                actionName = "Fertilizing";
                break;
            case 'PLANT':
                chestPos = state.seedChestPos; // Use dynamic pos
                dumpChestPos = new Point3D(chestPos.x, chestPos.y + 2, chestPos.z + 1);
                actionName = "Planting Seeds";
                break;
        }

        this.snakeWalk(state, chestPos, Config.ITEMS.REFILL_TRIGGER, actionName);
        ActionService.transferItemsToChest(dumpChestPos, itemsToTransfer);
        ActionService.eat();
    }
}

// --- Main Execution ---

const GlobalState = new FarmState();
Hud.clearDraw3Ds();

// Event Listeners
const keyListener = JsMacros.on("Key", JavaWrapper.methodToJava((event, ctx) => {
    // 1. Pause/Stop Control
    if (event.key == Config.CLOSE_KEY) {
        Chat.log('§cScript terminated.');
        JavaWrapper.stop();
    }
    if (event.key == Config.PAUSE_KEY && event.action == 1) {
        GlobalState.isPaused = !GlobalState.isPaused;
        Chat.log(GlobalState.isPaused ? '§eScript Paused' : '§aScript Resumed');
    }

    // 2. Setup Phase (Clicking Blocks)
    if (event.key == Config.LEFT_CLICK && event.action == 1) {
        // Only handle clicks during setup phases
        if (GlobalState.scriptPhase === "GET_POS_CHEST" || GlobalState.scriptPhase === "GET_POS_START") {
            const target = Player.getInteractionManager().getTargetedBlock();
            if (target) {
                event.cancel(); // Prevent actual hitting
                // ctx.releaseLock(); // Not always needed depending on context, keeping if original had it, but usually event.cancel is enough.
                
                const pos = Point3D.fromBlock(target);

                if (GlobalState.scriptPhase === "GET_POS_CHEST") {
                    GlobalState.seedChestPos = pos;
                    GlobalState.scriptPhase = "GET_POS_START";
                    Chat.log(Chat.createTextBuilder().append(`Seed Chest set: (${pos.x}, ${pos.y}, ${pos.z})`).withColor(0x2).build());
                    Chat.log("§eNext: Click the STARTING block.");
                } else if (GlobalState.scriptPhase === "GET_POS_START") {
                    GlobalState.startPos = pos;
                    GlobalState.scriptPhase = "MODE_SELECT";
                    Chat.log(Chat.createTextBuilder().append(`Start Point set: (${pos.x}, ${pos.y}, ${pos.z})`).withColor(0x2).build());
                    Chat.log("§aSetup Complete. Press 1 (Soil), 2 (Fertilize), 3 (Plant).");
                }
            }
        }
    }

    // 3. Mode Selection
    if (event.action == 1 && GlobalState.scriptPhase === "MODE_SELECT") {
        if (GlobalState.isActionRunning) {
             if ([Config.MODE_KEYS.SOIL, Config.MODE_KEYS.FERTILIZE, Config.MODE_KEYS.PLANT].includes(event.key)) {
                Chat.log("§cAction running. Please wait.");
             }
             return;
        }

        if (event.key == Config.MODE_KEYS.SOIL) {
            ModeExecutor.runTask(GlobalState, 'SOIL');
        } else if (event.key == Config.MODE_KEYS.FERTILIZE) {
            ModeExecutor.runTask(GlobalState, 'FERTILIZE');
        } else if (event.key == Config.MODE_KEYS.PLANT) {
            ModeExecutor.runTask(GlobalState, 'PLANT');
        }
    }
}));

// Initial Prompt
Chat.log(Chat.createTextBuilder().append("§aScript Started. Click on the SEED CHEST to begin.").build());

// Keep script alive (JSMacros scripts end when main execution finishes unless listeners are active, but explicit wait is good for some versions)
// loop required? Not if using event listeners purely. But usually scripts just end if no infinite loop. 
// However, JSMacros events keep the context alive.
// Original script didn't have a keep-alive loop at the end, relying on event listeners.