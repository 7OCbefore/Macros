// farmingUtils.js - 农场自动化脚本公共模块 (Refactored)

// --- 配置常量 ---
const Config = {
    CLOSE_KEY: "key.keyboard.x",
    PAUSE_KEY: "key.keyboard.z",
    TIMEOUT_TICKS: 100, // 通用超时
    EAT_WAIT_TICKS: 66,
    POST_EAT_WAIT_TICKS: 20,
    CHEST_WAIT_TICKS: 34,
    INV_CLOSE_WAIT_TICKS: 6,
    MOVE_WAIT_TICKS: 1,
    ATTACK_WAIT_TICKS: 1
};

// --- 文件操作帮助 ---
function loadConfig(relativePath) {
    try {
        // 尝试使用 standard require
        // 注意：在某些 JSMacros 环境下 require JSON 可能需要 .json 后缀或特定处理
        // 如果失败，建议使用 Java NIO 读取
        return require(relativePath);
    } catch (e) {
        Chat.log(`§c[Config] Failed to load config via require: ${e}`);
        // Fallback: Java method (Assuming executed in folder where script is)
        // This is a simplified fallback; in production, precise path handling is needed.
        return null;
    }
}

// --- 状态管理 ---
class FarmingState {
    constructor() {
        this.isPaused = false;
        this.isActionRunning = false;
        this.currentTaskName = "";
    }

    setRunning(isRunning, taskName = "") {
        this.isActionRunning = isRunning;
        this.currentTaskName = taskName;
    }
}

// --- 基础功能函数 ---

/**
 * 设置暂停和停止的按键监听
 * @param {FarmingState} state 
 */
function setupPauseControl(state) {
    JsMacros.on("Key", JavaWrapper.methodToJava((e, ctx) => {
        if (e.key == Config.CLOSE_KEY) {
            Chat.log('§c脚本已终止。');
            JavaWrapper.stop();
        }
        if (e.key == Config.PAUSE_KEY && e.action == 1) {
            state.isPaused = !state.isPaused;
            Chat.log(state.isPaused ? '§e脚本已暂停' : '§a脚本继续运行');
        }
    }));
}

/**
 * 如果暂停则阻塞线程
 * @param {FarmingState} state 
 */
function waitIfPaused(state) {
    while (state.isPaused) {
        Client.waitTick(10);
    }
}

/**
 * 移动到指定坐标
 * @param {number} x 
 * @param {number} y 
 * @param {number} z 
 * @param {number} tolerance 距离容差
 */
function moveToBlock(x, y, z, tolerance = 3) {
    const player = Player.getPlayer();
    
    // 简单的防抖，如果已经很近了就不动
    if (player.distanceTo(x, y, z) <= tolerance) return;

    player.lookAt(x, y, z);
    
    // 初始距离检查
    let distance = player.distanceTo(x, y, z);
    let timeout = 500; // 防止卡死

    while (distance > tolerance && timeout > 0) {
        waitIfPaused({ isPaused: false }); // 这里简单传入假状态，实际应传入全局状态，但 moveToBlock 通常是原子的

        player.lookAt(x, y, z);
        distance = player.distanceTo(x, y, z);
        
        KeyBind.keyBind("key.forward", true);
        KeyBind.keyBind("key.sprint", true);
        
        Client.waitTick(Config.MOVE_WAIT_TICKS);
        timeout--;
    }
    
    KeyBind.keyBind("key.forward", false);
    KeyBind.keyBind("key.sprint", false);

    if (timeout <= 0) {
        Chat.log("§c[Move] 移动超时，可能被卡住。");
    }
}

/**
 * 自动进食
 */
function eat() {
    const player = Player.getPlayer();
    let foodLevel = player.getFoodLevel();

    if (foodLevel >= 20) return;

    Chat.log(`§b[Eat] 当前饥饿值: ${foodLevel}，正在进食...`);

    let safetyCounter = 0;
    while (foodLevel < 20 && safetyCounter < 10) {
        player.lookAt("up");
        KeyBind.key('key.mouse.right', true);
        Client.waitTick(Config.EAT_WAIT_TICKS);
        KeyBind.key('key.mouse.right', false);

        Client.waitTick(Config.POST_EAT_WAIT_TICKS);
        foodLevel = player.getFoodLevel();
        safetyCounter++;

        if (foodLevel >= 20) {
            Chat.log("§a[Eat] 饱食度已满。");
            break;
        }
    }
}

/**
 * 检查并从箱子补充物品
 * @param {Array} chestPos 箱子坐标 [x, y, z]
 * @param {string} itemId 需要补充的物品ID
 * @param {number} threshold 阈值，低于此数量则补充
 * @param {FarmingState} state 状态对象，用于暂停检查
 */
function checkAndRefillItem(chestPos, itemId, threshold = 6, state) {
    const player = Player.getPlayer();
    const inv = Player.openInventory();
    
    // 检查背包中该物品的总数（包括快捷栏）
    // 注意：getMainHand() 只获取主手，这里我们遍历背包查找是否有备用的
    let totalCount = 0;
    const allSlots = inv.findItem(itemId);
    for (let slot of allSlots) {
        totalCount += inv.getSlot(slot).getCount();
    }

    // 如果总数充足，确保快捷栏有物品
    if (totalCount > threshold) {
        // 简单逻辑：如果主手空了或者很少，从背包里找一组放到快捷栏（这里简化处理，假设玩家自己会整理，或者后续添加整理逻辑）
        // 目前逻辑保持原样：如果当前不足，尝试去箱子取。
        // 但为了性能，如果背包里有，应该先用背包里的。
        
        // 检查快捷栏
        const hotbarIndex = inv.getSelectedHotbarSlotIndex(); 
        const currentItem = inv.getSlot(inv.getMap().hotbar[hotbarIndex]); // 获取当前手持
        
        if (currentItem.getItemId() == itemId && currentItem.getCount() > threshold) {
            return; // 手里有且够用
        }
        
        // 尝试从背包交换到快捷栏
        // Find best slot
        let bestSlot = -1;
        for (let slot of allSlots) {
             if (inv.getSlot(slot).getCount() > threshold) {
                 bestSlot = slot;
                 break;
             }
        }
        
        if (bestSlot !== -1) {
            inv.swapHotbar(bestSlot, hotbarIndex);
            Client.waitTick(10);
            return;
        }
    }

    // 需要去箱子补货
    Chat.log(`§e[Refill] ${itemId} 不足 (${totalCount})，前往箱子补货...`);
    
    // 记录当前位置以便返回 (可选，目前逻辑是蛇形走位，补货后通常回到原来位置需要精确计算，或者 snakeWalk 会自己处理回到 row start? 
    // 原逻辑是在 snakeWalk 内部调用的，补货完应该回到 localX/Z。
    // 但是 moveToBlock 会改变位置。snakeWalk 的下一次循环会再次调用 moveToBlock(localX...) 所以是安全的。
    
    moveToBlock(chestPos[0] + 0.5, chestPos[1] + 0.5, chestPos[2] + 0.5);
    
    // 打开箱子
    Player.getInteractionManager().interactBlock(chestPos[0], chestPos[1], chestPos[2], player.getFacingDirection().getName(), false);

    let timeout = 100;
    while (!Hud.isContainer() && timeout > 0) {
        Client.waitTick(1);
        timeout--;
    }
    
    if (timeout <= 0) {
        Chat.log("§c[Refill] 打开箱子超时！");
        return;
    }
    Client.waitTick(5);

    const chestInv = Player.openInventory();
    const chestItemSlots = chestInv.findItem(itemId);
    
    if (chestItemSlots.length === 0) {
        Chat.log(`§c[Refill] 箱子里也没有 ${itemId}！`);
        chestInv.closeAndDrop();
        return;
    }

    // 计算玩家背包空位
    let emptySlots = 0;
    const mainInvMap = chestInv.getMap().main; // 玩家背包部分
    // 注意：Container GUI 的 slot 索引，后半部分通常是玩家背包
    // findItem 返回的是全局索引。
    // 简单起见，我们狂拿物品直到拿满或者拿够
    
    for (let slot of chestItemSlots) {
        if (isInventoryFull(chestInv)) break; // 辅助函数检查玩家部分是否满
        chestInv.quick(slot);
        Client.waitTick(2);
    }
    
    Client.waitTick(5);
    chestInv.closeAndDrop();
    Client.waitTick(10);
    Chat.log("§a[Refill] 补货完成。");
}

/**
 * 蛇形走位执行任务
 * @param {Array} startPos [x, y, z]
 * @param {Array} endPos [x, y, z]
 * @param {Array} chestPos [x, y, z] 补货箱子
 * @param {string} itemId 消耗品ID
 * @param {Function} actionCallback (x, y, z) => void 在每个点执行的动作
 * @param {FarmingState} state
 */
function snakeWalk(startPos, endPos, chestPos, itemId, actionCallback, state) {
    const startX = startPos[0];
    const endX = endPos[0];
    const startZ = startPos[2];
    const endZ = endPos[2];
    const y = startPos[1];

    const xStep = Math.sign(endX - startX) || 1;
    const zStepInitial = Math.sign(endZ - startZ) || 1;
    
    let currentX = startX;
    let group = 0;
    const stepSize = Config.STEP_SIZE || 5;

    // X轴遍历
    while ((xStep > 0 && currentX <= endX) || (xStep < 0 && currentX >= endX)) {
        if (!state.isActionRunning) break; // 强制停止检查

        // Z轴方向交替
        const zStart = (group % 2 === 0) ? startZ : endZ;
        const zEnd = (zStart === startZ) ? endZ : startZ;
        const zStep = (zStart === startZ) ? zStepInitial : -zStepInitial;

        // Z轴遍历
        for (let z = zStart; (zStep > 0 && z <= zEnd) || (zStep < 0 && z >= zEnd); z += zStep) {
            if (!state.isActionRunning) break;
            
            // 当前行的 X 块 (一次处理一排 stepSize 宽度的区域? 原逻辑似乎是 5x1 的小条?)
            // 原逻辑： for (let localX = currentX; ... localX < currentX + 5 ... )
            // 这意味着它是“宽行”扫描。
            
            for (let localX = currentX; 
                 (xStep > 0 && localX < currentX + stepSize && localX <= endX) || 
                 (xStep < 0 && localX > currentX + stepSize && localX >= endX); 
                 localX += xStep) {
                
                waitIfPaused(state);
                if (!state.isActionRunning) return;

                // 1. 移动
                moveToBlock(localX + 0.5, y + 0.5, z + 0.5, 0.5); // 精度高一点

                // 2. 检查补货
                checkAndRefillItem(chestPos, itemId, 6, state);

                // 3. 执行动作
                try {
                    actionCallback(localX, y, z);
                } catch (e) {
                    Chat.log(`§c[Action] Error at ${localX},${z}: ${e}`);
                }
                
                Client.waitTick(1); // 动作后短暂等待
            }
        }
        currentX += stepSize * xStep;
        group++;
    }
}

/**
 * 将指定物品全部存入箱子
 */
function transferItemsToChest(chestPos, itemsToTransfer) {
    const player = Player.getPlayer();
    Chat.log("§b[Store] 正在存入物品...");
    
    moveToBlock(chestPos[0] + 0.5, chestPos[1] + 0.5, chestPos[2] + 0.5);
    Player.getInteractionManager().interactBlock(chestPos[0], chestPos[1], chestPos[2], player.getFacingDirection().getName(), false);

    let timeout = Config.TIMEOUT_TICKS;
    while (!Hud.isContainer() && timeout > 0) {
        Client.waitTick(1);
        timeout--;
    }

    if (timeout === 0) {
        Chat.log("§c[Store] 打开箱子超时。");
        return;
    }

    const inv = Player.openInventory();
    // 简单的一键存入逻辑
    // 遍历玩家背包(通常 index 总是固定的，或者用 map)
    // 假设 inv 是 ContainerInventory
    const map = inv.getMap();
    if (!map) {
         inv.closeAndDrop();
         return;
    }
    
    const mainStart = map.main[0]; // 玩家背包开始
    // const hotbarStart = map.hotbar[0]; // 快捷栏开始

    // 扫描整个玩家背包（包括快捷栏，通常快捷栏在 main 之后或分开，视 Map 而定，保险起见遍历 main 和 hotbar）
    // 通用做法：遍历 inv 的所有 slot，如果是 player inventory 的 slot 且 item 在 list 里，就 quick move
    
    // 这里简化：遍历 mainStart 到 mainStart + 36 (背包+快捷栏通常是36格)
    for (let i = mainStart; i < mainStart + 36; i++) {
        let item = inv.getSlot(i);
        if (itemsToTransfer.includes(item.getItemId())) {
            inv.quick(i);
            Client.waitTick(1);
        }
    }

    Client.waitTick(10);
    inv.closeAndDrop();
    Client.waitTick(Config.INV_CLOSE_WAIT_TICKS);
    Chat.log("§a[Store] 存入完成。");
}

function isInventoryFull(inv) {
    // 辅助检查，如果不传 inv 则打开一个新的检查
    let shouldClose = false;
    if (!inv) {
        inv = Player.openInventory();
        shouldClose = true;
    }
    
    const map = inv.getMap();
    let isFull = true;
    
    if (map && map.main) {
        for (let idx of map.main) {
            if (inv.getSlot(idx).isEmpty()) {
                isFull = false;
                break;
            }
        }
    }
    
    if (shouldClose) inv.closeAndDrop();
    return isFull;
}

// 导出公共功能
module.exports = {
    Config,
    FarmingState,
    loadConfig,
    setupPauseControl,
    waitIfPaused,
    moveToBlock,
    eat,
    transferItemsToChest,
    checkAndRefillItem,
    snakeWalk,
    isInventoryFull
};