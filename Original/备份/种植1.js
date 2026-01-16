/*
2024-08-17 修改为使用单一事件监听器和状态机，避免嵌套监听，提升代码结构和可维护性。
2025-01-15 Google Engineering Port: Integrated Kotlin "Grim" GCD-Bypass Algorithm for smooth and safe rotation.
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
        this.currentGroup = 0;
        this.xStep = Math.sign(endPos.x - startPos.x);
        this.zStepInitial = Math.sign(endPos.z - startPos.z);
        this.currentX = startPos.x;
    }

    *getNextPositions() {
        while ((this.xStep > 0 && this.currentX <= this.endPos.x) || 
               (this.xStep < 0 && this.currentX >= this.endPos.x)) {
            const zStart = (this.currentGroup % 2 === 0) ? this.startPos.z : this.endPos.z;
            const zEnd = (zStart === this.startPos.z) ? this.endPos.z : this.startPos.z;
            const zStep = (zStart === this.startPos.z) ? this.zStepInitial : -this.zStepInitial;

            for (let z = zStart; 
                 (zStep > 0 && z <= zEnd) || (zStep < 0 && z >= zEnd); 
                 z += zStep) {
                for (let localX = this.currentX;
                     (this.xStep > 0 && localX < this.currentX + this.stepSize * this.xStep && localX <= this.endPos.x) ||
                     (this.xStep < 0 && localX > this.currentX + this.stepSize * this.xStep && localX >= this.endPos.x);
                     localX += this.xStep) {
                    yield new Point3D(localX, this.startPos.y, z);
                }
            }
            this.currentX += this.stepSize * this.xStep;
            this.currentGroup++;
        }
    }
}

function normalizeItemName(name) {
    if (!name) {
        return "";
    }
    const withoutColor = String(name).replace(/§[0-9A-FK-OR]/gi, "");
    return withoutColor.replace(/[^0-9a-zA-Z\u4e00-\u9fa5]+/g, "").toLowerCase();
}

function normalizeTargetName(name) {
    if (!name) {
        return "";
    }
    const raw = String(name);
    const withoutNamespace = raw.includes(":") ? raw.split(":").pop() : raw;
    return normalizeItemName(withoutNamespace);
}

function normalizeTargetNames(names) {
    const list = Array.isArray(names) ? names : [names];
    const normalized = [];

    for (const name of list) {
        const normalizedName = normalizeTargetName(name);
        if (normalizedName) {
            normalized.push(normalizedName);
        }
    }

    return normalized;
}

function findItemSlotsByName(inventory, itemNames) {
    const totalSlots = inventory.getTotalSlots();
    const matchedSlots = [];
    const normalizedTargets = normalizeTargetNames(itemNames);

    if (normalizedTargets.length === 0) {
        return matchedSlots;
    }

    const targetSet = new Set(normalizedTargets);

    for (let slotIndex = 0; slotIndex < totalSlots; slotIndex++) {
        const item = inventory.getSlot(slotIndex);
        if (!item) {
            continue;
        }
        const displayName = item.getName().getString();
        if (targetSet.has(normalizeItemName(displayName))) {
            matchedSlots.push(slotIndex);
        }
    }

    return matchedSlots;
}


function isItemNameInList(item, nameList) {
    if (!item) {
        return false;
    }
    const displayName = item.getName().getString();
    const normalizedItemName = normalizeItemName(displayName);

    for (const targetName of nameList) {
        if (normalizedItemName === normalizeTargetName(targetName)) {
            return true;
        }
    }

    return false;
}

// 物品管理器
class ItemManager {
    constructor(chestPos, itemNames) {
        this.chestPos = chestPos;
        this.itemNames = itemNames;
    }



    checkAndRefillItem() {
        const player = Player.getPlayer();
        const inv = Player.openInventory();
        const mainHandItem = player.getMainHand();

        if (mainHandItem.getCount() <= REFILL_THRESHOLD) {
            const itemSlots = findItemSlotsByName(inv, this.itemNames);
            let selectedSlot = -1;
            for (const slot of itemSlots) {
                const slotItemCount = inv.getSlot(slot).getCount();
                if (slotItemCount > REFILL_THRESHOLD) {
                    selectedSlot = slot;
                    break;
                }
            }

            if (selectedSlot !== -1) {
                inv.swapHotbar(selectedSlot, inv.getSelectedHotbarSlotIndex());
                Client.waitTick(REFILL_WAIT_TICKS);
            } else {
                this.refillFromChest();
            }
        }
    }

    refillFromChest() {
        const player = Player.getPlayer();
        moveToBlock(this.chestPos.x + 0.5, this.chestPos.y + 0.5, this.chestPos.z + 0.5);
        Player.getInteractionManager().interactBlock(this.chestPos.x, this.chestPos.y, this.chestPos.z, player.getFacingDirection().getName(), false);

        let timeout = Config.CONTAINER_WAIT_TIMEOUT;
        while (!Hud.isContainer() && timeout > 0) {
            Client.waitTick();
            timeout--;
        }
        if (timeout === 0) {
            Chat.log(Chat.createTextBuilder().append("Error:").withColor(255, 0, 0)
                .append("Timeout while waiting for container to open.").withColor(255, 128, 128).build());
            return;
        }
        Client.waitTick(5);


        const chestInv = Player.openInventory();
        const chestSlots = findItemSlotsByName(chestInv, this.itemNames);

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

// --- Constants ---
const Config = {
    CLOSE_KEY: "key.keyboard.x",
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
    VERBOSE_LOGS: false,
    LOOK_SMOOTH_SPEED: 0.2, // 视角平滑速度，0.2-0.4，越小越平滑
};

function logVerbose(message) {
    if (Config.VERBOSE_LOGS) {
        Chat.log(message);
    }
}

// --- 平滑视角移动函数 (GrimAC Bypass / GCD Edition) ---
// Ported from Kotlin implementation to JS.
// 核心逻辑：强制视角变化符合 Minecraft 鼠标灵敏度步长(GCD)，模拟真实鼠标物理输入。

/**
 * 获取基于当前鼠标灵敏度的最小角度单位 (GCD)
 * 对应 Kotlin 中的: val f = (mouseSensitivity * 0.6f + 0.2f); f * f * f * 8f * 0.15f
 */
function getGCD() {
    const options = Client.getGameOptions();
    let sensitivity = 0.5; // Default safety fallback
    
    // Robust access to sensitivity, handling potential API differences in JS Macros
    try {
        const sensObj = options.getMouseSensitivity ? options.getMouseSensitivity() : options.mouseSensitivity;
        if (typeof sensObj === 'number') {
            sensitivity = sensObj;
        } else if (sensObj && typeof sensObj.getValue === 'function') {
            sensitivity = sensObj.getValue();
        }
    } catch (e) {
        // Fallback if API fails
        sensitivity = 0.5;
    }

    const f = sensitivity * 0.6 + 0.2;
    return f * f * f * 8.0 * 0.15;
}

// 角度归一化到 [-180, 180]
function normalizeAngle(angle) {
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
}

// 核心 Grim 算法：将 "当前角度" 到 "目标角度" 的路径，
// 强制量化为 "鼠标移动了 N 个像素点" 后的结果。
// 这确保了无论我们如何插值，发送给服务器的最终角度都是数学上合法的。
function grim(current, target) {
    const gcd = getGCD();
    const delta = normalizeAngle(target - current);
    
    // 计算需要的“鼠标点数” (Int)，并吸附到最近的整数点
    const mousePoints = Math.round(delta / gcd);
    
    // 转回角度并应用
    return current + (mousePoints * gcd);
}

// 改进后的 smoothLookAt
// 它不再使用简单的 lerpAngle，而是先计算理想的 lerp 位置，
// 然后使用 grim() 函数将该位置吸附到合法的 GCD 网格上。
// 返回本帧应使用的 yaw/pitch（不直接修改视角）。
function smoothLookAt(targetX, targetY, targetZ, speed) {
    const player = Player.getPlayer();
    const currentYaw = player.getYaw();
    const currentPitch = player.getPitch();

    // 1. 计算原始目标角度
    // [Fix] 引入眼高修正。
    // 之前只用了 player.getY() (脚底坐标)，导致看同高度方块时视角是水平的。
    // 现在加上 getEyeHeight() (通常为1.62)，确保计算的是从"眼睛"看向"目标"的角度，从而产生正确的俯视感。
    const eyeHeight = player.getEyeHeight ? player.getEyeHeight() : 1.62; 
    const playerEyeY = player.getY() + eyeHeight;

    const dx = targetX - player.getX();
    const dy = targetY - playerEyeY; // 使用眼睛高度计算垂直差值
    const dz = targetZ - player.getZ();
    const dist = Math.sqrt(dx * dx + dz * dz);

    const rawTargetYaw = Math.atan2(-dx, dz) * (180 / Math.PI);
    const rawTargetPitch = Math.atan2(-dy, dist) * (180 / Math.PI);

    // 2. 计算这一帧的“理想”中间值 (Lerp)
    // 这里的逻辑保持不变，用于产生“慢速移动”的效果
    const actualSpeed = speed !== undefined ? speed : Config.LOOK_SMOOTH_SPEED;
    
    // 我们想在这一帧移动多少度？
    const idealYawDelta = normalizeAngle(rawTargetYaw - currentYaw) * actualSpeed;
    const idealPitchDelta = normalizeAngle(rawTargetPitch - currentPitch) * actualSpeed;
    
    // 理想的下一帧角度
    const idealNextYaw = currentYaw + idealYawDelta;
    const idealNextPitch = currentPitch + idealPitchDelta;

    // 3. 应用 Grim 约束 (GCD Snap)
    // 即使我们只是稍微移动一点点，这一点点也必须对应整数个鼠标像素点
    const finalYaw = grim(currentYaw, idealNextYaw);
    const finalPitch = grim(currentPitch, idealNextPitch);

    return { yaw: finalYaw, pitch: finalPitch };
}

function buildMovementFrame(yaw, pitch, options = {}) {
    return {
        forward: options.forward !== undefined ? options.forward : 1.0,
        sideways: options.sideways !== undefined ? options.sideways : 0.0,
        yaw,
        pitch,
        jump: options.jump === true,
        sneak: options.sneak === true,
        sprint: options.sprint !== undefined ? options.sprint : true,
    };
}

class InputQueue {
    constructor() {
        this.queue = [];
    }

    enqueue(frame) {
        this.queue.push(frame);
    }

    enqueueMany(frames) {
        for (const frame of frames) {
            this.queue.push(frame);
        }
    }

    processNext() {
        if (this.queue.length === 0) {
            return false;
        }
        const frame = this.queue.shift();
        const input = Player.createPlayerInput(
            frame.forward,
            frame.sideways,
            frame.yaw,
            frame.pitch,
            frame.jump,
            frame.sneak,
            frame.sprint
        );
        Player.addInput(input);
        return true;
    }

    clear() {
        this.queue = [];
        Player.clearInputs();
    }
}



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
var closeKey = "key.keyboard.x";
var pauseKey = "key.keyboard.z";

// 暂停/继续功能 (保持不变)
JsMacros.on("Key", JavaWrapper.methodToJava((e, ctx) => {
    if (e.key == closeKey) {
        Chat.log('脚本关闭了。');
        JavaWrapper.stop();
    }
    if (e.key == pauseKey && e.action == 1) {
        isPaused = !isPaused;
        Chat.log(isPaused ? '脚本已暂停' : '脚本已继续');
    }
}));

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

    if (foodLevel >= 20) {
        return; // 饱食度足够，不需要吃
    }

    logVerbose(`foodLevel is ${foodLevel} now, eating~`);

    while (foodLevel < 20) {
        player.lookAt("up");
        KeyBind.key('key.mouse.right', true);
        Client.waitTick(Config.EAT_WAIT_TICKS);
        KeyBind.key('key.mouse.right', false);

        Client.waitTick(Config.POST_EAT_WAIT_TICKS);
        foodLevel = player.getFoodLevel();

        logVerbose(`foodLevel is now ${foodLevel}`);
        if (foodLevel >= 20) {
            logVerbose("Food level reached 20 or more, stopped eating.");
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
        const slotItem = inv.getSlot(i);
        if (slotItem && isItemNameInList(slotItem, itemsToTransfer)) {
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
function checkAndRefillItem(chestPos, mainHandItemNames) {
    // ... (checkAndRefillItem 函数代码保持不变)
    const player = Player.getPlayer();
    const inv = Player.openInventory();
    const mainHandItem = player.getMainHand();

    if (mainHandItem.getCount() <= REFILL_THRESHOLD) {
        const nameListLabel = Array.isArray(mainHandItemNames) ? mainHandItemNames.join(", ") : String(mainHandItemNames);
        logVerbose(`Item count is low. Attempting to refill item by name: ${nameListLabel}`);



        // Check for the item in the inventory
        const itemSlots = findItemSlotsByName(inv, mainHandItemNames);

        // Look for slots with sufficient quantity or slots below the threshold
        let lowSlots = [];
        let selectedSlot = -1;
        for (const slot of itemSlots) {
            const slotItemCount = inv.getSlot(slot).getCount();
            if (slotItemCount > REFILL_THRESHOLD) {
                selectedSlot = slot;
            } else if (slotItemCount > 0 && slotItemCount <= REFILL_THRESHOLD) {
                lowSlots.push(slot);
            }
        }

        // If any slots have items below the threshold, include them in the refill process
        let emptySlots = lowSlots.length;

        // Count actual empty slots in the player's inventory
        const maxSlots = 36; // Number of slots in the player's main inventory
        for (let i = 0; i < maxSlots; i++) {
            if (inv.getSlot(i).getItemId() == "minecraft:air") {
                emptySlots++;
            }
        }

        if (selectedSlot !== -1) {
            logVerbose(`Found item slot with sufficient quantity: ${selectedSlot}`);

            inv.swapHotbar(selectedSlot, inv.getSelectedHotbarSlotIndex());
            Client.waitTick(REFILL_WAIT_TICKS); // Wait for the swap to complete
        } else {
            Chat.log(Chat.createTextBuilder().append("Warning:").withColor(255, 0, 0)
                .append(`${nameListLabel} is exhausted in inventory, moving to chest for replenishment.`).withColor(255, 128, 128).build());


            // Walk to the chest and restock the item
            moveToBlock(chestPos[0] + 0.5, chestPos[1]+ 0.5, chestPos[2]+ 0.5);
            Player.getInteractionManager().interactBlock(chestPos[0], chestPos[1], chestPos[2], player.getFacingDirection().getName(), false);

            // Wait for the chest interface to open
            let timeout = Config.CONTAINER_WAIT_TIMEOUT;
            while (!Hud.isContainer() && timeout > 0) {
                Client.waitTick();
                timeout--;
            }
            if (timeout === 0) {
                Chat.log(Chat.createTextBuilder().append("Error:").withColor(255, 0, 0)
                    .append("Timeout while waiting for container to open.").withColor(255, 128, 128).build());
                return;
            }
            Client.waitTick(5);


            // Open inventory and look for the item in the chest
            const chestInv = Player.openInventory();
            const chestSlots = findItemSlotsByName(chestInv, mainHandItemNames);

            if (chestSlots.length > 0) {
                let transferred = 0;
                for (const chestSlot of chestSlots) {
                    if (chestInv.getSlot(chestSlot).getCount() > 0) {
                        const itemCount = chestInv.getSlot(chestSlot).getCount();
                        const stackSize = 64; // Maximum stack size
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
                    logVerbose(`Transferred ${transferred} items from the chest to the inventory.`);


                    // Ensure item is equipped in the main hand after restocking
                    const postChestInv = Player.openInventory();
                    const postChestItemSlots = findItemSlotsByName(postChestInv, mainHandItemNames);
                    let postChestSelectedSlot = -1;
                    for (const slot of postChestItemSlots) {
                        const postChestSlotItemCount = postChestInv.getSlot(slot).getCount();
                        if (postChestSlotItemCount > REFILL_THRESHOLD) {
                            postChestSelectedSlot = slot;
                            break;
                        }
                    }

                    if (postChestSelectedSlot !== -1) {
                        postChestInv.swapHotbar(postChestSelectedSlot, postChestInv.getSelectedHotbarSlotIndex());
                        Client.waitTick(REFILL_WAIT_TICKS); // Wait for the swap to complete
                    } else {
                        Chat.log("Error: Could not find item in inventory after chest restock.");
                    }
                } else {
                    Chat.log(Chat.createTextBuilder().append("Error:").withColor(255, 0, 0)
                        .append(`No more ${mainHandItemNames} in the chest.`).withColor(255, 128, 128).build());
                }
            } else {
                Chat.log(Chat.createTextBuilder().append("Error:").withColor(255, 0, 0)
                    .append(`No ${mainHandItemNames} found in the chest.`).withColor(255, 128, 128).build());
            }

            chestInv.closeAndDrop();
            Client.waitTick();
        }
    }
}

// moveToBlock (输入队列驱动)
function moveToBlock(x, y, z) {
    const player = Player.getPlayer();
    const targetX = x;
    const targetY = y;
    const targetZ = z;

    const inputQueue = new InputQueue();

    let currentX = player.getX();
    let currentY = player.getY();
    let currentZ = player.getZ();

    let dx = targetX - currentX;
    let dz = targetZ - currentZ;
    let distance = Math.sqrt(dx * dx + dz * dz);

    if (distance <= 3) {
        return true;
    }

    let timeout = 500;
    let lastDistance = distance;
    let stuckCount = 0;

    try {
        while (distance > 3 && timeout > 0) {
            if (isPaused) {
                waitIfPaused();
            }

            const rotation = smoothLookAt(targetX, targetY, targetZ);
            const shouldJump = stuckCount > 20;

            inputQueue.enqueue(buildMovementFrame(rotation.yaw, rotation.pitch, {
                jump: shouldJump,
            }));

            inputQueue.processNext();
            Client.waitTick(Config.MOVE_WAIT_TICKS);

            if (shouldJump) {
                Chat.log(`§c[Movement] Stuck at ${targetX},${targetY},${targetZ}. Attempting jump...`);
                stuckCount = 0;
            }

            currentX = player.getX();
            currentY = player.getY();
            currentZ = player.getZ();
            dx = targetX - currentX;
            dz = targetZ - currentZ;
            distance = Math.sqrt(dx * dx + dz * dz);

            if (Math.abs(distance - lastDistance) < 0.01) {
                stuckCount++;
            } else {
                stuckCount = 0;
            }

            lastDistance = distance;
            timeout--;
        }

        if (timeout === 0) {
            Chat.log(`§c[Movement] Timeout moving to ${targetX},${targetY},${targetZ}`);
            return false;
        }

        return true;
    } finally {
        inputQueue.clear();
    }
}



// snakeWalk (保持不变，但需要在结束时重置 State.isActionRunning 和 scriptState)
function snakeWalk(startPos, endPos, chestPos, itemNames, actionType) { // actionType 参数用于区分动作类型
    const startX = startPos[0];
    const endX = endPos[0];
    const startZ = startPos[2];
    const endZ = endPos[2];

    const xStep = Math.sign(endX - startX) || 1;
    const zStepInitial = Math.sign(endZ - startZ) || 1;

    let currentX = startX;
    let group = 0;
    const stepSize = Config.STEP_SIZE;

    const totalBlocks = (Math.abs(endX - startX) + 1) * (Math.abs(endZ - startZ) + 1);
    let processedBlocks = 0;

    Chat.log(`§e[Info] Processing ${totalBlocks} blocks...`);

    while ((xStep > 0 && currentX <= endX) || (xStep < 0 && currentX >= endX)) {
        const zStart = (group % 2 === 0) ? startZ : endZ;
        const zEnd = (zStart === startZ) ? endZ : startZ;
        const zStep = (zStart === startZ) ? zStepInitial : -zStepInitial;

        const stripEndX = currentX + (stepSize - 1) * xStep;
        const clampedStripEndX = xStep > 0 ? Math.min(stripEndX, endX) : Math.max(stripEndX, endX);

        let rowIndex = 0;

        for (let z = zStart; (zStep > 0 && z <= zEnd) || (zStep < 0 && z >= zEnd); z += zStep) {
            if (!State.isActionRunning) {
                Chat.log('§c[Stop] Execution stopped by user');
                break;
            }

            const isRowForward = (rowIndex % 2 === 0);
            let localX = isRowForward ? currentX : clampedStripEndX;
            const localXEnd = isRowForward ? clampedStripEndX : currentX;
            const localXStep = isRowForward ? xStep : -xStep;

            for (; (localXStep > 0 && localX <= localXEnd) || (localXStep < 0 && localX >= localXEnd); localX += localXStep) {
                waitIfPaused();

                if (!moveToBlock(localX + 0.5, startPos[1] + 0.5, z + 0.5)) {
                    Chat.log(`§c[Warning] Failed to reach ${localX},${startPos[1]},${z}`);
                    continue;
                }

                checkAndRefillItem(chestPos, itemNames);

                Player.getInteractionManager().interactBlock(localX, startPos[1], z, 1, false);
                Client.waitTick(FERTILIZE_WAIT_TICKS);

                processedBlocks++;
                if (processedBlocks % 300 === 0) {
                    Chat.log(`§b[Progress] ${processedBlocks}/${totalBlocks} blocks processed`);
                }
            }

            rowIndex++;
        }

        if (!State.isActionRunning) {
            break;
        }

        currentX += stepSize * xStep;
        group++;
    }

    State.isActionRunning = false;
    scriptState = "MODE_SELECT";
    Chat.log(`§a${actionType} completed. Choose again.`);
}



// 物品数量预设值 (保持不变)
const REFILL_THRESHOLD = 6;
const REFILL_WAIT_TICKS = 16;
const FERTILIZE_WAIT_TICKS = 1;

// 坐标和事件处理 (修改为单一事件监听器和状态机)
const posCon = [];

Chat.log(Chat.createTextBuilder().append("Click on the first block to set seed_chest position").withColor(0x2).build());

const mainEventListener = JsMacros.on("Key", JavaWrapper.methodToJava((event, ctx) => {
    if (event.key == "key.mouse.left" && event.action == 1) {
        if (scriptState === "GET_POS_CHEST") {
            event.cancel();
            ctx.releaseLock();
            const block = Player.getInteractionManager().getTargetedBlock().toPos3D();
            if (block != null) {
                Chat.log(Chat.createTextBuilder().append(`Seed_chest position set to: (${block.x}, ${block.y}, ${block.z})`).withColor(0x2).build());
                posCon[0] = [block.x, block.y, block.z];
                scriptState = "GET_POS_START"; // 更新状态为获取起始位置
                Chat.log(Chat.createTextBuilder().append("Now click on the second block as the starting point").withColor(0x2).build());
            }
        } else if (scriptState === "GET_POS_START") {
            event.cancel();
            ctx.releaseLock();
            const block = Player.getInteractionManager().getTargetedBlock().toPos3D();
            if (block != null) {
                Chat.log(Chat.createTextBuilder().append(`Starting point set to: (${block.x}, ${block.y}, ${block.z})`).withColor(0x2).build());
                posCon[1] = [block.x, block.y, block.z];
                scriptState = "MODE_SELECT"; // 更新状态为模式选择
                Chat.log(Chat.createTextBuilder().append("Positions set. Press 1 for placing soil, 2 for fertilizing, 3 for planting seeds.").withColor(0x2).build());
            }
        }
    } else if (event.action == 1 && scriptState === "MODE_SELECT" && !State.isActionRunning) { // 模式选择按键，且没有动作正在运行
        if (event.key == "key.keyboard.1") {
            State.isActionRunning = true;
            Chat.log("§aStarting soil placement...");
            const start = posCon[1];
            const end = [276, 56, 329]; // 保持硬编码的 end 坐标
            const chest1 = [220, 55, 397]; // 培养土箱子
            const chest1_1 = [220, 58, 398]; // 清空背包的 培养土箱子
            const itemsToTransfer = ["Bag o' Soil"]; // 转移物品列表
            snakeWalk(start, end, chest1, itemsToTransfer, "Soil placement"); // 传递 actionType
            transferItemsToChest(chest1_1, itemsToTransfer);
            eat();
        } else if (event.key == "key.keyboard.2") {
            State.isActionRunning = true;
            Chat.log("§aStarting fertilizing...");
            const start = posCon[1];
            const end = [276, 56, 329]; // 保持硬编码的 end 坐标
            const chest2 = [221, 55, 397]; // 肥料箱子
            const chest2_1 = [222, 58, 399]; // 清空背包的 肥料箱子
            const itemsToTransfer = ["Produce Multiplier Fertilizer"]; // 转移物品列表
            snakeWalk(start, end, chest2, itemsToTransfer, "Fertilizing"); // 传递 actionType
            transferItemsToChest(chest2_1, itemsToTransfer);
            eat();
        } else if (event.key == "key.keyboard.3") {
            State.isActionRunning = true;
            Chat.log("§aStarting planting seeds...");
            const start = posCon[1];
            const end = [276, 56, 329]; // 保持硬编码的 end 坐标
            const chest3 = posCon[0];      // 种子箱子 (使用之前获取的种子箱子位置)
            const chest3_1 = [chest3[0], chest3[1]+4, chest3[2]+2]; // 清空背包的 种子箱子
            const itemsToTransfer = ["Apple Seeds", "Mango Pit", "Banana Seeds"]; // 转移物品列表
            snakeWalk(start, end, chest3, itemsToTransfer, "Planting seeds"); // 传递 actionType
            transferItemsToChest(chest3_1, itemsToTransfer);
            eat();
        }
    } else if (event.action == 1 && scriptState === "MODE_SELECT" && State.isActionRunning) {
        if (event.key == "key.keyboard.1" || event.key == "key.keyboard.2" || event.key == "key.keyboard.3") {
            Chat.log("§cAnother action is already running. Please wait until it finishes.");
        }
    }
}));

//TODO 1. jump的问题  2. 继续测试平滑视角 3.