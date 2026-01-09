/*
2024-08-10 对速度进行了优化，现在遍历完一片田只需要不到一半的时间
2024-08-12 增加了自动补货功能。去除了依赖于inv...mod的自动补货功能。这一改动主要是为了避免在快速进行种植操作时，
来自inv的补货指令频繁而导致的冲突。
*/

Hud.clearDraw3Ds();

// 脚本状态控制
var isPaused = false;
var closeKey = "key.keyboard.x";
var pauseKey = "key.keyboard.z";

// 暂停/继续功能
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
        Client.waitTick(1);
    }
}

function harvestCrops() {
    waitIfPaused();
    const player = Player.getPlayer();
    const inv = Player.openInventory();
    const mainHandItem = player.getMainHand();
    const mainHandItemId = "minecraft:paper";

    // 检查物品数量
    if (mainHandItem.getCount() <= REFILL_THRESHOLD) {
        waitIfPaused();
        Chat.log(`Item count is low. Attempting to refill item with ID: ${mainHandItemId}`);
        refillItem();
    }

    // 收割逻辑
    const start = [220, 55, 397];
    const end = [276, 56, 329];
    snakeWalk(start, end);
}

function refillItem() {
    waitIfPaused();
    const player = Player.getPlayer();
    const inv = Player.openInventory();
    const mainHandItemId = "minecraft:paper";

    const itemSlots = inv.findItem(mainHandItemId);
    let selectedSlot = -1;
    
    for (const slot of itemSlots) {
        waitIfPaused();
        const slotItemCount = inv.getSlot(slot).getCount();
        if (slotItemCount > REFILL_THRESHOLD) {
            selectedSlot = slot;
            break;
        }
    }

    if (selectedSlot !== -1) {
        waitIfPaused();
        inv.swapHotbar(selectedSlot, inv.getSelectedHotbarSlotIndex());
        Client.waitTick(16);
    }
}

function snakeWalk(startPos, endPos) {
    waitIfPaused();
    const startX = startPos[0];
    const endX = endPos[0];
    const startZ = startPos[2];
    const endZ = endPos[2];

    const xStep = Math.sign(endX - startX);
    const zStepInitial = Math.sign(endZ - startZ);

    let currentX = startX;
    let group = 0;
    let stepSize = 5;

    while ((xStep > 0 && currentX <= endX) || (xStep < 0 && currentX >= endX)) {
        const middleX = currentX + xStep * Math.floor(5 / 2);

        const zStart = (group % 2 === 0) ? startZ : endZ;
        const zEnd = (zStart === startZ) ? endZ : startZ;
        const zStep = (zStart === startZ) ? zStepInitial : -zStepInitial;

        for (let z = zStart; (zStep > 0 && z <= zEnd) || (zStep < 0 && z >= zEnd); z += zStep) {
            for (let localX = currentX;
                (xStep > 0 && localX < currentX + 5 * xStep && localX <= endX) ||
                (xStep < 0 && localX > currentX + 5 * xStep && localX >= endX);
                localX += xStep) {
                waitIfPaused();

                moveToBlock(localX + 0.5, startPos[1] + 0.5, z + 0.5);
                Player.getInteractionManager().interactBlock(localX, startPos[1], z, 1, false);
                Client.waitTick(HARVEST_WAIT_TICKS);
            }
        }

        currentX += stepSize * xStep;
        group++;
    }
}

function moveToBlock(x, y, z) {
    waitIfPaused();
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

    while (distance > 3) {
        waitIfPaused();
        player.lookAt(targetX, targetY, targetZ);

        currentX = player.getX();
        currentY = player.getY();
        currentZ = player.getZ();
        dx = targetX - currentX;
        dz = targetZ - currentZ;
        distance = Math.sqrt(dx * dx + dz * dz);
        KeyBind.keyBind("key.forward", true);
        KeyBind.keyBind("key.sprint", true);
        Client.waitTick(1);
    }
    KeyBind.keyBind("key.forward", false);
}

// 物品数量预设值
const REFILL_THRESHOLD = 6;
const HARVEST_WAIT_TICKS = 1;

// 鼠标左键点击获取坐标
const posCon = [];

Chat.log(Chat.createTextBuilder().append("Click on the first block to set seed_chest position").withColor(0x2).build());

const click_event = JsMacros.on("Key", true, JavaWrapper.methodToJava((event, ctx) => {
    if (event.key == "key.mouse.left" && event.action == 1) {
        event.cancel();
        ctx.releaseLock();
        const block = Player.getInteractionManager().getTargetedBlock().toPos3D();
        if (block != null) {
            if (posCon.length === 0) {
                Chat.log(Chat.createTextBuilder().append(`Seed_chest position set to: (${block.x}, ${block.y}, ${block.z})`).withColor(0x2).build());
                Chat.log(Chat.createTextBuilder().append("Now click on the second block as the starting point").withColor(0x2).build());
                posCon.push([block.x, block.y, block.z]);
            } else if (posCon.length === 1) {
                Chat.log(Chat.createTextBuilder().append(`Starting point set to: (${block.x}, ${block.y}, ${block.z})`).withColor(0x2).build());
                posCon.push([block.x, block.y, block.z]);
                click_event.off();

                harvestCrops();
            }
        }
    }
}));
