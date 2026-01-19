Hud.clearDraw3Ds();
// 脚本状态控制
var isPaused = false;
var closeKey = "key.keyboard.x";
var pauseKey = "key.keyboard.z";

// 暂停/继续功能
JsMacros.on("Key", JavaWrapper.methodToJava((e, ctx) => {
    if (e.key === closeKey) {
        Chat.log('脚本关闭了。');
        JavaWrapper.stop();
    }
    if (e.key === pauseKey && e.action === 1) {
        isPaused = !isPaused;
        Chat.log(isPaused ? '脚本已暂停' : '脚本已继续');
    }
}));

function waitIfPaused() {
    while (isPaused) {
        Client.waitTick(20);
    }
}

// 朝目标方块移动
function moveToBlock(x, y, z) {
    const player = Player.getPlayer();
    var targetX = x;
    var targetY = y;
    var targetZ = z;

    player.lookAt(targetX, targetY, targetZ);
    var distance = player.distanceTo(targetX, targetY, targetZ);
    
    while (player.distanceTo(targetX, targetY, targetZ) > 4) {
        player.lookAt(targetX, targetY, targetZ);
        distance = player.distanceTo(targetX, targetY, targetZ);
        KeyBind.keyBind("key.forward", true);
        KeyBind.keyBind("key.sprint", true);
        Client.waitTick(1);
    }
    KeyBind.keyBind("key.forward", false);
}

// 查找中心点的函数
function findCenters(start, end) {
    const centers = [];
    const stepSize = 5;
    
    let minX = Math.min(start[0], end[0]);
    let maxX = Math.max(start[0], end[0]);
    let minZ = Math.min(start[2], end[2]);
    let maxZ = Math.max(start[2], end[2]);
    
    let x = minX + 2;
    let z = minZ + 2;
    let goingRight = true;

    while (z <= maxZ - 2) {
        if (goingRight) {
            while (x <= maxX - 2) {
                centers.push([x, start[1], z]);
                x += stepSize;
            }
            x = maxX - 2;
        } else {
            while (x >= minX + 2) {
                centers.push([x, start[1], z]);
                x -= stepSize;
            }
            x = minX + 2;
        }
        z += stepSize;
        goingRight = !goingRight;
    }

    return centers;
}

// 浇水壶位置
const wateringCanPos = [207, 56, 397];
const wateringCanItemName = "Wooden Watering Can";

// 去指定位置拿浇水壶
function pickupWateringCan(pos) {
    const player = Player.getPlayer();

    // 移动到箱子位置
    moveToBlock(pos[0], pos[1], pos[2]);

    // 打开箱子
    const interactionMgr = Player.getInteractionManager();
    interactionMgr.interactBlock(pos[0], pos[1], pos[2], player.getFacingDirection().getName(), false);
    Client.waitTick(40);

    // 打开箱子界面
    const chestInv = Player.openInventory();

    // 查找浇水壶
    const slots = chestInv.getTotalSlots();
    let wateringCanSlot = -1;

    for (let i = 0; i < slots; i++) {
        const item = chestInv.getSlot(i);
        if (item && !item.isEmpty()) {
            const displayName = item.getName().getString();
            // 移除颜色代码后比较名称
            const cleanName = displayName.replace(/§[0-9A-FK-OR]/gi, "").trim();
            if (cleanName === wateringCanItemName) {
                wateringCanSlot = i;
                break;
            }
        }
    }

    if (wateringCanSlot !== -1) {
        // 快速移动浇水壶到玩家背包
        chestInv.quick(wateringCanSlot);
        Chat.log(`§a[浇水] 已拿取 ${wateringCanItemName}`);
    } else {
        Chat.log(`§c[浇水] 未在箱子中找到 ${wateringCanItemName}`);
    }

    // 关闭箱子
    chestInv.closeAndDrop();
    Client.waitTick(10);
}

// 装备浇水壶到主手
function equipWateringCanToMainHand() {
    const inv = Player.openInventory();

    // 查找浇水壶在背包中的位置
    const slots = inv.getTotalSlots();
    let wateringCanSlot = -1;

    for (let i = 0; i < slots; i++) {
        const item = inv.getSlot(i);
        if (item && !item.isEmpty()) {
            const displayName = item.getName().getString();
            const cleanName = displayName.replace(/§[0-9A-FK-OR]/gi, "").trim();
            if (cleanName === wateringCanItemName) {
                wateringCanSlot = i;
                break;
            }
        }
    }

    if (wateringCanSlot !== -1) {
        const currentHotbarIndex = inv.getSelectedHotbarSlotIndex();
        // 如果不在当前快捷栏，移动到快捷栏第9个槽位（索引8）
        if (wateringCanSlot !== 8) {
            inv.swapHotbar(wateringCanSlot, 8);
        }
        // 选中第9个快捷栏槽位
        inv.setSelectedHotbarSlotIndex(8);
        Client.waitTick(5);
        Chat.log(`§a[浇水] 已将 ${wateringCanItemName} 装备到主手`);
    } else {
        Chat.log(`§c[浇水] 背包中未找到 ${wateringCanItemName}`);
    }
}

// 对植物进行浇水操作
function waterPlants(start, end) {
    const player = Player.getPlayer();

    // 先去拿浇水壶
    pickupWateringCan(wateringCanPos);

    // 装备浇水壶到主手
    equipWateringCanToMainHand();

    const centers = findCenters(start, end);

    for (let i = 0; i < centers.length; i++) {
        waitIfPaused();
        const center = centers[i];
        const waterSource = [center[0], center[1] + 4, center[2]];

        moveToBlock(waterSource[0] + 0.5, waterSource[1] + 0.5, waterSource[2] + 0.5);
        Client.waitTick(2);
        Player.getInteractionManager().interactBlock(waterSource[0], waterSource[1], waterSource[2], 0, false);
        Client.waitTick(2);

        player.lookAt(center[0] + 0.5, center[1] + 0.5, center[2] + 0.5);
        Client.waitTick(2);
        Player.getInteractionManager().interactBlock(center[0], center[1], center[2], 1, false);
        Client.waitTick(2);

    }
}

// 两对角的坐标点确定区域
const start = [207, 56, 393];
const end = [276, 56, 329];

// 执行浇水操作
waterPlants(start, end);