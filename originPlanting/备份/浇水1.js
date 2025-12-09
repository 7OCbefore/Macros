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

// 对植物进行浇水操作
function waterPlants(start, end) {
    const player = Player.getPlayer();
    // 将当前选中的快捷栏槽位改为第九个（索引为8）
    const inv = Player.openInventory();
    inv.setSelectedHotbarSlotIndex(8);
    Client.waitTick();
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