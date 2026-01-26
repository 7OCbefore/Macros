
/*
思路:
2024-08-14：可以改为站在最中间一列X，每个Z交互5个X
*/

/*
实现:
2024-08-10 对速度进行了优化,现在遍历完一片田只需要不到一半的时间
2024-08-13 增加了收菜时,背包满了将物品放入指定的箱子的功能
2024-08-15 实现了一次收一行（5格）
*/

Hud.clearDraw3Ds();

const FarmIterator = require('../core/FarmIterator.js');
const CorePoint3D = require('../core/Point3D.js');
const MovementService = require('./services/MovementService.js');

// --- Constants ---

const Config = {
    CLOSE_KEY: "key.keyboard.x",
    STEP_SIZE: 5,
    CONTAINER_WAIT_TIMEOUT: 100,
    EAT_WAIT_TICKS: 66,
    POST_EAT_WAIT_TICKS: 20,
    CHEST_WAIT_TICKS: 34,
    INV_CLOSE_WAIT_TICKS: 6,
    ATTACK_WAIT_TICKS: 1,
    MOVE_WAIT_TICKS: 1,
    LOOK_SMOOTH_SPEED: 0.25,
};

const movementService = new MovementService({
    timings: {
        moveWaitTicks: Config.MOVE_WAIT_TICKS,
        lookSmoothSpeed: Config.LOOK_SMOOTH_SPEED
    },
    thresholds: {
        playerReach: 3,
        stuckJumpThreshold: 20
    }
});




// --- State ---
let State = {
    lastUsedChestIndex: 0,
};

// --- Data Structures ---
/**
 * @typedef {object} Point3D
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @type {Point3D}
 */
const Point3D = (x, y, z) => ({ x, y, z });


// --- Game Configuration ---
const GameConfig = {
    START_POS: Point3D(266, 56, 329), // Example, will be set by user click
    END_POS: Point3D(276, 56, 329),
    CHEST_POSES: [
        Point3D(227, 56, 398),
        Point3D(230, 56, 398),
        Point3D(233, 56, 398),
        Point3D(236, 56, 398),
    ],
    ITEMS_TO_TRANSFER: ["minecraft:paper", "minecraft:apple", "minecraft:bread"],
    TARGET_PLAYER_NAME: "7OCbefore",
};


JsMacros.on("Key", JavaWrapper.methodToJava((e, ctx) => {
    if (e.key === Config.CLOSE_KEY) {
        Chat.log('Script stopped.');
        JavaWrapper.stop();
    }
}));

// 饿了吃饭
function eat() {
    const player = Player.getPlayer();
    let foodLevel = player.getFoodLevel();

    if (foodLevel >= 20) {
        return; // 饱食度足够，不需要吃
    }

    Chat.log(`foodLevel is ${foodLevel} now, eating~`);

    while (foodLevel < 20) {
        player.lookAt("up");
        KeyBind.key('key.mouse.right', true);
        Client.waitTick(Config.EAT_WAIT_TICKS);
        KeyBind.key('key.mouse.right', false);

        Client.waitTick(Config.POST_EAT_WAIT_TICKS);
        foodLevel = player.getFoodLevel();

        Chat.log(`foodLevel is now ${foodLevel}`);
        if (foodLevel >= 20) {
            Chat.log("Food level reached 20 or more, stopped eating.");
            break;
        }
    }
}

// Function to move to a specific block
function moveToBlock(targetPoint) {
    const pos = new CorePoint3D(targetPoint.x, targetPoint.y, targetPoint.z);
    movementService.moveTo(pos);
}


// Function to check if the inventory is full
function isInventoryFull() {
    const inv = Player.openInventory();
    const mainStartIndex = inv.getMap().main?.at(0);
    for (let i = mainStartIndex; i < mainStartIndex + 36; i++) {
        if (inv.getSlot(i).isEmpty()) {
            return false;
        }
    }
    return true;
}


function transferItemsToChest(chestPoses, itemsToTransfer) {
    const player = Player.getPlayer();

    KeyBind.keyBind("key.attack", false);
    Client.waitTick(5);

    for (let i = 0; i < chestPoses.length; i++) {
        // 从上次使用的箱子开始
        const currentIndex = (State.lastUsedChestIndex + i) % chestPoses.length;
        const chestPos = chestPoses[currentIndex];

        // 防止attack时间过长打碎方块
        // 最好聚焦在minecraft窗口，甚至别打开聊天框，esc 等GUI
        moveToBlock(Point3D(chestPos.x + 0.5, chestPos.y + 0.5, chestPos.z + 0.5));

        Player.getInteractionManager().interactBlock(chestPos.x, chestPos.y, chestPos.z, player.getFacingDirection().getName(), false);

        // 循环等待，直到容器界面打开或超时
        let timeout = Config.CONTAINER_WAIT_TIMEOUT;
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
        for (let j = 0; j < chestEndIndex; j++) {
            if (inv.getSlot(j).getItemId() === "minecraft:air") {
                emptySlots++;
            }
        }

        // 如果当前箱子有空槽，则进行物品转移
        if (emptySlots > 0) {
            let itemSlots = [];
            for (let j = mainStartIndex; j < mainStartIndex + 36; j++) {
                if (itemsToTransfer.includes(inv.getSlot(j).getItemId())) {
                    itemSlots.push(j);
                }
            }

            while (emptySlots > 0 && itemSlots.length > 0) {
                inv.quick(itemSlots.pop());
                Client.waitTick();
                emptySlots--;
            }

            // 更新上次使用的箱子索引
            State.lastUsedChestIndex = currentIndex;
            // 通常来说准备的箱子足够装下所有物品，如果中间出问题将最后一个箱子装满的话，就再从第一个箱子开始检查
            if (State.lastUsedChestIndex === chestPoses.length - 1) {
                State.lastUsedChestIndex = 0;
            }
            Client.waitTick(Config.CHEST_WAIT_TICKS);
            inv.closeAndDrop();
            Client.waitTick(Config.INV_CLOSE_WAIT_TICKS);

            // 如果还有空位，说明物品已全部转移完毕，可以退出循环
            if (emptySlots > 0) {
                break;
            }
        } else {
            // 如果当前箱子已满，关闭箱子并继续下一个
            Client.waitTick(Config.INV_CLOSE_WAIT_TICKS);
            inv.closeAndDrop();
        }
    }
}

function snakeWalk(startPos, endPos, chestPos, itemsToTransfer, playerName) {
    const iterator = new FarmIterator(
        new CorePoint3D(startPos.x, startPos.y, startPos.z),
        new CorePoint3D(endPos.x, endPos.y, endPos.z),
        Config.STEP_SIZE
    );

    for (const pos of iterator.iterate()) {
        moveToBlock(Point3D(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5));
        Player.getInteractionManager().attack(pos.x, pos.y, pos.z, 1, false);
        Client.waitTick(Config.ATTACK_WAIT_TICKS);

        if (isInventoryFull()) {
            transferItemsToChest(chestPos, itemsToTransfer);
        }
    }
}


// Prompt for user to select starting block
const posCon = [];
Chat.log(Chat.createTextBuilder().append("Click on the first block as the starting point").withColor(0x2).build());
const click_event = JsMacros.on("Key", true, JavaWrapper.methodToJava((event, ctx) => {
    if (event.key === "key.mouse.left" && event.action === 1) {
        event.cancel();
        ctx.releaseLock();
        const block = Player.getInteractionManager().getTargetedBlock().toPos3D();
        if (block != null) {
            posCon.push([block.x, block.y, block.z]);
            Chat.log(Chat.createTextBuilder().append(`Block selected at: (${block.x}, ${block.y}, ${block.z})`).withColor(0x2).build());
            click_event.off();

            // Update start position from user click
            GameConfig.START_POS = Point3D(posCon[0][0], posCon[0][1], posCon[0][2]);

            // Perform snake-like traversal and transfer items if inventory is full
            snakeWalk(GameConfig.START_POS, GameConfig.END_POS, GameConfig.CHEST_POSES, GameConfig.ITEMS_TO_TRANSFER, GameConfig.TARGET_PLAYER_NAME);
            transferItemsToChest(GameConfig.CHEST_POSES, GameConfig.ITEMS_TO_TRANSFER);
            eat();

        }
    }
}));
