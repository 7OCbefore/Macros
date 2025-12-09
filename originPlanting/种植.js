

/*
2024-08-17 修改为使用单一事件监听器和状态机，避免嵌套监听，提升代码结构和可维护性。
*/

// --- Data Structures ---
class Point3D {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    distanceTo(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const dz = this.z - other.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    add(dx, dy, dz) {
        return new Point3D(this.x + dx, this.y + dy, this.z + dz);
    }

    toBlockCenter() {
        return new Point3D(this.x + 0.5, this.y + 0.5, this.z + 0.5);
    }
}

// 农田区域管理器
class FarmAreaManager {
    constructor(startPos, endPos, stepSize = 5) {
        this.startPos = startPos;
        this.endPos = endPos;
        this.stepSize = stepSize;
        this.xStep = Math.sign(endPos.x - startPos.x);
        this.zStepInitial = Math.sign(endPos.z - startPos.z);
    }

    /**
     * 生成农田区域内所有位置的数组
     * @returns {Point3D[]} 包含所有需要处理位置的数组
     */
    getAllPositions() {
        const positions = [];
        let currentX = this.startPos.x;
        let group = 0;

        while ((this.xStep > 0 && currentX <= this.endPos.x) || 
               (this.xStep < 0 && currentX >= this.endPos.x)) {
            const zStart = (group % 2 === 0) ? this.startPos.z : this.endPos.z;
            const zEnd = (zStart === this.startPos.z) ? this.endPos.z : this.startPos.z;
            const zStep = (zStart === this.startPos.z) ? this.zStepInitial : -this.zStepInitial;

            for (let z = zStart; 
                 (zStep > 0 && z <= zEnd) || (zStep < 0 && z >= zEnd); 
                 z += zStep) {
                for (let localX = currentX;
                     (this.xStep > 0 && localX < currentX + this.stepSize * this.xStep && localX <= this.endPos.x) ||
                     (this.xStep < 0 && localX > currentX + this.stepSize * this.xStep && localX >= this.endPos.x);
                     localX += this.xStep) {
                    positions.push(new Point3D(localX, this.startPos.y, z));
                }
            }
            currentX += this.stepSize * this.xStep;
            group++;
        }
        
        return positions;
    }
}

// 物品管理器
class ItemManager {
    constructor(chestPos, itemId) {
        this.chestPos = chestPos;
        this.itemId = itemId;
    }

    checkAndRefillItem() {
        const player = Player.getPlayer();
        const inv = Player.openInventory();
        const mainHandItem = player.getMainHand();

        if (mainHandItem.getCount() <= Config.REFILL_THRESHOLD) {
            const itemSlots = inv.findItem(this.itemId);
            let selectedSlot = -1;
            for (const slot of itemSlots) {
                const slotItemCount = inv.getSlot(slot).getCount();
                if (slotItemCount > Config.REFILL_THRESHOLD) {
                    selectedSlot = slot;
                    break;
                }
            }

            if (selectedSlot !== -1) {
                inv.swapHotbar(selectedSlot, inv.getSelectedHotbarSlotIndex());
                Client.waitTick(Config.REFILL_WAIT_TICKS);
            } else {
                this.refillFromChest();
            }
        }
    }

    refillFromChest() {
        const player = Player.getPlayer();
        moveToBlock(this.chestPos.x + 0.5, this.chestPos.y + 0.5, this.chestPos.z + 0.5);
        Player.getInteractionManager().interactBlock(this.chestPos.x, this.chestPos.y, this.chestPos.z, player.getFacingDirection().getName(), false);

        while (!Hud.isContainer()) {
            Client.waitTick();
        }
        Client.waitTick(5);

        const chestInv = Player.openInventory();
        const chestSlots = chestInv.findItem(this.itemId);

        if (chestSlots.length > 0) {
            for (const chestSlot of chestSlots) {
                if (chestInv.getSlot(chestSlot).getCount() > 0) {
                    chestInv.quick(chestSlot);
                    Client.waitTick();
                }
            }
        }

        chestInv.closeAndDrop();
        Client.waitTick();
    }
}

// 库存管理器 - 优化库存操作
class InventoryManager {
    constructor() {
        this.inventory = Player.openInventory();
    }

    /**
     * 检查物品数量是否低于阈值
     * @param {string} itemId - 物品ID
     * @param {number} threshold - 阈值
     * @returns {boolean} - 是否低于阈值
     */
    isItemLow(itemId, threshold = Config.REFILL_THRESHOLD) {
        const mainHandItem = Player.getPlayer().getMainHand();
        return mainHandItem.getItemId() === itemId && mainHandItem.getCount() <= threshold;
    }

    /**
     * 在库存中查找物品
     * @param {string} itemId - 物品ID
     * @returns {Array} - 包含物品槽位的数组
     */
    findItemSlots(itemId) {
        return this.inventory.findItem(itemId);
    }

    /**
     * 获取空槽位数量
     * @returns {number} - 空槽位数量
     */
    getEmptySlotsCount() {
        let emptySlots = 0;
        for (let i = 0; i < Config.MAX_INVENTORY_SLOTS; i++) {
            if (this.inventory.getSlot(i).getItemId() === "minecraft:air") {
                emptySlots++;
            }
        }
        return emptySlots;
    }

    /**
     * 快速移动物品到玩家库存
     * @param {*} chestInventory - 箱子库存
     * @param {Array} slots - 槽位数组
     */
    quickTransfer(chestInventory, slots) {
        for (const slot of slots) {
            if (chestInventory.getSlot(slot).getCount() > 0) {
                chestInventory.quick(slot);
                Client.waitTick();
            }
        }
    }
}

// --- Constants ---
const Config = {
    CLOSE_KEY: "key.keyboard.x",
    PAUSE_KEY: "key.keyboard.z",
    STEP_SIZE: 5,
    PING_MEASUREMENT_COUNT: 34,
    PING_THRESHOLD_MULTIPLIER: 1.1,
    CONTAINER_WAIT_TIMEOUT: 100,
    EAT_WAIT_TICKS: 66,
    POST_EAT_WAIT_TICKS: 20,
    CHEST_WAIT_TICKS: 34,
    INV_CLOSE_WAIT_TICKS: 6,
    ATTACK_WAIT_TICKS: 1,
    MOVE_WAIT_TICKS: 1,
    REFILL_THRESHOLD: 6,
    REFILL_WAIT_TICKS: 16,
    FERTILIZE_WAIT_TICKS: 1,
    FOOD_LEVEL_THRESHOLD: 20,
    MAX_INVENTORY_SLOTS: 36,
    MAX_STACK_SIZE: 64,
    PLAYER_REACH_DISTANCE: 3,
    SPRINT_KEY: "key.forward",
    FORWARD_KEY: "key.sprint",
    RIGHT_CLICK: "key.mouse.right",
    LEFT_CLICK: "key.mouse.left",
    SOIL_ITEM_ID: "minecraft:dirt",  // 示例，实际使用时会传入
    FERTILIZER_ITEM_ID: "minecraft:bone_meal",  // 示例，实际使用时会传入
    SEED_ITEM_ID: "minecraft:wheat_seeds",  // 示例，实际使用时会传入
};

// --- State --- (保持不变，但新增 scriptState)
let State = {
    lastUsedChestIndex: 0,
    pingMeasurements: [],
    avgPing: 0,
    isActionRunning: false,
};

// --- Script State --- (新增脚本状态变量)
let scriptState = "GET_POS_CHEST"; // 初始状态为等待获取种子箱子位置

Hud.clearDraw3Ds();

// 脚本状态控制 (保持不变)
var isPaused = false;

// 暂停/继续功能 (保持不变)
JsMacros.on("Key", JavaWrapper.methodToJava((e, ctx) => {
    if (e.key == Config.CLOSE_KEY) {
        Chat.log('脚本关闭了。');
        JavaWrapper.stop();
    }
    if (e.key == Config.PAUSE_KEY && e.action == 1) {
        isPaused = !isPaused;
        Chat.log(isPaused ? '脚本已暂停' : '脚本已继续');
    }
}));

// 坐标和事件处理模块
const CoordinateHandler = {
    posCon: [],
    
    initialize() {
        Chat.log(Chat.createTextBuilder().append("Click on the first block to set seed_chest position").withColor(0x2).build());
    },
    
    handleBlockClick(block) {
        if (scriptState === "GET_POS_CHEST") {
            Chat.log(Chat.createTextBuilder().append(`Seed_chest position set to: (${block.x}, ${block.y}, ${block.z})`).withColor(0x2).build());
            this.posCon[0] = [block.x, block.y, block.z];
            scriptState = "GET_POS_START"; // 更新状态为获取起始位置
            Chat.log(Chat.createTextBuilder().append("Now click on the second block as the starting point").withColor(0x2).build());
        } else if (scriptState === "GET_POS_START") {
            Chat.log(Chat.createTextBuilder().append(`Starting point set to: (${block.x}, ${block.y}, ${block.z})`).withColor(0x2).build());
            this.posCon[1] = [block.x, block.y, block.z];
            scriptState = "MODE_SELECT"; // 更新状态为模式选择
            Chat.log(Chat.createTextBuilder().append("Positions set. Press 1 for placing soil, 2 for fertilizing, 3 for planting seeds.").withColor(0x2).build());
        }
    }
};

// 模式执行模块
const ModeExecutor = {
    executeSoilPlacement() {
        State.isActionRunning = true;
        Chat.log("§aStarting soil placement...");
        const start = CoordinateHandler.posCon[1];
        const end = [276, 56, 329]; // 保持硬编码的 end 坐标
        const chest1 = [220, 55, 397]; // 培养土箱子
        const chest1_1 = [220, 58, 398]; // 清空背包的 培养土箱子
        const itemsToTransfer = ["minecraft:paper"]; // 转移物品列表
        snakeWalk(start, end, chest1, "minecraft:paper", "Soil placement"); // 传递 actionType
        transferItemsToChest(chest1_1, itemsToTransfer);
        eat();
    },
    
    executeFertilizing() {
        State.isActionRunning = true;
        Chat.log("§aStarting fertilizing...");
        const start = CoordinateHandler.posCon[1];
        const end = [276, 56, 329]; // 保持硬编码的 end 坐标
        const chest2 = [221, 55, 397]; // 肥料箱子
        const chest2_1 = [222, 58, 399]; // 清空背包的 肥料箱子
        const itemsToTransfer = ["minecraft:paper"]; // 转移物品列表
        snakeWalk(start, end, chest2, "minecraft:paper", "Fertilizing"); // 传递 actionType
        transferItemsToChest(chest2_1, itemsToTransfer);
        eat();
    },
    
    executePlantingSeeds() {
        State.isActionRunning = true;
        Chat.log("§aStarting planting seeds...");
        const start = CoordinateHandler.posCon[1];
        const end = [276, 56, 329]; // 保持硬编码的 end 坐标
        const chest3 = CoordinateHandler.posCon[0];      // 种子箱子 (使用之前获取的种子箱子位置)
        const chest3_1 = [chest3[0], chest3[1]+2, chest3[2]+1]; // 清空背包的 种子箱子
        const itemsToTransfer = ["minecraft:paper"]; // 转移物品列表
        snakeWalk(start, end, chest3, "minecraft:paper", "Planting seeds"); // 传递 actionType
        transferItemsToChest(chest3_1, itemsToTransfer);
        eat();
    }
};

// 模式选择事件处理器
const ModeSelectionHandler = {
    handleModeSelection(key) {
        if (scriptState === "MODE_SELECT" && !State.isActionRunning) { // 模式选择按键，且没有动作正在运行
            if (key == "key.keyboard.1") {
                ModeExecutor.executeSoilPlacement();
            } else if (key == "key.keyboard.2") {
                ModeExecutor.executeFertilizing();
            } else if (key == "key.keyboard.3") {
                ModeExecutor.executePlantingSeeds();
            }
        } else if (scriptState === "MODE_SELECT" && State.isActionRunning) {
            if (key == "key.keyboard.1" || key == "key.keyboard.2" || key == "key.keyboard.3") {
                Chat.log("§cAnother action is already running. Please wait until it finishes.");
            }
        }
    }
};

function waitIfPaused() {
    while (isPaused) {
        Client.waitTick(20);
    }
}

// 饿了吃饭 (保持不变)
function eat() {
    // ... (eat 函数代码保持不变)
    const player = Player.getPlayer();
    let foodLevel = player.getFoodLevel();

    if (foodLevel >= Config.FOOD_LEVEL_THRESHOLD) {
        return; // 饱食度足够，不需要吃
    }

    Chat.log(`foodLevel is ${foodLevel} now, eating~`);

    while (foodLevel < 20) {
        player.lookAt("up");
        KeyBind.key(Config.RIGHT_CLICK, true);
        Client.waitTick(Config.EAT_WAIT_TICKS);
        KeyBind.key(Config.RIGHT_CLICK, false);

        Client.waitTick(Config.POST_EAT_WAIT_TICKS);
        foodLevel = player.getFoodLevel();

        Chat.log(`foodLevel is now ${foodLevel}`);
        if (foodLevel >= Config.FOOD_LEVEL_THRESHOLD) {
            Chat.log("Food level reached 20 or more, stopped eating.");
            break;
        }
    }
}


// transferItemsToChest (保持不变)
function transferItemsToChest(chestPos, itemsToTransfer) {
    // ... (transferItemsToChest 函数代码保持不变)
    const player = Player.getPlayer();
    Client.waitTick(1);
    moveToBlock(chestPos[0] + 0.5, chestPos[1] + 0.5, chestPos[2] + 0.5);
    Player.getInteractionManager().interactBlock(chestPos[0], chestPos[1], chestPos[2], player.getFacingDirection().getName(), false);

    // 循环等待，直到容器界面打开或超时
    let timeout = 100; // 假设最多等待 100 ticks (约 5 秒)
    while (!Hud.isContainer() && timeout > 0) {
        Client.waitTick(1);
        timeout--;
    }

    if (timeout === 0) {
        Chat.log(Chat.createTextBuilder().append("Error:").withColor(255, 0, 0)
            .append("Timeout while waiting for container to open.").withColor(255, 128, 128).build());
        return; // 如果超时，则提前返回，避免继续执行可能导致错误的代码
    }

    Client.waitTick(5);

    const inv = Player.openInventory();
    const mainStartIndex = inv.getMap().main?.at(0);
    const chestEndIndex = mainStartIndex;

    let emptySlots = 0;
    for (let i = 0; i < chestEndIndex; i++) {
        if (inv.getSlot(i).getItemId() == "minecraft:air") {
            emptySlots++;
        }
    }

    let itemSlots = [];
    for (let i = mainStartIndex; i < mainStartIndex + 36; i++) {
        if (itemsToTransfer.includes(inv.getSlot(i).getItemId())) {
            itemSlots.push(i);
        }
    }

    while (emptySlots > 0 && itemSlots.length > 0) {
        inv.quick(itemSlots.pop());
        Client.waitTick();
        emptySlots--;
    }

    Client.waitTick(20);
    inv.closeAndDrop();
    Client.waitTick(20);
}

// checkAndRefillItem (保持不变)
function checkAndRefillItem(chestPos, mainHandItemId) {
    // ... (checkAndRefillItem 函数代码保持不变)
    const player = Player.getPlayer();
    const inv = Player.openInventory();
    const mainHandItem = player.getMainHand();

    if (mainHandItem.getCount() <= Config.REFILL_THRESHOLD) {
        Chat.log(`Item count is low. Attempting to refill item with ID: ${mainHandItemId}`); // Debug log

        // Check for the item in the inventory
        const itemSlots = inv.findItem(mainHandItemId);

        // Look for slots with sufficient quantity or slots below the threshold
        let lowSlots = [];
        let selectedSlot = -1;
        for (const slot of itemSlots) {
            const slotItemCount = inv.getSlot(slot).getCount();
            if (slotItemCount > Config.REFILL_THRESHOLD) {
                selectedSlot = slot;
            } else if (slotItemCount > 0 && slotItemCount <= Config.REFILL_THRESHOLD) {
                lowSlots.push(slot);
            }
        }

        // If any slots have items below the threshold, include them in the refill process
        let emptySlots = lowSlots.length;

        // Count actual empty slots in the player's inventory
        const maxSlots = Config.MAX_INVENTORY_SLOTS; // Number of slots in the player's main inventory
        for (let i = 0; i < maxSlots; i++) {
            if (inv.getSlot(i).getItemId() == "minecraft:air") {
                emptySlots++;
            }
        }

        if (selectedSlot !== -1) {
            Chat.log(`Found item slot with sufficient quantity: ${selectedSlot}`); // Debug log
            inv.swapHotbar(selectedSlot, inv.getSelectedHotbarSlotIndex());
            Client.waitTick(Config.REFILL_WAIT_TICKS); // Wait for the swap to complete
        } else {
            Chat.log(Chat.createTextBuilder().append("Warning:").withColor(255, 0, 0)
                .append(`${mainHandItemId} is exhausted in inventory, moving to chest for replenishment.`).withColor(255, 128, 128).build());

            // Walk to the chest and restock the item
            moveToBlock(chestPos[0] + 0.5, chestPos[1]+ 0.5, chestPos[2]+ 0.5);
            Player.getInteractionManager().interactBlock(chestPos[0], chestPos[1], chestPos[2], player.getFacingDirection().getName(), false);

            // Wait for the chest interface to open
            while (!Hud.isContainer()) {
                Client.waitTick();
            }
            Client.waitTick(5);

            // Open inventory and look for the item in the chest
            const chestInv = Player.openInventory();
            const chestSlots = chestInv.findItem(mainHandItemId);

            if (chestSlots.length > 0) {
                let transferred = 0;
                for (const chestSlot of chestSlots) {
                    if (chestInv.getSlot(chestSlot).getCount() > 0) {
                        const itemCount = chestInv.getSlot(chestSlot).getCount();
                        const stackSize = Config.MAX_STACK_SIZE; // Maximum stack size
                        const amountToTransfer = Math.min(emptySlots * stackSize, itemCount);

                        for (let i = 0; i < Math.ceil(amountToTransfer / stackSize); i++) {
                            chestInv.quick(chestSlot);
                            Client.waitTick();
                        }

                        emptySlots -= Math.ceil(amountToTransfer / stackSize);
                        transferred += amountToTransfer;

                        if (emptySlots <= 0) {
                            break;
                        }
                    }
                }

                if (transferred > 0) {
                    Chat.log(`Transferred ${transferred} items from the chest to the inventory.`);

                    // Ensure item is equipped in the main hand after restocking
                    const postChestInv = Player.openInventory();
                    const postChestItemSlots = postChestInv.findItem(mainHandItemId);
                    let postChestSelectedSlot = -1;
                    for (const slot of postChestItemSlots) {
                        const postChestSlotItemCount = postChestInv.getSlot(slot).getCount();
                        if (postChestSlotItemCount > Config.REFILL_THRESHOLD) {
                            postChestSelectedSlot = slot;
                            break;
                        }
                    }

                    if (postChestSelectedSlot !== -1) {
                        postChestInv.swapHotbar(postChestSelectedSlot, postChestInv.getSelectedHotbarSlotIndex());
                        Client.waitTick(Config.REFILL_WAIT_TICKS); // Wait for the swap to complete
                    } else {
                        Chat.log("Error: Could not find item in inventory after chest restock.");
                    }
                } else {
                    Chat.log(Chat.createTextBuilder().append("Error:").withColor(255, 0, 0)
                        .append(`No more ${mainHandItemId} in the chest.`).withColor(255, 128, 128).build());
                }
            } else {
                Chat.log(Chat.createTextBuilder().append("Error:").withColor(255, 0, 0)
                    .append(`No ${mainHandItemId} found in the chest.`).withColor(255, 128, 128).build());
            }

            chestInv.closeAndDrop();
            Client.waitTick();
        }
    }
}

// moveToBlock (保持不变)
function moveToBlock(x, y, z) {
    // ... (moveToBlock 函数代码保持不变)
    const player = Player.getPlayer();
    var targetX = x;
    var targetY = y;
    var targetZ = z;

    var currentX = player.getX();
    var currentY = player.getY();
    var currentZ = player.getZ();

    var dx = targetX - currentX;
    var dz = targetZ - currentZ;

    player.lookAt(targetX, targetY, targetZ);

    dx = targetX - currentX;
    dz = targetZ - currentZ;
    var distance = Math.sqrt(dx * dx + dz * dz);

    while (distance > Config.PLAYER_REACH_DISTANCE) {
        player.lookAt(targetX, targetY, targetZ);

        currentX = player.getX();
        currentY = player.getY();
        currentZ = player.getZ();
        dx = targetX - currentX;
        dz = targetZ - currentZ;
        distance = Math.sqrt(dx * dx + dz * dz);
        KeyBind.keyBind(Config.SPRINT_KEY, true);
        KeyBind.keyBind(Config.FORWARD_KEY, true); // 冲刺
        Client.waitTick(Config.MOVE_WAIT_TICKS);
    }
    KeyBind.keyBind(Config.SPRINT_KEY, false);
}

// snakeWalk (使用新的FarmAreaManager优化)
function snakeWalk(startPos, endPos, chestPos, itemId, actionType) { // actionType 参数用于区分动作类型
    // 创建FarmAreaManager实例
    const farmManager = new FarmAreaManager(new Point3D(startPos[0], startPos[1], startPos[2]), 
                                           new Point3D(endPos[0], endPos[1], endPos[2]), 
                                           Config.STEP_SIZE);
    
    // 获取所有需要处理的位置
    const positions = farmManager.getAllPositions();
    
    // 遍历所有位置
    for (const pos of positions) {
        waitIfPaused(); //暂停

        moveToBlock(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5);

        checkAndRefillItem(chestPos, itemId); // Pass item ID to refill function

        Player.getInteractionManager().interactBlock(pos.x, pos.y, pos.z, 1, false); // 方块交互，方向参数 1 代表 East，可以根据实际情况调整
        Client.waitTick(Config.FERTILIZE_WAIT_TICKS);
    }
    
    State.isActionRunning = false;
    scriptState = "MODE_SELECT"; // 动作结束后，设置回模式选择状态
    Chat.log(`§a${actionType} completed. Choose again.`); // 提示用户可以选择新的模式, actionType 显示动作类型
}


// 物品数量预设值已经移到Config对象中
// REFILL_THRESHOLD: 6
// REFILL_WAIT_TICKS: 16  
// FERTILIZE_WAIT_TICKS: 1

// 初始化坐标处理
CoordinateHandler.initialize();

const mainEventListener = JsMacros.on("Key", JavaWrapper.methodToJava((event, ctx) => {
    if (event.key == Config.LEFT_CLICK && event.action == 1) {
        event.cancel();
        ctx.releaseLock();
        const block = Player.getInteractionManager().getTargetedBlock().toPos3D();
        if (block != null) {
            CoordinateHandler.handleBlockClick(block);
        }
    } else if (event.action == 1) {
        ModeSelectionHandler.handleModeSelection(event.key);
    }
}));